import React, { useRef } from 'react';
import { Movie } from '../types';
import { ChevronLeft, ChevronRight, TrendingUp, Play } from 'lucide-react';
import { motion } from 'motion/react';

interface NewReleasesRowProps {
  title: string;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
}

const NewCard = React.memo(({ movie, idx, onSelectMovie }: { movie: Movie; idx: number; onSelectMovie: (m: Movie) => void }) => {
  const img = movie.backdrop_path
    ? movie.backdrop_path.startsWith('http')
      ? movie.backdrop_path
      : `https://image.tmdb.org/t/p/w780/${movie.backdrop_path}`
    : movie.poster_path
    ? movie.poster_path.startsWith('http')
      ? movie.poster_path
      : `https://image.tmdb.org/t/p/w500/${movie.poster_path}`
    : `https://picsum.photos/seed/${movie.id}/780/440`;

  return (
    <motion.div
      className="relative flex-none w-[220px] md:w-[300px] group/new cursor-pointer"
      style={{ animationDelay: `${idx * 0.03}s` }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelectMovie(movie)}
    >
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/[0.07] group-hover/new:border-red-500/50 transition-all shadow-2xl">
        <img
          src={img}
          className="w-full h-full object-cover transition-transform duration-500 group-hover/new:scale-105"
          alt={movie.title || movie.name}
          referrerPolicy="no-referrer"
          loading={idx < 4 ? 'eager' : 'lazy'}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* EM ALTA badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2 py-0.5 rounded-lg shadow-lg">
          <div className="w-1 h-1 bg-white rounded-full animate-ping" />
          <span className="text-white text-[7px] font-black uppercase tracking-wider">Em Alta</span>
        </div>

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/new:opacity-100 transition-opacity duration-300">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
            <Play size={16} fill="white" className="text-white ml-0.5" />
          </div>
        </div>

        {/* Meta bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {movie.logo_path ? (
            <img
              src={movie.logo_path.startsWith('http') ? movie.logo_path : `https://image.tmdb.org/t/p/original/${movie.logo_path}`}
              className="h-6 md:h-8 object-contain object-left mb-1.5"
              referrerPolicy="no-referrer"
              alt=""
            />
          ) : (
            <h3 className="text-white font-black italic uppercase text-sm md:text-base leading-tight truncate mb-1">
              {movie.title || movie.name}
            </h3>
          )}
          <div className="flex items-center gap-2">
            {movie.genres && (
              <span className="text-[8px] font-black px-2 py-0.5 bg-white/15 text-white rounded-full uppercase tracking-widest backdrop-blur-sm">
                {movie.genres.split(',')[0].trim()}
              </span>
            )}
            {movie.vote_average && (
              <span className="text-[8px] font-black text-yellow-400">★ {(movie.vote_average as number).toFixed(1)}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const NewReleasesRow = ({ title, movies, onSelectMovie }: NewReleasesRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      scrollRef.current.scrollTo({ left: dir === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8, behavior: 'smooth' });
    }
  };

  if (!movies.length) return null;

  return (
    <div className="relative py-4 md:py-6">
      <div className="flex items-center justify-between mb-3 px-4 md:px-12">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 md:h-8 bg-red-600 rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]" />
          <TrendingUp className="text-red-500" size={15} />
          <h2 className="text-base md:text-2xl font-black text-white italic uppercase tracking-tighter">{title}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => scroll('left')} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-red-600 hover:border-red-600 transition-all">
            <ChevronLeft size={14} className="text-white" />
          </button>
          <button onClick={() => scroll('right')} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-red-600 hover:border-red-600 transition-all">
            <ChevronRight size={14} className="text-white" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto no-scrollbar gap-3 md:gap-4 px-4 md:px-12 pb-2"
      >
        {movies.map((movie, idx) => (
          <NewCard key={movie.id} movie={movie} idx={idx} onSelectMovie={onSelectMovie} />
        ))}
      </div>
    </div>
  );
};

export default NewReleasesRow;
