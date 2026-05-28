import React, { useEffect, useState, useRef } from 'react';
import { Play, Info, Sparkles, Star, ChevronDown, Clock } from 'lucide-react';
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

  const year = movie?.release_date
    ? new Date(movie.release_date).getFullYear()
    : movie?.first_air_date
    ? new Date((movie as any).first_air_date).getFullYear()
    : null;

  return (
    <header
      className="relative text-white flex flex-col justify-end overflow-hidden"
      style={{ height: 'min(100svh, 780px)', minHeight: '580px', backgroundColor: '#050505' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background image */}
      {backgroundUrl && (
        <AnimatePresence mode="wait">
          <motion.div
            key={movie?.id}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 1.06 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
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

      {/* Cinematic gradient stack */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Bottom cinema fade */}
        <div className="cinema-overlay absolute inset-0" />
        {/* Left side fade for readability */}
        <div className="hero-side-fade absolute inset-0" />
        {/* Subtle top darkening for navbar */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
        {/* Overall depth layer */}
        <div className="absolute inset-0 bg-black/15" />
      </div>

      {/* Slide Indicators — vertical right side */}
      {movies.length > 1 && !movieOverride && (
        <div className="absolute top-1/2 right-5 md:right-8 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
          {movies.slice(0, 5).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`transition-all duration-500 rounded-full ${
                i === currentIndex
                  ? 'w-1.5 h-12 bg-red-500 shadow-[0_0_15px_rgba(255,26,26,0.7)]'
                  : 'w-1 h-5 bg-white/20 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Hero Content */}
      <div className="relative z-20 px-5 md:px-14 pb-12 md:pb-20 max-w-3xl">
        <AnimatePresence mode="wait">
          {movie && (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-4 md:space-y-5"
            >
              {/* Badges row */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="flex flex-wrap items-center gap-2 md:gap-3"
              >
                <div className="flex items-center gap-1.5 bg-[#ff1a1a] px-3 md:px-4 py-1.5 rounded-md shadow-[0_0_20px_rgba(255,26,26,0.5)] neon-glow-red">
                  <Sparkles size={10} className="text-white md:w-3 md:h-3" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em]">Catálogo Premium</span>
                </div>
                {movie.vote_average && movie.vote_average > 0 ? (
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-md border border-white/15">
                    <Star size={10} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[9px] md:text-[11px] font-bold text-white/90">{movie.vote_average.toFixed(1)}</span>
                  </div>
                ) : null}
                {year && (
                  <div className="hidden sm:flex items-center bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/10">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300">{year}</span>
                  </div>
                )}
                {movie.type === 'series' && (
                  <div className="hidden sm:flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/10">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300">Série</span>
                  </div>
                )}
              </motion.div>

              {/* Title */}
              {logoUrl ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="h-16 md:h-32 lg:h-40 w-fit max-w-[80%]"
                >
                  <img
                    src={logoUrl}
                    alt={movie?.title || movie?.name}
                    className="h-full w-auto object-contain drop-shadow-[0_6px_30px_rgba(0,0,0,1)]"
                    referrerPolicy="no-referrer"
                    decoding="async"
                  />
                </motion.div>
              ) : (
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="text-4xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter italic leading-[0.88] text-white drop-shadow-[0_6px_30px_rgba(0,0,0,1)] select-none pr-4 section-title-premium"
                >
                  {movie?.title || movie?.name || movie?.original_name}
                </motion.h1>
              )}

              {/* Continue watching info */}
              {savedProgress > 5 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <Clock size={11} className="text-red-400" />
                  <span className="text-[9px] md:text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                    Continue de onde parou
                    {savedEpisodeInfo && ` — ${savedEpisodeInfo}`}
                  </span>
                  {/* Progress bar */}
                  <div className="flex-1 max-w-[120px] h-0.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${Math.min(savedProgress / 7200 * 100, 95)}%` }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Synopsis */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="max-w-md leading-relaxed text-[11px] md:text-sm text-gray-300/90 font-medium line-clamp-2 md:line-clamp-3 drop-shadow-md"
              >
                {truncate(movie?.overview || '', 220) || 'Explore agora este conteúdo exclusivo em altíssima definição.'}
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.45 }}
                className="flex flex-wrap items-center gap-3 md:gap-4 pt-1"
              >
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handlePlayClick}
                  className="btn-premium-red cursor-pointer text-white font-black rounded-xl px-7 md:px-10 py-3.5 md:py-4 flex items-center gap-2.5 md:gap-3 text-[11px] md:text-sm uppercase tracking-[0.2em] relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                  <Play fill="white" size={16} className="md:w-5 md:h-5 relative z-10" />
                  <span className="relative z-10">
                    {savedProgress > 5 ? (savedEpisodeInfo ? `Continuar (${savedEpisodeInfo})` : 'Continuar') : (movie.type === 'series' ? 'Assistir Série' : 'Assistir')}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04, backgroundColor: 'rgba(255,255,255,0.16)' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onInfo(movie)}
                  className="cursor-pointer text-white font-black rounded-xl px-7 md:px-10 py-3.5 md:py-4 bg-white/10 border border-white/20 flex items-center gap-2.5 md:gap-3 text-[11px] md:text-sm backdrop-blur-xl uppercase tracking-[0.2em] hover:bg-white/14 transition-all duration-300"
                >
                  <Info size={16} className="md:w-5 md:h-5" />
                  Detalhes
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: imgLoaded ? 0.35 : 0 }}
        transition={{ delay: 2.5, duration: 0.8 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 hidden md:flex flex-col items-center gap-1"
      >
        <ChevronDown size={18} className="text-white/70 animate-bounce" />
      </motion.div>

      {/* Red accent line on left edge */}
      <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-transparent via-[#ff1a1a]/80 to-transparent z-30 hidden lg:block shadow-[0_0_15px_rgba(255,26,26,0.5)]" />

      {/* Loading skeleton overlay */}
      {!imgLoaded && backgroundUrl && (
        <div className="absolute inset-0 z-5 skeleton-premium" />
      )}
    </header>
  );
});

export default Banner;
