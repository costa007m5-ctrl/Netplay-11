import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Film, Tv, Star, RefreshCw, Bell, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { buildBetterFlixUrl } from '../components/admin/AdminFlixAPITab';
import { supabase } from '../lib/supabase';

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

interface PlatformEpisode {
  seriesId: number;
  seriesTitle: string;
  seriesPoster: string | null;
  seriesBackdrop: string | null;
  episodeTitle: string;
  season: number;
  episode: number;
  videoUrl: string;
  addedAt: string;
  runtime?: number;
  overview?: string;
  still_path?: string;
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

const TABS = [
  { label: 'API Flix', value: 'apiflix' },
  { label: 'Chegou Agora', value: 'chegou-agora' },
  { label: 'Episódios Novos', value: 'episodes' },
  { label: 'Recentes BetterFlix', value: 'betterflix-recents' },
];

interface BetterFlixRecentItem {
  id: string;
  tmdb_id: number;
  title: string;
  type: 'movie' | 'series' | 'episode';
  poster_path?: string;
  source?: string;
  added_at?: number;
}

const fetchBetterFlixRecents = async (filter: string): Promise<BetterFlixRecentItem[]> => {
  const subpath = filter === 'movies' ? '/movies' : filter === 'tvshows' ? '/series' : '';
  const res = await fetch(`/api/betterflix/recents${subpath}?limit=24`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.titles || [];
};

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

        <div className="absolute top-2 right-2">
          <div className={`backdrop-blur-sm text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${item.type === 'series' ? 'bg-blue-600/70' : 'bg-white/10'}`}>
            {item.type === 'series' ? 'Série' : 'Filme'}
          </div>
        </div>

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

const EpisodeCard = React.memo(({ ep, idx, onPlay }: { ep: PlatformEpisode; idx: number; onPlay: (ep: PlatformEpisode) => void }) => {
  const imgUrl = ep.still_path
    ? (ep.still_path.startsWith('http') ? ep.still_path : `https://image.tmdb.org/t/p/w300${ep.still_path}`)
    : ep.seriesBackdrop
    ? (ep.seriesBackdrop.startsWith('http') ? ep.seriesBackdrop : `https://image.tmdb.org/t/p/w500${ep.seriesBackdrop}`)
    : null;

  const daysAgo = Math.floor((Date.now() - new Date(ep.addedAt).getTime()) / (1000 * 60 * 60 * 24));
  const daysLabel = daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? 'Ontem' : `${daysAgo}d atrás`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.6) }}
      className="group cursor-pointer flex gap-3 p-3 rounded-2xl bg-white/3 hover:bg-white/6 border border-white/5 hover:border-red-500/30 transition-all"
      onClick={() => onPlay(ep)}
    >
      <div className="relative w-32 md:w-48 aspect-video rounded-xl overflow-hidden flex-none bg-white/5">
        {imgUrl ? (
          <img src={imgUrl} alt={ep.episodeTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Tv size={20} className="text-white/20" /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Film size={14} className="text-white" />
          </div>
        </div>
        <div className="absolute top-1.5 left-1.5">
          <span className="bg-black/70 backdrop-blur-sm text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
            T{ep.season}·E{ep.episode}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">{daysLabel}</span>
            {ep.runtime && ep.runtime > 0 && (
              <span className="text-[8px] font-bold text-white/30">{ep.runtime}min</span>
            )}
          </div>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest truncate">{ep.seriesTitle}</p>
          <p className="text-white text-sm font-bold leading-tight line-clamp-2 mt-0.5">{ep.episodeTitle || `Episódio ${ep.episode}`}</p>
          {ep.overview && <p className="text-white/30 text-[10px] mt-1 line-clamp-2 hidden md:block">{ep.overview}</p>}
        </div>
      </div>
    </motion.div>
  );
});

interface FlixNovitiesPageProps {
  onSelectMovie: (movie: any) => void;
  defaultFilter?: 'all' | 'movies' | 'tvshows';
  hideFilterBar?: boolean;
  pageTitle?: string;
}

const fetchFlixPage = async (filter: string, page: number): Promise<FlixItem[]> => {
  const res = await fetch(`/api/betterflix/latest?type=${filter}&page=${page}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
};

const SEVEN_DAYS_SECS = 7 * 24 * 60 * 60;

const fetchChegouAgora = async (): Promise<BetterFlixRecentItem[]> => {
  const cutoffSecs = Math.floor(Date.now() / 1000) - SEVEN_DAYS_SECS;
  const res = await fetch('/api/betterflix/recents?limit=100');
  if (!res.ok) return [];
  const data = await res.json();
  const titles: BetterFlixRecentItem[] = data.titles || [];
  return titles.filter(t =>
    t.added_at == null || t.added_at >= cutoffSecs
  );
};

const fetchRecentEpisodes = async (): Promise<PlatformEpisode[]> => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,name,poster_path,backdrop_path,episodes,updated_at')
    .eq('type', 'series')
    .eq('is_hidden', false)
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const eps: PlatformEpisode[] = [];
  for (const series of data) {
    const rawEps: any[] = Array.isArray(series.episodes) ? series.episodes : [];
    const sorted = [...rawEps].sort((a, b) => {
      const sA = (a.season || 0) * 1000 + (a.episode || 0);
      const sB = (b.season || 0) * 1000 + (b.episode || 0);
      return sB - sA;
    });
    for (const ep of sorted.slice(0, 3)) {
      if (!ep.videoUrl && !ep.videoUrl2) continue;
      eps.push({
        seriesId: series.id,
        seriesTitle: series.title || series.name || '',
        seriesPoster: series.poster_path || null,
        seriesBackdrop: series.backdrop_path || null,
        episodeTitle: ep.title || ep.name || `Episódio ${ep.episode}`,
        season: ep.season || 1,
        episode: ep.episode || 1,
        videoUrl: ep.videoUrl || ep.videoUrl2 || '',
        addedAt: series.updated_at || new Date().toISOString(),
        runtime: ep.runtime,
        overview: ep.overview,
        still_path: ep.still_path,
      });
    }
  }
  return eps;
};

const FlixNovitiesPage: React.FC<FlixNovitiesPageProps> = ({ onSelectMovie, defaultFilter = 'all', hideFilterBar = false, pageTitle }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'apiflix' | 'chegou-agora' | 'episodes' | 'betterflix-recents'>('apiflix');
  const [filter, setFilter] = useState<'all' | 'movies' | 'tvshows'>(defaultFilter);
  const [page, setPage] = useState(1);
  const [extraItems, setExtraItems] = useState<FlixItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // React Query — página 1 fica em cache; voltar para a tela não rebusca
  const { data: baseItems = [], isFetching: loading, refetch: refetchApiflix } = useQuery({
    queryKey: ['flixNovidadesPage', filter],
    queryFn: () => fetchFlixPage(filter, 1),
    staleTime: 10 * 60 * 1000,
  });

  // React Query — episódios recentes (busca no Supabase, cache 10 min)
  const { data: episodes = [], isFetching: loadingEpisodes, refetch: refetchEpisodes } = useQuery({
    queryKey: ['flixEpisodiosRecentes'],
    queryFn: fetchRecentEpisodes,
    enabled: activeTab === 'episodes',
    staleTime: 10 * 60 * 1000,
  });

  // React Query — chegou agora (últimos 7 dias via BetterFlix recents)
  const { data: chegouAgora = [], isFetching: loadingChegou, refetch: refetchChegou } = useQuery<BetterFlixRecentItem[]>({
    queryKey: ['chegouAgora'],
    queryFn: fetchChegouAgora,
    enabled: activeTab === 'chegou-agora',
    staleTime: 5 * 60 * 1000,
  });

  // React Query — recentes BetterFlix
  const { data: bfRecents = [], isFetching: loadingBfRecents, refetch: refetchBfRecents } = useQuery({
    queryKey: ['bfRecents', filter],
    queryFn: () => fetchBetterFlixRecents(filter),
    enabled: activeTab === 'betterflix-recents',
    staleTime: 5 * 60 * 1000,
  });

  const hasMore = extraItems.length === 0
    ? baseItems.length >= 20
    : extraItems.slice(-20).length >= 20;

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
      const newItems = await fetchFlixPage(filter, page + 1);
      if (newItems.length > 0) {
        setExtraItems(prev => {
          const existingIds = new Set([...baseItems, ...prev].map(i => i.tmdb_id));
          return [...prev, ...newItems.filter(i => !existingIds.has(i.tmdb_id))];
        });
        setPage(p => p + 1);
      }
    } catch {}
    setLoadingMore(false);
  };

  const handleEpisodePlay = (ep: PlatformEpisode) => {
    // Cria objeto de filme para reprodução
    const movieObj = {
      id: ep.seriesId,
      name: ep.seriesTitle,
      type: 'series',
      poster_path: ep.seriesPoster,
      backdrop_path: ep.seriesBackdrop,
    };
    onSelectMovie({ ...movieObj, videoUrl: ep.videoUrl });
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
            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Novidades</p>
            <h1 className="text-lg font-black text-white italic uppercase tracking-tighter leading-none truncate">
              {pageTitle || 'Lançamentos'}
            </h1>
          </div>
        </div>

        {/* Filtros API Flix — só na aba apiflix */}
        {activeTab === 'apiflix' && !hideFilterBar && (
          <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10 shrink-0">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value as typeof filter)}
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
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 md:px-12 pt-6 pb-2 border-b border-white/5">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as any)}
            className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.value
                ? 'bg-red-600 text-white shadow-lg'
                : 'text-white/40 hover:text-white bg-white/5'
            }`}
          >
            {tab.value === 'chegou-agora' && <Sparkles size={10} className="inline mr-1.5 mb-0.5" />}
            {tab.value === 'episodes' && <Bell size={10} className="inline mr-1.5 mb-0.5" />}
            {tab.value === 'betterflix-recents' && <Clock size={10} className="inline mr-1.5 mb-0.5" />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 md:px-12 py-8">
        {activeTab === 'apiflix' && (
          <>
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

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-2xl bg-gradient-to-br from-[#1c1c1c] to-[#141414] border border-white/[0.04] relative overflow-hidden flex items-center justify-center" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex flex-col items-center gap-1.5 opacity-20 select-none">
                      <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-tighter italic text-white leading-none">NET<span className="text-red-500">PLAY</span></span>
                    </div>
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 0.08}s` }} />
                    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                      <div className="h-2.5 rounded-full bg-white/[0.07] w-3/4 animate-pulse" />
                      <div className="h-2 rounded-full bg-white/[0.05] w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Zap size={48} className="text-white/10" />
                <p className="text-white/30 font-bold text-lg">Nenhum conteúdo encontrado</p>
                <button onClick={() => refetchApiflix()} className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-full text-sm font-bold transition-all">
                  <RefreshCw size={14} />
                  Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                    {items.map((item, idx) => (
                      <FlixCard key={`${item.tmdb_id}-${item.type}`} item={item} idx={idx} onSelect={onSelectMovie} />
                    ))}
                  </div>
                </AnimatePresence>

                {hasMore && (
                  <div className="flex justify-center mt-12">
                    <button onClick={loadMore} disabled={loadingMore} className="flex items-center gap-3 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-600/40 rounded-full text-sm font-black uppercase tracking-widest text-white transition-all disabled:opacity-50">
                      {loadingMore ? (
                        <><div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />Carregando...</>
                      ) : (
                        <><RefreshCw size={14} />Carregar mais</>
                      )}
                    </button>
                  </div>
                )}

                <p className="text-center text-white/20 text-xs mt-6 font-mono">
                  {items.length} títulos · Fonte: API Flix + Vidsrc PT-BR
                </p>
              </>
            )}
          </>
        )}

        {activeTab === 'chegou-agora' && (
          <>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-purple-400" />
                  <p className="text-white font-black text-lg italic uppercase tracking-tighter">Chegou Agora</p>
                </div>
                <p className="text-white/30 text-xs">Séries e episódios adicionados nos últimos 7 dias · Some após esse período</p>
              </div>
              <button onClick={() => refetchChegou()} disabled={loadingChegou} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-black uppercase tracking-widest text-white/60 hover:text-white border border-white/10 transition-all disabled:opacity-40">
                <RefreshCw size={12} className={loadingChegou ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>

            {loadingChegou ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-2xl bg-gradient-to-br from-[#1c1c1c] to-[#141414] border border-white/[0.04] relative overflow-hidden flex items-center justify-center" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex flex-col items-center gap-1.5 opacity-20 select-none">
                      <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-tighter italic text-white leading-none">NET<span className="text-red-500">PLAY</span></span>
                    </div>
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 0.08}s` }} />
                    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                      <div className="h-2.5 rounded-full bg-white/[0.07] w-3/4 animate-pulse" />
                      <div className="h-2 rounded-full bg-white/[0.05] w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chegouAgora.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Sparkles size={48} className="text-white/10" />
                <p className="text-white/30 font-bold text-lg">Nenhum conteúdo novo nos últimos 7 dias</p>
                <p className="text-white/15 text-sm text-center max-w-xs">Filmes, séries e episódios adicionados nos últimos 7 dias aparecem aqui automaticamente</p>
                <button onClick={() => refetchChegou()} className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-full text-sm font-bold transition-all">
                  <RefreshCw size={14} /> Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                  {chegouAgora.map((item, idx) => {
                    const posterUrl = item.poster_path
                      ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342${item.poster_path}`)
                      : null;
                    const addedSecs = item.added_at ?? 0;
                    const hoursAgo = Math.floor((Date.now() / 1000 - addedSecs) / 3600);
                    const timeLabel = addedSecs === 0 ? null
                      : hoursAgo < 1 ? 'Agora mesmo'
                      : hoursAgo < 24 ? `${hoursAgo}h atrás`
                      : `${Math.floor(hoursAgo / 24)}d atrás`;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.5) }}
                        className="group cursor-pointer"
                        onClick={() => {
                          if (item.type === 'movie' || item.type === 'series') {
                            const url = buildBetterFlixUrl(item.tmdb_id, item.type === 'series' ? 'tv' : 'movie');
                            onSelectMovie({
                              id: item.tmdb_id,
                              title: item.type === 'movie' ? item.title : undefined,
                              name: item.type === 'series' ? item.title : undefined,
                              type: item.type,
                              poster_path: item.poster_path,
                              videoUrl: url,
                              playerStyle: 'betterflix',
                            });
                          }
                        }}
                      >
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border-2 border-white/5 group-hover:border-purple-500/50 transition-all duration-300 shadow-lg">
                          {posterUrl ? (
                            <img src={posterUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              {item.type === 'series' ? <Tv size={36} className="text-white/15" /> : <Film size={36} className="text-white/15" />}
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <div className="bg-purple-600/90 backdrop-blur-sm text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                              <Sparkles size={7} />
                              {timeLabel ?? 'Novo'}
                            </div>
                          </div>
                          <div className="absolute top-2 right-2">
                            <div className={`backdrop-blur-sm text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${item.type === 'series' ? 'bg-blue-600/70' : item.type === 'episode' ? 'bg-emerald-600/70' : 'bg-white/10'}`}>
                              {item.type === 'series' ? 'Série' : item.type === 'episode' ? 'Ep.' : 'Filme'}
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                            <div className="mt-2 w-full bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg text-center">
                              Assistir
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 px-0.5">
                          <p className="text-white text-xs font-bold leading-tight line-clamp-2">{item.title}</p>
                          {item.source && <p className="text-white/25 text-[10px] mt-0.5 font-mono">{item.source}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <p className="text-center text-white/20 text-xs mt-6 font-mono">
                  {chegouAgora.length} títulos · Adicionados nos últimos 7 dias · Fonte: BetterFlix
                </p>
              </>
            )}
          </>
        )}

        {activeTab === 'episodes' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white font-black text-lg italic uppercase tracking-tighter">Episódios da Plataforma</p>
                <p className="text-white/30 text-xs mt-0.5">Séries atualizadas nos últimos 30 dias</p>
              </div>
              <button onClick={() => refetchEpisodes()} disabled={loadingEpisodes} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-black uppercase tracking-widest text-white/60 hover:text-white border border-white/10 transition-all disabled:opacity-40">
                <RefreshCw size={12} className={loadingEpisodes ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>

            {loadingEpisodes ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 0.06}s` }} />
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Bell size={48} className="text-white/10" />
                <p className="text-white/30 font-bold text-lg">Nenhum episódio recente encontrado</p>
                <p className="text-white/15 text-sm text-center max-w-xs">Episódios de séries adicionadas à plataforma nos últimos 30 dias aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {episodes.map((ep, idx) => (
                  <EpisodeCard key={`${ep.seriesId}-${ep.season}-${ep.episode}`} ep={ep} idx={idx} onPlay={handleEpisodePlay} />
                ))}
                <p className="text-center text-white/20 text-xs mt-6 font-mono pt-4">
                  {episodes.length} episódios recentes · Da biblioteca da plataforma
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'betterflix-recents' && (
          <>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-white font-black text-lg italic uppercase tracking-tighter">Recém Adicionados</p>
                <p className="text-white/30 text-xs mt-0.5">Conteúdos mais recentes na plataforma BetterFlix</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => handleFilterChange(f.value as typeof filter)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      filter === f.value
                        ? 'bg-orange-600 text-white shadow-lg'
                        : 'text-white/40 hover:text-white bg-white/5'
                    }`}
                  >
                    <f.icon size={9} />
                    {f.label}
                  </button>
                ))}
                <button onClick={() => refetchBfRecents()} disabled={loadingBfRecents} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white border border-white/10 transition-all disabled:opacity-40">
                  <RefreshCw size={10} className={loadingBfRecents ? 'animate-spin' : ''} />
                  Atualizar
                </button>
              </div>
            </div>

            {loadingBfRecents ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-2xl bg-gradient-to-br from-[#1c1c1c] to-[#141414] border border-white/[0.04] relative overflow-hidden flex items-center justify-center" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex flex-col items-center gap-1.5 opacity-20 select-none">
                      <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-tighter italic text-white leading-none">NET<span className="text-red-500">PLAY</span></span>
                    </div>
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 0.08}s` }} />
                    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                      <div className="h-2.5 rounded-full bg-white/[0.07] w-3/4 animate-pulse" />
                      <div className="h-2 rounded-full bg-white/[0.05] w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : bfRecents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Clock size={48} className="text-white/10" />
                <p className="text-white/30 font-bold text-lg">Nenhum conteúdo recente encontrado</p>
                <button onClick={() => refetchBfRecents()} className="flex items-center gap-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-full text-sm font-bold transition-all">
                  <RefreshCw size={14} />
                  Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                  {bfRecents.map((item, idx) => {
                    const posterUrl = item.poster_path
                      ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342${item.poster_path}`)
                      : null;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.5) }}
                        className="group cursor-pointer"
                        onClick={() => {
                          if (item.type === 'movie' || item.type === 'series') {
                            const url = buildBetterFlixUrl(item.tmdb_id, item.type === 'series' ? 'tv' : 'movie');
                            onSelectMovie({
                              id: item.tmdb_id,
                              title: item.type === 'movie' ? item.title : undefined,
                              name: item.type === 'series' ? item.title : undefined,
                              type: item.type,
                              poster_path: item.poster_path,
                              videoUrl: url,
                              playerStyle: 'betterflix',
                            });
                          }
                        }}
                      >
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border-2 border-white/5 group-hover:border-orange-500/50 transition-all duration-300 shadow-lg">
                          {posterUrl ? (
                            <img src={posterUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              {item.type === 'series' ? <Tv size={36} className="text-white/15" /> : <Film size={36} className="text-white/15" />}
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <div className="bg-orange-600/90 backdrop-blur-sm text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                              <Clock size={7} />
                              Novo
                            </div>
                          </div>
                          <div className="absolute top-2 right-2">
                            <div className={`backdrop-blur-sm text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${item.type === 'series' ? 'bg-blue-600/70' : item.type === 'episode' ? 'bg-emerald-600/70' : 'bg-white/10'}`}>
                              {item.type === 'series' ? 'Série' : item.type === 'episode' ? 'Ep.' : 'Filme'}
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                            <div className="mt-2 w-full bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg text-center">
                              Assistir
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 px-0.5">
                          <p className="text-white text-xs font-bold leading-tight line-clamp-2">{item.title}</p>
                          {item.source && <p className="text-white/25 text-[10px] mt-0.5 font-mono">{item.source}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <p className="text-center text-white/20 text-xs mt-6 font-mono">
                  {bfRecents.length} títulos · Fonte: BetterFlix Recents API
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FlixNovitiesPage;
