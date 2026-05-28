import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { Movie } from '../types';

interface Top10RowProps {
  title: string;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
}

const Top10Row: React.FC<Top10RowProps> = ({ title, movies, onSelectMovie }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      rowRef.current.scrollTo({ left: direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8, behavior: 'smooth' });
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <div className="space-y-3 md:space-y-4 group/row relative py-4 md:py-6 overflow-hidden">
      <div className="px-4 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 md:h-8 bg-red-600 rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]" />
          <TrendingUp className="text-red-500" size={15} />
          <h2 className="text-base md:text-2xl font-black text-white italic uppercase tracking-tighter">
            {title}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white hover:bg-red-600 hover:border-red-600 transition-all active:scale-90"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white hover:bg-red-600 hover:border-red-600 transition-all active:scale-90"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex overflow-x-auto no-scrollbar gap-10 md:gap-14 px-8 md:px-14 pb-4"
      >
        {movies.slice(0, 10).map((movie, index) => (
          <motion.div
            key={movie.id}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -6, scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative flex-none w-[120px] md:w-[180px] aspect-[2/3] cursor-pointer group/card"
            onClick={() => onSelectMovie(movie)}
          >
            {/* Big rank number behind card */}
            <div className="absolute -left-6 md:-left-10 bottom-0 z-0 pointer-events-none select-none">
              <span
                className="text-[7rem] md:text-[11rem] font-black leading-none italic
                  bg-gradient-to-t from-gray-700/80 to-white/15 bg-clip-text text-transparent
                  transition-all duration-500
                  group-hover/card:from-red-800 group-hover/card:to-red-400
                  [filter:drop-shadow(2px_2px_0px_rgba(0,0,0,0.9))]"
              >
                {index + 1}
              </span>
            </div>

            {/* Poster */}
            <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden border border-white/[0.08] group-hover/card:border-red-500/60 transition-all duration-400 shadow-2xl">
              <img
                src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`}
                alt={movie.title || movie.name}
                className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-600"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* TOP badge — top LEFT */}
              <div className="absolute top-2 left-2 z-20">
                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md font-black italic text-[8px] md:text-[9px] shadow-lg border
                  ${index === 0 ? 'bg-red-600 border-red-400/30 text-white' :
                    index === 1 ? 'bg-orange-600 border-orange-400/30 text-white' :
                    index === 2 ? 'bg-yellow-600/90 border-yellow-400/30 text-white' :
                    'bg-black/70 border-white/10 text-white backdrop-blur-md'}`}
                >
                  TOP {index + 1}
                </div>
              </div>

              {/* Title on hover */}
              <div className="absolute bottom-2 left-2 right-2 translate-y-2 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 transition-all duration-400">
                <p className="text-white font-black text-[9px] md:text-[10px] uppercase italic truncate leading-tight">
                  {movie.title || movie.name}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Top10Row;
