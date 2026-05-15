import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Film, Layers } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  franchises: any[];
  onSelectMovie?: (movie: any) => void;
}

const posterUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w342${path}`;
};

const logoUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w300${path}`;
};

export default function FranchiseCarousels({ franchises, onSelectMovie }: Props) {
  const navigate = useNavigate();
  const visible = franchises.filter(f => (f.movies?.length || 0) >= 2).slice(0, 20);
  if (visible.length === 0) return null;

  return (
    <div className="mt-8 pb-2">
      <div className="px-4 md:px-12 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={14} className="text-red-500" />
          <h2 className="text-lg md:text-2xl font-black text-white italic uppercase tracking-tighter">
            Sagas &amp; Coleções
          </h2>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)', paddingLeft: 22 }}>
          Sua biblioteca organizada por franquias
        </p>
      </div>

      <div className="space-y-5">
        {visible.map((franchise, idx) => (
          <FranchiseRow
            key={franchise.id}
            franchise={franchise}
            delay={idx * 0.04}
            onSelectMovie={onSelectMovie}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}

function FranchiseRow({
  franchise,
  delay,
  onSelectMovie,
  navigate,
}: {
  franchise: any;
  delay: number;
  onSelectMovie?: (m: any) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });

  const movies = (franchise.movies || []).slice(0, 10);

  return (
    <motion.div
      className="group"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between px-4 md:px-12 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {franchise.logo ? (
            <img
              src={logoUrl(franchise.logo)}
              alt={franchise.name}
              className="h-5 object-contain flex-none"
              style={{ maxWidth: 90 }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const sib = e.currentTarget.nextElementSibling as HTMLElement;
                if (sib) sib.style.display = 'block';
              }}
            />
          ) : null}
          <span
            className="text-sm font-black text-white uppercase tracking-wider truncate"
            style={{ display: franchise.logo ? 'none' : 'block' }}
          >
            {franchise.name}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex-none" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {franchise.movies?.length} títulos
          </span>
        </div>
        <button
          onClick={() => navigate(`/universe/${franchise.id}`)}
          className="flex items-center gap-1 flex-none text-[10px] font-black uppercase tracking-widest transition-colors"
          style={{ color: 'rgba(229,62,62,0.85)' }}
        >
          Ver Saga <ArrowRight size={9} />
        </button>
      </div>

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
          {movies.map((movie: any) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onSelect={() => onSelectMovie ? onSelectMovie(movie) : navigate(`/movie/${movie.id}`)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function MovieCard({ movie, onSelect }: { movie: any; onSelect: () => void }) {
  const [failed, setFailed] = React.useState(false);
  const title = movie.title || movie.name || '';
  const year = (movie.release_date || '').slice(0, 4);
  const poster = posterUrl(movie.poster_path);

  return (
    <motion.div
      whileTap={{ scale: 0.94 }}
      className="flex-none snap-start cursor-pointer"
      style={{ width: 100 }}
      onClick={onSelect}
    >
      <div
        className="relative rounded-xl overflow-hidden border transition-all duration-200 hover:border-white/20"
        style={{ aspectRatio: '2/3', borderColor: 'rgba(255,255,255,0.07)', background: '#1a1a1a' }}
      >
        {poster && !failed ? (
          <img
            src={poster}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={20} style={{ color: 'rgba(255,255,255,0.12)' }} />
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.78), transparent)' }}
        />
        {year && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="font-bold" style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>{year}</span>
          </div>
        )}
      </div>
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
