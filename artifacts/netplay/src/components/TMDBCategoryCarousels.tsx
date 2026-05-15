import React, { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, ArrowRight, Globe } from 'lucide-react';
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
  const [failed, setFailed] = React.useState(false);
  const title = movie.title || movie.name || '';
  const rating = movie.vote_average ? Number(movie.vote_average.toFixed(1)) : null;
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);

  return (
    <motion.div
      whileTap={{ scale: 0.94 }}
      className="flex-none snap-start cursor-pointer"
      style={{ width: 100 }}
      onClick={onSelect}
    >
      {/* Poster */}
      <div
        className="relative rounded-xl overflow-hidden border transition-all duration-200"
        style={{ aspectRatio: '2/3', borderColor: 'rgba(255,255,255,0.07)', background: '#1a1a1a' }}
      >
        {movie.poster_path && !failed ? (
          <img
            src={tmdbImg(movie.poster_path)}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-2">
            <span
              className="font-black text-center uppercase leading-tight"
              style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}
            >
              {title}
            </span>
          </div>
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: '40%', background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
        />
        {/* Rating badge */}
        {rating && rating > 0 && (
          <div
            className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          >
            <Star size={6} className="text-yellow-400" fill="currentColor" />
            <span className="text-white font-black" style={{ fontSize: 7 }}>{rating}</span>
          </div>
        )}
        {/* Year tag */}
        {year && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="font-bold" style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>{year}</span>
          </div>
        )}
      </div>
      {/* Title */}
      <p
        className="mt-1.5 font-bold uppercase truncate leading-tight px-0.5"
        style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}
        title={title}
      >
        {title}
      </p>
    </motion.div>
  );
}
