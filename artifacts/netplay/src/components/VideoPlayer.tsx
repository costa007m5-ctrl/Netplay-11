import React, { useState, useEffect, useRef } from 'react';
import screenfull from 'screenfull';
import NetflixPlayer from './NetflixPlayer';
import { Movie, RoomEvent, AppSettings } from '../types';
import { supabase } from '../lib/supabase';

interface VideoPlayerProps {
  movie: Movie;
  onClose: () => void;
  profileId?: string;
  profile?: any; // Added profile object
  roomId?: string;
  isHost?: boolean;
  onPlayNext?: (movie: Movie, episodeUrl: string) => void;
  recommendations?: Movie[];
  onProgress?: (movieId: string | number, time: number, episodeUrl?: string) => void;
  appSettings?: AppSettings;
  initialTime?: number;
  initialPlayerStyle?: 'netflix' | 'standard' | 'special' | string;
  isBackgroundMode?: boolean;
  onClickBackground?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, onClose, profileId, profile, roomId, isHost, onPlayNext, recommendations = [], onProgress, appSettings, initialTime, initialPlayerStyle, isBackgroundMode, onClickBackground }) => {
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
  
  const [emotes, setEmotes] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
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
  const isTeraBox = url.includes('terabox.com') || url.includes('teraboxapp.com') || url.includes('dubox.com') || url.includes('nephobox.com');
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
      const isTera = u.includes('terabox.com') || u.includes('teraboxapp.com') || u.includes('dubox.com') || u.includes('nephobox.com') || u.includes('1024terabox.com') || u.includes('freeterabox.com') || u.includes('4funbox.com') || u.includes('mirrobox.com') || u.includes('momerybox.com') || u.includes('teraboxlink.com') || u.includes('terafileshare.com');
      
      if (isTera) {
        setIsExtractingTerabox(true);
        try {
          const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(u)}`);
          if (res.ok) {
            const data = await res.json();
            
            let vid = data.list && data.list.length > 0 ? data.list[0] : data;
            
            if (data.list && data.list.length > 0 && movie.file_name) {
               const matched = data.list.find((f: any) => f.filename === movie.file_name || f.name === movie.file_name);
               if (matched) {
                 vid = matched;
               }
            }
            
            if (vid) {
               const stUrl = vid.fast_stream_url?.['1080p'] || vid.fast_stream_url?.['720p'] || vid.fast_stream_url?.['480p'] || vid.fast_stream_url?.['360p'] || vid.normal_dlink || vid.url || vid.stream_url || vid.video_url || vid.src || (vid.data && vid.data.url) || vid.dlink;
               
               if (stUrl) {
                  setExtractedVideoUrl(stUrl);
                  setFinalVideoUrl(stUrl);
               }
               
               const subUrl = vid.subtitle_url || data.subtitle || data.subtitle_url;
               if (subUrl) {
                  setExtractedSubtitleUrl(subUrl);
               }
            }
          }
        } catch (e) {
          console.error("Failed to extract Terabox via API", e);
          // On failure, fall back to original URL so player doesn't get stuck
          setExtractedVideoUrl(u);
          setFinalVideoUrl(u);
        } finally {
          setIsExtractingTerabox(false);
        }
      }
    };
    runExtraction();
  }, [movie.id, movie.videoUrl]);

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

    const videoUrlOptions = [];
    if (finalVideoUrl || extractedVideoUrl) {
      videoUrlOptions.push({ id: 'sd', label: 'Padrão (SD)', url: extractedVideoUrl || finalVideoUrl || "" });
    }
    if (movie.videoUrl2) {
      videoUrlOptions.push({ id: 'hd', label: 'Alta Definição (HD)', url: movie.videoUrl2 });
    }

    // Calcula a URL correta para cada tipo de fonte
    const playerSrc = (() => {
      if (extractedVideoUrl) return extractedVideoUrl;
      if (isDriveVideo && driveId) return `https://drive.google.com/file/d/${driveId}/preview?autoplay=1`;
      if (isYouTube) {
        const ytId = extractYouTubeId(url);
        return ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&showinfo=0&modestbranding=1` : url;
      }
      if (isMega) return url.replace('/file/', '/embed/').replace('/#!', '/embed/#!');
      if (isGDPlayer) return url;
      return finalVideoUrl || url || "";
    })();

    // While Terabox is being extracted and we have no URL yet, show pre-loading
    if (isExtractingTerabox && !extractedVideoUrl) {
      return (
        <div className="fixed inset-0 bg-black z-[3000] flex flex-col items-center justify-center gap-6">
          {movie.backdrop_path && (
            <img
              src={movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/original/${movie.backdrop_path}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
            <p className="text-white font-black uppercase tracking-widest text-xs italic">Extraindo link do vídeo...</p>
            <button onClick={onClose} className="mt-4 text-white/40 text-xs uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        <NetflixPlayer 
          src={playerSrc}
          verificationUrl={isKingX && !extractedVideoUrl ? (movie.videoUrl || undefined) : undefined}
          subtitleUrl={extractedSubtitleUrl || undefined}
          title={displayTitle}
          seriesTitle={movie.type === 'series' ? (movie.title || movie.name || "") : undefined}
          episodes={movie.episodes}
          onSelectEpisode={(ep) => {
            if (onPlayNext) onPlayNext(movie, ep.videoUrl || ep.videoUrl2 || "");
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
              onPlayNext(movie, movie.episodes[currentIndex + 1].videoUrl);
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
