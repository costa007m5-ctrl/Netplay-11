import React, { useEffect, useState, useRef } from 'react';
import { Play, Info, Sparkles, Star, ChevronDown } from 'lucide-react';
import tmdb, { requests, getMovieLogo } from '../services/tmdb';
import { Movie } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface BannerProps {
  onPlay: (movie: Movie, episodeUrl?: string) => void;
  onInfo: (movie: Movie) => void;
  movieOverride?: Movie | null;
  movies?: Movie[];
}

const Banner = React.memo(({ onPlay, onInfo, movieOverride, movies = [] }: BannerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const prevMovieId = useRef<number | null>(null);

  useEffect(() => {
    if (movieOverride) { setMovie(movieOverride); return; }
    if (movies && movies.length > 0) {
      setMovie(movies[currentIndex]);
    } else {
      tmdb.get(requests.fetchNetflixOriginals).then(r => {
        setMovie(r.data.results[0]);
      }).catch(() => {});
    }
  }, [movieOverride, movies, currentIndex]);

  useEffect(() => {
    if (movieOverride || isPaused || !movies || movies.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % Math.min(movies.length, 5));
    }, 8000);
    return () => clearInterval(interval);
  }, [movieOverride, isPaused, movies]);

  useEffect(() => {
    if (!movie?.id || movie.id === prevMovieId.current) return;
    prevMovieId.current = movie.id;
    setLogoUrl(null);
    setImgLoaded(false);
    getMovieLogo(movie.id, (movie as any).name ? 'tv' : 'movie').then(logo => {
      setLogoUrl(logo);
    });
  }, [movie?.id]);

  function truncate(str: string, n: number) {
    return str?.length > n ? str.substr(0, n - 1) + '...' : str;
  }

  // Use `original` size for maximum sharpness on the banner
  const backgroundUrl = movie?.backdrop_path?.startsWith('http')
    ? movie.backdrop_path
    : movie?.backdrop_path
      ? `https://image.tmdb.org/t/p/original/${movie.backdrop_path}`
      : '';

  const savedProgress = movie ? parseFloat(localStorage.getItem(`netplay_progress_${movie.id}`) || '0') : 0;
  const savedUrl = movie ? localStorage.getItem(`netplay_progress_url_${movie.id}`) : null;

  const savedEpisodeInfo = (() => {
    if (!movie || movie.type !== 'series' || !movie.episodes || !savedUrl) return null;
    const ep = movie.episodes.find((e: any) => e.videoUrl === savedUrl || e.videoUrl2 === savedUrl);
    return ep ? `T${ep.season} E${ep.episode}` : null;
  })();

  const handlePlayClick = () => {
    if (!movie) return;
    const defaultUrl = movie.type === 'series' && movie.episodes?.length > 0 ? movie.episodes[0].videoUrl : movie.videoUrl;
    onPlay(movie, savedUrl || defaultUrl);
  };

  return (
    <header
      className="relative text-white flex flex-col justify-end overflow-hidden bg-[#080808]"
      style={{ height: 'min(100svh, 760px)', minHeight: '560px' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background image — full resolution for maximum sharpness */}
      {backgroundUrl && (
        <AnimatePresence mode="wait">
          <motion.div
            key={movie?.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 1.04 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute inset-0 z-0"
          >
            <img
              src={backgroundUrl}
              alt=""
              className="w-full h-full object-cover object-[center_15%]"
              style={{ imageRendering: 'auto', backfaceVisibility: 'hidden' }}
              onLoad={() => setImgLoaded(true)}
              fetchPriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Cinematic gradient layers — bottom-heavy so image stays sharp at top */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Lateral vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-black/30" />
        {/* Bottom fade — tall so content is always readable */}
        <div className="absolute bottom-0 left-0 right-0 h-[75%] bg-gradient-to-t from-[#080808] via-[#080808]/60 to-transparent" />
        {/* Very subtle top darkening */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      {/* Slide Indicators */}
      {movies.length > 1 && !movieOverride && (
        <div className="absolute top-1/2 right-5 md:right-10 -translate-y-1/2 z-30 flex flex-col items-center gap-2.5">
          {movies.slice(0, 5).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`transition-all duration-400 rounded-full ${
                i === currentIndex
                  ? 'w-1.5 h-10 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                  : 'w-1 h-4 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-20 px-5 md:px-16 pb-10 md:pb-16 max-w-4xl">
        <AnimatePresence mode="wait">
          {movie && (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="space-y-4 md:space-y-6"
            >
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1.5 bg-[#e50914] px-3 md:px-5 py-1.5 md:py-2 rounded-md shadow-[0_0_20px_rgba(229,9,20,0.4)]">
                  <Sparkles size={11} className="text-white md:w-3.5 md:h-3.5" />
                  <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.25em]">Catálogo Premium</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 md:px-5 py-1.5 md:py-2 rounded-md border border-white/15">
                  <Star size={11} className="text-yellow-400 fill-yellow-400 md:w-3.5 md:h-3.5" />
                  <span className="text-[9px] md:text-[11px] font-bold text-white/90">{movie.vote_average?.toFixed(1) || '—'}</span>
                </div>
                {movie.release_date && (
                  <div className="hidden sm:flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/10">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300">
                      {new Date(movie.release_date).getFullYear()}
                    </span>
                  </div>
                )}
              </div>

              {/* Title — logo or text */}
              {logoUrl ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="h-20 md:h-36 lg:h-44 w-fit max-w-[85%]"
                >
                  <img
                    src={logoUrl}
                    alt={movie?.title || movie?.name}
                    className="h-full w-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]"
                    referrerPolicy="no-referrer"
                    decoding="async"
                  />
                </motion.div>
              ) : (
                <h1 className="text-4xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter italic leading-[0.88] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] select-none pr-4">
                  {movie?.title || movie?.name || movie?.original_name}
                </h1>
              )}

              {/* Synopsis */}
              <p className="max-w-lg leading-relaxed text-[11px] md:text-sm text-gray-300 font-medium line-clamp-2 md:line-clamp-3 drop-shadow-md">
                {truncate(movie?.overview || '', 220) || 'Explore agora este conteúdo exclusivo em altíssima definição.'}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 pt-1">
                <motion.button
                  whileHover={{ scale: 1.03, brightness: 1.1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePlayClick}
                  className="cursor-pointer text-white font-black rounded-lg px-6 md:px-10 py-3 md:py-4 bg-[#e50914] flex items-center gap-2.5 md:gap-3 text-[11px] md:text-sm uppercase tracking-[0.2em] shadow-[0_4px_20px_rgba(229,9,20,0.45)] hover:bg-[#ff0f1f] transition-colors"
                >
                  <Play fill="white" size={16} className="md:w-5 md:h-5" />
                  {savedProgress > 5 ? (savedEpisodeInfo ? `Continuar (${savedEpisodeInfo})` : 'Continuar') : (movie.type === 'series' ? 'Assistir Série' : 'Assistir')}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.18)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onInfo(movie)}
                  className="cursor-pointer text-white font-black rounded-lg px-6 md:px-10 py-3 md:py-4 bg-white/10 border border-white/25 flex items-center gap-2.5 md:gap-3 text-[11px] md:text-sm backdrop-blur-md uppercase tracking-[0.2em] hover:bg-white/16 transition-colors"
                >
                  <Info size={16} className="md:w-5 md:h-5" /> Detalhes
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: imgLoaded ? 0.4 : 0 }}
        transition={{ delay: 2, duration: 0.6 }}
        className="absolute bottom-3 right-1/2 translate-x-1/2 z-20 hidden md:flex flex-col items-center gap-1"
      >
        <ChevronDown size={18} className="text-white animate-bounce" />
      </motion.div>

      {/* Red accent line on left edge */}
      <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-transparent via-[#e50914]/70 to-transparent z-30 hidden lg:block" />
    </header>
  );
});

export default Banner;
