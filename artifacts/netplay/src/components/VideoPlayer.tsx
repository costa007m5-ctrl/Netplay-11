import React, { useState, useEffect, useRef } from 'react';
import screenfull from 'screenfull';
import NetflixPlayer from './NetflixPlayer';
import { Movie, RoomEvent, AppSettings } from '../types';
import { supabase } from '../lib/supabase';
import { isDynamicRef, resolveTeraboxUrl } from '../services/terabox';

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
  initialPlayerStyle?: 'netflix' | 'standard' | 'special' | string;
  initialEpisodeIndex?: number;
  isBackgroundMode?: boolean;
  onClickBackground?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, onClose, profileId, profile, roomId, isHost, onPlayNext, recommendations = [], onProgress, appSettings, initialTime, initialPlayerStyle, initialEpisodeIndex, isBackgroundMode, onClickBackground }) => {
  const [orientationKey, setOrientationKey] = useState(0);
  const [playerStyle, setPlayerStyle] = useState<'netflix' | 'standard' | 'special' | null>((initialPlayerStyle as any) || 'netflix');
  const [drivePlayMethod, setDrivePlayMethod] = useState<'api' | 'uc' | 'iframe'>('api');
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
           const currentIndex = movie.episodes ? movie.episodes.findIndex(ep => ep.videoUrl === movie.videoUrl || ep.videoUrl2 === movie.videoUrl) : -1;
           const isLastEpisode = movie.episodes && currentIndex !== -1 && currentIndex === movie.episodes.length - 1;
           
           if (isLastEpisode) {
              supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id }).then(() => {});
           } else {
              const nextEp = movie.episodes && currentIndex !== -1 ? movie.episodes[currentIndex + 1] : null;
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

  useEffect(() => {
    const runExtraction = async () => {
      const u = movie.videoUrl || '';

      // Handle terabox-folder:// dynamic refs (format: "terabox-folder://folderUrl###filename")
      if (isDynamicRef(u)) {
        setIsExtractingTerabox(true);
        try {
          const resolved = await resolveTeraboxUrl(u);
          setExtractedVideoUrl(resolved);
          setFinalVideoUrl(resolved);
        } catch (e) {
          console.error("Failed to resolve dynamic Terabox ref", e);
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
          const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(u)}`);
          if (res.ok) {
            const text = await res.text();
            let data: any;
            try {
              data = JSON.parse(text);
            } catch {
              console.error('[Terabox] Resposta não-JSON do servidor:', text.slice(0, 200));
              throw new Error('Servidor Terabox retornou resposta inválida (provável timeout)');
            }

            const rawList: any[] = Array.isArray(data.list) ? data.list : (data.list ? [data.list] : []);

            // Sort files by filename for consistent ordering (natural sort)
            const sortedList = [...rawList].sort((a: any, b: any) => {
              const nameA = (a.filename || a.name || '').toLowerCase();
              const nameB = (b.filename || b.name || '').toLowerCase();
              return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // Find episode index by URL match (may be wrong when all share same URL)
            const urlMatchIndex = movie.type === 'series' && movie.episodes
              ? movie.episodes.findIndex(ep => ep.videoUrl === u || ep.videoUrl2 === u)
              : -1;
            const urlMatchEp = urlMatchIndex !== -1 && movie.episodes ? movie.episodes[urlMatchIndex] : null;

            let vid: any = null;

            if (sortedList.length > 0) {
              // Priority 1: match by stored file_name on the episode
              const epFileName = (urlMatchEp as any)?.file_name;
              const movieFileName = (movie as any).file_name;
              const fileNameToMatch = epFileName || movieFileName;
              if (fileNameToMatch) {
                vid = sortedList.find((f: any) =>
                  f.filename === fileNameToMatch ||
                  f.name === fileNameToMatch ||
                  (f.filename || f.name || '').toLowerCase() === fileNameToMatch.toLowerCase()
                ) || null;
              }

              // Priority 2: use explicitly passed episode index (most reliable for folder URLs)
              if (!vid && initialEpisodeIndex !== undefined && initialEpisodeIndex >= 0 && initialEpisodeIndex < sortedList.length) {
                vid = sortedList[initialEpisodeIndex];
              }

              // Priority 3: use episode's episode number (1-based) as index into sorted list
              if (!vid && urlMatchEp && (urlMatchEp as any).episode > 0) {
                const epNum = (urlMatchEp as any).episode - 1;
                if (epNum < sortedList.length) vid = sortedList[epNum];
              }

              // Priority 4: URL-match index if it's unique (unambiguous)
              if (!vid && urlMatchIndex > 0 && urlMatchIndex < sortedList.length) {
                vid = sortedList[urlMatchIndex];
              }

              // Priority 5: first file as last resort
              if (!vid) vid = sortedList[0];
            } else if (data.filename || data.fast_stream_url || data.dlink) {
              vid = data;
            }
            
            if (vid) {
               // Build COMPLETE quality list — all available resolutions, ordered best→worst
               const qualityList: { id: string; label: string; url: string }[] = [];
               const fs = vid.fast_stream_url || {};
               const qualityOrder: Array<{ k: string; label: string }> = [
                 { k: '1080p', label: '1080p (Full HD)' },
                 { k: '720p',  label: '720p (HD)' },
                 { k: '480p',  label: '480p (SD)' },
                 { k: '360p',  label: '360p' },
                 { k: '240p',  label: '240p' },
               ];
               for (const q of qualityOrder) {
                 if (fs[q.k] && typeof fs[q.k] === 'string') {
                   qualityList.push({ id: q.k, label: q.label, url: fs[q.k] });
                 }
               }
               // Fallbacks de download (sem qualidade conhecida) — vão pro final como "Download"
               const directUrl = vid.normal_dlink || vid.url || vid.stream_url || vid.video_url || vid.src || (vid.data && vid.data.url) || vid.dlink;
               if (directUrl && !qualityList.some(q => q.url === directUrl)) {
                 qualityList.push({ id: 'auto', label: 'Padrão', url: directUrl });
               }

               // OVERRIDE MANUAL: se o admin escolheu uma qualidade fixa pro filme/episódio,
               // priorizamos ela. Episódio tem prioridade sobre filme.
               // IMPORTANTE: ainda probamos pra confirmar que a URL realmente entrega conteúdo
               // (workers.dev às vezes retorna 200 com body vazio em qualidades "fantasma").
               const epPreferred = (urlMatchEp as any)?.preferredQuality as string | undefined;
               const moviePreferred = (movie as any).preferredQuality as string | undefined;
               const preferred = (epPreferred && epPreferred !== 'auto') ? epPreferred
                                : (moviePreferred && moviePreferred !== 'auto') ? moviePreferred
                                : null;

               // Monta uma ordem de tentativa: [forçada, depois desce a escada, depois sobe]
               const ladder = ['1080p', '720p', '480p', '360p', '240p'];
               let attemptOrder: typeof qualityList = [];
               if (preferred) {
                 const prefIdx = ladder.indexOf(preferred);
                 const seen = new Set<string>();
                 const pushIfExists = (id: string) => {
                   if (seen.has(id)) return;
                   const q = qualityList.find(x => x.id === id);
                   if (q) { attemptOrder.push(q); seen.add(id); }
                 };
                 if (prefIdx !== -1) {
                   for (let i = prefIdx; i < ladder.length; i++) pushIfExists(ladder[i]); // forçada → mais baixas
                   for (let i = prefIdx - 1; i >= 0; i--) pushIfExists(ladder[i]);        // depois mais altas
                 }
                 // adiciona qualquer outra (ex: "auto" do dlink) como último recurso
                 for (const q of qualityList) if (!seen.has(q.id)) attemptOrder.push(q);
               } else {
                 attemptOrder = qualityList;
               }

               let finalList = qualityList;
               let forcedByAdmin = false;

               // SMART PROBE: testa as URLs pra confirmar que entregam conteúdo.
               // - Sem admin override: testa tudo em paralelo, mantém só as que funcionam
               // - Com admin override: testa em ORDEM (forçada primeiro), para na primeira que funciona
               if (qualityList.length >= 1) {
                 const probeController = new AbortController();
                 probeAbortRef.current?.abort();
                 probeAbortRef.current = probeController;
                 const probeMovieId = movie.id;
                 const probeTimeout = setTimeout(() => probeController.abort(), preferred ? 8000 : 5000);
                 try {
                   const probeRes = await fetch('/api/probe-streams', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     signal: probeController.signal,
                     body: JSON.stringify({
                       urls: attemptOrder.slice(0, 6).map(q => ({
                         quality: q.id,
                         label: q.label,
                         url: q.url,
                       })),
                     }),
                   });
                   clearTimeout(probeTimeout);
                   if (probeMovieId === movie.id && probeRes.ok) {
                     const probeData = await probeRes.json();
                     const working: any[] = Array.isArray(probeData?.working) ? probeData.working : [];
                     if (working.length > 0) {
                       const workingIds = new Set(working.map(w => w.quality));
                       const filtered = qualityList.filter(q => workingIds.has(q.id));
                       if (filtered.length > 0) {
                         if (preferred) {
                           // Modo override: pega a PRIMEIRA da ordem de tentativa que sobreviveu ao probe
                           const chosen = attemptOrder.find(q => workingIds.has(q.id));
                           if (chosen) {
                             finalList = [chosen, ...filtered.filter(q => q.id !== chosen.id)];
                             forcedByAdmin = true;
                             console.log(`[VideoPlayer] qualidade preferida "${preferred}" → tocando ${chosen.id} (validada via probe). Outras disponíveis: ${filtered.filter(q=>q.id!==chosen.id).map(q=>q.id).join(',') || 'nenhuma'}`);
                           }
                         } else {
                           finalList = filtered;
                           console.log(`[VideoPlayer] probe: ${filtered.length}/${qualityList.length} qualidades funcionais`,
                             working.map((w:any) => `${w.quality}(${w.ms}ms)`).join(', '));
                         }
                       }
                     } else {
                       console.warn('[VideoPlayer] probe: nenhuma qualidade respondeu, usando lista original');
                     }
                   }
                 } catch (probeErr: any) {
                   clearTimeout(probeTimeout);
                   if (probeErr?.name !== 'AbortError') {
                     console.warn('[VideoPlayer] probe falhou (usando lista original):', probeErr);
                   } else {
                     console.warn('[VideoPlayer] probe timeout, usando lista original');
                   }
                 }
               }

               // Agora sim — define a URL inicial (só com qualidade VERIFICADA quando possível)
               const stUrl = finalList[0]?.url;
               if (stUrl) {
                  setExtractedVideoUrl(stUrl);
                  setFinalVideoUrl(stUrl);
                  setExtractedQualities(finalList);
               }
               
               const subUrl = vid.subtitle_url || data.subtitle || data.subtitle_url;
               if (subUrl) {
                  setExtractedSubtitleUrl(subUrl);
               }
            }
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
  useEffect(() => {
    setPlayerStyle('netflix');
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

  // NetflixPlayer é o único player — todos os links são roteados aqui
  {
    const currentIndex = movie.type === 'series' && movie.episodes 
      ? movie.episodes.findIndex(ep => ep.videoUrl === movie.videoUrl)
      : -1;
    const currentEpisode = currentIndex !== -1 && movie.episodes ? movie.episodes[currentIndex] : null;
    const episodeTitle = currentEpisode ? (currentEpisode.title || `Episódio ${currentEpisode.episode}`) : "";
    const displayTitle = movie.type === 'series' && episodeTitle 
       ? `${movie.title || movie.name} - ${episodeTitle}` 
       : (movie.title || movie.name || "");
    const hasNextEpisode = currentIndex !== -1 && movie.episodes && currentIndex < movie.episodes.length - 1;

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
          episodes={movie.episodes}
          onSelectEpisode={(ep) => {
            const epIdx = movie.episodes ? movie.episodes.findIndex(e => e.id === ep.id) : -1;
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
            if (hasNextEpisode && movie.episodes && onPlayNext) {
              const nextIdx = currentIndex + 1;
              onPlayNext(movie, movie.episodes[nextIdx].videoUrl, nextIdx);
            }
          }}
          videoUrlOptions={videoUrlOptions}
          isHost={isHost}
          roomId={roomId}
          profile={profile}
          maxQualityHeight={appSettings?.subscription_plan === 'hub' ? 720 : 1080}
          autoNextOffset={
            movie.type === 'series' && currentIndex !== -1 
              ? movie.episodes?.[currentIndex]?.credits_time 
              : undefined
          }
          onProgress={async (time, duration) => {
            currentTimeRef.current = time;
            if (duration !== undefined) durationRef.current = duration;
            if (onProgress) onProgress(movie.id, time, movie.videoUrl);
            
            if (profileId && movie.id && appSettings?.subscription_plan !== 'hub') {
              const finalDuration = duration !== undefined ? duration : durationRef.current;
              const isMovie = movie.type !== 'series';
              const seriesCreditsTime = currentIndex !== -1 && movie.episodes?.[currentIndex]?.credits_time !== undefined 
                  ? movie.episodes[currentIndex].credits_time 
                  : 30;
              const isFinished = finalDuration > 0 && (isMovie ? (finalDuration - time <= 450) : (finalDuration - time <= seriesCreditsTime!));

              if (isFinished && isMovie) {
                  await supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id });
              } else if (isFinished && !isMovie) {
                  const currentIndex = movie.episodes ? movie.episodes.findIndex(ep => ep.videoUrl === movie.videoUrl || ep.videoUrl2 === movie.videoUrl) : -1;
                  const isLastEpisode = movie.episodes && currentIndex !== -1 && currentIndex === movie.episodes.length - 1;
                  
                  if (isLastEpisode) {
                     await supabase.from('watch_history').delete().match({ profile_id: profileId, movie_id: movie.id });
                  } else {
                     const nextEp = movie.episodes && currentIndex !== -1 ? movie.episodes[currentIndex + 1] : null;
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
