import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Zap, Film, Tv, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { buildBetterFlixUrl } from './admin/AdminFlixAPITab';

interface FlixItem {
  tmdb_id: number;
  type: 'movie' | 'series';
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string | null;
  overview: string;
  genres: string;
}

interface FlixLatestRowProps {
  onSelectMovie: (movie: any) => void;
}

function buildVirtualMovie(item: FlixItem): any {
  const videoUrl = buildBetterFlixUrl(item.tmdb_id, item.type === 'series' ? 'tv' : 'movie');
  return {
    id: item.tmdb_id,
    title: item.type === 'movie' ? item.title : undefined,
    name: item.type === 'series' ? item.title : undefined,
    type: item.type,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    overview: item.overview,
    genres: item.genres,
    videoUrl,
    playerStyle: 'betterflix',
    episodes: item.type === 'series' ? [] : undefined,
  };
}

const FlixCard = React.memo(({ item, idx, onSelect }: { item: FlixItem; idx: number; onSelect: (m: any) => void }) => {
  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : item.backdrop_path
    ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
    : null;

  const year = item.release_date ? new Date(item.release_date).getFullYear() : null;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const genre = item.genres?.split(',')[0] || '';

  return (
    <motion.div
      className="relative flex-none snap-start w-[130px] md:w-[180px] group cursor-pointer"
      style={{ animationDelay: `${idx * 0.03}s` }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(buildVirtualMovie(item))}
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border-2 border-white/5 group-hover:border-red-500/60 transition-colors duration-300">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            {item.type === 'series' ? <Tv size={32} className="text-white/20" /> : <Film size={32} className="text-white/20" />}
          </div>
        )}

        {/* Badge API Flix */}
        <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-sm text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
          <Zap size={8} fill="currentColor" />
          API Flix
        </div>

        {/* Badge tipo */}
        <div className="absolute top-2 right-2">
          {item.type === 'series' ? (
            <div className="bg-blue-600/80 backdrop-blur-sm text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full">
              Série
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full">
              Filme
            </div>
          )}
        </div>

        {/* Overlay com info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          {rating && (
            <div className="flex items-center gap-1 mb-1">
              <span className="text-yellow-400 text-[10px] font-black">★ {rating}</span>
            </div>
          )}
          {genre && (
            <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest truncate">{genre}</span>
          )}
        </div>
      </div>

      <div className="mt-2 px-1">
        <p className="text-white text-[11px] font-bold leading-tight line-clamp-2">{item.title}</p>
        {year && <p className="text-white/40 text-[9px] mt-0.5 font-mono">{year}</p>}
      </div>
    </motion.div>
  );
});

const FILTER_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Filmes', value: 'movies' },
  { label: 'Séries', value: 'tvshows' },
];

const fetchFlixLatest = async (type: string, page: number): Promise<FlixItem[]> => {
  const res = await fetch(`/api/betterflix/latest?type=${type}&page=${page}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
};

const FlixLatestRow = ({ onSelectMovie }: FlixLatestRowProps) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'movies' | 'tvshows'>('all');
  const [page, setPage] = useState(1);
  const [extraItems, setExtraItems] = useState<FlixItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // React Query cuida do cache: voltar para esta tela não dispara nova requisição
  const { data: baseItems = [], isLoading: loading } = useQuery({
    queryKey: ['flixLatest', filter],
    queryFn: () => fetchFlixLatest(filter, 1),
    staleTime: 10 * 60 * 1000,
  });

  // Reseta extras ao trocar filtro
  const items = page === 1 ? baseItems : [...baseItems, ...extraItems];

  const handleFilterChange = (f: typeof filter) => {
    setFilter(f);
    setPage(1);
    setExtraItems([]);
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const newItems = await fetchFlixLatest(filter, page + 1);
      if (newItems.length > 0) {
        setExtraItems(prev => {
          const existingIds = new Set([...baseItems, ...prev].map(i => i.tmdb_id));
          return [...prev, ...newItems.filter((i: FlixItem) => !existingIds.has(i.tmdb_id))];
        });
        setPage(p => p + 1);
      }
    } catch {}
    setLoadingMore(false);
  };

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollLeft + (dir === 'right' ? amount : -amount),
        behavior: 'smooth',
      });
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <div className="relative py-6 md:py-8 px-4 md:px-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-red-600 rounded-full" />
          <div>
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-red-500" fill="currentColor" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">API Flix</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter leading-tight">
              Últimos Adicionados
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ver todas as novidades */}
          <button
            onClick={() => navigate('/novidades-flix')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/15 hover:bg-red-600/30 border border-red-600/20 text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Ver tudo
            <ArrowRight size={11} />
          </button>

          {/* Filtro de tipo */}
          <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleFilterChange(opt.value as typeof filter)}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  filter === opt.value
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Setas */}
          <div className="flex gap-1">
            <button
              onClick={() => scroll('left')}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all hover:border-red-600/50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all hover:border-red-600/50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Linha de cards */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-none w-[130px] md:w-[180px] aspect-[2/3] rounded-2xl bg-white/5 animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide gap-3 md:gap-4 snap-x pb-3"
        >
          {items.map((item, idx) => (
            <FlixCard
              key={item.tmdb_id}
              item={item}
              idx={idx}
              onSelect={onSelectMovie}
            />
          ))}

          {/* Botão carregar mais */}
          <div className="flex-none flex items-center justify-center w-[130px] md:w-[180px]">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full aspect-[2/3] rounded-2xl border-2 border-dashed border-white/10 hover:border-red-600/40 flex flex-col items-center justify-center gap-2 text-white/30 hover:text-red-500 transition-all group"
            >
              {loadingMore ? (
                <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Ver mais</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlixLatestRow;
