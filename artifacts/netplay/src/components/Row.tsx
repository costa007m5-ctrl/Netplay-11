import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Movie } from '../types';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface RowProps {
  title: string;
  movies: Movie[];
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
}

const MovieCard = React.memo(({ movie, isLargeRow, isContinueWatching, onSelectMovie, cardStyle, type = 'standard', rank, rankColor, highlightProvider }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const matchPercentage = 80 + (movie.id % 20);

  const parseWatchProviders = useCallback((providersString?: string) => {
    if (!providersString) return [];

    // Formato enriquecido: "Nome|logo_url;;Nome2|logo_url2"
    if (providersString.includes('|')) {
      return providersString.split(';;').map(p => {
        const [name, logo] = p.split('|');
        return { name, logo };
      }).reduce((acc: any[], current) => {
        if (!acc.find(item => item.name === current.name)) acc.push(current);
        return acc;
      }, []);
    }

    // Formato legado: "Netflix,Disney+" — associa logos conhecidas
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
    return providersString.split(',').map(p => p.trim()).filter(Boolean).map(name => ({
      name,
      logo: KNOWN[name.toLowerCase()] || '',
    })).filter(p => p.logo); // só mostra se tiver logo conhecida
  }, []);

  const providers = parseWatchProviders(movie.watch_providers);

  // Smaller image sizes for faster loading
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

  return (
    <div
      className={`relative flex-none snap-start cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-50 ${cardStyle || (type === 'circle' ? 'rounded-full' : 'rounded-[0.8rem] md:rounded-[1.5rem]')} ${rank !== undefined ? '' : 'overflow-hidden'} shadow-2xl hover:shadow-red-600/20 group/card ${
        isContinueWatching || type === 'landscape' ? 'w-[160px] md:w-[340px] aspect-video border-2 border-red-600/30' :
        type === 'circle' ? 'w-[90px] md:w-[180px] aspect-square border-2 border-white/10' :
        type === 'wide' ? 'w-[220px] md:w-[440px] aspect-[21/9] border-2 border-white/5' :
        isLargeRow ? 'w-[110px] md:w-[260px] aspect-[2/3]' : 'w-[110px] md:w-[220px] aspect-[2/3]'
      } ${rank !== undefined ? (isLargeRow ? 'ml-12 md:ml-28' : 'ml-8 md:ml-18') : ''}`}
      onClick={() => onSelectMovie(movie)}
    >
      {rank !== undefined && (
        <div className="absolute -left-8 md:-left-32 bottom-0 z-0 pointer-events-none select-none h-full flex items-end">
          <span
            className="text-[60px] md:text-[280px] font-black text-transparent italic leading-[0.8] drop-shadow-[0_0_2px_rgba(255,255,255,0.1)] transition-all duration-300 group-hover/card:text-white/20"
            style={{ WebkitTextStroke: `1px ${rankColor || 'rgba(255,255,255,0.2)'}` }}
          >
            {rank + 1}
          </span>
        </div>
      )}

      <div className={`w-full h-full relative overflow-hidden ${cardStyle || (type === 'circle' ? 'rounded-full' : 'rounded-[1rem] md:rounded-[2rem]')}`}>
        {providers.length > 0 && (
          <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5 pointer-events-none">
            {providers
              .sort((a: any, b: any) => {
                if (highlightProvider) {
                  if (a.name.toLowerCase().includes(highlightProvider.toLowerCase())) return -1;
                  if (b.name.toLowerCase().includes(highlightProvider.toLowerCase())) return 1;
                }
                return 0;
              })
              .slice(0, highlightProvider ? 1 : 3).map((provider: any, i: number) => (
              <div
                key={provider.name}
                className={`p-1 px-1.5 bg-black/60 rounded-lg border shadow-xl ${highlightProvider && provider.name.toLowerCase().includes(highlightProvider.toLowerCase()) ? 'border-red-600 scale-110' : 'border-white/10'}`}
              >
                <img
                  src={provider.logo}
                  alt={provider.name}
                  className={`${highlightProvider ? 'h-5 w-5 md:h-8 md:w-8' : 'h-3 w-3 md:h-5 md:w-5'} object-contain`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        )}

        {/* Skeleton */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-white/5 animate-pulse" />
        )}

        {imgSrc ? (
          <img
            className={`object-cover w-full h-full transition-transform duration-300 group-hover/card:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            src={imgSrc}
            alt={movie.title || movie.name}
            onLoad={() => setIsLoaded(true)}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#181818] to-black flex items-center justify-center p-8 text-center border border-white/5">
            <span className="text-white font-black text-sm md:text-xl uppercase tracking-tighter italic">{movie.title || movie.name}</span>
          </div>
        )}

        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col p-3 md:p-6 ${type === 'circle' ? 'items-center justify-center text-center bg-black/20 group-hover/card:bg-transparent' : 'justify-end'}`}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={movie.title || movie.name}
              className={`${type === 'circle' ? 'w-auto h-auto max-w-[80%] max-h-[80%]' : 'h-8 md:h-14'} object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] mb-1 opacity-90 group-hover/card:scale-105 transition-transform duration-300`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          <h4
            className={`text-white font-black text-[10px] uppercase tracking-tighter italic leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,1)] ${type === 'circle' ? 'md:text-[14px] text-center' : 'md:text-xl truncate'}`}
            style={{ display: logoSrc ? 'none' : 'block' }}
          >
            {movie.title || movie.name}
          </h4>
          <div className="hidden md:flex items-center gap-2 mt-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
            <span className="text-green-500 font-black text-[10px] italic">{matchPercentage}% Match</span>
            <span className="text-white/60 font-black text-[10px] italic">{movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0] || '2024'}</span>
          </div>
        </div>

        {movie.last_position !== undefined && movie.last_position > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 overflow-hidden">
            <div
              className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"
              style={{ width: `${(movie.last_position / (movie.runtime ? movie.runtime * 60 : 7200)) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

// Row renders lazily — only mounts when it enters the viewport
const Row = React.memo(({
  title,
  movies,
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
  highlightProvider
}: RowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      rowRef.current.scrollTo({ left: direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth, behavior: 'smooth' });
    }
  }, []);

  if (!movies || movies.length === 0) return null;

  return (
    <div ref={containerRef} className="ml-2 md:ml-12 text-white relative group mb-4 md:mb-6 overflow-x-hidden">
      <div className="flex items-center justify-between pr-2 md:pr-12 mb-2 md:mb-4">
        <h2 className="text-lg md:text-5xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3 md:gap-6 group/title font-display">
          <div className="relative">
            <span className="block w-1.5 md:w-3 h-6 md:h-14 bg-red-600 rounded-full" />
            <Sparkles className="absolute -top-1 -right-1 text-red-600 opacity-0 group-hover/title:opacity-100 transition-opacity duration-200" size={12} />
          </div>
          {title}
        </h2>
        {onViewAll && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewAll(title)}
            className="text-[8px] md:text-xs font-black text-white hover:text-white transition-all flex items-center gap-2 md:gap-3 uppercase tracking-[0.2em] md:tracking-[0.3em] group/all bg-white/5 hover:bg-red-600 px-4 md:px-6 py-2 md:py-3 rounded-full border border-white/10 hover:border-red-600 shadow-xl italic"
          >
            Ver Tudo <ChevronRight size={14} className="group-hover/all:translate-x-1 transition-transform" />
          </motion.button>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-0 bottom-0 w-10 md:w-20 bg-gradient-to-r from-black via-black/80 to-transparent z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center -ml-4 md:-ml-12"
        >
          <ChevronLeft size={32} className="md:w-12 md:h-12 text-white drop-shadow-md" />
        </button>

        <div
          ref={rowRef}
          className="flex overflow-y-visible overflow-x-scroll scrollbar-hide gap-3 md:gap-4 pb-6 pt-4 pr-5 snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {isVisible ? movies.map((movie, idx) => (
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
            // Placeholder slots while row is off-screen
            Array.from({ length: Math.min(movies.length, 8) }).map((_, i) => (
              <div
                key={i}
                className={`flex-none bg-white/5 rounded-[1rem] ${
                  isContinueWatching || type === 'landscape' ? 'w-[160px] md:w-[340px] aspect-video' :
                  type === 'circle' ? 'w-[90px] md:w-[180px] aspect-square rounded-full' :
                  type === 'wide' ? 'w-[220px] md:w-[440px] aspect-[21/9]' :
                  isLargeRow ? 'w-[110px] md:w-[260px] aspect-[2/3]' : 'w-[110px] md:w-[220px] aspect-[2/3]'
                }`}
              />
            ))
          )}
        </div>

        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-0 bottom-0 w-10 md:w-20 bg-gradient-to-l from-black via-black/80 to-transparent z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
        >
          <ChevronRight size={32} className="md:w-12 md:h-12 text-white drop-shadow-md" />
        </button>
      </div>
    </div>
  );
});

export default Row;
