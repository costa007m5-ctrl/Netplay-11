import React, { useState } from 'react';
import { Film, Tv, Clock, RefreshCw, Loader2, Zap, List } from 'lucide-react';

interface RecentItem {
  id: string;
  tmdb_id: number;
  title: string;
  type: 'movie' | 'series' | 'episode';
  poster_path?: string;
  source?: string;
  added_at?: number;
}

interface RecentsResponse {
  success: boolean;
  titles?: RecentItem[];
}

const ENDPOINTS = [
  { key: 'all', label: 'Todos', path: '', icon: Zap, color: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/20' },
  { key: 'movies', label: 'Filmes', path: '/movies', icon: Film, color: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/20' },
  { key: 'series', label: 'Séries', path: '/series', icon: Tv, color: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/20' },
  { key: 'episodes', label: 'Episódios', path: '/episodes', icon: List, color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' },
];

function timeAgo(ts?: number): string {
  if (!ts) return '';
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export function AdminFlixRecentsTab() {
  const [activeEndpoint, setActiveEndpoint] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);
  const [force, setForce] = useState(false);

  const ep = ENDPOINTS.find(e => e.key === activeEndpoint)!;

  const fetchRecents = async (endpoint: string, pg: number, forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const path = ENDPOINTS.find(e => e.key === endpoint)?.path || '';
      const params = new URLSearchParams({ page: String(pg), limit: String(limit) });
      if (forceRefresh) params.set('force', 'true');
      const res = await fetch(`/api/betterflix/recents${path}?${params}`);
      const data: RecentsResponse = await res.json();
      if (!data.success) throw new Error('Resposta inválida da API');
      setItems(data.titles || []);
      setFetched(true);
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar recentes');
    } finally {
      setLoading(false);
    }
  };

  const handleEndpointChange = (key: string) => {
    setActiveEndpoint(key);
    setPage(1);
    setItems([]);
    setFetched(false);
    setError('');
  };

  const handleFetch = () => fetchRecents(activeEndpoint, page, force);
  const handleForceRefresh = () => {
    setForce(true);
    fetchRecents(activeEndpoint, 1, true);
    setTimeout(() => setForce(false), 3000);
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-12">
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 tracking-tighter uppercase font-mono">
          <Clock className="inline-block w-8 h-8 md:w-10 md:h-10 mr-3 -mt-2 text-orange-400" />
          Recentes BetterFlix
        </h2>
        <p className="text-base md:text-lg text-gray-400 font-medium max-w-3xl">
          Conteúdos mais recentes adicionados na plataforma BetterFlix via <code className="text-orange-300 bg-orange-500/10 px-1.5 py-0.5 rounded text-sm">GET /api/recents/*</code>
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ENDPOINTS.map(e => {
          const Icon = e.icon;
          return (
            <button
              key={e.key}
              onClick={() => handleEndpointChange(e.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
                activeEndpoint === e.key
                  ? `${e.badge} border-current`
                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
              }`}
            >
              <Icon size={12} />
              {e.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 border border-white/10 rounded-xl px-4 py-2 font-mono">
          <span className="text-gray-400">Endpoint:</span>
          <span className="text-orange-300">betterflix.click/api/recents{ep.path}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleForceRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Forçar Atualização
          </button>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-600/20 disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Buscar
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 rounded-2xl p-4 border border-red-500/20">
          {error}
        </div>
      )}

      {!fetched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Clock size={48} className="text-white/10" />
          <p className="text-white/30 font-bold">Selecione um endpoint e clique em Buscar</p>
          <p className="text-white/15 text-sm max-w-xs">Os dados vêm direto da API BetterFlix com cache local e atualização em tempo real</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 0.04}s` }} />
          ))}
        </div>
      )}

      {!loading && fetched && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Zap size={48} className="text-white/10" />
          <p className="text-white/30 font-bold">Nenhum item encontrado</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => {
              const posterUrl = item.poster_path
                ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342${item.poster_path}`)
                : null;
              return (
                <div key={item.id} className="group cursor-default">
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 bg-white/5">
                    {posterUrl ? (
                      <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.type === 'movie' ? <Film size={28} className="text-white/20" /> : <Tv size={28} className="text-white/20" />}
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5">
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${
                        item.type === 'movie' ? 'bg-blue-600/80 text-blue-200 border-blue-500/30' :
                        item.type === 'series' ? 'bg-purple-600/80 text-purple-200 border-purple-500/30' :
                        'bg-emerald-600/80 text-emerald-200 border-emerald-500/30'
                      }`}>
                        {item.type === 'movie' ? 'Filme' : item.type === 'series' ? 'Série' : 'Ep.'}
                      </span>
                    </div>
                    {item.added_at && (
                      <div className="absolute bottom-1.5 right-1.5">
                        <span className="text-[8px] font-bold bg-black/70 backdrop-blur-sm text-white/70 px-1.5 py-0.5 rounded-md">
                          {timeAgo(item.added_at)}
                        </span>
                      </div>
                    )}
                    {item.source && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-orange-500/70 text-white">
                          {item.source}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 px-0.5">
                    <p className="text-white text-xs font-bold leading-tight line-clamp-2">{item.title}</p>
                    {item.tmdb_id && <p className="text-white/25 text-[10px] mt-0.5 font-mono">TMDB #{item.tmdb_id}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-white/20 text-xs font-mono">{items.length} itens · {ep.label}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); fetchRecents(activeEndpoint, Math.max(1, page - 1)); }}
                disabled={page <= 1 || loading}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-xs text-gray-500 font-mono">Pág. {page}</span>
              <button
                onClick={() => { setPage(p => p + 1); fetchRecents(activeEndpoint, page + 1); }}
                disabled={loading || items.length < limit}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminFlixRecentsTab;
