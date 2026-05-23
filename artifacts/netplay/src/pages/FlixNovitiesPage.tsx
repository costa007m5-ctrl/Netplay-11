import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Film, Tv, Star, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildBetterFlixUrl } from '../components/admin/AdminFlixAPITab';

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
  source?: 'apiflix' | 'vidsrc';
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

const FILTERS = [
  { label: 'Todos', value: 'all', icon: Zap },
  { label: 'Filmes', value: 'movies', icon: Film },
  { label: 'Séries', value: 'tvshows', icon: Tv },
];

const FlixCard = React.memo(({
  item,
  idx,
  onSelect,
}: {
  item: FlixItem;
  idx: number;
  onSelect: (m: any) => void;
}) => {
  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : item.backdrop_path
    ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
    : null;

  const year = item.release_date ? new Date(item.release_date).getFullYear() : null;
  const rating = item.vote_average > 0 ? item.vote_average.toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.5) }}
      className="group cursor-pointer"
      onClick={() => onSelect(buildVirtualMovie(item))}
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border-2 border-white/5 group-hover:border-red-500/50 transition-all duration-300 shadow-lg group-hover:shadow-red-900/20">
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
            {item.type === 'series' ? (
              <Tv size={36} className="text-white/15" />
            ) : (
              <Film size={36} className="text-white/15" />
            )}
          </div>
        )}

        {/* Badge fonte */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <div className="bg-red-600/90 backdrop-blur-sm text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
            <Zap size={7} fill="currentColor" />
            API Flix
          </div>
          {item.source === 'vidsrc' && (
            <div className="bg-blue-600/80 backdrop-blur-sm text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
              PT-BR
            </div>
          )}
        </div>

        {/* Badge tipo */}
        <div className="absolute top-2 right-2">
          <div className={`backdrop-blur-sm text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${item.type === 'series' ? 'bg-blue-600/70' : 'bg-white/10'}`}>
            {item.type === 'series' ? 'Série' : 'Filme'}
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          {rating && (
            <div className="flex items-center gap-1 mb-1">
              <Star size={10} className="text-yellow-400" fill="currentColor" />
              <span className="text-yellow-400 text-[11px] font-black">{rating}</span>
            </div>
          )}
          {item.genres && (
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest truncate">
              {item.genres.split(',')[0]}
            </span>
          )}
          <div className="mt-2 w-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg text-center">
            Assistir
          </div>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="text-white text-xs font-bold leading-tight line-clamp-2">{item.title}</p>
        {year && <p className="text-white/35 text-[10px] mt-0.5 font-mono">{year}</p>}
      </div>
    </motion.div>
  );
});

interface FlixNovitiesPageProps {
  onSelectMovie: (movie: any) => void;
}

const FlixNovitiesPage: React.FC<FlixNovitiesPageProps> = ({ onSelectMovie }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<FlixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'movies' | 'tvshows'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchItems = useCallback(async (f: string, p: number, reset: boolean) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`/api/betterflix/latest?type=${f}&page=${p}`);
      const data = await res.json();
      const newItems: FlixItem[] = data.results || [];

      setHasMore(newItems.length >= 20);

      if (reset) {
        setItems(newItems);
      } else {
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.tmdb_id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.tmdb_id))];
        });
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchItems(filter, 1, true);
  }, [filter, fetchItems]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems(filter, nextPage, false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-12 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all shrink-0"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-600/30 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-red-500" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">API Flix</p>
            <h1 className="text-lg font-black text-white italic uppercase tracking-tighter leading-none truncate">
              Novidades
            </h1>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10 shrink-0">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as any)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                filter === f.value
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <f.icon size={10} />
              <span className="hidden sm:inline">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-12 py-8">
        {/* Legenda das fontes */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-red-600/20 border border-red-600/30 text-red-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
              <Zap size={8} fill="currentColor" />
              API Flix
            </div>
            <span className="text-gray-600 text-[10px]">= Em cartaz / No ar agora</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
              PT-BR
            </div>
            <span className="text-gray-600 text-[10px]">= Com dublagem em português</span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] rounded-2xl bg-white/5 animate-pulse"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Zap size={48} className="text-white/10" />
            <p className="text-white/30 font-bold text-lg">Nenhum conteúdo encontrado</p>
            <button
              onClick={() => fetchItems(filter, 1, true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-full text-sm font-bold transition-all"
            >
              <RefreshCw size={14} />
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {items.map((item, idx) => (
                  <FlixCard
                    key={`${item.tmdb_id}-${item.type}`}
                    item={item}
                    idx={idx}
                    onSelect={onSelectMovie}
                  />
                ))}
              </div>
            </AnimatePresence>

            {/* Botão Carregar Mais */}
            {hasMore && (
              <div className="flex justify-center mt-12">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-3 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-600/40 rounded-full text-sm font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Carregar mais
                    </>
                  )}
                </button>
              </div>
            )}

            <p className="text-center text-white/20 text-xs mt-6 font-mono">
              {items.length} títulos · Fonte: API Flix + Vidsrc PT-BR
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default FlixNovitiesPage;
