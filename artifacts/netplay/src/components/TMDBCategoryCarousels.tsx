import React, { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { useTMDBCategories } from '../hooks/useTMDBCategories';

interface Props {
  onSelectMovie?: (movie: any) => void;
}

const tmdbImg = (path: string | undefined, size = 'w342') => {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`;
};

export default function TMDBCategoryCarousels({ onSelectMovie }: Props) {
  const { categories, loading } = useTMDBCategories();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading || categories.length === 0) return null;

  const handleSelect = (movie: any) => {
    if (onSelectMovie) {
      onSelectMovie(movie);
    } else {
      navigate(`/movie/${movie.id}`, { state: { backgroundLocation: location } });
    }
  };

  return (
    <div className="mt-10 pb-4">
      {/* Section header */}
      <div className="px-4 md:px-12 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={14} className="text-red-500" />
          <h2 className="text-lg md:text-2xl font-black text-white italic uppercase tracking-tighter">
            Descobrir no Mundo
          </h2>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)', paddingLeft: 22 }}>
          Destaques globais · Atualiza a cada 2h
        </p>
      </div>

      <div className="space-y-8">
        {categories.map((cat, idx) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            delay={idx * 0.05}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ category, delay, onSelect }: { category: any; delay: number; onSelect: (m: any) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  return (
    <motion.div
      className="group"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
    >
      {/* Row header */}
      <div className="flex items-center justify-between px-4 md:px-12 mb-3">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">{category.title}</h3>
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors"
          style={{ color: 'rgba(229,62,62,0.85)' }}
        >
          Ver Tudo <ArrowRight size={9} />
        </button>
      </div>

      {/* Scroll container */}
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-black/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
        >
          <ChevronLeft size={14} className="text-white" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-black/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
        >
          <ChevronRight size={14} className="text-white" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-12 pb-1 snap-x snap-mandatory"
        >
          {category.movies.map((movie: any) => (
            <TMDBMovieCard key={movie.id} movie={movie} onSelect={() => onSelect(movie)} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TMDBMovieCard({ movie, onSelect }: { movie: any; onSelect: () => void }) {
  const title = movie.title || movie.name || '';
  const posterSrc = movie.poster_path
    ? tmdbImg(movie.poster_path, 'w342')
    : 'https://via.placeholder.com/342x513?text=Sem+Poster';

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      className="flex-none w-28 sm:w-36 snap-start cursor-pointer group"
      onClick={onSelect}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-white/5 group-hover:border-red-600/60 transition-all shadow-lg">
        <img
          src={posterSrc}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
          <p className="text-white font-black text-[10px] uppercase leading-tight truncate">{title}</p>
          {movie.vote_average ? (
            <p className="text-yellow-400 text-[9px] font-bold mt-0.5">★ {Number(movie.vote_average).toFixed(1)}</p>
          ) : null}
        </div>
      </div>
      <p className="text-gray-400 text-[10px] font-bold mt-1.5 truncate group-hover:text-white transition-colors leading-tight">{title}</p>
    </motion.div>
  );
}
