import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Movie } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface RowProps {
  title: string;
  movies: Movie[];
  isLoading?: boolean;
  isLargeRow?: boolean;
  isContinueWatching?: boolean;
  onSelectMovie: (movie: Movie) => void;
  onToggleMyList?: (movie: Movie) => void;
  onToggleFavorite?: (movie: Movie) => void;
  myListIds?: Set<number>;
  favoriteIds?: Set<number>;
  onViewAll?: (genre: string) => void;
  cardStyle?: string;
  streamingProviders?: any[];
  type?: 'standard' | 'landscape' | 'circle' | 'wide';
  showRankNumbers?: boolean;
  rankColor?: string;
  highlightProvider?: string;
  accentColor?: string;
}

const MovieCard = React.memo(({ movie, isLargeRow, isContinueWatching, onSelectMovie, cardStyle, type = 'standard', rank, rankColor, highlightProvider, idx = 99 }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    if (imgRef.current?.complete) setIsLoaded(true);
  }, []);
  const matchPercentage = 80 + (movie.id % 20);

  const providers = useMemo(() => {
    const providersString = movie.watch_providers;
    if (!providersString) return [];
    if (providersString.includes('|')) {
      return providersString.split(';;').map((p: string) => {
        const [name, logo] = p.split('|');
        return { name, logo };
      }).reduce((acc: any[], current: any) => {
        if (!acc.find((item: any) => item.name === current.name)) acc.push(current);
        return acc;
      }, []);
    }
    const KNOWN: Record<string, string> = {
      'netflix': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
      'disney+': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
      'disney plus': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
      'max': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg',
      'hbo max': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg',
      'prime video': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png',
      'amazon prime': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png',
      'apple tv+': 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
      'apple tv plus': 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
      'paramount+': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg',
      'paramount plus': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg',
      'globoplay': 'https://upload.wikimedia.org/wikipedia/commons/a/af/Globoplay_logo.svg',
    };
    return providersString.split(',').map((p: string) => p.trim()).filter(Boolean).map((name: string) => ({
      name,
      logo: KNOWN[name.toLowerCase()] || '',
    })).filter((p: any) => p.logo);
  }, [movie.watch_providers]);

  const posterSrc = movie.poster_path
    ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`)
    : null;
  const backdropSrc = movie.backdrop_path
    ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.backdrop_path}`)
    : null;
  const logoSrc = movie.logo_path
    ? (movie.logo_path.startsWith('http') ? movie.logo_path : `https://image.tmdb.org/t/p/w185/${movie.logo_path}`)
    : null;

  const useBackdrop = (isContinueWatching || type === 'landscape' || type === 'wide') && backdropSrc;
  const imgSrc = useBackdrop ? backdropSrc : posterSrc;

  const sizeClass = isContinueWatching || type === 'landscape'
    ? 'w-[160px] md:w-[320px] aspect-video'
    : type === 'circle'
    ? 'w-[90px] md:w-[160px] aspect-square'
    : type === 'wide'
    ? 'w-[220px] md:w-[420px] aspect-[21/9]'
    : isLargeRow
    ? 'w-[120px] md:w-[240px] aspect-[2/3]'
    : 'w-[110px] md:w-[200px] aspect-[2/3]';

  const radiusClass = type === 'circle' ? 'rounded-full' : 'rounded-xl md:rounded-2xl';

  return (
    <div
      className={`relative flex-none snap-start cursor-pointer group/card ${sizeClass} ${rank !== undefined ? (isLargeRow ? 'ml-12 md:ml-24' : 'ml-8 md:ml-16') : ''}`}
      onClick={() => onSelectMovie(movie)}
    >
      {/* Rank number */}
      {rank !== undefined && (
        <div className="absolute -left-7 md:-left-28 bottom-0 z-0 pointer-events-none select-none h-full flex items-end">
          <span
            className="text-[55px] md:text-[240px] font-black text-transparent italic leading-[0.85] transition-all duration-400 group-hover/card:text-white/15"
            style={{ WebkitTextStroke: `1px ${rankColor || 'rgba(255,255,255,0.18)'}` }}
          >
            {rank + 1}
          </span>
        </div>
      )}

      {/* Card body */}
      <div
        className={`w-full h-full relative overflow-hidden ${radiusClass} transition-all duration-150 ease-out group-hover/card:scale-[1.06] group-hover/card:z-50 shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover/card:shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_1.5px_rgba(255,26,26,0.35)]`}
        style={{ borderRadius: type === 'circle' ? '50%' : undefined }}
      >
        {/* Provider logos */}
        {providers.length > 0 && (
          <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 pointer-events-none">
            {providers
              .sort((a: any, b: any) => {
                if (highlightProvider) {
                  if (a.name.toLowerCase().includes(highlightProvider.toLowerCase())) return -1;
                  if (b.name.toLowerCase().includes(highlightProvider.toLowerCase())) return 1;
                }
                return 0;
              })
              .slice(0, 1).map((provider: any) => (
              <div
                key={provider.name}
                className="p-1 px-1.5 bg-black/70 rounded-lg border border-white/10 backdrop-blur-md shadow-xl"
              >
                <img
                  src={provider.logo}
                  alt={provider.name}
                  className="h-3 w-3 md:h-5 md:w-5 object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        )}

        {/* Skeleton shimmer */}
        {!isLoaded && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 skeleton-premium" />
          </div>
        )}

        {/* Main image */}
        {imgSrc ? (
          <img
            ref={imgRef}
            className={`object-cover w-full h-full transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            src={imgSrc}
            alt={movie.title || movie.name}
            onLoad={() => setIsLoaded(true)}
            loading={idx < 3 ? 'eager' : 'lazy'}
            fetchPriority={idx < 3 ? 'high' : 'auto'}
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#181818] to-[#0a0a0a] flex items-center justify-center p-6 text-center" onLoad={() => setIsLoaded(true)}>
            <span className="text-white font-black text-sm md:text-lg uppercase tracking-tighter italic">{movie.title || movie.name}</span>
          </div>
        )}

        {/* Gradient overlay — appears on hover */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${
          type === 'circle' 
            ? 'bg-black/30 opacity-60 group-hover/card:opacity-0' 
            : 'bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-60 group-hover/card:opacity-100'
        }`} />

        {/* Bottom content */}
        <div className={`absolute inset-0 flex flex-col p-2.5 md:p-4 ${type === 'circle' ? 'items-center justify-center text-center' : 'justify-end'} transition-all duration-300`}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={movie.title || movie.name}
              className={`${type === 'circle' ? 'w-auto h-auto max-w-[78%] max-h-[78%]' : 'h-7 md:h-12'} object-contain drop-shadow-[0_2px_15px_rgba(0,0,0,1)] mb-1 opacity-90 group-hover/card:scale-105 transition-transform duration-300`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          <h4
            className={`text-white font-black text-[9px] uppercase tracking-tight italic leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,1)] ${type === 'circle' ? 'md:text-[13px] text-center' : 'md:text-lg truncate'} opacity-0 group-hover/card:opacity-100 transition-opacity duration-250`}
            style={{ display: logoSrc ? 'none' : 'block' }}
          >
            {movie.title || movie.name}
          </h4>
          {/* Match % on hover */}
          <div className="hidden md:flex items-center gap-2 mt-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-250">
            <span className="text-green-400 font-black text-[9px] italic">{matchPercentage}% Match</span>
            {movie.vote_average > 0 && (
              <span className="text-yellow-400 text-[9px] font-bold">★ {(movie.vote_average as number).toFixed(1)}</span>
            )}
            <span className="text-white/50 font-bold text-[9px]">{movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0] || '2024'}</span>
          </div>
        </div>

        {/* Progress bar for continue watching */}
        {(movie.last_position !== undefined && movie.last_position > 0) && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 overflow-hidden">
            <div
              className="h-full bg-red-500 shadow-[0_0_8px_rgba(255,26,26,0.8)]"
              style={{ width: `${Math.min((movie.last_position / (movie.runtime ? movie.runtime * 60 : 7200)) * 100, 95)}%` }}
            />
          </div>
        )}

        {/* "NEW" badge */}
        {movie.created_at && (
          (() => {
            const daysSince = (Date.now() - new Date(movie.created_at).getTime()) / 86400000;
            return daysSince < 14 ? (
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[6px] md:text-[8px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full shadow-lg">
                Novo
              </div>
            ) : null;
          })()
        )}
      </div>
    </div>
  );
});

function NetPlayLogoMini({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'lg' ? 20 : size === 'md' ? 14 : 10;
  const boxClass = size === 'lg' ? 'w-9 h-9 rounded-xl' : size === 'md' ? 'w-6 h-6 rounded-lg' : 'w-4 h-4 rounded-md';
  return (
    <div className="flex flex-col items-center gap-1 opacity-15 select-none pointer-events-none">
      <div className={`${boxClass} bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center`}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
      </div>
      <span className={`text-[7px] font-black uppercase tracking-tighter italic text-white leading-none`}>
        NET<span className="text-red-500">PLAY</span>
      </span>
    </div>
  );
}

function SkeletonCard({ type, isLargeRow, isContinueWatching, index = 0 }: { type: string; isLargeRow?: boolean; isContinueWatching?: boolean; index?: number }) {
  return (
    <div
      className={`flex-none overflow-hidden rounded-xl md:rounded-2xl relative border border-white/[0.03] ${
        isContinueWatching || type === 'landscape' ? 'w-[160px] md:w-[320px] aspect-video' :
        type === 'circle' ? 'w-[90px] md:w-[160px] aspect-square rounded-full' :
        type === 'wide' ? 'w-[220px] md:w-[420px] aspect-[21/9]' :
        isLargeRow ? 'w-[120px] md:w-[240px] aspect-[2/3]' : 'w-[110px] md:w-[200px] aspect-[2/3]'
      }`}
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="absolute inset-0 skeleton-premium" />
      <div className="absolute inset-0 flex items-center justify-center">
        <NetPlayLogoMini size={isLargeRow || type === 'landscape' ? 'md' : 'sm'} />
      </div>
      {type !== 'circle' && (
        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
          <div className="h-2.5 rounded-full bg-white/[0.06] w-3/4" />
          <div className="h-2 rounded-full bg-white/[0.04] w-1/2" />
        </div>
      )}
    </div>
  );
}

const Row = React.memo(({
  title,
  movies,
  isLoading = false,
  isLargeRow,
  isContinueWatching,
  onSelectMovie,
  onToggleMyList,
  onToggleFavorite,
  myListIds,
  favoriteIds,
  onViewAll,
  cardStyle,
  streamingProviders,
  type = 'standard',
  showRankNumbers = false,
  rankColor,
  highlightProvider,
  accentColor,
}: RowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      rowRef.current.scrollTo({ left: direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8, behavior: 'smooth' });
    }
  }, []);

  if (!isLoading && (!movies || movies.length === 0)) return null;

  const skeletonCount = isLoading ? 8 : Math.min(movies.length, 8);
  const accentBar = accentColor || '#ff1a1a';

  return (
    <div ref={containerRef} className="relative group mb-3 md:mb-5 overflow-x-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 md:px-12 mb-2.5 md:mb-4">
        <h2 className="section-title-premium text-base md:text-4xl text-white flex items-center gap-2.5 md:gap-5 group/title">
          {/* Accent bar */}
          <div className="relative flex-shrink-0">
            <span
              className="block w-1 md:w-2 h-5 md:h-12 rounded-full"
              style={{ background: accentBar, boxShadow: `0 0 15px ${accentBar}60` }}
            />
          </div>
          {isLoading ? (
            <span className="block h-5 md:h-9 w-36 md:w-56 rounded-lg skeleton-premium" />
          ) : title}
        </h2>

        {onViewAll && !isLoading && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onViewAll(title)}
            className="text-[7px] md:text-[10px] font-black text-gray-400 hover:text-white transition-all flex items-center gap-1.5 uppercase tracking-[0.2em] group/all bg-white/[0.04] hover:bg-red-600/90 px-3 md:px-5 py-1.5 md:py-2.5 rounded-full border border-white/[0.07] hover:border-red-600/50 shadow-lg mr-4 md:mr-0"
          >
            Ver Tudo
            <ChevronRight size={11} className="group-hover/all:translate-x-1 transition-transform" />
          </motion.button>
        )}
      </div>

      {/* Scrollable cards row */}
      <div className="relative">
        {/* Left scroll button */}
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-0 bottom-0 w-10 md:w-16 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-250 flex items-center justify-center"
        >
          <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors">
            <ChevronLeft size={16} className="text-white" />
          </div>
        </button>

        <div
          ref={rowRef}
          className="flex overflow-y-visible overflow-x-scroll scrollbar-hide gap-2.5 md:gap-3.5 pb-5 pt-3 pl-4 md:pl-12 pr-5 snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {isLoading ? (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} index={i} type={type} isLargeRow={isLargeRow} isContinueWatching={isContinueWatching} />
            ))
          ) : isVisible ? movies.map((movie, idx) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              idx={idx}
              isLargeRow={isLargeRow}
              isContinueWatching={isContinueWatching}
              onSelectMovie={onSelectMovie}
              onToggleMyList={onToggleMyList}
              onToggleFavorite={onToggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
              cardStyle={cardStyle}
              streamingProviders={streamingProviders}
              type={type}
              rank={showRankNumbers ? idx : undefined}
              rankColor={rankColor}
              highlightProvider={highlightProvider}
            />
          )) : (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} type={type} isLargeRow={isLargeRow} isContinueWatching={isContinueWatching} />
            ))
          )}
        </div>

        {/* Right scroll button */}
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-0 bottom-0 w-10 md:w-16 bg-gradient-to-l from-[#050505] via-[#050505]/80 to-transparent z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-250 flex items-center justify-center"
        >
          <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors">
            <ChevronRight size={16} className="text-white" />
          </div>
        </button>
      </div>
    </div>
  );
});

export default Row;
