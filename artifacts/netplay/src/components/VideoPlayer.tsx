import React, { useState, useEffect, useRef, useMemo } from 'react';
import screenfull from 'screenfull';
import NetflixPlayer from './NetflixPlayer';
import { Movie, RoomEvent, AppSettings } from '../types';
import { supabase } from '../lib/supabase';
import { isDynamicRef, parseDynamicRef } from '../services/terabox';

interface VideoPlayerProps {
  movie: Movie;
  onClose: () => void;
  profileId?: string;
  profile?: any;
  roomId?: string;
  isHost?: boolean;
  onPlayNext?: (movie: Movie, episodeUrl: string, episodeIndex?: number) => void;
  recommendations?: Movie[];
  onProgress?: (movieId: string | number, time: number, episodeUrl?: string) => void;
  appSettings?: AppSettings;
  initialTime?: number;
  initialPlayerStyle?: 'netflix' | 'standard' | 'special' | 'betterflix' | string;
  initialEpisodeIndex?: number;
  isBackgroundMode?: boolean;
  onClickBackground?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, onClose, profileId, profile, roomId, isHost, onPlayNext, recommendations = [], onProgress, appSettings, initialTime, initialPlayerStyle, initialEpisodeIndex, isBackgroundMode, onClickBackground }) => {
  const [orientationKey, setOrientationKey] = useState(0);
  const [playerStyle, setPlayerStyle] = useState<'netflix' | 'standard' | 'special' | 'betterflix' | null>((initialPlayerStyle as any) || 'netflix');
  const [drivePlayMethod, setDrivePlayMethod] = useState<'api' | 'uc' | 'iframe'>('api');
  const [isAutoProCascade, setIsAutoProCascade] = useState(initialPlayerStyle === 'netflix-cascade');
  const getInitialExtracted = (type: 'video' | 'subtitle') => {
    let url = movie.videoUrl || '';
    const isKing = url.includes('player.kingx.dev') || url.includes('teradl.kingx.dev');

    if (isKing) {
      try {
        // Format 1: player.kingx.dev/#video_url=<encoded>&subtitle_url=<encoded>&expires=...
        // IMPORTANT: Use URLSearchParams to correctly handle %26 inside the video URL value.
        // Manual regex with %26→& replacement would break the m3u8 URL query params.
        if (url.includes('player.kingx.dev') && url.includes('#')) {
          const hash = url.split('#')[1] || '';
          const params = new URLSearchParams(hash);
          if (type === 'video') {
            const v = params.get('video_url');
            if (v) return v;
          } else {
            const s = params.get('subtitle_url');
            if (s) return s;
          }
        }

        // Format 2: player.kingx.dev/?url=<encoded> (older format)
        if (url.includes('player.kingx.dev') && url.includes('url=') && type === 'video') {
          const params = new URLSearchParams(url.split('?')[1] || '');
          const v = params.get('url');
          if (v) return v;
        }

        // Format 3: direct teradl.kingx.dev m3u8 URL — already playable as-is
        if (url.includes('teradl.kingx.dev') && url.includes('.m3u8') && type === 'video') {
          return url;
        }
      } catch (e) {}
      return null;
    }

    return null;
  };

  const [extractedVideoUrl, setExtractedVideoUrl] = useState<string | null>(getInitialExtracted('video'));
  const [extractedSubtitleUrl, setExtractedSubtitleUrl] = useState<string | null>(getInitialExtracted('subtitle'));
  const [isExtractingTerabox, setIsExtractingTerabox] = useState(false);
  const [extractedQualities, setExtractedQualities] = useState<{ id: string; label: string; url: string }[]>([]);
  const [dubbingOptions, setDubbingOptions] = useState<{ id: string; label: string; url: string }[]>([]);

  // BetterFlix stream resolution
  const [bfStreamUrl, setBfStreamUrl] = useState<string | null>(null);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfFailed, setBfFailed] = useState(false);
  
  const [emotes, setEmotes] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
  const probeAbortRef = useRef<AbortController | null>(null);
  const lastSyncTime = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Episódios ordenados por temporada→número — usado em TODOS os lookups por índice.
  // initialEpisodeIndex passado pelo modal já usa essa mesma ordem.
  const sortedEpisodes = useMemo(() => {
    if (!movie.episodes || movie.episodes.length === 0) return [];
    return [...movie.episodes].sort((a: any, b: any) => {
      const sa = (a.season || 1) - (b.season || 1);
      return sa !== 0 ? sa : (a.episode || 0) - (b.episode || 0);
    });
  }, [movie.episodes]);

  const driveApiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;

  const [movieLogo, setMovieLogo] = useState<string | null>(movie.logo_path || null);

  useEffect(() => {
    if (!movieLogo && movie.id) {
       // Tenta buscar o logo (como é para TMDB, verificamos primeiro tv, depois movie)
       import('../services/tmdb').then(({ getMovieLogo }) => {
         getMovieLogo(movie.id, (movie as any).name ? 'tv' : 'movie').then(logo => {
           if (logo) setMovieLogo(logo);
           else {
             getMovieLogo(movie.id, (movie as any).name ? 'movie' : 'tv').then(logo2 => {
               if (logo2) setMovieLogo(logo2);
             });
           }
         });
       });
    }
  }, [movie.id, movieLogo]);

  // Track progress on unmount
  useEffect(() => {
    return () => {
      const finalTime = currentTimeRef.current;
      const finalDuration = durationRef.current;
      if (profileId && movie.id && finalTime > 0 && appSettings?.subscription_plan !== 'hub') {
        const isMovie = movie.type !== 'series';
        const isFinished = finalDuration > 0 && (isMovie ? (finalDuration - finalTime <= 450) : (finalDuration - finalTime <= 30));
        
        if (isFinished && isMovie) {
           supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id }).then(() => {});
        } else if (isFinished && !isMovie) {
           const currentIndex = sortedEpisodes.findIndex(ep => ep.videoUrl === movie.videoUrl || ep.videoUrl2 === movie.videoUrl);
           const isLastEpisode = sortedEpisodes.length > 0 && currentIndex !== -1 && currentIndex === sortedEpisodes.length - 1;
           
           if (isLastEpisode) {
              supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id }).then(() => {});
           } else {
              const nextEp = sortedEpisodes.length > 0 && currentIndex !== -1 ? sortedEpisodes[currentIndex + 1] : null;
              if (nextEp) {
                 localStorage.setItem(`netplay_progress_url_${movie.id}`, nextEp.videoUrl || nextEp.videoUrl2 || '');
              }
              const nextUrl = nextEp ? (nextEp.videoUrl || nextEp.videoUrl2 || '') : '';
              supabase.from('watch_history').upsert({
                profile_id: profileId,
                movie_id: movie.id,
                last_position: 0,
                episode_url: nextUrl || undefined,
                updated_at: new Date().toISOString()
              }, { onConflict: 'profile_id,movie_id' }).then(() => {});
           }
        } else {
           const currentEpUrl = movie.videoUrl || '';
           supabase.from('watch_history').upsert({
             profile_id: profileId,
             movie_id: movie.id,
             last_position: finalTime,
             ...(currentEpUrl ? { episode_url: currentEpUrl } : {}),
             updated_at: new Date().toISOString()
           }, { onConflict: 'profile_id,movie_id' }).then(() => {});
        }
      }
    };
  }, [profileId, movie.id, movie.type, appSettings?.subscription_plan]);

  useEffect(() => {
    const currentUrl = movie.videoUrl || '';
    if (movie.id && currentUrl) {
      localStorage.setItem(`netplay_progress_url_${movie.id}`, currentUrl);
    }
  }, [movie.id, movie.videoUrl]);

  useEffect(() => {
    const saveToHistory = async () => {
      if (!profileId || !movie.id) return;
      if (appSettings?.subscription_plan === 'hub') return;
      
      try {
        const { error } = await supabase
          .from('watch_history')
          .upsert({
            profile_id: profileId,
            movie_id: movie.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'profile_id,movie_id' });

        if (error) throw error;
      } catch (error) {
        console.error('Erro ao salvar histórico:', error);
      }
    };

    saveToHistory();
  }, [profileId, movie.id]);

  useEffect(() => {
    if (!roomId) return;
    if (playerStyle === 'netflix') return; // NetflixPlayer handles its own sync

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: profileId || 'anonymous',
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setParticipants(Object.values(state).flat());
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }: { payload: RoomEvent }) => {
        handleRoomEvent(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: profileId,
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, profileId]);

  const handleRoomEvent = (event: RoomEvent) => {
    if (event.sender_id === profileId) return;

    switch (event.type) {
      case 'play':
        if (videoRef.current?.paused) videoRef.current?.play();
        break;
      case 'pause':
        if (!videoRef.current?.paused) videoRef.current?.pause();
        break;
      case 'seek':
        if (videoRef.current) {
          videoRef.current.currentTime = event.payload.time;
        }
        break;
      case 'emote':
        addEmote(event.payload.emoji);
        break;
    }
  };

  const broadcastEvent = (type: RoomEvent['type'], payload?: any) => {
    if (!roomId || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type, payload, sender_id: profileId },
    }).catch(() => {});
  };

  const addEmote = (emoji: string) => {
    const id = Math.random().toString(36).substring(7);
    const x = 20 + Math.random() * 60; // 20% to 80%
    const y = 20 + Math.random() * 60;
    setEmotes(prev => [...prev, { id, emoji, x, y }]);
    setTimeout(() => {
      setEmotes(prev => prev.filter(e => e.id !== id));
    }, 3000);
  };

  const sendEmote = (emoji: string) => {
    addEmote(emoji);
    broadcastEvent('emote', { emoji });
    setShowEmotePicker(false);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomId) return;

    const onPlay = () => broadcastEvent('play');
    const onPause = () => broadcastEvent('pause');
    const onSeeked = () => broadcastEvent('seek', { time: video.currentTime });

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [roomId]);

  const extractDriveId = (url: string) => {
    const match = url.match(/(?:file\/d\/|id=)([-\w]{25,})/);
    if (match) return match[1];
    const fallbackMatch = url.match(/[-\w]{25,}/);
    return fallbackMatch ? fallbackMatch[0] : null;
  };

  const extractYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const url = movie.videoUrl || '';
  const isDriveVideo = url.includes('drive.google.com');
  const isGooglePhotos = url.includes('photos.google.com') || url.includes('photos.app.goo.gl');
  const isTeraBox = url.includes('terabox.com') || url.includes('teraboxapp.com') || url.includes('dubox.com') || url.includes('nephobox.com') || url.includes('1024terabox.com') || url.includes('freeterabox.com') || url.includes('4funbox.com') || url.includes('mirrobox.com') || url.includes('momerybox.com') || url.includes('teraboxlink.com') || url.includes('terafileshare.com');
  const isKingX = url.includes('player.kingx.dev') || url.includes('teradl.kingx.dev');
  const isGDPlayer = url.includes('gdplayer.to') || url.includes('gdplayer.org');
  const driveId = isDriveVideo ? extractDriveId(url) : null;

  // Extração inicial foi migrada para estado síncrono.
  
  // Lógica de fallback para Google Drive
  useEffect(() => {
    if (isDriveVideo && !driveApiKey && drivePlayMethod === 'api') {
      setDrivePlayMethod('uc');
    }
  }, [isDriveVideo, driveApiKey, drivePlayMethod]);

  const getDriveUrl = () => {
    if (!driveId) return null;
    if (drivePlayMethod === 'api' && driveApiKey) {
      return `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media&key=${driveApiKey}`;
    }
    if (drivePlayMethod === 'uc') {
      return `https://drive.google.com/uc?export=download&id=${driveId}`;
    }
    return null;
  };

  const getInitialFinalVideoUrl = () => {
    const defaultUrl = movie.videoUrl || '';
    const isDrive = defaultUrl.includes('drive.google.com');
    const dId = isDrive ? extractDriveId(defaultUrl) : null;
    if (isDrive && dId) return `/api/stream/${dId}`;
    return defaultUrl;
  };

  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(getInitialFinalVideoUrl);

  useEffect(() => {
    setFinalVideoUrl(getInitialFinalVideoUrl());
  }, [movie.id, movie.videoUrl]);

  // Resolve BetterFlix stream URL para usar no NetflixPlayer nativo
  useEffect(() => {
    const currentUrl = movie.videoUrl || '';
    const isBF = currentUrl.includes('betterflix.click') || initialPlayerStyle === 'betterflix';
    if (!isBF) {
      setBfStreamUrl(null);
      setBfLoading(false);
      setBfFailed(false);
      return;
    }

    let id: string, type: string, season: string, episode: string;
    if (currentUrl.includes('betterflix.click')) {
      try {
        const urlParams = new URLSearchParams(currentUrl.split('?')[1] || '');
        id = urlParams.get('id') || String(movie.id);
        type = urlParams.get('type') || (movie.type === 'series' ? 'tv' : 'movie');
        season = urlParams.get('season') || '1';
        episode = urlParams.get('episode') || '1';
      } catch {
        id = String(movie.id);
        type = movie.type === 'series' ? 'tv' : 'movie';
        season = '1';
        episode = '1';
      }
    } else {
      id = String(movie.id);
      type = movie.type === 'series' ? 'tv' : 'movie';
      season = '1';
      episode = '1';
    }

    setBfLoading(true);
    setBfStreamUrl(null);
    setBfFailed(false);

    const abort = new AbortController();
    fetch(
      `/api/betterflix/stream?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&season=${encodeURIComponent(season)}&episode=${encodeURIComponent(episode)}`,
      { signal: abort.signal }
    )
      .then(r => r.json())
      .then(data => {
        if (abort.signal.aborted) return;
        if (data.streamUrl) {
          setBfStreamUrl(data.streamUrl);
        } else {
          setBfFailed(true);
        }
      })
      .catch(() => { if (!abort.signal.aborted) setBfFailed(true); })
      .finally(() => { if (!abort.signal.aborted) setBfLoading(false); });

    return () => abort.abort();
  }, [movie.id, movie.videoUrl, initialPlayerStyle]);

  // Pre-warm KingX/direct HLS URLs as soon as they are loaded so CDN edges are hot
  useEffect(() => {
    const u = movie.videoUrl || '';
    const isKingXUrl = u.includes('player.kingx.dev') || u.includes('teradl.kingx.dev');
    const isDirectHls = /^https?:\/\/.+\.m3u8/i.test(u);
    if ((isKingXUrl || isDirectHls) && u) {
      fetch('/api/keepwarm-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [u], concurrency: 1 }),
      }).catch(() => {});
    }
  }, [movie.id, movie.videoUrl]);

  useEffect(() => {
    const runExtraction = async () => {
      const u = movie.videoUrl || '';

      // Handle terabox-folder:// dynamic refs (format: "terabox-folder://folderUrl###filename")
      if (isDynamicRef(u)) {
        setIsExtractingTerabox(true);
        try {
          const { folderUrl, filename, v2, v3 } = parseDynamicRef(u);
          // Respeitar a API da URL: v1=Pro, v2=v2, v3=v3 — sem mistura entre APIs
          const endpoint = v3 ? '/api/terabox-v3' : v2 ? '/api/terabox-v2' : '/api/terabox-pro';

          // Honor preferredQuality from episode/movie — also match by filename for converted dynamic refs
          const urlMatchEp = movie.type === 'series' && movie.episodes
            ? movie.episodes.find(ep => {
                if (ep.videoUrl === u || ep.videoUrl2 === u) return true;
                if (isDynamicRef(u) && ep.videoUrl && isDynamicRef(ep.videoUrl)) {
                  try {
                    const { filename: epFn } = parseDynamicRef(ep.videoUrl);
                    const { filename: mvFn } = parseDynamicRef(u);
                    if (epFn && mvFn && epFn === mvFn) return true;
                  } catch {}
                }
                return false;
              })
            : null;
          const epPref = (urlMatchEp as any)?.preferredQuality;
          const moviePref = (movie as any).preferredQuality;
          const preferred: string | null = (epPref && epPref !== 'auto' && epPref !== 'stream') ? epPref
                           : (moviePref && moviePref !== 'auto' && moviePref !== 'stream') ? moviePref
                           : null;

          // Tenta resolver — se falhar ou voltar vazio, retenta com nocache=1 para pular cache
          // local do servidor (links Terabox às vezes ficam "presos" no cache enquanto o CDN
          // ainda não liberou o arquivo). Backoff curto entre tentativas.
          const fetchWithRetry = async () => {
            const tryOnce = async (ep: string, nocache: boolean) => {
              const qs = nocache ? `&nocache=1&_t=${Date.now()}` : '';
              const r = await fetch(`${ep}?url=${encodeURIComponent(folderUrl)}${qs}`);
              const d = await r.json().catch(() => ({}));
              return { r, d };
            };
            let { r, d } = await tryOnce(endpoint, false);
            const isEmpty = r.ok && (!Array.isArray(d.list) || d.list.length === 0);
            if (!r.ok || isEmpty) {
              console.warn(`[VideoPlayer] dyn-ref tentativa 1 falhou (status=${r.status}, vazio=${isEmpty}) — retry com nocache em 500ms`);
              await new Promise(res => setTimeout(res, 500));
              ({ r, d } = await tryOnce(endpoint, true));
            }
            // Se for endpoint v1 sem chave (503) ou sem resultados, tenta v3 como fallback
            const isMissingKey = r.status === 503;
            const isStillEmpty = r.ok && (!Array.isArray(d.list) || d.list.length === 0);
            if ((isMissingKey || isStillEmpty) && endpoint !== '/api/terabox-v3') {
              console.warn(`[VideoPlayer] dyn-ref ${endpoint} falhou/sem resultados — tentando fallback v3`);
              ({ r, d } = await tryOnce('/api/terabox-v3', false));
              if (!r.ok) {
                ({ r, d } = await tryOnce('/api/terabox-v3', true));
              }
              if (r.ok && Array.isArray(d.list) && d.list.length > 0) {
                (d as any)._source = 'v3-fallback';
              }
            }
            if (!r.ok) throw new Error(d?.error || `Falha ao resolver Terabox (${r.status})`);
            return d;
          };
          const data = await fetchWithRetry();

          const list: any[] = Array.isArray(data.list) ? data.list : [];
          if (list.length === 0) throw new Error('Pasta vazia ou expirada');
          if ((data as any)._source) console.log(`[VideoPlayer] dyn-ref resolvido via ${(data as any)._source}`);

          // Helper: extrai o nome do arquivo de qualquer campo possível da resposta da API
          // V1 (xapiverse) pode retornar em server_filename, V3 normaliza para filename
          const getFn = (f: any): string =>
            (f.server_filename || f.filename || f.name || '').trim();

          // Sort list by filename for consistent, deterministic ordering
          const sortedList = [...list].sort((a: any, b: any) => {
            const nameA = getFn(a).toLowerCase();
            const nameB = getFn(b).toLowerCase();
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
          });

          // Normalize filename for fuzzy matching (strip diacritics, collapse spaces, lowercase)
          const normFn = (s: string) =>
            s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase().trim();

          // Find file: exact → case-insensitive → normalized → episode code (SxxExx) partial match → initialEpisodeIndex → first
          let file: any = null;
          if (filename) {
            const normFilename = normFn(filename);
            file = sortedList.find(f => getFn(f) === filename)
                || sortedList.find(f => getFn(f).toLowerCase() === filename.toLowerCase())
                || sortedList.find(f => normFn(getFn(f)) === normFilename);
            if (!file) {
              const epCodeMatch = filename.match(/S(\d+)E(\d+)/i);
              if (epCodeMatch) {
                const targetCode = epCodeMatch[0].toUpperCase();
                file = sortedList.find(f => getFn(f).toUpperCase().includes(targetCode)) || null;
                if (file) console.log(`[VideoPlayer] dyn-ref: match parcial por código de episódio "${targetCode}" → ${getFn(file)}`);
              }
            }
            // Partial normalized match — strip extension and compare base names
            if (!file) {
              const baseFilename = normFilename.replace(/\.[^.]+$/, '');
              if (baseFilename.length > 4) {
                file = sortedList.find(f => {
                  const baseFn = normFn(getFn(f)).replace(/\.[^.]+$/, '');
                  return baseFn === baseFilename || baseFn.includes(baseFilename) || baseFilename.includes(baseFn);
                }) || null;
                if (file) console.log(`[VideoPlayer] dyn-ref: match parcial normalizado "${baseFilename}" → ${getFn(file)}`);
              }
            }
          }
          // Filtrar apenas arquivos de vídeo para o fallback por índice
          // (evita pegar legendas, thumbnails, etc. que quebrariam a correspondência posicional)
          const VIDEO_EXT_RE = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|mpg|mpeg|ts|m2ts|mts|vob|3gp|rmvb|rm|ogv|m3u8)$/i;
          const videoOnlyList = sortedList.filter((f: any) => VIDEO_EXT_RE.test(getFn(f)));
          const indexPool = videoOnlyList.length > 0 ? videoOnlyList : sortedList;

          // Fallback 1: look up episode metadata using SORTED episodes array (same sort as caller)
          // initialEpisodeIndex is now always the season→episode sorted position passed from MovieDetailsModal
          if (!file && initialEpisodeIndex !== undefined && initialEpisodeIndex >= 0) {
            // Sort movie.episodes by season then episode number to match the index passed by the UI
            const sortedEps = movie.episodes
              ? [...movie.episodes].sort((a: any, b: any) => {
                  const sa = (a.season || 1) - (b.season || 1);
                  return sa !== 0 ? sa : (a.episode || 0) - (b.episode || 0);
                })
              : [];
            const epForIdx = sortedEps[initialEpisodeIndex] || null;
            const epNum = (epForIdx as any)?.episode;
            const epSeason = (epForIdx as any)?.season || 1;

            if (epNum && epNum > 0) {
              // Try SxxExx (e.g. S01E03), NxMM (e.g. 1x03), Ep NN, Episodio NN patterns
              const sePadded = `S${String(epSeason).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
              const seShort = `S${epSeason}E${epNum}`;
              const altX = `${epSeason}x${String(epNum).padStart(2, '0')}`;
              const epPad = String(epNum).padStart(2, '0');
              const byCode = sortedList.find((f: any) => {
                const fn = getFn(f).toUpperCase();
                return (
                  fn.includes(sePadded.toUpperCase()) ||
                  fn.includes(seShort.toUpperCase()) ||
                  fn.includes(altX.toUpperCase()) ||
                  fn.includes(`EP${epPad}`) ||
                  fn.includes(`EP ${epPad}`) ||
                  fn.includes(`EPISODIO ${epPad}`) ||
                  fn.includes(`EPISÓDIO ${epPad}`) ||
                  fn.includes(`EPISODE ${epPad}`)
                );
              }) || null;
              if (byCode) {
                file = byCode;
                console.log(`[VideoPlayer] dyn-ref: match por padrão T${epSeason}E${epNum} → ${file?.filename || file?.name}`);
              }
            }

            // Last resort: use the sorted index into the VIDEO-ONLY pool
            // (legendas/thumbnails são excluídos de indexPool para evitar seleção errada)
            if (!file && initialEpisodeIndex < indexPool.length) {
              file = indexPool[initialEpisodeIndex];
              console.log(`[VideoPlayer] dyn-ref: usando índice ordenado ${initialEpisodeIndex} (pool de vídeos: ${indexPool.length}) → ${(file?.filename || file?.name) ?? '?'}`);
            }
          }
          // Fallback 2: first sorted video file
          if (!file) file = indexPool[0] || sortedList[0] || list[0];

          // Build COMPLETE quality list
          const fs = file.fast_stream_url || {};
          const nativeQuality: string | undefined = typeof file.quality === 'string' ? file.quality : undefined;
          const ladderRank: Record<string, number> = { '240p': 1, '360p': 2, '480p': 3, '720p': 4, '1080p': 5 };
          const nativeRank = nativeQuality && ladderRank[nativeQuality] ? ladderRank[nativeQuality] : 99;
          const qualityOrder = [
            { k: '1080p', label: '1080p (Full HD)' },
            { k: '720p',  label: '720p (HD)' },
            { k: '480p',  label: '480p (SD)' },
            { k: '360p',  label: '360p' },
            { k: '240p',  label: '240p' },
          ];
          const qualityList: { id: string; label: string; url: string }[] = [];
          for (const q of qualityOrder) {
            if (fs[q.k] && typeof fs[q.k] === 'string') {
              const rank = ladderRank[q.k] || 0;
              if (rank > nativeRank) continue;
              qualityList.push({ id: q.k, label: q.label, url: fs[q.k] });
            }
          }
          // Add "Auto (Stream)" — stream HLS M3U8 com áudio completo
          // Prioridade: fast_stream_url['auto'] > stream_url > url
          const autoStreamUrl = fs['auto'] || file.stream_url || file.url;
          if (autoStreamUrl && !qualityList.some(q => q.url === autoStreamUrl)) {
            qualityList.push({ id: 'stream', label: 'Auto (Stream)', url: autoStreamUrl });
          }
          // Add "stream_url" separately when it differs from fast_stream_url.auto (HLS direto)
          if (file.stream_url && file.stream_url !== autoStreamUrl && !qualityList.some(q => q.url === file.stream_url)) {
            qualityList.push({ id: 'stream_url', label: 'Stream HLS', url: file.stream_url });
          }
          // Add "Link Direto" (normal_dlink / worker proxy) as an explicit selectable option
          const directUrl = file.normal_dlink || file.dlink;
          if (directUrl && !qualityList.some(q => q.url === directUrl)) {
            qualityList.push({ id: 'direct', label: 'Link Direto', url: directUrl });
          }
          // Add "Download Direto" (stream_download_url) — direct API download link
          const dlUrl = (file as any).stream_download_url;
          if (dlUrl && !qualityList.some(q => q.url === dlUrl)) {
            qualityList.push({ id: 'stream_download', label: 'Download Direto', url: dlUrl });
          }

          if (qualityList.length === 0) throw new Error('Nenhum link de stream para este arquivo');

          // Pick initial: preferred (if available) else best
          let initial = qualityList[0];
          if (preferred) {
            const found = qualityList.find(q => q.id === preferred);
            if (found) {
              initial = found;
              // reorder so preferred is first
              const others = qualityList.filter(q => q.id !== found.id);
              qualityList.length = 0;
              qualityList.push(found, ...others);
              console.log(`[VideoPlayer] dyn-ref: qualidade preferida "${preferred}" aplicada`);
            }
          }

          // Vídeo Automático: ativa cascata apenas para API 1 Pro sem qualidade fixada
          setIsAutoProCascade(!v2 && !v3 && !preferred && qualityList.length > 1);

          setExtractedVideoUrl(initial.url);
          setFinalVideoUrl(initial.url);
          setExtractedQualities(qualityList);
          const subUrl = file.subtitle_url || data.subtitle || data.subtitle_url;
          if (subUrl) setExtractedSubtitleUrl(subUrl);
          console.log(`[VideoPlayer] dyn-ref: ${qualityList.length} qualidades disponíveis (${qualityList.map(q => q.id).join(', ')})`);

          // Pre-warm resolved URLs on the server side so they're cached for next play
          const urlsToWarm = qualityList.map(q => q.url).filter(Boolean).slice(0, 4);
          if (urlsToWarm.length > 0) {
            fetch('/api/keepwarm-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls: urlsToWarm, concurrency: 3 }),
            }).catch(() => {});
          }

          // Extração de dublagem: busca streams das outras APIs em background para oferecer opções de áudio
          (async () => {
            const allApis = [
              { id: 'v1', label: 'API Pro (V1)', endpoint: '/api/terabox-pro' },
              { id: 'v2', label: 'API V2', endpoint: '/api/terabox-v2' },
              { id: 'v3', label: 'API V3 (Premium)', endpoint: '/api/terabox-v3' },
            ];
            const primaryId = v3 ? 'v3' : v2 ? 'v2' : 'v1';
            const dubOpts: { id: string; label: string; url: string }[] = [];
            const primaryStreamUrl = file.stream_url || file.fast_stream_url?.['720p'] || file.fast_stream_url?.['1080p'] || file.normal_dlink || file.dlink;
            if (primaryStreamUrl) {
              dubOpts.push({ id: primaryId, label: `API ${primaryId.toUpperCase()} (atual)`, url: primaryStreamUrl });
            }
            await Promise.allSettled(
              allApis
                .filter(api => api.id !== primaryId)
                .map(async (api) => {
                  try {
                    const r = await fetch(`${api.endpoint}?url=${encodeURIComponent(folderUrl)}`, { signal: AbortSignal.timeout(8000) });
                    if (!r.ok) return;
                    const d = await r.json().catch(() => ({}));
                    const files: any[] = Array.isArray(d.list) ? d.list : [];
                    if (files.length === 0) return;
                    let f = filename
                      ? (files.find((x: any) => (x.filename || x.name) === filename) ||
                         files.find((x: any) => (x.filename || x.name || '').toLowerCase() === filename.toLowerCase()) ||
                         files[0])
                      : files[0];
                    if (!f) return;
                    const streamUrl = f.stream_url || f.fast_stream_url?.['720p'] || f.fast_stream_url?.['1080p'] || f.normal_dlink || f.dlink;
                    if (streamUrl) dubOpts.push({ id: api.id, label: api.label, url: streamUrl });
                  } catch { /* silently ignore */ }
                })
            );
            if (dubOpts.length > 1) {
              setDubbingOptions(dubOpts);
              console.log(`[VideoPlayer] dublagem: ${dubOpts.length} fontes disponíveis`);
            }
          })();
        } catch (e: any) {
          console.error('[VideoPlayer] dyn-ref falhou:', e?.message || e);
          setExtractedVideoUrl(u);
          setFinalVideoUrl(u);
        } finally {
          setIsExtractingTerabox(false);
        }
        return;
      }

      const isTera = u.includes('terabox.com') || u.includes('teraboxapp.com') || u.includes('dubox.com') || u.includes('nephobox.com') || u.includes('1024terabox.com') || u.includes('freeterabox.com') || u.includes('4funbox.com') || u.includes('mirrobox.com') || u.includes('momerybox.com') || u.includes('teraboxlink.com') || u.includes('terafileshare.com');
      
      if (isTera) {
        setIsExtractingTerabox(true);
        try {
          // URLs simples de terabox.com (sem prefixo de API) — usa v3 por padrão, sem mistura
          const r = await fetch(`/api/terabox-v3?url=${encodeURIComponent(u)}`);
          const text = await r.text();
          let data: any;
          try { data = JSON.parse(text); } catch {
            console.error('[VideoPlayer] Resposta inválida do servidor Terabox:', text.slice(0, 200));
            throw new Error('Servidor Terabox retornou resposta inválida');
          }
          if (!r.ok) throw new Error(data?.error || `Falha ao resolver Terabox (${r.status})`);
          let rawList: any[] = Array.isArray(data?.list) ? data.list : (data?.list ? [data.list] : []);

          // Sort files by filename for consistent ordering (natural sort)
          const sortedList = [...rawList].sort((a: any, b: any) => {
            const nameA = (a.filename || a.name || '').toLowerCase();
            const nameB = (b.filename || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
          });

          // Find episode index by URL match using sorted episodes for consistent indexing
          const urlMatchIndex = movie.type === 'series' && sortedEpisodes.length > 0
            ? sortedEpisodes.findIndex(ep => ep.videoUrl === u || ep.videoUrl2 === u)
            : -1;
          const urlMatchEp = urlMatchIndex !== -1 ? sortedEpisodes[urlMatchIndex] : null;

          let vid: any = null;

          if (sortedList.length > 0) {
            // Prioridade 1: usar o episódio pelo índice exato selecionado usando sortedEpisodes
            const indexedEp = (initialEpisodeIndex !== undefined && initialEpisodeIndex >= 0 && initialEpisodeIndex < sortedEpisodes.length)
              ? sortedEpisodes[initialEpisodeIndex]
              : null;
            const indexedFileName = (indexedEp as any)?.file_name;
            // Prioridade 2: episódio encontrado por URL match (fallback)
            const epFileName = indexedFileName || (urlMatchEp as any)?.file_name;
            const movieFileName = (movie as any).file_name;
            const fileNameToMatch = epFileName || movieFileName;
            if (fileNameToMatch) {
              vid = sortedList.find((f: any) =>
                f.filename === fileNameToMatch ||
                f.name === fileNameToMatch ||
                (f.filename || f.name || '').toLowerCase() === fileNameToMatch.toLowerCase()
              ) || null;
            }
            // Prioridade 3: usar índice ordenado da lista de arquivos (sortedList e sortedEpisodes usam mesma ordem)
            if (!vid && initialEpisodeIndex !== undefined && initialEpisodeIndex >= 0) {
              if (initialEpisodeIndex < sortedList.length) {
                vid = sortedList[initialEpisodeIndex];
              }
            }
            if (!vid && urlMatchEp && (urlMatchEp as any).episode > 0) {
              const epNum = (urlMatchEp as any).episode - 1;
              if (epNum < sortedList.length) vid = sortedList[epNum];
            }
            if (!vid && urlMatchIndex > 0 && urlMatchIndex < sortedList.length) {
              vid = sortedList[urlMatchIndex];
            }
            if (!vid) vid = sortedList[0];
          } else if (data?.filename || data?.fast_stream_url || data?.dlink) {
            vid = data;
          }

          if (vid) {
            // FAST PATH: qualidade admin forçada com URL direta — play imediato
            const fsEarly = vid.fast_stream_url || {};
            const epPrefEarly = (urlMatchEp as any)?.preferredQuality as string | undefined;
            const moviePrefEarly = (movie as any).preferredQuality as string | undefined;
            const preferredEarly = (epPrefEarly && epPrefEarly !== 'auto') ? epPrefEarly
                                 : (moviePrefEarly && moviePrefEarly !== 'auto') ? moviePrefEarly
                                 : null;
            if (preferredEarly && typeof fsEarly[preferredEarly] === 'string' && fsEarly[preferredEarly]) {
              console.log(`[VideoPlayer] qualidade forçada "${preferredEarly}" — tocando direto`);
              setExtractedVideoUrl(fsEarly[preferredEarly]);
              setFinalVideoUrl(fsEarly[preferredEarly]);
              setExtractedQualities([{ id: preferredEarly, label: preferredEarly, url: fsEarly[preferredEarly] }]);
              const subE = vid.subtitle_url || data?.subtitle || data?.subtitle_url;
              if (subE) setExtractedSubtitleUrl(subE);
              setIsExtractingTerabox(false);
              return;
            }

            // Build quality list
            const qualityList: { id: string; label: string; url: string }[] = [];
            const fs = vid.fast_stream_url || {};
            const nativeQuality: string | undefined = typeof vid.quality === 'string' ? vid.quality : undefined;
            const ladderRank: Record<string, number> = { '240p': 1, '360p': 2, '480p': 3, '720p': 4, '1080p': 5 };
            const nativeRank = nativeQuality && ladderRank[nativeQuality] ? ladderRank[nativeQuality] : 99;
            const qualityOrder: Array<{ k: string; label: string }> = [
              { k: '1080p', label: '1080p (Full HD)' },
              { k: '720p',  label: '720p (HD)' },
              { k: '480p',  label: '480p (SD)' },
              { k: '360p',  label: '360p' },
              { k: '240p',  label: '240p' },
            ];
            for (const q of qualityOrder) {
              if (fs[q.k] && typeof fs[q.k] === 'string') {
                const rank = ladderRank[q.k] || 0;
                if (rank > nativeRank) continue;
                qualityList.push({ id: q.k, label: q.label, url: fs[q.k] });
              }
            }
            if (nativeQuality) console.log(`[VideoPlayer] resolução nativa: ${nativeQuality}`);
            const autoStreamUrl = fs['auto'] || vid.stream_url || vid.url || vid.video_url || vid.src || (vid.data && vid.data.url);
            if (autoStreamUrl && !qualityList.some(q => q.url === autoStreamUrl)) {
              qualityList.push({ id: 'stream', label: 'Auto (Stream)', url: autoStreamUrl });
            }
            // stream_url separado quando difere do fast_stream_url.auto
            if (vid.stream_url && vid.stream_url !== autoStreamUrl && !qualityList.some(q => q.url === vid.stream_url)) {
              qualityList.push({ id: 'stream_url', label: 'Stream HLS', url: vid.stream_url });
            }
            const directUrl = vid.normal_dlink || vid.dlink;
            if (directUrl && !qualityList.some(q => q.url === directUrl)) {
              qualityList.push({ id: 'direct', label: 'Link Direto', url: directUrl });
            }
            // Download Direto (stream_download_url) — link direto via servidor API
            const dlUrl = vid.stream_download_url;
            if (dlUrl && !qualityList.some(q => q.url === dlUrl)) {
              qualityList.push({ id: 'stream_download', label: 'Download Direto', url: dlUrl });
            }

            const epPreferred = (urlMatchEp as any)?.preferredQuality as string | undefined;
            const moviePreferred = (movie as any).preferredQuality as string | undefined;
            const preferred = (epPreferred && epPreferred !== 'auto') ? epPreferred
                             : (moviePreferred && moviePreferred !== 'auto') ? moviePreferred
                             : null;

            const subUrl = vid.subtitle_url || data?.subtitle || data?.subtitle_url;

            if (qualityList.length === 0) throw new Error('Nenhum link de stream para este arquivo');

            // ── PLAY IMEDIATO: define a URL sem esperar o probe ──────────────────
            // O probe roda em background e atualiza a lista de qualidades quando termina.
            // O vídeo começa a carregar assim que a API responde (~0.5–2s vs ~7–13s antes).
            const initialUrl = preferred
              ? (qualityList.find(q => q.id === preferred) || qualityList[0]).url
              : qualityList[0].url;
            setExtractedVideoUrl(initialUrl);
            setFinalVideoUrl(initialUrl);
            setExtractedQualities(qualityList);
            if (subUrl) setExtractedSubtitleUrl(subUrl);
            setIsExtractingTerabox(false); // libera o spinner imediatamente

            // Probe em background — não bloqueia o play
            if (qualityList.length >= 2) {
              const probeMovieId = movie.id;
              const ladder = ['1080p', '720p', '480p', '360p', '240p', 'stream', 'stream_url', 'direct', 'stream_download'];
              const attemptOrder: typeof qualityList = preferred
                ? (() => {
                    const prefIdx = ladder.indexOf(preferred);
                    const seen = new Set<string>();
                    const out: typeof qualityList = [];
                    const push = (id: string) => {
                      if (seen.has(id)) return;
                      const q = qualityList.find(x => x.id === id);
                      if (q) { out.push(q); seen.add(id); }
                    };
                    if (prefIdx !== -1) {
                      for (let i = prefIdx; i < ladder.length; i++) push(ladder[i]);
                      for (let i = prefIdx - 1; i >= 0; i--) push(ladder[i]);
                    }
                    for (const q of qualityList) if (!seen.has(q.id)) out.push(q);
                    return out;
                  })()
                : qualityList;

              (async () => {
                try {
                  const ctrl = new AbortController();
                  setTimeout(() => ctrl.abort(), 8000);
                  const probeRes = await fetch('/api/probe-streams', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: ctrl.signal,
                    body: JSON.stringify({
                      urls: attemptOrder.slice(0, 6).map(q => ({ quality: q.id, label: q.label, url: q.url })),
                    }),
                  });
                  if (probeMovieId !== movie.id) return;
                  if (!probeRes.ok) return;
                  const probeData = await probeRes.json();
                  const working: any[] = Array.isArray(probeData?.working) ? probeData.working : [];
                  if (working.length > 0) {
                    const workingIds = new Set(working.map((w: any) => w.quality));
                    let refined = qualityList.filter(q => workingIds.has(q.id));
                    if (refined.length > 0) {
                      if (preferred) {
                        const chosen = attemptOrder.find(q => workingIds.has(q.id));
                        if (chosen) refined = [chosen, ...refined.filter(q => q.id !== chosen.id)];
                      }
                      setExtractedQualities(refined);
                      console.log(`[VideoPlayer] probe bg: ${refined.length}/${qualityList.length} qualidades ok`);
                    }
                  }
                } catch { /* probe em background — ignorar erros */ }
              })();
            }

            return; // evita setIsExtractingTerabox(false) duplicado no finally
          }
        } catch (e) {
          console.error("Failed to extract Terabox via API", e);
          setExtractedVideoUrl(u);
          setFinalVideoUrl(u);
        } finally {
          setIsExtractingTerabox(false);
        }
      }
    };
    runExtraction();
  }, [movie.id, movie.videoUrl, initialEpisodeIndex]);

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isHLS = url.includes('.m3u8') || (extractedVideoUrl?.includes('.m3u8') ?? false);
  const isMega = url.includes('mega.nz');
  const isDirectVideo = isHLS || url.match(/\.(mp4|webm|ogg|mkv|mov|avi)$/i) !== null || (isDriveVideo && drivePlayMethod !== 'iframe') || (isKingX && extractedVideoUrl !== null);
  // FIX 1: Todos os links que não são explicitamente embeds (YouTube, Mega, GDPlayer iframe) usam o Netflix Player
  // Isso resolve o problema de links aleatórios de séries/filmes abrindo no player nativo do link
  const isExplicitEmbed = isYouTube || isMega || isGDPlayer || (isDriveVideo && drivePlayMethod === 'iframe');
  const isMP4 = !isExplicitEmbed; // Qualquer coisa que não é embed explícito vai pro Netflix Player
  const isEmbeddable = isYouTube || isMega || isTeraBox || isKingX || isGDPlayer || (isDriveVideo && drivePlayMethod === 'iframe');

  const getEmbedUrl = () => {
    if (isDriveVideo && drivePlayMethod === 'iframe') {
      return driveId ? `https://drive.google.com/file/d/${driveId}/preview?autoplay=1` : null;
    }
    if (isYouTube) {
      const id = extractYouTubeId(url);
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&showinfo=0&modestbranding=1` : null;
    }
    if (isMega) {
      // Convert mega.nz/file/... to mega.nz/embed/...
      return url.replace('/file/', '/embed/').replace('/#!', '/embed/#!');
    }
    if (isTeraBox || isGDPlayer) {
      return url; // TeraBox and GDPlayer usually work as-is if already embed links
    }
    return url;
  };

  const embedUrl = getEmbedUrl();

  // Monitorar conexão
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sempre usar o Netflix Player como único player
  // Exceção: betterflix usa iframe externo — não sobreescrever
  useEffect(() => {
    const isBetterFlix = (movie.videoUrl || '').includes('betterflix.click');
    if (!isBetterFlix) {
      setPlayerStyle('netflix');
    }
    requestLandscape();
  }, [movie.videoUrl]);

  const requestLandscape = async () => {
    try {
      const container = containerRef.current;
      if (!container) return;

      // Try to enter fullscreen first as it's often required for orientation lock
      if (!document.fullscreenElement) {
        if (screenfull.isEnabled) {
          await screenfull.request(container).catch(() => {});
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen().catch(() => {});
        } else if (container.requestFullscreen) {
          await container.requestFullscreen().catch(() => {});
        }
      }

      // Lock orientation with multiple attempts and fallbacks
      const lock = async () => {
        if (screen.orientation && (screen.orientation as any).lock) {
          try {
            await (screen.orientation as any).lock('landscape');
            return true;
          } catch (e) {
            try {
              await (screen.orientation as any).lock('landscape-primary');
              return true;
            } catch (e2) {
              return false;
            }
          }
        }
        return false;
      };

      // Try immediately
      await lock();

      // Small delay to ensure fullscreen transition is stable, then try again
      await new Promise(resolve => setTimeout(resolve, 500));
      await lock();
      
      // One more try after 1.5s for slow devices
      setTimeout(lock, 1500);

      // iOS specific: force landscape via webkitEnterFullscreen on the video element if available
      if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
        try {
          (videoRef.current as any).webkitEnterFullscreen();
        } catch (e) {}
      }

      setOrientationKey(prev => prev + 1);
    } catch (error) {
      console.warn("Erro ao configurar modo paisagem:", error);
    }
  };

  useEffect(() => {
    if (playerStyle !== null) {
      // Immediate attempt
      requestLandscape();
      
      // Follow-up attempt after a short delay to catch any race conditions
      const timer = setTimeout(requestLandscape, 1000);
      return () => clearTimeout(timer);
    }
  }, [playerStyle]);

  const toggleFullscreen = async () => {
    try {
      const container = containerRef.current;
      if (!container) return;

      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        }
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
      setOrientationKey(prev => prev + 1);
    } catch (error) {
      console.error("Erro ao alternar tela cheia:", error);
    }
  };

  useEffect(() => {
    if (playerStyle === null && isKingX) {
      setPlayerStyle('netflix');
      // Tentar rotacionar imediatamente para KingX
      requestLandscape();
    }
  }, [isKingX, playerStyle]);

  // Vidsrc (Net 2.0) — sempre iframe embed
  const isVidsrcUrl = url.includes('vidsrc-embed.ru') || url.includes('vidsrc-embed.su') || url.includes('vidsrcme.su') || url.includes('vsrc.su');
  if (isVidsrcUrl || playerStyle === 'vidsrc') {
    const vsTitle = movie.title || movie.name || 'Assistindo';
    const vsYear = movie.release_date
      ? new Date(movie.release_date).getFullYear()
      : movie.first_air_date
      ? new Date(movie.first_air_date).getFullYear()
      : null;
    const vsIsTV = movie.type === 'series';
    return (
      <div ref={containerRef} className="fixed inset-0 z-[200] bg-black flex flex-col">
        <div className="relative z-10 flex items-center gap-3 px-4 py-2.5 bg-gradient-to-b from-black/95 via-black/60 to-transparent shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/25 text-white flex items-center justify-center transition-all backdrop-blur-md group"
            aria-label="Fechar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-sm truncate max-w-[55vw] tracking-tight">{vsTitle}</span>
              {vsYear && <span className="text-gray-500 text-xs shrink-0">{vsYear}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-md">
                Net 2.0
              </span>
              {vsIsTV && (
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md">
                  Série
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <iframe
            src={url}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
            referrerPolicy="origin"
            title={vsTitle}
          />
        </div>
      </div>
    );
  }

  // BetterFlix — resolve stream e exibe no NetflixPlayer nativo
  const isBetterFlixUrl = url.includes('betterflix.click');
  if (isBetterFlixUrl || playerStyle === 'betterflix') {
    const bfSrc = isBetterFlixUrl ? url : (movie.videoUrl || '');
    const bfTitle = movie.title || movie.name || 'Assistindo';
    const bfYear = movie.release_date
      ? new Date(movie.release_date).getFullYear()
      : movie.first_air_date
      ? new Date(movie.first_air_date).getFullYear()
      : null;
    const bfIsTV = movie.type === 'series';
    const closeBtn = (
      <button
        onClick={onClose}
        className="absolute top-3 left-3 z-20 w-9 h-9 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-white flex items-center justify-center transition-all backdrop-blur-md group"
        aria-label="Fechar"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    );

    // Carregando resolução
    if (bfLoading) {
      return (
        <div ref={containerRef} className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-4">
          {closeBtn}
          <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-white font-semibold text-sm">{bfTitle}{bfYear ? ` (${bfYear})` : ''}</p>
            <p className="text-white/40 text-xs">Carregando stream…</p>
            <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.5 rounded-md mt-1">
              API Flix
            </span>
          </div>
        </div>
      );
    }

    // Stream resolvido — usa NetflixPlayer nativo com hls.js
    if (bfStreamUrl && !bfFailed) {
      return (
        <div className="relative w-full h-full">
          <NetflixPlayer
            src={bfStreamUrl}
            title={bfTitle}
            seriesTitle={bfIsTV ? (movie.title || movie.name || '') : undefined}
            episodes={bfIsTV && (movie.episodes?.length ?? 0) > 0 ? movie.episodes : undefined}
            backdropUrl={movie.backdrop_path}
            logoUrl={movieLogo || undefined}
            onClose={onClose}
            initialTime={initialTime ?? movie.last_position ?? 0}
            isMovie={!bfIsTV}
            hasNextEpisode={false}
            recommendations={recommendations}
            onSelectRecommendation={(rec) => {
              const recUrl = rec.type === 'series' && rec.episodes?.length ? rec.episodes[0].videoUrl : rec.videoUrl;
              if (onPlayNext) onPlayNext(rec, recUrl || '');
            }}
            onNextEpisode={() => {}}
            videoUrlOptions={[]}
            isHost={isHost}
            roomId={roomId}
            profile={profile}
            maxQualityHeight={appSettings?.subscription_plan === 'hub' ? 720 : 1080}
            onProgress={async (time, duration) => {
              currentTimeRef.current = time;
              if (duration !== undefined) durationRef.current = duration;
              if (onProgress) onProgress(movie.id, time, movie.videoUrl);
            }}
            isBackgroundMode={isBackgroundMode}
            onClickBackground={onClickBackground}
          />
        </div>
      );
    }

    // Fallback iframe — stream não pôde ser extraído
    return (
      <div ref={containerRef} className="fixed inset-0 z-[200] bg-black flex flex-col">
        <div className="relative z-10 flex items-center gap-3 px-4 py-2.5 bg-gradient-to-b from-black/95 via-black/60 to-transparent shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/25 text-white flex items-center justify-center transition-all backdrop-blur-md group"
            aria-label="Fechar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-sm truncate max-w-[55vw] tracking-tight">{bfTitle}</span>
              {bfYear && <span className="text-gray-500 text-xs shrink-0">{bfYear}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.5 rounded-md">
                API Flix
              </span>
              {bfIsTV && (
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md">
                  Série
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <iframe
            src={bfSrc}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
            referrerPolicy="origin"
            title={bfTitle}
          />
        </div>
      </div>
    );
  }

  // NetflixPlayer é o único player — todos os links são roteados aqui
  {
    // Prioridade: usar initialEpisodeIndex quando disponível (evita ambiguidade quando múltiplos eps têm a mesma URL)
    // Usa sortedEpisodes para que o índice seja consistente com initialEpisodeIndex (também sorted)
    const currentIndexByUrl = movie.type === 'series' && sortedEpisodes.length > 0
      ? sortedEpisodes.findIndex(ep => {
          const mv = movie.videoUrl || '';
          if (ep.videoUrl === mv || ep.videoUrl2 === mv) return true;
          if (isDynamicRef(mv) && ep.videoUrl && isDynamicRef(ep.videoUrl)) {
            try {
              const { filename: epFn } = parseDynamicRef(ep.videoUrl);
              const { filename: mvFn } = parseDynamicRef(mv);
              if (epFn && mvFn && epFn === mvFn) return true;
            } catch {}
          }
          return false;
        })
      : -1;
    const currentIndex = (initialEpisodeIndex !== undefined && initialEpisodeIndex >= 0 && initialEpisodeIndex < sortedEpisodes.length)
      ? initialEpisodeIndex
      : currentIndexByUrl;
    const currentEpisode = currentIndex !== -1 ? sortedEpisodes[currentIndex] || null : null;
    const episodeTitle = currentEpisode ? (currentEpisode.title || `Episódio ${currentEpisode.episode}`) : "";
    const displayTitle = movie.type === 'series' && episodeTitle 
       ? `${movie.title || movie.name} - ${episodeTitle}` 
       : (movie.title || movie.name || "");
    const hasNextEpisode = currentIndex !== -1 && sortedEpisodes.length > 0 && currentIndex < sortedEpisodes.length - 1;

    const videoUrlOptions: { id: string; label: string; url: string }[] = [];
    // Se Terabox extraiu múltiplas qualidades, expor todas (1080p, 720p, 480p, 360p, ...)
    if (extractedQualities.length > 0) {
      videoUrlOptions.push(...extractedQualities);
    } else if (finalVideoUrl || extractedVideoUrl) {
      videoUrlOptions.push({ id: 'sd', label: 'Padrão (SD)', url: extractedVideoUrl || finalVideoUrl || "" });
    }
    if (movie.videoUrl2 && !videoUrlOptions.some(o => o.url === movie.videoUrl2)) {
      videoUrlOptions.push({ id: 'hd', label: 'Alta Definição (HD)', url: movie.videoUrl2 });
    }

    // Calcula a URL correta para cada tipo de fonte
    const playerSrc = (() => {
      if (extractedVideoUrl) return extractedVideoUrl;
      // Enquanto estiver extraindo um link TeraBox, não passa a URL bruta de compartilhamento
      // para o player — isso evita o player travar tentando carregar uma página web como vídeo
      if (isExtractingTerabox) return "";
      if (isTeraBox) return ""; // Link TeraBox não extraído ainda — aguarda extração
      if (isDriveVideo && driveId) return `https://drive.google.com/file/d/${driveId}/preview?autoplay=1`;
      if (isYouTube) {
        const ytId = extractYouTubeId(url);
        return ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&showinfo=0&modestbranding=1` : url;
      }
      if (isMega) return url.replace('/file/', '/embed/').replace('/#!', '/embed/#!');
      if (isGDPlayer) return url;
      return finalVideoUrl || url || "";
    })();

    return (
      <div className="relative w-full h-full">
        <NetflixPlayer 
          src={playerSrc}
          verificationUrl={isKingX && !extractedVideoUrl ? (movie.videoUrl || undefined) : undefined}
          iframeFallbackUrl={isKingX ? (movie.videoUrl || undefined) : undefined}
          subtitleUrl={extractedSubtitleUrl || undefined}
          title={displayTitle}
          seriesTitle={movie.type === 'series' ? (movie.title || movie.name || "") : undefined}
          episodes={sortedEpisodes.length > 0 ? sortedEpisodes : movie.episodes}
          currentEpisodeIndex={currentIndex >= 0 ? currentIndex : undefined}
          onSelectEpisode={(ep) => {
            const epIdx = sortedEpisodes.findIndex(e => e.id === ep.id || (e.videoUrl === ep.videoUrl && e.episode === ep.episode && e.season === ep.season));
            if (onPlayNext) onPlayNext(movie, ep.videoUrl || ep.videoUrl2 || "", epIdx >= 0 ? epIdx : undefined);
          }}
          backdropUrl={movie.backdrop_path}
          logoUrl={movieLogo || undefined}
          onClose={onClose}
          initialTime={initialTime ?? movie.last_position ?? 0}
          isMovie={movie.type !== 'series'}
          hasNextEpisode={hasNextEpisode}
          recommendations={recommendations}
          onSelectRecommendation={(rec) => {
            const defaultRecUrl = rec.type === 'series' && rec.episodes && rec.episodes.length > 0 ? rec.episodes[0].videoUrl : rec.videoUrl;
            if (onPlayNext) onPlayNext(rec, defaultRecUrl || "");
          }}
          onNextEpisode={() => {
            if (hasNextEpisode && sortedEpisodes.length > 0 && onPlayNext) {
              const nextIdx = currentIndex + 1;
              onPlayNext(movie, sortedEpisodes[nextIdx].videoUrl || sortedEpisodes[nextIdx].videoUrl2 || "", nextIdx);
            }
          }}
          videoUrlOptions={videoUrlOptions}
          dubbingOptions={dubbingOptions}
          autoQualityCascade={isAutoProCascade}
          cascadeDelaySecs={movie.qualityCascadeDelay ?? 10}
          teraboxV1Ref={isAutoProCascade ? (movie.videoUrl || undefined) : undefined}
          cascadeToV3OnPenultimate={movie.cascadeToV3OnPenultimate !== false}
          preferredAudioLanguage={(() => {
            const urlMatchEp = movie.type === 'series' && movie.episodes
              ? movie.episodes.find(ep => ep.videoUrl === movie.videoUrl || ep.videoUrl2 === movie.videoUrl)
              : null;
            return (urlMatchEp as any)?.preferredAudioLanguage || (movie as any).preferredAudioLanguage || 'pt-BR';
          })()}
          isHost={isHost}
          roomId={roomId}
          profile={profile}
          maxQualityHeight={appSettings?.subscription_plan === 'hub' ? 720 : 1080}
          autoNextOffset={
            movie.type === 'series' && currentIndex !== -1 
              ? sortedEpisodes[currentIndex]?.credits_time 
              : (movie as any).credits_time ?? undefined
          }
          recsOverlayOffset={appSettings?.recs_overlay_offset ?? 120}
          onProgress={async (time, duration) => {
            currentTimeRef.current = time;
            if (duration !== undefined) durationRef.current = duration;
            if (onProgress) onProgress(movie.id, time, movie.videoUrl);

            // Salva progresso por episódio no localStorage
            if (movie.id && currentIndex >= 0 && time > 0) {
              try {
                const key = `netplay_ep_progress_${movie.id}`;
                const existing: Record<number, { pos: number; dur: number }> = JSON.parse(localStorage.getItem(key) || '{}');
                existing[currentIndex] = { pos: time, dur: duration ?? durationRef.current ?? 0 };
                localStorage.setItem(key, JSON.stringify(existing));
              } catch {}
            }
            
            if (profileId && movie.id && appSettings?.subscription_plan !== 'hub') {
              const finalDuration = duration !== undefined ? duration : durationRef.current;
              const isMovie = movie.type !== 'series';
              const seriesCreditsTime = currentIndex !== -1 && sortedEpisodes[currentIndex]?.credits_time !== undefined 
                  ? sortedEpisodes[currentIndex].credits_time 
                  : 30;
              const isFinished = finalDuration > 0 && (isMovie ? (finalDuration - time <= 450) : (finalDuration - time <= seriesCreditsTime!));

              if (isFinished && isMovie) {
                  await supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id });
              } else if (isFinished && !isMovie) {
                  const currentIndex = sortedEpisodes.findIndex(ep => ep.videoUrl === movie.videoUrl || ep.videoUrl2 === movie.videoUrl);
                  const isLastEpisode = sortedEpisodes.length > 0 && currentIndex !== -1 && currentIndex === sortedEpisodes.length - 1;
                  
                  if (isLastEpisode) {
                     await supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id });
                  } else {
                     const nextEp = sortedEpisodes.length > 0 && currentIndex !== -1 ? sortedEpisodes[currentIndex + 1] : null;
                     if (nextEp) {
                        localStorage.setItem(`netplay_progress_url_${movie.id}`, nextEp.videoUrl || nextEp.videoUrl2 || '');
                     }
                     await supabase.from('watch_history').upsert({
                       profile_id: profileId,
                       movie_id: movie.id,
                       last_position: 0,
                       updated_at: new Date().toISOString()
                     }, { onConflict: 'profile_id,movie_id' });
                  }
              } else {
                  await supabase.from('watch_history').upsert({
                    profile_id: profileId,
                    movie_id: movie.id,
                    last_position: time,
                    updated_at: new Date().toISOString()
                  }, { onConflict: 'profile_id,movie_id' });
              }
            }
          }}
          isBackgroundMode={isBackgroundMode}
          onClickBackground={onClickBackground}
        />
      </div>
    );
  }

  // Fallback (nunca deve ser alcançado pois o bloco acima sempre retorna)
  return null;
};

export default VideoPlayer;
