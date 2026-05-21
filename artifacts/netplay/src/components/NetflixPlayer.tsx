import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, X, ChevronLeft, Settings, Subtitles, FastForward, WifiOff, AlertCircle, Cast, Tv, Share2, Info, Smile, Users, PictureInPicture, ZoomIn, ZoomOut, Lock, Unlock, Languages } from 'lucide-react';
import screenfull from 'screenfull';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { parseDynamicRef } from '../services/terabox';

interface NetflixPlayerProps {
  src: string;
  verificationUrl?: string;
  iframeFallbackUrl?: string;
  title: string;
  seriesTitle?: string;
  movieId?: string | number;
  backdropUrl?: string; // Backdrop image (landscape)
  posterUrl?: string;   // Poster image (portrait)
  logoUrl?: string;     // Movie logo PNG
  onClose: () => void;
  onProgress?: (currentTime: number, duration?: number) => void;
  initialTime?: number;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  isMovie?: boolean;
  recommendations?: any[];
  onSelectRecommendation?: (movie: any) => void;
  onSwitchPlayer?: () => void;
  subtitleUrl?: string;
  videoUrlOptions?: { id: string; label: string; url: string }[];
  isHost?: boolean;
  roomId?: string;
  profile?: any;
  maxQualityHeight?: number;
  isBackgroundMode?: boolean;
  onClickBackground?: () => void;
  autoNextOffset?: number;
  episodes?: any[];
  currentEpisodeIndex?: number;
  onSelectEpisode?: (episode: any) => void;
  preferredAudioLanguage?: string;
  recsOverlayOffset?: number;
  autoQualityCascade?: boolean;
  cascadeDelaySecs?: number;
  teraboxV1Ref?: string;
  cascadeToV3OnPenultimate?: boolean;
  dubbingOptions?: { id: string; label: string; url: string }[];
}

const NetflixPlayer: React.FC<NetflixPlayerProps> = ({ 
  src, 
  verificationUrl,
  iframeFallbackUrl,
  title, 
  seriesTitle,
  movieId,
  backdropUrl,
  posterUrl,
  logoUrl,
  onClose, 
  onProgress, 
  initialTime = 0,
  onNextEpisode,
  hasNextEpisode,
  isMovie = false,
  recommendations = [],
  onSelectRecommendation,
  onSwitchPlayer,
  subtitleUrl,
  videoUrlOptions = [],
  isHost = true,
  roomId = null,
  profile,
  maxQualityHeight,
  isBackgroundMode = false,
  onClickBackground,
  autoNextOffset,
  episodes = [],
  currentEpisodeIndex,
  onSelectEpisode,
  preferredAudioLanguage,
  recsOverlayOffset = 120,
  autoQualityCascade = false,
  cascadeDelaySecs: cascadeDelaySecsProp = 6,
  teraboxV1Ref,
  cascadeToV3OnPenultimate = true,
  dubbingOptions = [],
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mediaAttachedRef = useRef(false);
  const iframeLoadedRef = useRef(false);
  const startedHlsRef = useRef(false);
  const videoToPlayRef = useRef('');
  const failedSourcesRef = useRef<Set<string>>(new Set());
  const cascadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cascadeSucceededRef = useRef(false);
  const autoQualityCascadeRef = useRef(autoQualityCascade);
  const videoUrlOptionsRef = useRef(videoUrlOptions);
  const [cascadeDelaySecs, setCascadeDelaySecs] = useState(cascadeDelaySecsProp);
  const hlsInstanceIdRef = useRef(0);
  // Warm-up: teradl.kingx.dev links precisam de uma requisição prévia para ativar a sessão
  const warmupDoneRef = useRef(true); // true por padrão; false só para links teradl que precisam de warm-up
  const warmupAbortRef = useRef<AbortController | null>(null);
  // Stall detection: reinicia o player se o vídeo travar em buffering por muito tempo
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const parsedUrls = useMemo(() => {
    let vToPlay = src;
    let sToPlay = subtitleUrl;
    let autoV = null;
    
    try {
      // Allow extraction for kingx.dev as well, as direct iframe might be blocked.
      // We will use the original src as verificationUrl if we extract a direct link.
      if (src) {
        if (src.includes('video_url=')) {
          const urlObj = new URL(src, window.location.origin);
          
          let v = urlObj.searchParams.get('video_url');
          let sub = urlObj.searchParams.get('subtitle_url');
          
          if (!v && urlObj.hash && urlObj.hash.includes('video_url=')) {
             let hashStr = urlObj.hash.substring(1);
             if (hashStr.startsWith('/') && hashStr.includes('?')) {
               hashStr = hashStr.substring(hashStr.indexOf('?') + 1);
             }
             
             // First, globally replace URL-encoded ampersands so regex can split them
             const normalizedHashStr = hashStr.replace(/%26/g, '&').replace(/&amp;/g, '&');
             
             const vMatch = normalizedHashStr.match(/video_url=([^&]+(?:&[^&]+)*?)(?:&subtitle_url=|$)/i);
             if (vMatch && vMatch[1]) {
               v = decodeURIComponent(vMatch[1]);
             } else {
               const hashParams = new URLSearchParams(normalizedHashStr);
               v = hashParams.get('video_url');
             }
             
             const subMatch = normalizedHashStr.match(/subtitle_url=([^&]+(?:&[^&]+)*?)(?:&video_url=|$)/i);
             if (subMatch && subMatch[1]) {
                sub = decodeURIComponent(subMatch[1]);
             } else {
                const hashParams = new URLSearchParams(normalizedHashStr);
                sub = hashParams.get('subtitle_url') || sub;
             }
          }
          
          if (!v) {
            const normalizedSrc = src.replace(/%26/g, '&').replace(/&amp;/g, '&');
            const matchVid = normalizedSrc.match(/(?:[?&#])video_url=(https?[^&]+(?:&[^&]+)*?)(?:&subtitle_url=|$)/i);
            if (matchVid && matchVid[1]) {
               v = decodeURIComponent(matchVid[1]);
            }
          }
          
          if (v) vToPlay = v;
          if (sub) sToPlay = sub;
          
          if (v && src.includes('player.kingx.dev')) {
             autoV = src;
          }
        }
      }
      console.log('URL EXTRACTED:', vToPlay);
    } catch (e) {
      console.warn("URL Extraction failed", e);
    }
    
    console.log("NETFLIX_PLAYER_URLS:", { inputSrc: src, vToPlay, sToPlay, autoV });
    return { video_url: vToPlay, subtitle_url: sToPlay, autoVerificationUrl: autoV };
  }, [src, subtitleUrl]);

  const finalVerificationUrl = useMemo(() => verificationUrl || parsedUrls.autoVerificationUrl, [verificationUrl, parsedUrls.autoVerificationUrl]);

  const attemptStartHlsLoad = useCallback(() => {
    if (startedHlsRef.current) return;
    // Aguarda: mídia anexada + verificação de iframe (se houver) + warm-up do teradl (se necessário)
    if (mediaAttachedRef.current && (!finalVerificationUrl || iframeLoadedRef.current) && warmupDoneRef.current && hlsRef.current) {
        startedHlsRef.current = true;
        hlsRef.current.loadSource(videoToPlayRef.current);
    }
  }, [finalVerificationUrl]);

  const [forcedIframeMode, setForcedIframeMode] = useState(false);

  // CRÍTICO: sempre que muda de vídeo, reseta forcedIframeMode pra dar prioridade ao Netflix Player.
  // Sem isso, um vídeo que caiu pro iframe "contamina" todos os vídeos seguintes até reload manual.
  useEffect(() => {
    setForcedIframeMode(false);
    retryCountRef.current = 0;
    failedSourcesRef.current.clear();
  }, [parsedUrls.video_url]);

  const isIframeMode = useMemo(() => {
    if (forcedIframeMode) return true;
    if (!parsedUrls.video_url) return false;
    const lowerSrc = parsedUrls.video_url.toLowerCase();
    
    // Se o link for explicitamente para ser embutido e tocar como uma página Web (Iframe)
    if (
      lowerSrc.includes('player.kingx.dev') ||
      lowerSrc.includes('/embed/') ||
      lowerSrc.includes('/preview?') ||
      lowerSrc.includes('superflix') ||
      lowerSrc.includes('embed.') ||
      lowerSrc.includes('drive.google.com/file/') ||
      lowerSrc.includes('youtube.com/embed/') ||
      lowerSrc.includes('mega.nz/embed') ||
      lowerSrc.includes('gdplayer.to') ||
      lowerSrc.includes('gdplayer.org') ||
      lowerSrc.includes('vidsrc.me') ||
      lowerSrc.includes('vidsrc.to') ||
      lowerSrc.includes('vidsrc.xyz') ||
      lowerSrc.includes('vidsrc.cc') ||
      lowerSrc.includes('vidsrc.rip') ||
      lowerSrc.includes('vidsrc.net') ||
      lowerSrc.includes('vidsrc.pm') ||
      lowerSrc.includes('vidsrc.icu') ||
      lowerSrc.includes('vidsrc-embed.ru') ||
      lowerSrc.includes('vidsrc-embed.su') ||
      lowerSrc.includes('vidsrcme.su') ||
      lowerSrc.includes('vsrc.su')
    ) {
      return true;
    }
    // teradl.kingx.dev m3u8 URLs are HLS streams — play via HLS.js, NOT iframe
    if (lowerSrc.includes('teradl.kingx.dev') && lowerSrc.includes('.m3u8')) {
      return false;
    }
    // Other teradl.kingx.dev links (not m3u8) → iframe
    if (lowerSrc.includes('teradl.kingx.dev') || lowerSrc.includes('kingx')) {
      return !lowerSrc.includes('.m3u8');
    }
    
    if (lowerSrc.includes('video_url=')) {
      return false;
    }
    
    return false;
  }, [parsedUrls.video_url, forcedIframeMode]);

  const [activeSrc, setActiveSrc] = useState(parsedUrls.video_url);
  const [activeSubtitleUrl, setActiveSubtitleUrl] = useState(parsedUrls.subtitle_url);
  const [sessionKey, setSessionKey] = useState(() => Date.now());
  
  // Classificação indicativa local e estática para não quebrar dependências externas
  const ageRating = useMemo(() => {
    const ratings = ['L', '10', '12', '14', '16', '18'];
    let hash = 0;
    const str = title + (movieId || '');
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % ratings.length;
    return ratings[index];
  }, [title, movieId]);

  const [showAgeRating, setShowAgeRating] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowAgeRating(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Independent Mode Detection
  const playerMode = useMemo(() => (initialTime > 0 ? 'resume' : 'fresh'), [initialTime]);

  const toggleReparar = () => {
    setSessionKey(Date.now());
    setShowStuckButton(false);
    setError(null);
    setIsLoading(true);
  };

  // Sincroniza activeSrc apenas se a prop src mudar externamente
  useEffect(() => {
    if (parsedUrls.video_url !== activeSrc) {
      setActiveSrc(parsedUrls.video_url);
      setActiveSubtitleUrl(parsedUrls.subtitle_url);
      setSessionKey(Date.now());
      setShowStuckButton(false);
      setAutoplayBlocked(false);
      // Reset failed sources when external src changes (new movie/episode)
      failedSourcesRef.current = new Set();
    }
  }, [parsedUrls.video_url, parsedUrls.subtitle_url]);

  // Quando o ativo trocar pelo fallback, garantir que o player reinicie a sessão
  useEffect(() => {
    if (activeSrc && parsedUrls.video_url && activeSrc !== parsedUrls.video_url) {
      setSessionKey(Date.now());
      startedHlsRef.current = false;
    }
  }, [activeSrc]);

  // Manter refs atualizados para uso dentro de closures HLS (evita stale state)
  useEffect(() => { autoQualityCascadeRef.current = autoQualityCascade; });
  useEffect(() => { videoUrlOptionsRef.current = videoUrlOptions; });

  // Sincroniza o label de qualidade atual com videoUrlOptions
  useEffect(() => {
    if (videoUrlOptions && videoUrlOptions.length > 0) {
      const match = videoUrlOptions.find(o => o.url === activeSrc);
      if (match && currentQuality !== match.label) {
        setCurrentQuality(match.label);
      }
    }
  }, [activeSrc, videoUrlOptions]);

  // ── Vídeo Automático: cascata de qualidade com timeout configurável (apenas API 1 Pro) ──────────
  // Cada qualidade tem `cascadeDelaySecs` segundos para iniciar o vídeo; se não iniciar, passa para a próxima.
  // Se TODAS as qualidades falharem e teraboxV1Ref estiver disponível, tenta fallback automático para API 3.0.
  useEffect(() => {
    if (!autoQualityCascade || !activeSrc || !videoUrlOptions || videoUrlOptions.length <= 1) return;

    const currentIdx = videoUrlOptions.findIndex(o => o.url === activeSrc);
    const hasNext = videoUrlOptions.some((o, i) => i > currentIdx && !failedSourcesRef.current.has(o.url));

    // IMPORTANTE: não abortar quando hasNext=false se tiver fallback API 3.0 disponível.
    // Sem esse check, a última qualidade nunca cria um timer e o fallback nunca executa.
    if (!hasNext && !teraboxV1Ref) return;

    cascadeSucceededRef.current = false;
    const currentLabel = currentIdx >= 0 ? videoUrlOptions[currentIdx].label : 'qualidade';
    setQualityToast(`🔍 Conectando ${currentLabel}...`);

    const timer = setTimeout(() => {
      if (cascadeSucceededRef.current) return;
      const video = videoRef.current;
      const hasStarted = video && (video.currentTime > 0.5 || video.readyState >= 3);
      if (hasStarted) {
        cascadeSucceededRef.current = true;
        setQualityToast(null);
        return;
      }

      // Marcar a fonte atual como falha
      if (activeSrc) failedSourcesRef.current.add(activeSrc);

      const nextOpt = videoUrlOptions.find((o, i) => i > currentIdx && !failedSourcesRef.current.has(o.url));

      // Verifica se nextOpt é a ÚLTIMA opção disponível (ou seja, a qualidade atual é a penúltima)
      const nextOptIdx = nextOpt ? videoUrlOptions.findIndex(o => o.url === nextOpt.url) : -1;
      const hasAnyAfterNext = nextOpt
        ? videoUrlOptions.some((o, i) => i > nextOptIdx && !failedSourcesRef.current.has(o.url))
        : false;

      // Se estamos na penúltima qualidade E cascadeToV3OnPenultimate está ativo E há fallback V3:
      // pula a última qualidade (ex: Link Direto) e vai direto para API 3.0
      const shouldSkipToV3 = cascadeToV3OnPenultimate && teraboxV1Ref && nextOpt && !hasAnyAfterNext;

      if (nextOpt && !shouldSkipToV3) {
        console.log(`[AutoCascade] "${currentLabel}" sem resposta em ${cascadeDelaySecs}s → ${nextOpt.label}`);
        setQualityToast(`⏩ Tentando ${nextOpt.label}...`);
        setTimeout(() => setQualityToast(null), 3000);
        // Destrói HLS atual para cancelar qualquer retry pendente da qualidade anterior
        if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
        retryCountRef.current = 0;
        setActiveSrc(nextOpt.url);
        setCurrentQuality(nextOpt.label);
      } else if (teraboxV1Ref) {
        // Penúltima falhou (ou todas falharam) — fallback automático para API 3.0
        if (shouldSkipToV3 && nextOpt) {
          failedSourcesRef.current.add(nextOpt.url); // marcar última qualidade como ignorada
          console.log(`[AutoCascade] Penúltima "${currentLabel}" falhou → pulando para API 3.0 diretamente`);
        } else {
          console.log('[AutoCascade] Todas as qualidades da API 1 esgotadas → tentando API 3.0 (HMAC)');
        }
        setQualityToast('⚡ Mudando para API 3.0...');
        (async () => {
          try {
            const { folderUrl, filename } = parseDynamicRef(teraboxV1Ref);
            // Busca sem cache para garantir links frescos
            const res = await fetch(`/api/terabox-v3?url=${encodeURIComponent(folderUrl)}&nocache=1`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `API 3.0 retornou ${res.status}`);
            const list: any[] = Array.isArray(data.list) ? data.list : [];
            if (list.length === 0) throw new Error('API 3.0 não encontrou arquivos na pasta');
            let file: any = list[0];
            if (filename) {
              file = list.find((f: any) =>
                (f.filename || f.name) === filename ||
                (f.filename || f.name || '').toLowerCase() === filename.toLowerCase()
              ) || list[0];
            }
            // Preferência: link direto > stream_url (para máxima compatibilidade)
            const directUrl = file?.normal_dlink || file?.dlink || file?.stream_url;
            if (!directUrl) throw new Error('API 3.0 não retornou link direto para este arquivo');
            console.log('[AutoCascade] API 3.0 → link direto obtido com sucesso');
            setQualityToast('✅ API 3.0 ativada! Iniciando reprodução...');
            setTimeout(() => setQualityToast(null), 4000);
            setActiveSrc(directUrl);
            setCurrentQuality('API 3.0 (Link Direto)');
          } catch (err: any) {
            console.error('[AutoCascade] Fallback API 3.0 falhou:', err.message);
            setQualityToast('❌ Todas as opções falharam. Tente outro player.');
            setTimeout(() => setQualityToast(null), 6000);
          }
        })();
      } else {
        setQualityToast(null);
      }
    }, cascadeDelaySecs * 1000);

    cascadeTimerRef.current = timer;
    return () => { clearTimeout(timer); };
  }, [activeSrc, autoQualityCascade]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(isBackgroundMode);
  const [showControls, setShowControls] = useState(false); // Hidden by default on entry
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockOverlay, setShowUnlockOverlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  // Incrementar força reinício completo do player (warm-up + HLS do zero) — equivale a fechar/reabrir app
  const [stallRestartKey, setStallRestartKey] = useState(0);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showStuckButton, setShowStuckButton] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [error, setError] = useState<{ message: string; type: 'network' | 'format' | 'unknown' } | null>(null);
  const [bufferedPercentage, setBufferedPercentage] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Sync background mode changes
  useEffect(() => {
    setIsMuted(!!isBackgroundMode);
    if (!isBackgroundMode) {
      setShowControls(true);
      resetControlsTimer(true);
      // tentar full screen nativo ao sair do modo background
      if (containerRef.current && screenfull.isEnabled) {
        screenfull.request(containerRef.current).catch(() => {});
      }
    }
  }, [isBackgroundMode]);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [showRecsOverlay, setShowRecsOverlay] = useState(false);
  const [showEpisodesSidebar, setShowEpisodesSidebar] = useState(false);
  const [activeSeason, setActiveSeason] = useState(1);
  const [epProgressMap, setEpProgressMap] = useState<Record<number, { pos: number; dur: number }>>(() => {
    if (!movieId) return {};
    try {
      return JSON.parse(localStorage.getItem(`netplay_ep_progress_${movieId}`) || '{}');
    } catch { return {}; }
  });
  const [showTvShare, setShowTvShare] = useState(false);
  const [showLogoOverlay, setShowLogoOverlay] = useState(false);
  const [showAutoNext, setShowAutoNext] = useState(false);
  const currentEpForIntro = !isMovie ? (episodes as any[])?.find((ep: any) => ep.videoUrl === activeSrc || ep.videoUrl2 === activeSrc) : null;
  const introSkipStart: number | undefined = currentEpForIntro?.intro_skip_time;
  const showSkipIntro = !isMovie && (
    introSkipStart !== undefined
      ? (currentTime >= introSkipStart && currentTime <= introSkipStart + 150)
      : (hasNextEpisode !== undefined && currentTime >= 10 && currentTime <= 180)
  );
  const [autoNextCounter, setAutoNextCounter] = useState(10);
  const [isLandscape, setIsLandscape] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>(() => {
    return localStorage.getItem('lastQuality') || 'Auto';
  });
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [hlsAudioTracks, setHlsAudioTracks] = useState<{ id: number; name: string; lang: string; default?: boolean }[]>([]);
  const [currentAudioTrackId, setCurrentAudioTrackId] = useState<number | null>(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [nativeAudioTracks, setNativeAudioTracks] = useState<{ id: string; label: string; lang: string; enabled: boolean }[]>([]);
  const [currentNativeAudioId, setCurrentNativeAudioId] = useState<string | null>(null);
  const [showDubbingMenu, setShowDubbingMenu] = useState(false);
  const [activeDubbingId, setActiveDubbingId] = useState<string | null>(null);
  const [canCast, setCanCast] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [qualityToast, setQualityToast] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(() => {
    const saved = localStorage.getItem('autoRotate');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [objectFit, setObjectFit] = useState<'contain' | 'cover'>('contain');
  const [emotes, setEmotes] = useState<{ id: string | number; emoji: string; x: number; y: number; profileName?: string }[]>([]);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [roomUsers, setRoomUsers] = useState<any[]>([]);
  const channelRef = useRef<any>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 10));
  const lastProgressTime = useRef(0);
  
  const EMOTES = ['🔥', '😂', '😱', '😍', '😢', '👏', '👎', '❓', '🍿', '😮', '💀', '🤡'];

  const seasons = useMemo(() => {
    if (!episodes || episodes.length === 0) return [];
    return Array.from(new Set(episodes.map(e => e.season))).sort((a, b) => a - b);
  }, [episodes]);

  useEffect(() => {
    if (episodes && episodes.length > 0) {
      // Usa currentEpisodeIndex se disponível, senão tenta by URL
      if (currentEpisodeIndex !== undefined && currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length) {
        setActiveSeason(episodes[currentEpisodeIndex].season || seasons[0] || 1);
      } else if (activeSrc) {
        const currentEq = episodes.find(e => e.videoUrl === activeSrc || e.videoUrl2 === activeSrc);
        if (currentEq) {
          setActiveSeason(currentEq.season);
        } else {
          setActiveSeason(seasons[0] || 1);
        }
      }
    }
  }, [activeSrc, currentEpisodeIndex, episodes, seasons]);

  // Recarrega progresso por episódio do localStorage sempre que o sidebar abre
  useEffect(() => {
    if (showEpisodesSidebar && movieId) {
      try {
        const stored = JSON.parse(localStorage.getItem(`netplay_ep_progress_${movieId}`) || '{}');
        setEpProgressMap(stored);
      } catch {}
    }
  }, [showEpisodesSidebar, movieId]);

  const isMedianApp = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('median') || ua.includes('gonative');
  };

  const setMedianOrientation = (orientation: 'landscape' | 'portrait' | 'unlocked') => {
    try {
      if (typeof window !== 'undefined' && isMedianApp()) {
        if ((window as any).median) {
          (window as any).median.screen.setOrientation({orientation});
        } else if ((window as any).gonative) {
          (window as any).gonative.screen.setOrientation({orientation});
        } else {
          window.location.href = `median://screen/setOrientation?orientation=${orientation}`;
        }
      }
    } catch(e) {}
  };

  useEffect(() => {
    if (roomId && profile) {
      const channel = supabase.channel(`room:${roomId}`, {
        config: {
          broadcast: {
            ack: true,
          },
          presence: {
            key: clientIdRef.current,
          },
        },
      });

      channelRef.current = channel;

      let syncInterval: any;

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const users = Object.values(state).flat().map((p: any) => ({
            id: p.profileId,
            profileName: p.profileName,
            avatar: p.avatar
          }));
          
          const uniqueUsers = Array.from(new Map(users.map(item => [item.profileName, item])).values());
          setRoomUsers(uniqueUsers);
        })
        .on('broadcast', { event: 'room_event' }, ({ payload }) => {
          if (payload.sender_id === clientIdRef.current) return;

          switch (payload.type) {
            case 'sync_host':
              if (!isHost && videoRef.current) {
                const diff = Math.abs(videoRef.current.currentTime - payload.currentTime);
                // Tolerates up to 4 seconds of mismatch
                if (diff > 4) {
                  videoRef.current.currentTime = payload.currentTime;
                }
                if (payload.playing && videoRef.current.paused) {
                  // Only try to play if we have enough data to at least start
                  videoRef.current.play().catch(() => {});
                } else if (!payload.playing && !videoRef.current.paused) {
                  videoRef.current.pause();
                }
              }
              break;
            case 'play':
              if (videoRef.current && videoRef.current.paused) videoRef.current.play().catch(() => {});
              break;
            case 'pause':
              if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
              break;
            case 'seek':
              if (videoRef.current) {
                videoRef.current.currentTime = payload.time;
              }
              break;
            case 'emote':
              const x = 20 + Math.random() * 60;
              const y = 20 + Math.random() * 60;
              const id = Math.random();
              setEmotes(prev => [...prev, { id, emoji: payload.emoji, x, y, profileName: payload.profileName }]);
              setTimeout(() => {
                setEmotes(prev => prev.filter(e => e.id !== id));
              }, 3000);
              break;
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              profileId: profile.id || 'anonymous',
              profileName: profile.name || 'Usuário',
              avatar: profile.avatar_url,
              joined_at: new Date().toISOString(),
            });

            if (isHost && !syncInterval) {
              syncInterval = setInterval(() => {
                if (videoRef.current) {
                  channel.send({
                    type: 'broadcast',
                    event: 'room_event',
                    payload: { 
                      type: 'sync_host', 
                      playing: !videoRef.current.paused, 
                      currentTime: videoRef.current.currentTime,
                      sender_id: clientIdRef.current 
                    }
                  }).catch(() => {});
                }
              }, 3000);
            }
          }
        });

      return () => {
        if (syncInterval) clearInterval(syncInterval);
        channel.unsubscribe();
      };
    }
  }, [roomId, isHost, profile, movieId]);

  // Configuração inicial quando liga o componente
  useEffect(() => {
    if (videoRef.current) {
      // Ativa Picture-in-Picture automático para Chromium (ex: quando o app fica em segundo plano/muda de aba)
      try {
        if ('autoPictureInPicture' in videoRef.current) {
          (videoRef.current as any).autoPictureInPicture = true;
        }
        (videoRef.current as any).disablePictureInPicture = false;
      } catch (e) {
         console.warn("PiP feature check:", e);
      }
    }
  }, []);

  // Remote Playback API (Chromecast / AirPlay / DLNA)
  useEffect(() => {
    const video = videoRef.current as any;
    if (!video || !video.remote) return;

    const onConnecting = () => setIsCasting(true);
    const onConnect = () => setIsCasting(true);
    const onDisconnect = () => setIsCasting(false);

    video.remote.addEventListener('connecting', onConnecting);
    video.remote.addEventListener('connect', onConnect);
    video.remote.addEventListener('disconnect', onDisconnect);

    // Monitora disponibilidade de dispositivos na rede
    video.remote.watchAvailability((available: boolean) => {
      setCanCast(available);
    }).catch(() => {
      // watchAvailability não suportado — mostra botão de cast assim mesmo
      setCanCast(true);
    });

    return () => {
      try {
        video.remote.removeEventListener('connecting', onConnecting);
        video.remote.removeEventListener('connect', onConnect);
        video.remote.removeEventListener('disconnect', onDisconnect);
        video.remote.cancelWatchAvailability().catch(() => {});
      } catch {}
    };
  }, [sessionKey]);

  // PiP automático: entra no mini player quando o usuário sai da aba ou do app
  useEffect(() => {
    const enterPiP = async () => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      try {
        // Tenta API padrão (Chrome/Firefox/Edge desktop e Android Chrome)
        if (document.pictureInPictureEnabled && !document.pictureInPictureElement) {
          await video.requestPictureInPicture();
          return;
        }
        // Fallback Safari (webkit)
        const v = video as any;
        if (v.webkitSupportsPresentationMode && typeof v.webkitSetPresentationMode === 'function') {
          if (v.webkitPresentationMode !== 'picture-in-picture') {
            v.webkitSetPresentationMode('picture-in-picture');
          }
        }
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          console.warn('PiP auto-enter error:', err);
        }
      }
    };

    const exitPiP = async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return;
        }
        const v = videoRef.current as any;
        if (v?.webkitPresentationMode === 'picture-in-picture') {
          v.webkitSetPresentationMode('inline');
        }
      } catch (err: any) {
        console.warn('PiP exit error:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        enterPiP();
      } else {
        exitPiP();
      }
    };

    // pagehide cobre o caso de sair do navegador/app no mobile
    const handlePageHide = () => { enterPiP(); };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  const sendEmote = (emote: string) => {
    if (channelRef.current && roomId) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'room_event',
        payload: { type: 'emote', emoji: emote, profileName: profile?.name, sender_id: clientIdRef.current }
      }).catch((e: Error) => console.error("Emote broadcast err:", e));
    }
    
    // Always show locally immediately for instant feedback
    const x = 20 + Math.random() * 60;
    const y = 20 + Math.random() * 60;
    const id = Math.random();
    setEmotes(prev => [...prev, { id, emoji: emote, x, y, profileName: profile?.name }]);
    setTimeout(() => {
      setEmotes(prev => prev.filter(e => e.id !== id));
    }, 3000);
    
    setShowEmotePicker(false);
    resetControlsTimer();
  };

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;
  const hasSeekedRef = useRef(false);

  const resetControlsTimer = useCallback((forceShow = false) => {
    // Se o player estiver bloqueado e não estivermos forçando a exibição do cadeado (ex: botão de unlock)
    // então não mostramos os controles de reprodução (nesse caso `showControls` não deve ser true para o UI normal).
    if (isLocked && !forceShow) {
      return; 
    }
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeedMenu(false);
      setShowSettingsMenu(false);
      setShowQualityMenu(false);
      setShowEmotePicker(false);
    }, 5000); // 5s timeout as requested
  }, [isLocked]);

  const handleMouseMove = () => {
    resetControlsTimer(false);
  };

  const toggleRotation = () => {
    const newState = !autoRotate;
    setAutoRotate(newState);
    localStorage.setItem('autoRotate', JSON.stringify(newState));
  };

  const loadingFacts = useMemo(() => {
    const facts = [
      `Resolvendo link de ${title || 'este conteúdo'}...`,
      "Conectando ao servidor de streaming...",
      "Verificando autenticação de sessão...",
      "Carregando manifesto de vídeo...",
      "Baixando primeiros fragmentos...",
      "Sincronizando áudio e vídeo...",
      "Preparando melhor qualidade disponível..."
    ];
    return facts; // Keep ordered to reflect real loading phases
  }, [title]);

  const prefetchStreamHost = useCallback((url: string) => {
    try {
      const urlObj = new URL(url);
      const existing = document.querySelector(`link[rel="preconnect"][href="${urlObj.origin}"]`);
      if (existing) return;
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = urlObj.origin;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
      const dns = document.createElement('link');
      dns.rel = 'dns-prefetch';
      dns.href = urlObj.origin;
      document.head.appendChild(dns);
      setTimeout(() => { preconnect.remove(); dns.remove(); }, 60000);
    } catch (e) {}
  }, []);

  // Drive loading message from progress phases rather than a blind timer
  useEffect(() => {
    if (!isLoading) return;
    // Map progress ranges to message indices (matching loadingFacts order)
    if (loadingProgress < 15) setLoadingMessageIndex(0);       // Resolvendo link...
    else if (loadingProgress < 30) setLoadingMessageIndex(1);  // Conectando ao servidor...
    else if (loadingProgress < 45) setLoadingMessageIndex(2);  // Verificando autenticação...
    else if (loadingProgress < 60) setLoadingMessageIndex(3);  // Carregando manifesto...
    else if (loadingProgress < 75) setLoadingMessageIndex(4);  // Baixando fragmentos...
    else if (loadingProgress < 88) setLoadingMessageIndex(5);  // Sincronizando...
    else setLoadingMessageIndex(6);                             // Preparando qualidade...
  }, [isLoading, loadingProgress]);

  const hasStartedPlayedRef = useRef(false);
  const recsDismissedRef = useRef(false);
  const recsDismissedTimeRef = useRef<number | null>(null);
  const recsTargetTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    let timer: any;
    // Se estiver carregando há mais de 12 segundos, mostra o botão de ajuda, independente do progresso
    if (isLoading && !error) {
      timer = setTimeout(() => {
        setShowStuckButton(true);
      }, 12000);
    } else {
      setShowStuckButton(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading, error]);

  useEffect(() => {
    // When cascade is active, let it handle quality fallback — don't jump straight to iframe
    if (error && !autoQualityCascadeRef.current && (src.includes('kingx.dev') || src.includes('terabox') || src.includes('teradl'))) {
       console.log("Auto-switching to Iframe mode due to playback error on KingX/Terabox link");
       setForcedIframeMode(true);
       setError(null);
       setIsLoading(true);
    }
  }, [error, src]);

  useEffect(() => {
    if (isIframeMode && (src.includes('kingx.dev') || src.includes('terabox'))) {
       // KingX/Terabox iframes may require user interaction (like captchas)
       // We release the loading overlay immediately so the user can see and interact with it.
       setIsLoading(false);
       setLoadingProgress(100);
       setIsPlaying(true); // Treat as playing to hide logo overlay
    }
  }, [isIframeMode, src]);

  useEffect(() => {
    if (isIframeMode && isLoading) {
       // Timeout de segurança para fechar o loading em 10 segundos se o iframe demorar
       const t = setTimeout(() => {
         if (isLoading) {
           setIsLoading(false);
           setLoadingProgress(100);
           setIsPlaying(true);
         }
       }, 10000);
       return () => clearTimeout(t);
    }
  }, [isIframeMode, isLoading]);

  useEffect(() => {
    if (isIframeMode) {
       // O isLoading e afins serão gerenciados pelo onLoad do iframe
       return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Reset state
    setError(null);
    setIsLoading(true);
    setLoadingProgress(0);
    retryCountRef.current = 0;
    const initPlayer = () => {
      if (!video) return;

      iframeLoadedRef.current = false;
      startedHlsRef.current = false;
      mediaAttachedRef.current = false;

      // CLEANUP INDEPENDENTE
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      try {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch (e) {}

      // For teradl.kingx.dev m3u8 links, route through our server-side proxy
      // so the correct Referer header is sent — browsers can't set it via JS.
      const buildProxiedUrl = (rawUrl: string): string => {
        const lower = rawUrl.toLowerCase();
        if (
          (lower.includes('teradl.kingx.dev') || lower.includes('teraboxdownloader')) &&
          lower.includes('.m3u8')
        ) {
          const referer = encodeURIComponent('https://player.kingx.dev/');
          return `/api/proxy-stream?url=${encodeURIComponent(rawUrl)}&referer=${referer}`;
        }
        return rawUrl;
      };

      const videoToPlay = buildProxiedUrl(activeSrc);
      if (!videoToPlay) return;

      const lowerSrc = videoToPlay.toLowerCase();
      // Usar a URL ORIGINAL para detectar formato (m3u8/hls), não a proxied,
      // pois /api/proxy-stream?url=... não contém ".m3u8" na URL proxied.
      const lowerOrigSrc = activeSrc.toLowerCase();
      let startLoadTimer: NodeJS.Timeout;

      const applyHlsAudioTracks = (hls: any, retry = false) => {
        const rawTracks: any[] = hls.audioTracks || [];
        const tracks: { id: number; name: string; lang: string; default?: boolean }[] = rawTracks.map((t: any, i: number) => ({
          id: i,
          name: t.name || t.lang || `Faixa ${i + 1}`,
          lang: (t.lang || '').toLowerCase(),
          default: t.default,
        }));
        if (tracks.length > 1) {
          setHlsAudioTracks(tracks);
          const pref = (preferredAudioLanguage || 'pt-BR').toLowerCase().replace('_', '-');
          const prefBase = pref.split('-')[0];
          const isPortuguese = prefBase === 'pt' || pref.startsWith('por');
          const ptCodes = new Set(['pt', 'pt-br', 'por', 'por-br', 'pb', 'pob', 'ptbr', 'portuguese', 'pt-pt', 'por-pt']);
          // Palavras-chave nos nomes das faixas — cobre casos onde lang está vazio mas o nome é descritivo
          const ptNameKw = ['portugu', 'brasil', 'pt-br', 'ptbr', 'dub'];
          const prefTrack = isPortuguese
            ? (
                tracks.find(t => ptCodes.has(t.lang)) ||
                tracks.find(t => t.lang.startsWith('pt') || t.lang.startsWith('por') || t.lang === 'pb' || t.lang === 'pob') ||
                tracks.find(t => { const n = t.name.toLowerCase(); return ptNameKw.some(k => n.includes(k)); })
              )
            : (tracks.find(t => t.lang === pref || t.lang === prefBase || t.lang.startsWith(prefBase)));
          if (prefTrack) {
            if (prefTrack.id !== hls.audioTrack) {
              hls.audioTrack = prefTrack.id;
              setCurrentAudioTrackId(prefTrack.id);
              console.log(`[NetflixPlayer] HLS áudio auto-selecionado: ${prefTrack.name} (${prefTrack.lang})`);
            } else {
              setCurrentAudioTrackId(prefTrack.id);
            }
            // Re-aplica após 800ms para garantir que o switch foi efetivado pelo HLS.js
            if (!retry && isMounted) {
              setTimeout(() => { if (isMounted) applyHlsAudioTracks(hls, true); }, 800);
            }
          } else {
            setCurrentAudioTrackId(hls.audioTrack ?? 0);
          }
        }
      };

      const initUnifiedMode = () => {
        if (!isMounted || !video) return;
        setLoadingProgress(3);
        
        const startPoint = initialTime > 0 ? Math.max(0, initialTime - 2) : -1;
        
        if (lowerSrc.includes('.m3u8') || lowerOrigSrc.includes('.m3u8')) {
          const canPlayNative = video.canPlayType('application/vnd.apple.mpegurl') !== '';
          const isIOS = /iP(hone|od|ad)/i.test(navigator.userAgent);
          
          if (Hls.isSupported() && !isIOS) {
            const thisHlsId = ++hlsInstanceIdRef.current;
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,        // VOD: desligar baixa latência melhora seeking drasticamente
              startFragPrefetch: true,
              capLevelToPlayerSize: true,
              autoStartLoad: true,
              startLevel: -1,
              startPosition: startPoint > 0 ? startPoint : -1,
              maxBufferLength: 60,              // mais buffer = seeking mais suave
              maxMaxBufferLength: 120,
              backBufferLength: 45,             // mantém 45s atrás para seeking reverso rápido
              maxBufferHole: 0.5,               // tolera buracos pequenos sem travar
              maxFragLookUpTolerance: 0.25,     // tolerância de busca de fragmento ao dar seek
              nudgeMaxRetry: 5,
              manifestLoadingMaxRetry: 8,
              levelLoadingMaxRetry: 8,
              fragLoadingMaxRetry: 8,
              manifestLoadingRetryDelay: 300,
              levelLoadingRetryDelay: 300,
              fragLoadingRetryDelay: 300,
              fragLoadingMaxRetryTimeout: 4000,
            });
            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
              mediaAttachedRef.current = true;
              videoToPlayRef.current = videoToPlay;
              attemptStartHlsLoad();
              
                      if (finalVerificationUrl) {
                // Advance progress to show "verification handshake" phase
                setLoadingProgress(prev => Math.max(prev, 20));
                // Fallback: If iframe never fires onLoad or is blocked, start anyway
                setTimeout(() => {
                  if (!startedHlsRef.current) {
                    iframeLoadedRef.current = true;
                    setLoadingProgress(prev => Math.max(prev, 35));
                    attemptStartHlsLoad();
                  }
                }, 2500);
              }
            });
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              let parsedLevels = data.levels.map((l, i) => ({ id: i, height: l.height, bitrate: l.bitrate })).sort((a, b) => b.height - a.height);
              setQualityLevels(parsedLevels);
              setLoadingProgress(prev => Math.max(prev, 55));

              // Detect and auto-select audio tracks
              applyHlsAudioTracks(hls);
              
              if (video) {
                 video.play().catch(e => { console.warn("Autoplay block", e); setAutoplayBlocked(true); setShowControls(true); setIsPlaying(false); });
              }
            });
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
              applyHlsAudioTracks(hls);
            });
            hls.on(Hls.Events.FRAG_BUFFERED, () => {
              setLoadingProgress(prev => Math.min(Math.max(prev, 60) + 8, 95));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              console.warn("HLS Error:", data);
              if (data.fatal) {
                 console.error("FATAL HLS ERROR DETAILS:", { type: data.type, details: data.details, response: data.response });

                 const respCode = data.response?.code;
                 // PRIORIDADE NETFLIX PLAYER: damos ao HLS várias chances antes de desistir.
                 // 451/403/404 muitas vezes são transitórios (rate limit, cache stale, race no upstream).
                 // Tentamos até 4x com backoff antes de cair pro iframe.
                 const isAuthError = respCode === 451 || respCode === 403 || respCode === 404;
                 const isManifestParseError =
                   data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR ||
                   data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_VERSIONS_ERROR;
                 // Teradl links: mais tentativas porque cada retry re-aquece o link
                 // Cascata normal: menos tentativas para trocar de qualidade mais rápido
                 const isTeradlLink = videoToPlay.includes('/api/proxy-stream');
                 const MAX_RETRIES = isTeradlLink ? 5 : (autoQualityCascadeRef.current ? 2 : 7);

                 const shouldRetry = (isAuthError || data.type === Hls.ErrorTypes.NETWORK_ERROR) && retryCountRef.current < MAX_RETRIES;

                 if (shouldRetry) {
                   retryCountRef.current++;
                   // Cascata: backoff curto (500ms, 1s) para falhar rápido e trocar de qualidade
                   // Normal: backoff longo (1.8s, 3.1s, ..., 9s) para tentar mais antes de desistir
                   const retryDelay = autoQualityCascadeRef.current
                     ? Math.min(500 + retryCountRef.current * 500, 1500)
                     : Math.min(500 + retryCountRef.current * 1300, 9000);
                   const reasonTag = isAuthError ? `auth ${respCode}` : 'network';
                   console.warn(`[NetflixPlayer] HLS retry ${retryCountRef.current}/${MAX_RETRIES} (${reasonTag}) in ${retryDelay}ms`);

                   // Para links teradl, mostra toast de reaquecimento em vez de "Reconectando"
                   const isTeradlRetry = videoToPlay.includes('/api/proxy-stream') &&
                     (activeSrc || '').toLowerCase().includes('teradl.kingx.dev');

                   if (retryCountRef.current === 1) {
                     setQualityToast(isTeradlRetry ? "🔥 Reaquecendo link..." : "Reconectando...");
                     if (!isTeradlRetry) setTimeout(() => setQualityToast(null), 1500);
                   }

                   const capturedHlsId = thisHlsId;
                   setTimeout(() => {
                     // Se a instância do HLS já foi trocada (cascata mudou de qualidade), não tenta mais
                     if (hlsInstanceIdRef.current !== capturedHlsId) return;

                     // Bypass cache da borda forçando uma URL única se for auth error
                     const reload = isAuthError && videoToPlay.includes('/api/proxy-stream')
                       ? videoToPlay + (videoToPlay.includes('?') ? '&' : '?') + '_t=' + Date.now()
                       : videoToPlay;

                     const doHlsReload = () => {
                       if (hlsInstanceIdRef.current !== capturedHlsId) return;
                       if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                           data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                           isAuthError) {
                         hls.loadSource(reload);
                       } else {
                         hls.startLoad();
                       }
                     };

                     // Para links teradl: re-aquece via proxy antes de retentar, com espera
                     // escalonada após o request para dar tempo ao servidor de ativar a sessão:
                     //   retry 1 → espera 10s após request
                     //   retry 2+ → espera 15s após request
                     if (isTeradlRetry && activeSrc) {
                       const retryCurrent = retryCountRef.current;
                       const settleMs = retryCurrent <= 1 ? 10000 : 15000;
                       const reWarmReferer = encodeURIComponent('https://player.kingx.dev/');
                       const reWarmUrl = `/api/proxy-stream?url=${encodeURIComponent(activeSrc)}&referer=${reWarmReferer}&_t=${Date.now()}`;
                       console.log(`[Warmup] Re-aquecendo link (retry ${retryCurrent}/${MAX_RETRIES}), settle=${settleMs / 1000}s...`);
                       setQualityToast(`🔥 Reaquecendo link... (${retryCurrent}/${MAX_RETRIES})`);
                       // Timeout de segurança: fetch (~4s) + settle + folga (3s)
                       const safetyMs = 4000 + settleMs + 3000;
                       const reWarmTimeoutId = setTimeout(() => {
                         if (hlsInstanceIdRef.current !== capturedHlsId) return;
                         console.log('[Warmup] Re-aquecimento timeout total — retentando mesmo assim');
                         setQualityToast(null);
                         doHlsReload();
                       }, safetyMs);
                       fetch(reWarmUrl, { cache: 'no-store' })
                         .then(r => { console.log(`[Warmup] Re-aquecimento concluído (${r.status}) — aguardando ${settleMs / 1000}s...`); })
                         .catch(() => { console.log('[Warmup] Re-aquecimento falhou — aguardando mesmo assim...'); })
                         .finally(() => {
                           // Limpa toast independente do estado do HLS (evita ficar preso mostrando o toast)
                           if (hlsInstanceIdRef.current !== capturedHlsId) {
                             setQualityToast(null);
                             return;
                           }
                           // Espera intencional após request para o servidor ativar a sessão
                           setTimeout(() => {
                             setQualityToast(null); // sempre limpa, mesmo se capturedHlsId mudou
                             if (hlsInstanceIdRef.current !== capturedHlsId) return;
                             clearTimeout(reWarmTimeoutId);
                             doHlsReload();
                           }, settleMs);
                         });
                     } else {
                       doHlsReload();
                     }
                   }, retryDelay);
                   return;
                 }

                 // Se cascade está ativo, tenta próxima qualidade imediatamente em vez de ir pro iframe
                 const cascadeOpts = videoUrlOptionsRef.current;
                 if (autoQualityCascadeRef.current && cascadeOpts && cascadeOpts.length > 1) {
                   failedSourcesRef.current.add(activeSrc);
                   if (cascadeTimerRef.current) { clearTimeout(cascadeTimerRef.current); cascadeTimerRef.current = null; }
                   const curIdx = cascadeOpts.findIndex(o => o.url === activeSrc);
                   const nextOpt = cascadeOpts.find((o, i) => i > curIdx && !failedSourcesRef.current.has(o.url));
                   if (nextOpt) {
                     console.warn(`[NetflixPlayer] HLS fatal — cascade imediato para ${nextOpt.label}`);
                     setQualityToast(`⏩ Tentando ${nextOpt.label}...`);
                     setTimeout(() => setQualityToast(null), 2500);
                     try { hls.destroy(); } catch {}
                     hlsRef.current = null;
                     retryCountRef.current = 0;
                     setActiveSrc(nextOpt.url);
                     setCurrentQuality(nextOpt.label);
                     return;
                   }
                   // Todas as qualidades falharam — deixa o cascade effect lidar com o fallback v3
                   console.warn('[NetflixPlayer] HLS fatal — todas as qualidades falharam, cascade vai tentar v3');
                 }

                 // Esgotou retries OU erro não recuperável (ex: manifest parse) → cai pro iframe
                 if ((isAuthError || isManifestParseError || data.type === Hls.ErrorTypes.NETWORK_ERROR) && iframeFallbackUrl) {
                   console.warn(`[NetflixPlayer] HLS exhausted (${data.details}/${respCode}) — switching to iframe fallback`);
                   setQualityToast("Carregando player original...");
                   setTimeout(() => setQualityToast(null), 3000);
                   try { hls.destroy(); } catch {}
                   hlsRef.current = null;
                   setForcedIframeMode(true);
                   setIsLoading(false);
                   return;
                 }

                 if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                   hls.recoverMediaError();
                 } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                   setError({ message: "O servidor de vídeo falhou. A conexão pode ter expirado ou o servidor está bloqueado. Tente o player nativo.", type: 'network' });
                   setIsLoading(false);
                 } else {
                   console.error("Ignored fatal error for seamless playback attempt", data);
                 }
              }
            });
            hlsRef.current = hls;
          } else if (canPlayNative) {
            video.src = videoToPlay;
            video.load();
            video.addEventListener('loadedmetadata', () => {
              let safeStartPoint = startPoint;
              if (safeStartPoint > 0) {
                const duration = video.duration || 0;
                const threshold = isMovie ? 450 : 30;
                if (duration > 0 && safeStartPoint >= duration - threshold) { safeStartPoint = 0; }
                video.currentTime = safeStartPoint;
              }
              detectNativeAudioTracks(video);
            }, { once: true });
            video.addEventListener('canplay', () => detectNativeAudioTracks(video), { once: true });
            video.play().catch(e => { console.warn("Autoplay block", e); setAutoplayBlocked(true); setShowControls(true); setIsPlaying(false); });
          }
        } else {
          video.src = videoToPlay;
          video.load();
          video.addEventListener('loadedmetadata', () => {
               let safeStartPoint = startPoint;
               if (safeStartPoint > 0) {
                 const duration = video.duration || 0;
                 const threshold = isMovie ? 450 : 30;
                 if (duration > 0 && safeStartPoint >= duration - threshold) { safeStartPoint = 0; }
                 video.currentTime = safeStartPoint;
               }
               detectNativeAudioTracks(video);
          }, { once: true });
          video.addEventListener('canplay', () => detectNativeAudioTracks(video), { once: true });
          video.play().catch(e => { console.warn("Autoplay block", e); setAutoplayBlocked(true); setShowControls(true); setIsPlaying(false); });
        }
      };

      // EXECUÇÃO IMEDIATA
      initUnifiedMode();

      return () => {
        clearTimeout(startLoadTimer);
      };
    };

    // Adicionar listeners ANTES de carregar o vídeo
    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (onProgress) {
        if (Math.abs(time - lastProgressTime.current) >= 10) {
           onProgress(time, video.duration);
           lastProgressTime.current = time;
        }
      }

      const didSeek = Math.abs(time - lastTimeRef.current) > 2;
      lastTimeRef.current = time;

      if (time > 0.5 && video.readyState >= 3 && !video.seeking && !video.paused) {
        if (isLoading) {
          hasStartedPlayedRef.current = true;
          setIsLoading(false);
          setLoadingProgress(100);
          setShowLogoOverlay(false);
        }
        // Vídeo Automático: cancela o cascade — esta qualidade funcionou
        if (cascadeTimerRef.current) {
          clearTimeout(cascadeTimerRef.current);
          cascadeTimerRef.current = null;
          cascadeSucceededRef.current = true;
          setQualityToast(q => (q?.startsWith('🔍') || q?.startsWith('⏩')) ? null : q);
        }
      }

      if (video.duration > 0) {
        const timeFromEnd = video.duration - time;
        if (hasNextEpisode) {
          const triggerTime = autoNextOffset !== undefined ? autoNextOffset : 120;
          if (timeFromEnd <= triggerTime && timeFromEnd > 0) {
            setShowAutoNext(true);
            const countdownSeconds = Math.min(15, triggerTime);
            if (recsTargetTimeRef.current === null || didSeek) {
               recsTargetTimeRef.current = time + countdownSeconds;
            }
            const nextCounter = Math.max(0, Math.ceil(recsTargetTimeRef.current - time));
            setAutoNextCounter(nextCounter);
            // Automatic switch to next episode at 0
            if (nextCounter === 0 && onNextEpisode) {
               onNextEpisode();
            }
          } else {
            setShowAutoNext(false);
            recsTargetTimeRef.current = null;
          }
        }

        if (!hasNextEpisode) {
          const recsThreshold = recsOverlayOffset > 0 ? recsOverlayOffset : 440;
          if (timeFromEnd <= recsThreshold && timeFromEnd > 0) {
            if (recsDismissedRef.current && recsDismissedTimeRef.current !== null && time > recsDismissedTimeRef.current + 40) {
               recsDismissedRef.current = false;
               recsTargetTimeRef.current = null;
            }
            if (!recsDismissedRef.current) {
              setShowRecsOverlay(true);
              if (recsTargetTimeRef.current === null || didSeek) {
                 recsTargetTimeRef.current = time + 15;
              }
              const nextCounter = Math.max(0, Math.ceil(recsTargetTimeRef.current - time));
              setAutoNextCounter(nextCounter);
              // Automatic switch to first recommendation at 0
              if (nextCounter === 0 && onSelectRecommendation && recommendations && recommendations.length > 0) {
                 onSelectRecommendation(recommendations[0]);
              }
            }
          } else {
            if (timeFromEnd > recsThreshold) {
              setShowRecsOverlay(false);
              recsDismissedRef.current = false;
              recsTargetTimeRef.current = null;
            }
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (!hlsRef.current) {
        setCurrentQuality(getQualityLabel(video.videoHeight));
      }
    };

    const handleCanPlay = () => {
      // Don't set isLoading(false) here, let handlePlaying or handleTimeUpdate do it
      // when the video truly starts playing to prevent the loading screen from dropping early

      // Vídeo Automático: cancela o cascade quando vídeo está pronto para tocar
      if (cascadeTimerRef.current) {
        clearTimeout(cascadeTimerRef.current);
        cascadeTimerRef.current = null;
        cascadeSucceededRef.current = true;
        setQualityToast(q => (q?.startsWith('🔍') || q?.startsWith('⏩')) ? null : q);
      }

      if (video.paused) {
        // Only autoplay if we are host, OR if we are not in a room, OR if we are supposed to be playing.
        // Actually, if we are a guest, wait for playback-update to tell us to play. If we try to play automatically, we break the host's pause state.
        if (!roomId || isHost) {
          video.play().catch(err => {
            console.warn("Autoplay blocked:", err);
            setIsLoading(false);
            setLoadingProgress(100);
            setShowLogoOverlay(false);
            setShowControls(true);
            setIsPlaying(false);
          });
        }
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Only dismiss loading/buffering if the video was already playing
      // Avoids the loading overlay blinking out on initial forced pauses.
      if (hasStartedPlayedRef.current) {
        setIsBuffering(false);
      }
      if (isHost && channelRef.current && roomId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'room_event',
          payload: { type: 'pause', sender_id: clientIdRef.current }
        }).catch(() => {});
      }
    };

    const handleWaiting = () => {
      // Evita mostrar loading se já houver buffer suficiente
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        if (bufferedEnd > video.currentTime + 1.5) return;
      }
      setIsBuffering(true);

      // Stall detection: se o vídeo ficou travado por 12s APÓS ter começado a tocar,
      // reinicia o player completamente com novo warm-up (equivale a fechar e reabrir o app)
      if (hasStartedPlayedRef.current) {
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
        stallTimerRef.current = setTimeout(() => {
          stallTimerRef.current = null;
          console.log('[Stall] Vídeo travado por 12s — reiniciando player com novo warm-up');
          setQualityToast('🔄 Reiniciando player...');
          setStallRestartKey(k => k + 1);
        }, 12000);
      }
    };

    const handlePlaying = () => {
      // Cancela stall timer — o vídeo voltou a tocar
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }

      // Só esconde loading quando o vídeo realmente avançou (frame renderizado),
      // evita o "loading some uns segundos antes do play tocar"
      if (video.currentTime <= 0 || video.readyState < 3) {
        setIsPlaying(true);
        return;
      }
      hasStartedPlayedRef.current = true;
      setIsLoading(false);
      setLoadingProgress(100);
      setShowLogoOverlay(false);
      setIsBuffering(false);
      setIsPlaying(true);
      setShowStuckButton(false);
      setError(null);
      retryCountRef.current = 0;
      
      lockOrientation();

      if (isHost && channelRef.current && roomId && video) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'room_event',
          payload: { type: 'play', sender_id: clientIdRef.current }
        }).catch(() => {});
      }
      
      const lock = async () => {
        try {
          if (screen.orientation && (screen.orientation as any).lock) {
            await (screen.orientation as any).lock('landscape').catch(() => {});
            setIsLandscape(true);
          }
          setMedianOrientation('landscape');
        } catch (e) {}
      };
      lock();
    };

    const handleProgress = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const progress = Math.min(100, Math.round((bufferedEnd / video.duration) * 100));
        setBufferedPercentage(progress);
        
        if (!isLoading) {
           setLoadingProgress(100);
        } else {
           setLoadingProgress(prev => Math.max(prev, progress));
        }
        
        // We only update progress here. Hiding the loading screen should strictly wait until playback begins.
        // That is handled in handlePlaying and handleTimeUpdate to ensure frames are visible.
      }
    };

    const handleStalled = () => {
      if (video.paused && isPlaying) {
        video.play().catch(e => { console.warn("Autoplay block", e); setAutoplayBlocked(true); setShowControls(true); setIsPlaying(false); });
      }
    };

    const handleError = (e: any) => {
      // Ignora evento abort (1), que acontece ao desmontar o player ou mudar o src
      if (video.error && video.error.code === 1) return;

      // Se HLS.js estiver ativo, ele possui seu próprio tratador de erros ultra-robusto (Hls.Events.ERROR).
      // Evitamos conflito com erros nativos prematuros do HTMLMediaElement.
      if (activeSrc && activeSrc.toLowerCase().includes('.m3u8') && Hls.isSupported() && hlsRef.current) {
        return; 
      }

      // AUTO-FALLBACK entre qualidades: se a URL atual falhou e existem outras qualidades,
      // tenta a próxima imediatamente (ex: 1080p falha → tenta 720p → 480p → 360p)
      if (videoUrlOptions && videoUrlOptions.length > 1) {
        const currentIdx = videoUrlOptions.findIndex(o => o.url === activeSrc);
        // Marca a atual como falha
        if (activeSrc) failedSourcesRef.current.add(activeSrc);
        // Procura a próxima opção que ainda não falhou
        const nextOption = videoUrlOptions.find((o, i) => i !== currentIdx && !failedSourcesRef.current.has(o.url));
        if (nextOption) {
          console.warn(`[Quality fallback] ${currentIdx >= 0 ? videoUrlOptions[currentIdx].label : 'atual'} falhou, tentando ${nextOption.label}`);
          setQualityToast(`Tentando ${nextOption.label}...`);
          setTimeout(() => setQualityToast(null), 2500);
          retryCountRef.current = 0;
          setActiveSrc(nextOption.url);
          setCurrentQuality(nextOption.label);
          setIsAutoQuality(false);
          return;
        }
      }

      if (retryCountRef.current < 5) { // reduced to 5 for faster failure detection
        retryCountRef.current++;
        setTimeout(() => {
          if (video) {
            video.load();
            video.play().catch(e => { console.warn("Autoplay block", e); setAutoplayBlocked(true); setShowControls(true); setIsPlaying(false); });
          }
        }, 2000);
        return;
      }

      if (!error) {
        const lowerSrc = (activeSrc || '').toLowerCase();
        let errorMsg = "Não foi possível carregar o vídeo.";
        
        if (lowerSrc.includes('drive.google.com')) {
          errorMsg = "O Google Drive bloqueou o acesso direto a este vídeo. Tente usar o 'Player Padrão' ou verifique as configurações.";
        } else {
          errorMsg = "Erro ao carregar o vídeo. O formato pode ser incompatível ou o link expirou.";
        }

        setError({ 
          message: errorMsg, 
          type: lowerSrc.includes('drive.google.com') ? 'format' : 'network' 
        });
      }
      setIsLoading(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('seeked', () => setIsBuffering(false));
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('error', handleError);

    // ── Pré-aquecimento de links teradl.kingx.dev ─────────────────────────────────────────────────
    // Esses links exigem que uma requisição seja feita com o Referer correto antes de começar
    // a reprodução. Sem isso, o HLS.js falha na primeira tentativa e o usuário precisa fechar
    // e reabrir o player manualmente. O warm-up faz essa requisição via nosso proxy (que injeta
    // o Referer) enquanto o loading aparece normalmente, e só libera o HLS quando estiver pronto.
    const lowerActiveSrcForWarmup = (activeSrc || '').toLowerCase();
    const needsWarmup =
      (lowerActiveSrcForWarmup.includes('teradl.kingx.dev') ||
       lowerActiveSrcForWarmup.includes('teraboxdownloader')) &&
      lowerActiveSrcForWarmup.includes('.m3u8');

    // Aborta qualquer warm-up anterior (caso o usuário troque de fonte rapidamente)
    if (warmupAbortRef.current) { warmupAbortRef.current.abort(); warmupAbortRef.current = null; }
    warmupDoneRef.current = !needsWarmup;

    if (needsWarmup && activeSrc) {
      const warmupAc = new AbortController();
      warmupAbortRef.current = warmupAc;
      const warmupReferer = encodeURIComponent('https://player.kingx.dev/');
      const warmupProxyUrl = `/api/proxy-stream?url=${encodeURIComponent(activeSrc)}&referer=${warmupReferer}`;

      setLoadingProgress(prev => Math.max(prev, 8));
      setQualityToast('🔥 Conectando servidor...');

      // Tempo de espera após o request completar antes de iniciar o HLS.
      // O servidor teradl precisa desse tempo para "ativar" a sessão depois do request.
      const WARMUP_SETTLE_MS = 5000; // 5s no warm-up inicial
      // Timeout de segurança: fetch (~4s) + settle (5s) + folga (3s) = 12s
      const warmupTimeout = setTimeout(() => {
        if (!warmupAc.signal.aborted) {
          console.log('[Warmup] Timeout total — iniciando HLS sem esperar mais');
          warmupDoneRef.current = true;
          setQualityToast(null);
          attemptStartHlsLoad();
        }
      }, 12000);

      fetch(warmupProxyUrl, { signal: warmupAc.signal, cache: 'no-store' })
        .then(r => {
          console.log(`[Warmup] teradl request concluído (${r.status}) — aguardando ${WARMUP_SETTLE_MS / 1000}s para ativar sessão...`);
        })
        .catch(() => {
          console.log('[Warmup] Requisição falhou — aguardando mesmo assim antes de tentar HLS');
        })
        .finally(() => {
          if (warmupAc.signal.aborted) return;
          setQualityToast('🔥 Ativando sessão...');
          setLoadingProgress(prev => Math.max(prev, 30));
          // Espera intencional para o servidor processar antes do HLS carregar o manifesto
          setTimeout(() => {
            if (warmupAc.signal.aborted) return;
            clearTimeout(warmupTimeout);
            warmupDoneRef.current = true;
            setQualityToast(null);
            attemptStartHlsLoad();
          }, WARMUP_SETTLE_MS);
        });
    }

    let isMounted = true;
    const cleanupInit = initPlayer();

    return () => {
      isMounted = false;
      // Cancela stall timer, warm-up e HLS ao desmontar/trocar fonte
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
      if (warmupAbortRef.current) { warmupAbortRef.current.abort(); warmupAbortRef.current = null; }
      warmupDoneRef.current = true; // reset para não bloquear próxima fonte
      if (cleanupInit) cleanupInit();
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('seeked', () => setIsBuffering(false));
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('error', handleError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
    };
  }, [activeSrc, sessionKey, movieId, playerMode, stallRestartKey]);

  const lockOrientation = useCallback(async () => {
    if (!autoRotate) return;
    try {
      // Fullscreen is required before orientation lock on Android Chrome
      if (!document.fullscreenElement) {
        const el = containerRef.current || document.documentElement;
        await (el.requestFullscreen?.() ?? Promise.resolve()).catch(() => {});
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape').catch(() => {});
        setIsLandscape(true);
      }
    } catch (e) {
      console.warn("Orientation lock not supported", e);
    }
    setMedianOrientation('landscape');
  }, [autoRotate]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Auto-rotação para paisagem em dispositivos móveis
    lockOrientation();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [autoRotate, lockOrientation]);

  // Trigger DNS prefetch / preconnect early when a video URL is ready
  useEffect(() => {
    if (parsedUrls.video_url) {
      prefetchStreamHost(parsedUrls.video_url);
    }
    if (finalVerificationUrl) {
      prefetchStreamHost(finalVerificationUrl);
    }
  }, [parsedUrls.video_url, finalVerificationUrl, prefetchStreamHost]);

  // Smooth animated loading progress (1%→92% while loading, driven by real HLS milestones)
  // Phase 0-25%: URL extraction + initial connection setup
  // Phase 25-55%: Verification handshake / manifest request
  // Phase 55-85%: HLS manifest parsed + first fragments (driven by HLS events)
  // Phase 85-92%: Slow crawl until 'playing' event fires
  useEffect(() => {
    if (!isLoading || !!error) return;

    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 92) return prev;
        if (prev < 15) return prev + 2.5;
        if (prev < 40) return prev + 1.2;
        if (prev < 65) return prev + 0.5;
        if (prev < 85) return prev + 0.15;
        return prev + 0.04; // Very slow crawl past 85% — real events will jump it to 100%
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isLoading, error]);

  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;

    if (isLoading) {
      safetyTimeout = setTimeout(() => {
        if (isLoading) {
          console.warn("Safety timeout forcing exit from loading state");
          setIsLoading(false);
          setLoadingProgress(100);
          setShowLogoOverlay(false);
          
          if (videoRef.current && videoRef.current.paused) {
             videoRef.current.play().catch(e => console.warn("Safety timeout autoplay blocked", e));
          }
        }
      }, 45000); // 45 seconds — gives slow streams enough time to start
    }

    return () => {
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, [isLoading]);

  useEffect(() => {
    if (!videoRef.current || !movieId) return;
    
    const saveProgress = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        const duration = videoRef.current.duration;
        const threshold = isMovie ? 450 : 30;
        
        if (duration > 0) {
          if (time > 10 && time < (duration - threshold)) {
             localStorage.setItem(`netplay_progress_${movieId}`, time.toString());
          } else if (time >= (duration - threshold)) {
             localStorage.removeItem(`netplay_progress_${movieId}`);
          }
        }
      }
    };

    const interval = setInterval(saveProgress, 10000); // Save every 10s
    return () => {
      clearInterval(interval);
      saveProgress();
    };
  }, [movieId]);

  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => {
        setShowStuckButton(true);
      }, 10000); // 10s para mostrar botão de "Reparar"
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        lockOrientation();
        // Allow guest to initiate playback to bypass browser autoplay blocks
        video.play().catch(e => { console.warn("Autoplay block", e); setAutoplayBlocked(true); setShowControls(true); setIsPlaying(false); });
        if (isHost && channelRef.current && roomId) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'room_event',
            payload: { type: 'play', sender_id: clientIdRef.current }
          }).catch(() => {});
        }
      } else {
        if (!isHost && roomId) return; // Only host can actively pause the room
        video.pause();
        if (isHost && channelRef.current && roomId) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'room_event',
            payload: { type: 'pause', sender_id: clientIdRef.current }
          }).catch(() => {});
        }
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost && roomId) return;
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      if (isHost && channelRef.current && roomId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'room_event',
          payload: { type: 'seek', time, sender_id: clientIdRef.current }
        }).catch(() => {});
      }
    }
  };

  const skip = (amount: number) => {
    if (!isHost && roomId) return;
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
      if (isHost && channelRef.current && roomId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'room_event',
          payload: { type: 'seek', time: videoRef.current.currentTime, sender_id: clientIdRef.current }
        }).catch(() => {});
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const togglePiP = async () => {
    try {
      const video = videoRef.current as any;
      if (!video) return;

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      } else if (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === "function") {
        // Fallback para Safari (iOS/Mac)
        const currentMode = video.webkitPresentationMode;
        const newMode = currentMode === "picture-in-picture" ? "inline" : "picture-in-picture";
        video.webkitSetPresentationMode(newMode);
      }
    } catch (error) {
      console.error("PiP error:", error);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current && screenfull.isEnabled) {
      screenfull.toggle(containerRef.current);
      
      // Tentar forçar landscape ao entrar em fullscreen
      if (!screenfull.isFullscreen && screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    }
    
    // Median.co WebView fallback fullscreen
    try {
      if (isMedianApp()) {
        if (!isFullscreen) {
           window.location.href = 'median://screen/fullScreen';
        } else {
           window.location.href = 'median://screen/normalScreen';
        }
      }
    } catch(e) {}
  };

  const toggleSubtitles = () => {
    if (videoRef.current && videoRef.current.textTracks.length > 0) {
      const newMode = !showSubtitles;
      setShowSubtitles(newMode);
      videoRef.current.textTracks[0].mode = newMode ? 'showing' : 'hidden';
    }
  };

  const toggleCast = async () => {
    const video = videoRef.current as any;
    if (video?.remote) {
      try {
        // Se já está transmitindo, desconecta
        if (isCasting) {
          await video.remote.disconnect?.();
          setIsCasting(false);
          return;
        }
        // Abre o seletor nativo de dispositivos (Chromecast / AirPlay / DLNA)
        await video.remote.prompt();
      } catch (err: any) {
        console.warn("Cast prompt failed or dismissed:", err);
        // Fallback: mostra QR de compartilhamento
        setShowTvShare(true);
      }
    } else {
      setShowTvShare(true);
    }
  };

  const getQualityLabel = (height: number) => {
    if (height >= 2160) return '4K';
    if (height >= 1440) return '2K';
    if (height >= 1080) return 'FULL HD';
    if (height >= 720) return 'HD';
    return 'SD';
  };

  const getFullQualityName = (height: number) => {
    if (height >= 2160) return 'ULTRA HD 4K';
    if (height >= 1440) return 'QUAD HD 2K';
    if (height >= 1080) return 'FULL HD 1080p';
    if (height >= 720) return 'HD 720p';
    if (height >= 480) return 'PADRÃO 480p';
    if (height >= 360) return 'ECONOMIA 360p';
    return 'BÁSICO';
  };

  const getQualityColor = (height: number) => {
    if (height >= 2160) return 'from-amber-400 to-amber-600';
    if (height >= 1440) return 'from-orange-400 to-orange-600';
    if (height >= 1080) return 'from-red-500 to-red-700';
    if (height >= 720) return 'from-blue-500 to-blue-700';
    if (height >= 480) return 'from-emerald-500 to-emerald-700';
    if (height >= 360) return 'from-purple-500 to-purple-700';
    return 'from-slate-500 to-slate-700';
  };

  // Cores por label de qualidade (string). Funciona pra "FULL HD", "HD", "1080p", "720p", "480p (SD)", "Auto (Stream)", "Link Direto", etc.
  const getQualityColorByLabel = (label: string | undefined | null): string => {
    if (!label) return 'from-slate-500 to-slate-700';
    const l = label.toUpperCase();
    if (l.includes('4K') || l.includes('2160')) return 'from-amber-400 to-amber-600';
    if (l.includes('2K') || l.includes('1440') || l.includes('QUAD')) return 'from-orange-400 to-orange-600';
    if (l.includes('1080') || l.includes('FULL HD')) return 'from-red-500 to-red-700';
    if (l.includes('720') || (l.includes('HD') && !l.includes('FULL'))) return 'from-blue-500 to-blue-700';
    if (l.includes('480') || l.includes('PADRÃO') || l === 'SD') return 'from-emerald-500 to-emerald-700';
    if (l.includes('360') || l.includes('ECONOMIA')) return 'from-purple-500 to-purple-700';
    if (l.includes('240') || l.includes('BÁSICO')) return 'from-slate-500 to-slate-700';
    if (l.includes('STREAM') || l.includes('AUTO')) return 'from-teal-500 to-teal-700';
    if (l.includes('DIRETO') || l.includes('DIRECT')) return 'from-orange-500 to-orange-700';
    return 'from-gray-500 to-gray-700';
  };

  // Cor do "ponto" indicador (sem gradiente)
  const getQualityDotColor = (label: string | undefined | null): string => {
    if (!label) return 'bg-slate-500';
    const l = label.toUpperCase();
    if (l.includes('4K') || l.includes('2160')) return 'bg-amber-500';
    if (l.includes('2K') || l.includes('1440') || l.includes('QUAD')) return 'bg-orange-500';
    if (l.includes('1080') || l.includes('FULL HD')) return 'bg-red-500';
    if (l.includes('720') || (l.includes('HD') && !l.includes('FULL'))) return 'bg-blue-500';
    if (l.includes('480') || l.includes('PADRÃO') || l === 'SD') return 'bg-emerald-500';
    if (l.includes('360') || l.includes('ECONOMIA')) return 'bg-purple-500';
    if (l.includes('240') || l.includes('BÁSICO')) return 'bg-slate-500';
    if (l.includes('STREAM') || l.includes('AUTO')) return 'bg-teal-500';
    if (l.includes('DIRETO') || l.includes('DIRECT')) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const handleAudioTrackChange = (trackId: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
      setCurrentAudioTrackId(trackId);
      const track = hlsAudioTracks.find(t => t.id === trackId);
      if (track) {
        setQualityToast(`Áudio: ${track.name}`);
        setTimeout(() => setQualityToast(null), 3000);
      }
    }
    setShowAudioMenu(false);
  };

  const handleNativeAudioTrackChange = (trackId: string) => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = (video as any).audioTracks as any;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].enabled = tracks[i].id === trackId;
    }
    setCurrentNativeAudioId(trackId);
    const found = nativeAudioTracks.find(t => t.id === trackId);
    if (found) {
      setQualityToast(`Áudio: ${found.label || found.lang}`);
      setTimeout(() => setQualityToast(null), 3000);
    }
    setShowAudioMenu(false);
  };

  const snapshotNativeAudioTracks = (video: HTMLVideoElement) => {
    const tracks = (video as any).audioTracks as any;
    if (!tracks || tracks.length < 2) return false;
    const list: { id: string; label: string; lang: string; enabled: boolean }[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      list.push({
        id: t.id != null && t.id !== '' ? String(t.id) : String(i),
        label: t.label || t.language || `Faixa ${i + 1}`,
        lang: (t.language || '').toLowerCase(),
        enabled: t.enabled,
      });
    }
    setNativeAudioTracks(list);
    const enabledTrack = list.find(t => t.enabled) ?? list[0];
    setCurrentNativeAudioId(enabledTrack.id);
    // Auto-select Portuguese
    const ptCodes = ['pt', 'pt-br', 'por', 'por-br', 'pb', 'pob', 'ptbr', 'portuguese'];
    const ptTrack = list.find(t =>
      ptCodes.includes(t.lang) ||
      t.lang.startsWith('pt') ||
      t.lang.startsWith('por') ||
      t.label.toLowerCase().includes('portugu') ||
      t.label.toLowerCase().includes('português')
    );
    if (ptTrack && !ptTrack.enabled) {
      // Directly set without calling handleNativeAudioTrackChange to avoid stale closure
      const rawTracks = (video as any).audioTracks as any;
      for (let i = 0; i < rawTracks.length; i++) rawTracks[i].enabled = false;
      const rawPt = [...Array(rawTracks.length)].map((_, i) => rawTracks[i]).find((t: any) =>
        String(t.id ?? i) === ptTrack.id || String(i) === ptTrack.id
      );
      if (rawPt) rawPt.enabled = true;
      setCurrentNativeAudioId(ptTrack.id);
    }
    console.log('[NetflixPlayer] MKV/MP4 audioTracks detectados:', list);
    return true;
  };

  const detectNativeAudioTracks = (video: HTMLVideoElement) => {
    // Try immediately — works for MP4
    if (snapshotNativeAudioTracks(video)) return;
    // MKV: tracks appear asynchronously via addtrack event
    const audioTracks = (video as any).audioTracks as any;
    if (!audioTracks) return;
    const onAddTrack = () => {
      snapshotNativeAudioTracks(video);
    };
    audioTracks.addEventListener?.('addtrack', onAddTrack);
    // Also poll for up to 5 seconds for MKV files whose tracks load late
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (snapshotNativeAudioTracks(video) || attempts >= 10) {
        clearInterval(poll);
        audioTracks.removeEventListener?.('addtrack', onAddTrack);
      }
    }, 500);
  };

  const handleQualityChange = (levelId: number | string) => {
    let label = 'Auto';
    if (levelId === 'auto') {
      if (hlsRef.current) hlsRef.current.currentLevel = -1;
      setIsAutoQuality(true);
      setCurrentQuality('Auto');
      setQualityToast('Qualidade: Automático');
    } else {
      setIsAutoQuality(false);
      
      // Check if it's a fixed URL option
      const fixedOption = videoUrlOptions.find(o => o.id === levelId);
      if (fixedOption) {
        setActiveSrc(fixedOption.url);
        label = fixedOption.label;
        setCurrentQuality(label);
        setQualityToast(`Qualidade: ${fixedOption.label}`);
      } else {
        // HLS Level
        const id = typeof levelId === 'string' ? parseInt(levelId) : levelId;
        if (hlsRef.current) {
          hlsRef.current.currentLevel = id;
          const level = hlsRef.current.levels[id];
          if (level) {
            label = getQualityLabel(level.height);
            setCurrentQuality(label);
            setQualityToast(`Qualidade definida: ${label}`);
          }
        }
      }
    }
    localStorage.setItem('lastQuality', label);
    setTimeout(() => setQualityToast(null), 3000);
    setShowQualityMenu(false);
  };

  const formatTime = (time: number) => {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleContainerClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Only toggle if clicking background or the video element
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.tagName === 'VIDEO' || target.id === 'player-overlay') {
      if (isBackgroundMode) {
         if (onClickBackground) onClickBackground();
         return;
      }
      if (isLocked) {
        setShowUnlockOverlay(true);
        setTimeout(() => setShowUnlockOverlay(false), 3000);
        return;
      }
      if (showControls) {
        setShowControls(false);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      } else {
        handleMouseMove(); 
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={isBackgroundMode ? "absolute inset-0 z-0 bg-black flex items-center justify-center select-none overflow-hidden scale-105 pointer-events-auto" : "fixed inset-0 bg-black z-[3000] flex items-center justify-center select-none group overflow-hidden"}
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
      onTouchStart={handleMouseMove}
    >
      {/* Backdrop de fundo enquanto carrega ou como papel de parede */}
      
      {finalVerificationUrl && (
        <iframe 
          src={finalVerificationUrl} 
          className="absolute z-[-1] opacity-0 pointer-events-none w-1 h-1 top-0 left-0"
          title="verification"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            iframeLoadedRef.current = true;
            setLoadingProgress(prev => Math.max(prev, 35));
            attemptStartHlsLoad();
          }}
        />
      )}
      
      <AnimatePresence>
        {(isLoading || showLogoOverlay || showAutoNext || showRecsOverlay) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${(showAutoNext || showRecsOverlay) ? 'z-[2]' : 'z-[5]'}`}
          >
            {backdropUrl && (
              <img 
                src={backdropUrl.startsWith('http') ? backdropUrl : `https://image.tmdb.org/t/p/original/${backdropUrl}`}
                alt=""
                className={`w-full h-full object-cover transition-opacity duration-1000 ${logoUrl && !(showAutoNext || showRecsOverlay) ? 'opacity-40' : 'opacity-90'} ${(showAutoNext || showRecsOverlay) ? 'scale-105 brightness-[0.7]' : ''}`}
                referrerPolicy="no-referrer"
              />
            )}
            {posterUrl && !(showAutoNext || showRecsOverlay) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12 md:p-20">
                 <motion.img 
                   src={posterUrl.startsWith('http') ? posterUrl : `https://image.tmdb.org/t/p/w780/${posterUrl}`}
                   alt=""
                   className={`h-[70%] md:h-[80%] rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-white/10 ${logoUrl ? 'opacity-50' : 'opacity-100'}`}
                   initial={{ scale: 0.9, y: 20 }}
                   animate={{ scale: 1, y: 0 }}
                   referrerPolicy="no-referrer"
                 />
              </div>
            )}
            <div className={`absolute inset-0 bg-gradient-to-t ${logoUrl ? 'from-black via-black/40 to-black/60' : 'from-black/40 via-transparent to-black/40'}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay de Recomendações (Elegante e horizontal) */}
      {showRecsOverlay && recommendations.length > 0 && !isLoading && (
        <div className="absolute top-0 right-0 bottom-0 w-[90%] sm:w-[75%] md:w-[60%] lg:w-[50%] bg-gradient-to-l from-black/95 via-black/80 to-transparent z-[315] flex flex-col justify-end animate-in slide-in-from-right duration-[800ms] p-6 md:p-12 overflow-hidden pointer-events-none">
          
          <div className="pointer-events-auto flex flex-col justify-end h-full">
            <div className="flex justify-between items-end mb-4 md:mb-6 mt-auto">
              <h2 className="text-white text-2xl md:text-4xl font-black uppercase tracking-tighter italic shadow-black drop-shadow-lg">
                Descubra a Seguir
              </h2>
              <button 
                onClick={() => {
                  setShowRecsOverlay(false);
                  recsDismissedRef.current = true;
                  recsDismissedTimeRef.current = videoRef.current ? videoRef.current.currentTime : 0;
                }}
                className="text-gray-400 hover:text-white bg-white/10 rounded-full p-2 md:p-3 transition-colors mb-1 md:mb-2"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>
            
            <div className="flex overflow-x-auto snap-x scrollbar-hide gap-3 md:gap-4 pb-8 -mr-6 md:-mr-12 pr-6 md:pr-12 pointer-events-auto">
              {recommendations.slice(0, 10).map((rec, index) => (
                <div 
                  key={rec.id}
                  onClick={() => onSelectRecommendation?.(rec)}
                  className={`flex-none w-[160px] md:w-[240px] aspect-video relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-500 shadow-2xl snap-start ${index === 0 ? 'ring-2 ring-red-600 scale-100 hover:scale-105 opacity-100' : 'opacity-70 hover:opacity-100 scale-95 hover:scale-100'}`}
                >
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${rec.backdrop_path || rec.poster_path}`}
                    alt={rec.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-3 md:p-4">
                    <h4 className="text-white font-bold text-xs md:text-sm line-clamp-2 drop-shadow-md leading-tight">{rec.title || rec.name}</h4>
                    
                    {index === 0 && !hasNextEpisode && autoNextCounter > 0 && (
                       <div className="mt-2 flex items-center gap-2">
                         <div className="w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin"/>
                         <span className="text-red-500 font-bold text-[9px] md:text-[10px] tracking-widest uppercase drop-shadow-md">
                           Em {autoNextCounter}s
                         </span>
                       </div>
                    )}
                    {index === 0 && (!autoNextCounter || autoNextCounter <= 0) && (
                       <div className="mt-2 flex items-center gap-1 md:gap-2 text-red-500 font-bold text-[9px] md:text-[10px] tracking-widest uppercase drop-shadow-md">
                          <Play size={10} className="md:w-3 md:h-3" fill="currentColor" /> Reproduzir
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Espaçador para não grudar no bottom dos controllers invisíveis */}
            <div className="h-6 md:h-12 border-t border-transparent" />
          </div>
        </div>
      )}

      {/* Logo Overlay Inicial */}
      <AnimatePresence>
        {qualityToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-[400] bg-red-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-[0_10px_30px_rgba(220,38,38,0.5)] italic"
          >
            {qualityToast}
          </motion.div>
        )}
        {showLogoOverlay && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="absolute inset-0 z-[350] bg-black flex flex-col items-center justify-center p-4 overflow-hidden"
          >
            {/* Fundo com gradiente Netflix */}
            <div className="absolute inset-0 bg-gradient-radial from-red-950/20 via-black to-black" />
            
            {/* Partículas de brilho */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-red-500/40 rounded-full"
                style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%` }}
                animate={{ opacity: [0, 0.8, 0], scale: [0, 1.5, 0], y: [0, -30, -60] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
              />
            ))}

            {/* Logo NetPlay animado estilo Netflix */}
            <motion.div 
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex flex-col items-center gap-8"
            >
              {/* Ícone com brilho */}
              <div className="relative">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-red-600 rounded-3xl blur-2xl scale-110"
                />
                <div className="relative w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-red-500 to-red-800 rounded-3xl flex items-center justify-center shadow-2xl border border-red-400/20">
                  <Play size={40} fill="white" className="text-white ml-1.5 md:ml-2" />
                </div>
              </div>

              {/* Título */}
              <div className="text-center">
                <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter italic leading-none drop-shadow-2xl">
                  Net<span className="text-red-500">play</span>
                </h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-[0.3em] mt-2"
                >
                  {loadingFacts[loadingMessageIndex]}
                </motion.p>
              </div>

              {/* Barra de progresso estilo Netflix */}
              <div className="w-48 md:w-64 h-[3px] bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.max(5, loadingProgress)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão Próximo Episódio Automático e Skip Intro */}
      <AnimatePresence>
        {showAutoNext && hasNextEpisode && (
          <motion.div 
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-[5%] top-1/2 -translate-y-1/2 z-[310] w-[30%] max-w-sm flex flex-col items-center justify-center gap-6 pointer-events-auto"
          >
            <div className="text-center">
              <h3 className="text-white text-2xl md:text-3xl font-black mb-2 shadow-black drop-shadow-xl">Próximo Episódio</h3>
              <p className="text-gray-300 text-sm md:text-base font-bold shadow-black drop-shadow-lg">Começando em {autoNextCounter}...</p>
            </div>
            <button 
              onClick={(e) => {
                 e.stopPropagation();
                 if (onNextEpisode) onNextEpisode();
              }}
              className="group relative flex items-center gap-4 bg-white text-black p-2 pr-8 rounded-full font-black hover:scale-105 transition-all shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-red-600 w-0 group-hover:w-full transition-all duration-500 z-0"></div>
              <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white z-10 shadow-lg group-hover:bg-white group-hover:text-red-600 transition-colors">
                <FastForward size={28} fill="currentColor" />
              </div>
              <div className="text-left z-10 group-hover:text-white transition-colors duration-500">
                <p className="text-lg">Assistir Agora</p>
              </div>
            </button>
          </motion.div>
        )}
        
        {showSkipIntro && !showAutoNext && showControls && !isMovie && (
          <motion.button
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            onClick={(e) => {
               e.stopPropagation();
               if (videoRef.current) {
                 videoRef.current.currentTime += 85; 
                 // Pular abertura genérico de 85s
               }
            }}
            className="absolute bottom-32 right-12 z-[310] bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 px-6 py-3 rounded-md font-bold uppercase tracking-widest text-xs md:text-sm shadow-2xl backdrop-blur-md transition-all pointer-events-auto flex items-center gap-2"
          >
            <FastForward size={18} /> Pular Abertura
          </motion.button>
        )}
      </AnimatePresence>

      {/* Classificação Indicativa (Netflix Style) */}
      <AnimatePresence>
        {showAgeRating && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, transition: { duration: 1 } }}
            className="absolute top-20 left-0 bg-black/60 backdrop-blur-md rounded-r-lg border-y border-r border-white/20 p-4 px-6 z-[300] flex items-center gap-4 pointer-events-none"
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-white shadow-lg ${
              ageRating === 'L' ? 'bg-green-600' :
              ageRating === '10' ? 'bg-blue-500' :
              ageRating === '12' ? 'bg-yellow-500' :
              ageRating === '14' ? 'bg-orange-500' :
              ageRating === '16' ? 'bg-red-500' : 'bg-black border-2 border-red-600'
            }`}>
              {ageRating}
            </div>
            <div className="text-white text-sm font-medium pr-4">
              Classificação indicativa
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(showEpisodesSidebar || showSettingsMenu) && (backdropUrl || posterUrl) && (
          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 z-[5] pointer-events-none"
          >
            <img src={backdropUrl || posterUrl} className="w-full h-full object-cover opacity-60 blur-xl" alt="" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/80 to-black/95" />
          </motion.div>
        )}
      </AnimatePresence>

      {isIframeMode ? (
        <iframe
          src={forcedIframeMode ? (iframeFallbackUrl || finalVerificationUrl || src) : src}
          className="relative z-[10] w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => {
            setIsLoading(false);
            setLoadingProgress(100);
            setShowLogoOverlay(false);
            setIsPlaying(true);
            hasStartedPlayedRef.current = true;
          }}
        />
      ) : (
        <video
          ref={videoRef}
          className={`relative z-[10] w-full h-full transition-all duration-700 ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} ${(showAutoNext || showRecsOverlay || showEpisodesSidebar || showSettingsMenu) ? 'scale-[0.7] -translate-x-[15%] rounded-3xl overflow-hidden shadow-2xl origin-center' : ''}`}
          autoPlay
          playsInline
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          disablePictureInPicture={false}
          referrerPolicy="no-referrer"
          onClick={handleContainerClick}
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 2) skip(-10);
            else skip(10);
          }}
        >
          {(subtitleUrl || activeSubtitleUrl) && !(subtitleUrl || activeSubtitleUrl || '').includes('.m3u8') && (
            <track 
              kind="subtitles" 
              src={subtitleUrl || activeSubtitleUrl} 
              srcLang="pt" 
              label="Português" 
            />
          )}
        </video>
      )}

      {/* Emotes Overlay Layer */}
      <div className="absolute inset-0 z-[250] pointer-events-none overflow-hidden">
        <AnimatePresence mode="popLayout">
          {emotes.map((emote) => (
            <motion.div
              key={emote.id}
              initial={{ scale: 0, y: 100, opacity: 0, rotate: -20 }}
              animate={{ 
                scale: [1, 1.2, 1], 
                y: -100, 
                opacity: [0, 1, 1, 0],
                rotate: [0, 10, -10, 0]
              }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 4, ease: "linear" }}
              style={{
                position: 'absolute',
                left: `${emote.x}%`,
                top: `${emote.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="flex flex-col items-center gap-2"
            >
              <div className="text-5xl md:text-7xl filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] select-none">
                {emote.emoji}
              </div>
              {emote.profileName && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-4 py-1.5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl"
                >
                  <span className="text-[9px] md:text-[11px] font-black text-white uppercase tracking-[0.2em] italic whitespace-nowrap">
                    {emote.profileName}
                  </span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Overlay de Buffering Menor */}
      {isBuffering && !isLoading && !error && (
        <div className="absolute inset-0 z-[309] flex flex-col items-center justify-center p-4 pointer-events-none">
           <div className="w-16 h-16 border-4 border-white/20 border-t-red-600 rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
        </div>
      )}

      {/* Overlay de Carregamento Circular (1-100%) */}
      {isLoading && !error && (
        <div className="absolute inset-0 z-[310] flex flex-col items-center justify-center p-4">
          <div className="absolute inset-0 overflow-hidden">
             {backdropUrl && (
               <img 
                 src={backdropUrl.startsWith('http') ? backdropUrl : `https://image.tmdb.org/t/p/original/${backdropUrl}`}
                 alt=""
                 className="w-full h-full object-cover scale-105"
                 referrerPolicy="no-referrer"
               />
             )}
             <div className="absolute inset-0 bg-[#080808]/40" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]" />
          </div>

          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 flex flex-col items-center max-w-5xl text-center"
          >
            <div className="flex flex-row items-center justify-center gap-4 md:gap-8 mb-10 px-6 py-5 bg-white/5 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl transform scale-90 md:scale-100">
               <div className="flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 md:w-16 md:h-16 bg-red-600 rounded-lg md:rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                     <Play size={16} fill="white" className="text-white ml-0.5 md:ml-1 md:w-8 md:h-8" />
                  </div>
                  <div className="text-left">
                     <h2 className="text-lg md:text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Net<span className="text-red-600">play</span></h2>
                     <p className="text-[6px] md:text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em]">Original App</p>
                  </div>
               </div>

               <div className="w-px h-8 bg-white/10" />

               {logoUrl ? (
                  <motion.img 
                    src={logoUrl.startsWith('http') ? logoUrl : `https://image.tmdb.org/t/p/w500/${logoUrl}`}
                    alt={title}
                    className="h-8 md:h-12 max-w-[120px] md:max-w-[200px] object-contain filter drop-shadow-2xl"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    referrerPolicy="no-referrer"
                  />
               ) : (
                  <div className="flex flex-col relative w-[150px] md:w-[300px] overflow-hidden">
                    <div className="whitespace-nowrap flex animate-marquee">
                      <h1 className="text-white text-sm md:text-xl font-black uppercase italic tracking-tighter drop-shadow-2xl pr-8">
                        {seriesTitle ? `${seriesTitle} • ${title.replace(seriesTitle + ' - ', '')}` : title}
                      </h1>
                      <h1 className="text-white text-sm md:text-xl font-black uppercase italic tracking-tighter drop-shadow-2xl pr-8">
                        {seriesTitle ? `${seriesTitle} • ${title.replace(seriesTitle + ' - ', '')}` : title}
                      </h1>
                    </div>
                  </div>
               )}
            </div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 mb-6">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-white/10"
                />
                <motion.circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-red-600 transition-all duration-300"
                  strokeDasharray="283"
                  animate={{ strokeDashoffset: 283 - (283 * loadingProgress) / 100 }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl md:text-2xl font-black text-white italic">{Math.round(loadingProgress)}%</span>
              </div>
            </div>
            

            <motion.p 
              key={loadingMessageIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-white/80 font-black tracking-widest uppercase text-[10px] md:text-[12px] italic mt-4 max-w-lg leading-relaxed h-12 flex items-center justify-center text-balance"
            >
              {loadingFacts[loadingMessageIndex]}
            </motion.p>

          </motion.div>
        </div>
      )}

      {/* Mensagem de Erro */}
      {error && (
        <div className="absolute inset-0 z-[320] flex flex-col items-center justify-center bg-[#080808] p-6 text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center border border-red-600/30">
              {error.type === 'network' ? <WifiOff size={48} className="text-red-600" /> : <AlertCircle size={48} className="text-red-600" />}
            </div>
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center border-4 border-[#080808]"
            >
              <X size={16} className="text-white" />
            </motion.div>
          </div>
          
          <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter italic font-display">
            {error.type === 'network' ? 'Problema de Conexão' : 'Erro de Carregamento'}
          </h3>
          <p className="text-gray-400 mb-10 max-w-md leading-relaxed font-medium">
            {error.message}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <button 
              onClick={() => {
                setError(null);
                setIsLoading(true);
                setSessionKey(Date.now());
                setForcedIframeMode(false);
              }}
              className="flex-1 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all shadow-xl hover:scale-105 active:scale-95"
            >
              Tentativa 1
            </button>
            <button 
              onClick={() => {
                setError(null);
                setIsLoading(true);
                setForcedIframeMode(true);
              }}
              className="flex-1 bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95"
            >
              Tentativa 2 (Nativa)
            </button>
          </div>
        </div>
      )}

      {/* Episodes Sidebar Overlay */}
      <AnimatePresence>
        {showEpisodesSidebar && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 bottom-0 w-full md:w-[400px] bg-black/95 border-l border-white/10 z-[400] flex flex-col shadow-2xl backdrop-blur-xl"
            onMouseLeave={() => resetControlsTimer()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Episódios</h2>
              <button 
                onClick={() => setShowEpisodesSidebar(false)}
                className="text-white/60 hover:text-white hover:scale-110 transition-all p-2 rounded-full hover:bg-white/10"
                title="Fechar"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide border-b border-white/5">
              {seasons.map(season => (
                <button
                  key={season}
                  onClick={() => setActiveSeason(season)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all whitespace-nowrap ${activeSeason === season ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  Temporada {season}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {episodes?.filter(ep => ep.season === activeSeason).map(ep => {
                const globalIndex = episodes.findIndex(e => e === ep || (e.id && e.id === ep.id) || (e.episode === ep.episode && e.season === ep.season));
                const isActive = currentEpisodeIndex !== undefined
                  ? globalIndex === currentEpisodeIndex
                  : (activeSrc === ep.videoUrl || activeSrc === ep.videoUrl2);
                const epProg = epProgressMap[globalIndex];
                const progressPct = epProg && epProg.dur > 0 ? Math.min(100, Math.round((epProg.pos / epProg.dur) * 100)) : 0;
                const isWatched = progressPct >= 95;
                return (
                  <button
                    key={ep.id || globalIndex}
                    onClick={() => {
                        if (isActive) return;
                        setShowEpisodesSidebar(false);
                        const epUrl = ep.videoUrl || ep.videoUrl2 || "";
                        if (epUrl) prefetchStreamHost(epUrl);
                        if (onSelectEpisode) {
                           onSelectEpisode(ep);
                        } else {
                           setIsLoading(true);
                           setLoadingProgress(0);
                           setError(null);
                           setSessionKey(Date.now());
                           setActiveSrc(epUrl);
                        }
                    }}
                    className={`w-full text-left p-3 rounded-xl flex gap-4 items-center transition-all duration-300 ${isActive ? 'bg-red-600/15 border-l-[3px] border-l-red-500 border border-red-600/30 shadow-[0_0_24px_rgba(220,38,38,0.15)] cursor-default' : 'hover:bg-white/5 border border-transparent cursor-pointer group'}`}
                  >
                    <div className="w-28 h-16 bg-gray-900 rounded-md overflow-hidden relative shrink-0">
                       {ep.still_path ? (
                         <img src={ep.still_path.startsWith('http') ? ep.still_path : `https://image.tmdb.org/t/p/w300${ep.still_path}`} alt="" className="w-full h-full object-cover" />
                       ) : (
                         <div className="absolute inset-0 flex items-center justify-center">
                            <Tv size={24} className="text-white/20" />
                         </div>
                       )}
                       {isActive ? (
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                           <div className="flex items-end gap-[3px]">
                             <div className="w-[3px] bg-red-500 rounded-full animate-bounce" style={{ height: '8px', animationDelay: '0s' }} />
                             <div className="w-[3px] bg-red-500 rounded-full animate-bounce" style={{ height: '14px', animationDelay: '0.15s' }} />
                             <div className="w-[3px] bg-red-500 rounded-full animate-bounce" style={{ height: '10px', animationDelay: '0.3s' }} />
                           </div>
                         </div>
                       ) : null}
                       {/* Barra de progresso vermelha na thumbnail */}
                       {progressPct > 0 && !isActive && (
                         <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20 rounded-b-md overflow-hidden">
                           <div
                             className={`h-full rounded-b-md transition-all ${isWatched ? 'bg-white/60' : 'bg-red-600'}`}
                             style={{ width: `${progressPct}%` }}
                           />
                         </div>
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-bold text-sm truncate pr-2 ${isActive ? 'text-red-400' : isWatched ? 'text-white/50' : 'text-gray-300'}`}>{ep.episode}. {ep.title}</h4>
                        {isActive ? (
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-600/20 border border-red-500/40 px-2 py-0.5 rounded-full animate-pulse">
                            ● Assistindo
                          </span>
                        ) : isWatched ? (
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                            ✓ Assistido
                          </span>
                        ) : ep.runtime ? (
                          <span className="text-gray-400 text-[10px] uppercase font-bold tracking-widest shrink-0">{ep.runtime} min</span>
                        ) : null}
                      </div>
                      {ep.overview && (
                        <p className="text-gray-500 text-[10px] leading-tight line-clamp-2 md:line-clamp-3">{ep.overview}</p>
                      )}
                      {/* Barra de progresso abaixo da sinopse */}
                      {progressPct > 0 && !isActive && (
                        <div className="mt-2 h-[2px] bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isWatched ? 'bg-white/40' : 'bg-red-600'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay de Desbloqueio (Lock Screen) */}
      <AnimatePresence>
        {isLocked && showUnlockOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[4000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()} // Prevent bubbling to container which might re-trigger
          >
            <motion.div
              drag
              dragConstraints={{ top: -100, bottom: 0, left: -100, right: 100 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y < -50 || Math.abs(info.offset.x) > 50) {
                  setIsLocked(false);
                  setShowUnlockOverlay(false);
                  resetControlsTimer(true);
                }
              }}
              className="flex flex-col items-center gap-4 cursor-grab active:cursor-grabbing p-8 rounded-3xl bg-black/80 border border-white/20 shadow-2xl pointer-events-auto relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 to-transparent pointer-events-none" />
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex flex-col items-center opacity-50"
              >
                <ChevronLeft className="text-white rotate-90 translate-y-2" size={24} />
                <ChevronLeft className="text-white rotate-90" size={24} />
              </motion.div>
              <div className="flex items-center gap-4">
                 <motion.div animate={{ x: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="opacity-50 hidden md:block">
                    <ChevronLeft className="text-white" size={24} />
                 </motion.div>
                 <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center border-2 border-red-600/50 mb-2 shadow-[0_0_30px_rgba(220,38,38,0.3)] relative z-10">
                   <Lock size={32} className="text-white" />
                 </div>
                 <motion.div animate={{ x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="opacity-50 hidden md:block">
                    <ChevronLeft className="text-white rotate-180" size={24} />
                 </motion.div>
              </div>
              <p className="text-white font-black uppercase tracking-widest text-[10px] md:text-xs relative z-10">
                Arraste para desbloquear
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay de Controles */}
      {!isIframeMode && (
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-500 flex flex-col justify-between p-6 z-[305] ${showControls && !isLoading && !isLocked && !isBackgroundMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Topo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-white hover:scale-110 transition-transform">
              <ChevronLeft size={40} strokeWidth={3} />
            </button>
            <div className="flex flex-col relative w-[150px] md:w-[300px] overflow-hidden mask-image:linear-gradient(to_right,black_80%,transparent)]">
              <div className="whitespace-nowrap flex animate-marquee">
                <h1 className="text-white text-xs md:text-lg font-black uppercase italic tracking-tighter drop-shadow-md pr-8">
                  {seriesTitle ? `${seriesTitle} • ${title.replace(seriesTitle + ' - ', '')}` : title}
                </h1>
                <h1 className="text-white text-xs md:text-lg font-black uppercase italic tracking-tighter drop-shadow-md pr-8">
                  {seriesTitle ? `${seriesTitle} • ${title.replace(seriesTitle + ' - ', '')}` : title}
                </h1>
              </div>
              {roomId && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-red-600 italic">Sala de Estreia Ativa</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            {roomId && (
               <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-2 rounded-full">
                  <Users size={16} className="text-red-600" />
                  <div className="flex -space-x-2">
                    {roomUsers.map((u, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border border-black bg-gray-800 overflow-hidden" title={u.profileName}>
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px]">{u.profileName[0]}</div>}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{roomUsers.length} Online</span>
               </div>
            )}
            <button 
              onClick={toggleCast}
              className={`transition-colors ${isCasting ? 'text-red-600 animate-pulse' : 'text-white hover:text-gray-300'}`}
              title="Transmitir para TV"
            >
              <Cast size={28} />
            </button>
            <button 
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`transition-colors ${showSettingsMenu ? 'text-red-600' : 'text-white hover:text-gray-300'}`}
              title="Configurações"
            >
              <Settings size={28} />
            </button>
          </div>
        </div>

        {/* Menu de Configurações - Full Sidebar */}
        <AnimatePresence>
          {showSettingsMenu && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-full md:w-[360px] bg-black/95 border-l border-white/10 z-[320] flex flex-col shadow-2xl backdrop-blur-xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Configurações</h3>
                <button onClick={() => setShowSettingsMenu(false)} className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                {/* Ações Rápidas */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-4">Ações do Player</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(!roomId || isHost) && (
                      <button 
                        onClick={() => skip(-10)} 
                        className="py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-white/5"
                      >
                        <RotateCcw size={20} className="text-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Retornar 10s</span>
                      </button>
                    )}
                    <button 
                      onClick={togglePiP} 
                      className="py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-white/5"
                    >
                      <PictureInPicture size={20} className="text-white" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Mini Player</span>
                    </button>
                    {onSwitchPlayer && (
                      <button 
                        onClick={onSwitchPlayer}
                        className="py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-white/5"
                      >
                        <Settings size={20} className="text-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest text-center">Nativo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Alternâncias */}
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-4">Preferências</p>
                  <button 
                    onClick={toggleSubtitles}
                    disabled={!subtitleUrl && !activeSubtitleUrl}
                    className={`w-full py-4 px-5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between ${!subtitleUrl && !activeSubtitleUrl ? 'bg-white/3 border-white/5 text-gray-600 cursor-not-allowed opacity-60' : 'bg-white/5 hover:bg-white/10 text-white border-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Subtitles size={18} className={showSubtitles ? 'text-red-500' : 'text-gray-400'} />
                      <span>Legendas</span>
                    </div>
                    {subtitleUrl || activeSubtitleUrl ? (
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${showSubtitles ? 'bg-red-600' : 'bg-gray-700'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showSubtitles ? 'right-1' : 'left-1'}`} />
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 font-normal">Indisponível</span>
                    )}
                  </button>
                  <button 
                    onClick={toggleRotation}
                    className="w-full py-4 px-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <RotateCw size={18} className={autoRotate ? 'text-red-500' : 'text-gray-400'} />
                      <span>Rotação Automática</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${autoRotate ? 'bg-red-600' : 'bg-gray-700'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${autoRotate ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>
                </div>

                {/* Qualidade */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-3">Qualidade</p>
                  <button 
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="w-full py-4 px-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/5 flex items-center justify-between"
                  >
                    <span>{isAutoQuality ? 'Automático' : currentQuality}</span>
                    <Settings size={16} className={`transition-transform duration-300 ${showQualityMenu ? 'rotate-90 text-red-500' : 'text-gray-400'}`} />
                  </button>
                  
                  <AnimatePresence>
                    {showQualityMenu && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-2 overflow-hidden px-1"
                      >
                        <button
                          onClick={() => handleQualityChange('auto')}
                          className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${isAutoQuality ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                          <div className="flex items-center gap-3">
                             <div className={`w-2 h-2 rounded-full ${isAutoQuality ? 'bg-white animate-pulse' : 'bg-gray-600'}`} />
                             <span>Automático</span>
                          </div>
                          {isAutoQuality && <span className="text-[10px] font-black italic">{currentQuality}</span>}
                        </button>
                        {videoUrlOptions.map(option => (
                          <button
                            key={option.id}
                            onClick={() => handleQualityChange(option.id)}
                            className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${activeSrc === option.url ? `bg-gradient-to-r ${getQualityColorByLabel(option.label)} text-white shadow-lg border border-white/20` : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
                          >
                             <div className="flex items-center gap-3">
                               <div className={`w-10 h-5 flex items-center justify-center rounded-[3px] text-[8px] font-black bg-gradient-to-br ${getQualityColorByLabel(option.label || option.id)} text-white shadow-sm uppercase`}>
                                 {option.id}
                               </div>
                               <span>{option.label}</span>
                             </div>
                          </button>
                        ))}
                        {qualityLevels.map(level => (
                          <button
                            key={level.id}
                            onClick={() => handleQualityChange(level.id)}
                            className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${!isAutoQuality && hlsRef.current?.currentLevel === level.id ? 'bg-white/10 text-white shadow-lg border border-white/10' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
                          >
                             <div className="flex items-center gap-3">
                               <div className={`w-8 h-5 flex items-center justify-center rounded-[3px] text-[8px] font-black bg-gradient-to-br ${getQualityColor(level.height)} text-white shadow-sm`}>
                                 {getQualityLabel(level.height)}
                               </div>
                               <span>{getFullQualityName(level.height)}</span>
                             </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Áudio — HLS e/ou nativo */}
                {(hlsAudioTracks.length >= 2 || nativeAudioTracks.length >= 2) && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-3">Faixa de Áudio</p>
                    <button
                      onClick={() => setShowAudioMenu(!showAudioMenu)}
                      className="w-full py-4 px-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Languages size={14} className="text-blue-400" />
                        <span>
                          {hlsAudioTracks.length >= 2
                            ? (currentAudioTrackId !== null ? (hlsAudioTracks.find(t => t.id === currentAudioTrackId)?.name || 'Áudio') : 'Áudio')
                            : (currentNativeAudioId !== null ? (nativeAudioTracks.find(t => t.id === currentNativeAudioId)?.label || 'Áudio') : 'Áudio')}
                        </span>
                      </div>
                      <Settings size={16} className={`transition-transform duration-300 ${showAudioMenu ? 'rotate-90 text-blue-500' : 'text-gray-400'}`} />
                    </button>
                    <AnimatePresence>
                      {showAudioMenu && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 space-y-2 overflow-hidden px-1"
                        >
                          {/* HLS tracks */}
                          {hlsAudioTracks.length >= 2 && hlsAudioTracks.map(track => (
                            <button
                              key={`hls-${track.id}`}
                              onClick={() => handleAudioTrackChange(track.id)}
                              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${currentAudioTrackId === track.id ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0 ${currentAudioTrackId === track.id ? 'bg-white animate-pulse' : 'bg-gray-600'}`} />
                              <span className="flex-1 text-left">{track.name}</span>
                              {track.lang && <span className="text-[10px] uppercase tracking-widest opacity-60">{track.lang}</span>}
                            </button>
                          ))}
                          {/* Native MP4 tracks */}
                          {nativeAudioTracks.length >= 2 && nativeAudioTracks.map(track => (
                            <button
                              key={`native-${track.id}`}
                              onClick={() => handleNativeAudioTrackChange(track.id)}
                              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${currentNativeAudioId === track.id ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0 ${currentNativeAudioId === track.id ? 'bg-white animate-pulse' : 'bg-gray-600'}`} />
                              <span className="flex-1 text-left">{track.label}</span>
                              {track.lang && <span className="text-[10px] uppercase tracking-widest opacity-60">{track.lang}</span>}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Dublagem */}
                {dubbingOptions.length > 1 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-3">Fonte de Dublagem</p>
                    <button
                      onClick={() => setShowDubbingMenu(!showDubbingMenu)}
                      className="w-full py-4 px-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Languages size={14} className="text-purple-400" />
                        <span>
                          {activeDubbingId
                            ? (dubbingOptions.find(d => d.id === activeDubbingId)?.label || 'Dublagem')
                            : (dubbingOptions[0]?.label || 'Dublagem')}
                        </span>
                      </div>
                      <Settings size={16} className={`transition-transform duration-300 ${showDubbingMenu ? 'rotate-90 text-purple-500' : 'text-gray-400'}`} />
                    </button>
                    <AnimatePresence>
                      {showDubbingMenu && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 space-y-2 overflow-hidden px-1"
                        >
                          {dubbingOptions.map(opt => {
                            const isActive = activeDubbingId ? activeDubbingId === opt.id : dubbingOptions[0]?.id === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  setActiveDubbingId(opt.id);
                                  setActiveSrc(opt.url);
                                  setShowDubbingMenu(false);
                                  setQualityToast(`Dublagem: ${opt.label}`);
                                  setTimeout(() => setQualityToast(null), 3000);
                                }}
                                className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isActive ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                              >
                                <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white animate-pulse' : 'bg-gray-600'}`} />
                                <span className="flex-1 text-left">{opt.label}</span>
                                {opt.id.startsWith('v') && (
                                  <span className="text-[10px] uppercase tracking-widest opacity-60">{opt.id.toUpperCase()}</span>
                                )}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Velocidade */}
                <div className="pb-8">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-3">Velocidade de Reprodução</p>
                  <div className="flex gap-2 p-2 bg-white/5 rounded-2xl border border-white/5">
                    {[0.5, 1, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPlaybackSpeed(speed);
                          if (videoRef.current) videoRef.current.playbackRate = speed;
                        }}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${playbackSpeed === speed ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Centro (Play/Skip/Emotes) */}
      <div className="flex items-center justify-center gap-6 md:gap-20">
        
        {/* Emote Picker Trigger (For Everyone) */}
        <div className="relative group">
          <button
            onClick={() => {
              setShowEmotePicker(!showEmotePicker);
              resetControlsTimer();
            }}
            className={`p-3 md:p-5 rounded-full backdrop-blur-xl border border-white/20 transition-all active:scale-90 shadow-2xl ${showEmotePicker ? 'bg-red-600 text-white border-red-500' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Smile size={28} className="md:w-8 md:h-8" />
          </button>
          
          <AnimatePresence>
            {showEmotePicker && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 bg-black/90 backdrop-blur-3xl p-5 rounded-[2.5rem] border border-white/10 flex gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[400]"
              >
                 {EMOTES.map(emoji => (
                   <button
                     key={emoji}
                     onClick={() => sendEmote(emoji)}
                     className="text-3xl md:text-4xl hover:scale-150 transition-transform active:scale-90 p-2"
                   >
                     {emoji}
                   </button>
                 ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(!roomId || isHost) ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }} 
            className="text-white hover:scale-110 transition-transform p-4 bg-white/5 rounded-full backdrop-blur-md border border-white/10"
          >
            {isPlaying ? <Pause size={48} className="md:w-20 md:h-20" fill="white" /> : <Play size={48} className="md:w-20 md:h-20" fill="white" />}
          </button>
        ) : roomId && (
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 bg-white/5 rounded-full backdrop-blur-md border border-white/10 opacity-50">
              {isPlaying ? <Pause size={48} className="md:w-20 md:h-20" fill="white" /> : <Play size={48} className="md:w-20 md:h-20" fill="white" />}
            </div>
            <span className="text-[8px] md:text-[10px] font-black uppercase text-red-500 tracking-widest animate-pulse">Sincronizado</span>
          </div>
        )}

        {(!roomId || isHost) && (
          <button onClick={() => skip(10)} className="text-white hover:scale-110 transition-transform flex flex-col items-center">
            <RotateCw size={32} className="md:w-12 md:h-12" />
            <span className="text-[10px] md:text-xs font-bold mt-1">10</span>
          </button>
        )}
      </div>

        {/* Base (Barra de Progresso e Controles) */}
        <div className="space-y-4">
          {/* Barra de Progresso */}
          <div className={`flex items-center gap-4 group/progress ${(roomId && !isHost) ? 'pointer-events-none opacity-50' : ''}`}>
            <span className="text-white text-sm font-medium min-w-[50px]">{formatTime(currentTime)}</span>
            {currentQuality && currentQuality !== 'Auto' && (
              <span
                className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-br ${getQualityColorByLabel(currentQuality)} border border-white/20 px-2.5 py-1 rounded-md shadow-md`}
                title="Qualidade atual"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {currentQuality}
              </span>
            )}
            <div 
              className="relative flex-1 h-2 md:h-1.5 bg-gray-600/50 rounded-full cursor-pointer group/bar hover:h-3 transition-all"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                setHoverPosition(Math.max(0, Math.min(1, pos)));
                if (duration) setHoverTime(pos * duration);
              }}
              onMouseLeave={() => setHoverTime(null)}
              onTouchMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const touch = e.touches[0];
                const pos = (touch.clientX - rect.left) / rect.width;
                setHoverPosition(Math.max(0, Math.min(1, pos)));
                if (duration) setHoverTime(pos * duration);
              }}
              onTouchEnd={() => setHoverTime(null)}
            >
              {/* Barra de Carregamento (Buffer) - Parte em banco */}
              <div 
                className="absolute top-0 left-0 h-full bg-red-600/40 rounded-full transition-all duration-300"
                style={{ width: `${bufferedPercentage}%` }}
              />
              
              {/* Barra Assistida */}
              <div 
                className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-100 rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              
              {/* Botão de Progresso */}
              <div 
                className="absolute top-1/2 w-4 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)] opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none z-20"
                style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
              
              {/* Miniatura de Tempo/Cena Hover */}
              {hoverTime !== null && (
                <div 
                  className="absolute bottom-full mb-4 bg-white text-black px-3 py-1.5 rounded-lg font-black text-sm shadow-2xl pointer-events-none z-30 flex flex-col items-center"
                  style={{ left: `${hoverPosition * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {/* Seta */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[6px] border-x-transparent border-t-[6px] border-t-white" />
                  <span>{formatTime(hoverTime)}</span>
                </div>
              )}
            </div>
            <span className="text-white text-sm font-medium min-w-[50px]">{formatTime(duration - currentTime)}</span>
          </div>

          {/* Controles Inferiores */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {(!roomId || isHost) && (
                <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors">
                  {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" />}
                </button>
              )}
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLocked(true);
                  setShowControls(false);
                }} 
                className="text-white hover:text-red-500 transition-colors flex flex-col items-center gap-1 group"
              >
                <Lock size={24} className="group-hover:scale-110 transition-transform" />
                <span className="text-[8px] font-black uppercase tracking-widest hidden md:block">Bloquear</span>
              </button>

              <div className="flex items-center gap-4 group/volume">
                <button onClick={toggleMute} className="text-white">
                  {isMuted || volume === 0 ? <VolumeX size={32} /> : <Volume2 size={32} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover/volume:w-24 transition-all duration-300 accent-red-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md shadow-xl">
                {isAutoQuality && (
                  <div className={`px-1.5 py-0.5 rounded text-[8px] font-black text-white italic tracking-tighter uppercase bg-gradient-to-br ${getQualityColorByLabel(currentQuality)} shadow animate-pulse`}>
                    AUTO
                  </div>
                )}
                <div className={`px-2 py-0.5 rounded-[3px] text-[10px] md:text-[12px] font-black text-white italic tracking-tighter uppercase whitespace-nowrap bg-gradient-to-br shadow-lg ${getQualityColorByLabel(currentQuality)}`}>
                  {currentQuality}
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setObjectFit(f => f === 'contain' ? 'cover' : 'contain');
                }}
                className="text-white hover:text-gray-300 transition-all hidden md:block"
                title={objectFit === 'contain' ? "Preencher Tela" : "Ajustar à Tela"}
              >
                {objectFit === 'contain' ? <ZoomIn size={24} className="md:w-6 md:h-6 lg:w-8 lg:h-8" /> : <ZoomOut size={24} className="md:w-6 md:h-6 lg:w-8 lg:h-8" />}
              </button>

              {episodes && episodes.length > 0 && (
                <button 
                  onClick={() => {
                    setShowEpisodesSidebar(true);
                    setShowControls(false); // hide controls when sidebar opens
                  }}
                  className="hidden md:flex items-center gap-2 text-white hover:text-gray-300 font-bold bg-white/10 px-4 py-2 rounded-md border border-white/20 transition-all"
                >
                  <Tv size={20} /> Episódios
                </button>
              )}

              {hasNextEpisode && onNextEpisode && (
                <button 
                  onClick={onNextEpisode}
                  className="hidden md:flex items-center gap-2 text-white hover:text-gray-300 font-bold bg-white/10 px-4 py-2 rounded-md border border-white/20 transition-all"
                >
                  <FastForward size={20} /> Próximo
                </button>
              )}

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setObjectFit(f => f === 'contain' ? 'cover' : 'contain');
                }}
                className="text-white hover:text-gray-300 md:hidden"
                title={objectFit === 'contain' ? "Preencher Tela" : "Ajustar à Tela"}
              >
                {objectFit === 'contain' ? <ZoomIn size={28} /> : <ZoomOut size={28} />}
              </button>

              {episodes && episodes.length > 0 && (
                <button 
                  onClick={() => {
                    setShowEpisodesSidebar(true);
                    setShowControls(false);
                  }}
                  className="text-white hover:text-gray-300 md:hidden"
                  title="Episódios"
                >
                  <Tv size={28} />
                </button>
              )}

              {hasNextEpisode && onNextEpisode && (
                <button 
                  onClick={onNextEpisode}
                  className="text-white hover:text-gray-300 md:hidden"
                  title="Próximo Episódio"
                >
                  <FastForward size={28} />
                </button>
              )}

              <button onClick={toggleFullscreen} className="text-white hover:scale-110 transition-transform">
                {isFullscreen ? <Minimize size={28} className="md:w-8 md:h-8" /> : <Maximize size={28} className="md:w-8 md:h-8" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* TV Sharing Overlay Fallback */}
      <AnimatePresence>
        {showTvShare && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[500] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6"
            onClick={() => setShowTvShare(false)}
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#141414] border border-white/10 rounded-[3rem] p-10 max-w-sm w-full text-center space-y-8 shadow-[0_0_100px_rgba(220,38,38,0.3)]"
              onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col items-center">
                   <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mb-6">
                      <Tv className="text-red-600" size={32} />
                   </div>
                   <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter text-center">Transmitir para TV</h3>
                   <p className="text-gray-500 text-sm mt-2 leading-relaxed text-center">Assista em tela grande usando o navegador da sua TV:</p>
                </div>
                
                <div className="space-y-4 text-left">
                   <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-4">
                      <div className="flex gap-4 items-start">
                         <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-lg shadow-red-600/20">1</div>
                         <p className="text-white text-[11px] font-bold uppercase tracking-wider italic">Abra o Navegador (Browser) da sua Smart TV.</p>
                      </div>
                      <div className="flex gap-4 items-start">
                         <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-lg shadow-red-600/20">2</div>
                         <p className="text-white text-[11px] font-bold uppercase tracking-wider italic">Acesse este endereço:</p>
                      </div>
                      <div className="bg-black/60 p-4 rounded-xl border border-white/10 text-center">
                         <span className="text-red-600 font-mono font-black text-xl tracking-tighter">{window.location.hostname}</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex flex-col items-center gap-2">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest italic animate-pulse">Ou use o QR Code:</p>
                      <div className="bg-white p-4 rounded-2xl shadow-2xl">
                         <QRCodeSVG 
                          value={window.location.href} 
                          size={120}
                          level="H"
                          includeMargin={false}
                         />
                      </div>
                   </div>
                   <button 
                     onClick={() => setShowTvShare(false)}
                     className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs italic shadow-xl"
                   >
                     Continuar no Celular
                   </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Marca d'água quando os controles somem */}
      <AnimatePresence>
        {!showControls && !isLoading && !error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.5, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-6 left-0 right-0 z-[300] flex items-center justify-center pointer-events-none"
          >
            <div className="flex items-center gap-3 bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/5">
               {logoUrl ? (
                 <img 
                   src={logoUrl.startsWith('http') ? logoUrl : `https://image.tmdb.org/t/p/w200/${logoUrl}`}
                   alt=""
                   className="h-4 md:h-6 object-contain"
                   referrerPolicy="no-referrer"
                 />
               ) : (
                 <span className="text-white font-black italic uppercase text-[8px] md:text-[10px] tracking-tight opacity-70">{title}</span>
               )}
               
               <div className="w-px h-3 bg-white/20" />
               
               <div className="flex items-center gap-1.5">
                 <div className="w-4 h-4 md:w-5 md:h-5 bg-red-600 rounded-md flex items-center justify-center">
                    <Play size={8} fill="white" className="text-white ml-0.5" />
                 </div>
                 <span className="text-white font-black text-[10px] md:text-xs italic uppercase tracking-tighter">Net<span className="text-red-600">play</span></span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão de Fechar Dedicado para Iframe Mode */}
      {isIframeMode && (
         <button 
           onClick={onClose} 
           className="absolute top-6 left-6 z-[400] bg-black/60 backdrop-blur-md p-3 rounded-full text-white hover:bg-red-600 transition-colors pointer-events-auto shadow-2xl border border-white/10"
         >
            <ChevronLeft size={32} strokeWidth={3} />
         </button>
      )}
    </div>
  );
};

export default NetflixPlayer;
