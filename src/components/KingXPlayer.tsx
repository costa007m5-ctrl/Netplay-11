import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, X, ChevronLeft, Maximize, Minimize, Volume2, VolumeX, RotateCcw, Settings, Lock, Unlock, Smile, ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';
import screenfull from 'screenfull';
import { motion, AnimatePresence } from 'motion/react';

interface KingXPlayerProps {
  src: string; // URL completa do player.kingx.dev (com video_url, subtitle_url, etc)
  title: string;
  seriesTitle?: string;
  movieId?: string | number;
  backdropUrl?: string;
  posterUrl?: string;
  logoUrl?: string;
  onClose: () => void;
  onProgress?: (currentTime: number, duration?: number) => void;
  initialTime?: number;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  isMovie?: boolean;
  onSwitchPlayer?: () => void;
  isBackgroundMode?: boolean;
  onClickBackground?: () => void;
}

const KingXPlayer: React.FC<KingXPlayerProps> = ({
  src,
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
  onSwitchPlayer,
  isBackgroundMode = false,
  onClickBackground
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [showLogoOverlay, setShowLogoOverlay] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showStuckButton, setShowStuckButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const hideControlsTimer = useRef<any>(null);

  // Formata a URL para o iframe do kingx.dev
  const getIframeUrl = useCallback(() => {
    // Se a URL já é do player.kingx.dev, usa diretamente
    if (src.includes('player.kingx.dev')) {
      return src;
    }
    
    // Se é uma URL de vídeo direto, monta a URL do player
    if (src.includes('teradl.kingx.dev') || src.includes('.m3u8')) {
      const videoUrl = encodeURIComponent(src);
      return `https://player.kingx.dev/#video_url=${videoUrl}`;
    }
    
    return src;
  }, [src]);

  // Simula progresso de loading
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Mostra botão de stuck após 15 segundos
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => {
        setShowStuckButton(true);
      }, 15000);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Handler para quando o iframe carrega
  const handleIframeLoad = () => {
    setLoadingProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setShowLogoOverlay(false);
    }, 500);
  };

  // Handler para erro no iframe
  const handleIframeError = () => {
    setError('Erro ao carregar o player. Tente novamente.');
    setIsLoading(false);
  };

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (screenfull.isEnabled && containerRef.current) {
      screenfull.toggle(containerRef.current);
    }
  }, []);

  // Listener de fullscreen
  useEffect(() => {
    if (screenfull.isEnabled) {
      const handler = () => {
        setIsFullscreen(screenfull.isFullscreen);
      };
      screenfull.on('change', handler);
      return () => screenfull.off('change', handler);
    }
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      if (!isLocked) setShowControls(false);
    }, 4000);
  }, [isLocked]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [resetHideTimer]);

  // Lock orientation on mobile
  useEffect(() => {
    if (screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {});
    }
    return () => {
      if (screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
    };
  }, []);

  // Reload player
  const handleReload = () => {
    setIsLoading(true);
    setShowLogoOverlay(true);
    setLoadingProgress(0);
    setError(null);
    setShowStuckButton(false);
    
    // Force iframe reload
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      }, 100);
    }
  };

  // Background mode click handler
  if (isBackgroundMode) {
    return (
      <div 
        className="absolute inset-0 cursor-pointer"
        onClick={onClickBackground}
      >
        <iframe
          ref={iframeRef}
          src={getIframeUrl()}
          className="w-full h-full pointer-events-none"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[300] bg-black flex flex-col"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => {
        if (!isLocked && (e.target as HTMLElement).closest('.kingx-controls') === null) {
          setShowControls(prev => !prev);
        }
      }}
    >
      {/* Logo Overlay / Loading Screen */}
      <AnimatePresence>
        {showLogoOverlay && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[310] bg-black flex flex-col items-center justify-center"
          >
            {/* Background blur */}
            {(backdropUrl || posterUrl) && (
              <div className="absolute inset-0 opacity-30">
                <img 
                  src={backdropUrl || posterUrl} 
                  alt="" 
                  className="w-full h-full object-cover blur-xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />
              </div>
            )}
            
            {/* Logo or Title */}
            <div className="relative z-10 flex flex-col items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={title}
                  className="max-w-[60%] max-h-32 object-contain mb-8 drop-shadow-2xl"
                />
              ) : (
                <h1 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter text-center mb-8 px-8">
                  {title}
                </h1>
              )}
              
              {seriesTitle && (
                <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-4">
                  {seriesTitle}
                </p>
              )}
              
              {/* Progress bar */}
              <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-red-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-4">
                {loadingProgress < 100 ? 'Carregando player externo...' : 'Pronto!'}
              </p>
              
              {/* Stuck button */}
              {showStuckButton && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleReload}
                  className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-bold uppercase tracking-widest rounded-full transition-colors flex items-center gap-2"
                >
                  <RefreshCcw size={16} />
                  Tentar Novamente
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[320] bg-black/90 flex flex-col items-center justify-center p-8"
          >
            <div className="text-red-500 mb-4">
              <X size={48} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Erro ao carregar</h2>
            <p className="text-white/60 text-center mb-6">{error}</p>
            <div className="flex gap-4">
              <button
                onClick={handleReload}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-full transition-colors flex items-center gap-2"
              >
                <RefreshCcw size={16} />
                Tentar Novamente
              </button>
              {onSwitchPlayer && (
                <button
                  onClick={onSwitchPlayer}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest rounded-full transition-colors"
                >
                  Usar Player Nativo
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Iframe Player */}
      <iframe
        ref={iframeRef}
        src={getIframeUrl()}
        className="w-full h-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && !isLoading && !isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="kingx-controls absolute inset-0 z-[305] pointer-events-none"
          >
            {/* Top gradient */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
              <div className="flex items-center justify-between px-4 md:px-8 pt-4">
                {/* Back button */}
                <button 
                  onClick={onClose}
                  className="flex items-center gap-3 text-white hover:text-red-500 transition-colors group"
                >
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center group-hover:bg-red-600 transition-colors">
                    <ChevronLeft size={28} />
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-white/60 font-bold uppercase tracking-widest">Voltar</p>
                    <p className="text-lg font-black italic uppercase tracking-tight truncate max-w-xs">{title}</p>
                  </div>
                </button>

                {/* Right controls */}
                <div className="flex items-center gap-3">
                  {onSwitchPlayer && (
                    <button
                      onClick={onSwitchPlayer}
                      className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                      title="Trocar para Player Nativo"
                    >
                      <Play size={20} />
                    </button>
                  )}
                  
                  <button
                    onClick={handleReload}
                    className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                    title="Recarregar"
                  >
                    <RefreshCcw size={20} />
                  </button>
                  
                  <button
                    onClick={() => setIsLocked(true)}
                    className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                    title="Bloquear Tela"
                  >
                    <Lock size={20} />
                  </button>
                  
                  <button
                    onClick={toggleFullscreen}
                    className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                    title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                  >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom gradient - info */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
              <div className="flex items-center justify-center px-4 md:px-8 pb-4 h-full">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                  Player Externo KingX - Controles dentro do player
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock Screen Overlay */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[306] flex items-center justify-center"
            onClick={() => setIsLocked(false)}
          >
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center"
              >
                <Unlock size={28} className="text-white" />
              </motion.div>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                Toque para desbloquear
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KingXPlayer;
