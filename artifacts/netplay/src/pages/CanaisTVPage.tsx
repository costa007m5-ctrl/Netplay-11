import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Search, X, RefreshCcw, Tv2, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { buildBetterFlixUrl, getBetterFlixKey } from '../components/admin/AdminFlixAPITab';

interface Channel {
  id: string | number;
  nome?: string;
  name?: string;
  imagem?: string;
  image?: string;
  categoria?: string;
  category?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Esportes: 'bg-green-500/20 text-green-300 border-green-500/30',
  Notícias: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Entretenimento: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Filmes: 'bg-red-500/20 text-red-300 border-red-500/30',
  Séries: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Infantil: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Música: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Documentários: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};

function getCategoryStyle(cat?: string): string {
  if (!cat) return 'bg-white/10 text-gray-400 border-white/10';
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'bg-white/10 text-gray-400 border-white/10';
}

const CanaisTVPage: React.FC = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/betterflix/canais');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Não foi possível carregar os canais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const categories = Array.from(
    new Set(channels.map(c => c.categoria || c.category).filter(Boolean) as string[])
  ).sort();

  const filtered = channels.filter(ch => {
    const name = (ch.nome || ch.name || '').toLowerCase();
    const cat = ch.categoria || ch.category || '';
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchCat = !activeCategory || cat === activeCategory;
    return matchSearch && matchCat;
  });

  const getName = (ch: Channel) => ch.nome || ch.name || 'Canal';
  const getImage = (ch: Channel) => ch.imagem || ch.image || '';
  const getCat = (ch: Channel) => ch.categoria || ch.category || '';

  const buildChannelPlayerUrl = (ch: Channel) => {
    const key = getBetterFlixKey();
    let url = `https://betterflix.click/api/player?id=${ch.id}&type=channel`;
    if (key) url += `&key=${encodeURIComponent(key)}`;
    return url;
  };

  if (playingChannel) {
    const fakeMovie = {
      id: Number(playingChannel.id) || 0,
      title: getName(playingChannel),
      backdrop_path: getImage(playingChannel),
      poster_path: getImage(playingChannel),
      overview: '',
      vote_average: 0,
      videoUrl: buildChannelPlayerUrl(playingChannel),
      type: 'movie' as const,
    };
    return (
      <VideoPlayer
        movie={fakeMovie}
        onClose={() => setPlayingChannel(null)}
        initialPlayerStyle="betterflix"
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-2xl border-b border-white/5 px-4 md:px-10 py-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Tv2 size={16} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">Canais de TV</h1>
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                {loading ? 'Carregando...' : `${channels.length} canais ao vivo`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchChannels}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin text-orange-400' : ''} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar canal..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 focus:bg-white/8 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${!activeCategory ? 'bg-orange-500/30 border-orange-500/50 text-orange-300' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeCategory === cat ? getCategoryStyle(cat) + ' !bg-opacity-40' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 md:px-10 pt-6">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 mb-6">
            <div className="text-red-400 text-sm flex-1">{error}</div>
            <button onClick={fetchChannels} className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-2xl aspect-[4/3] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Radio size={60} className="text-gray-800 mb-4" />
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Nenhum canal encontrado</h3>
            <p className="text-gray-600 text-sm">Tente buscar por outro termo.</p>
          </div>
        )}

        {/* Channel grid */}
        {!loading && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
          >
            <AnimatePresence>
              {filtered.map((ch, i) => (
                <motion.button
                  key={ch.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  onClick={() => setPlayingChannel(ch)}
                  className="group relative bg-[#111] border border-white/5 rounded-2xl overflow-hidden hover:border-orange-500/40 hover:scale-[1.03] transition-all duration-200 shadow-lg hover:shadow-orange-500/10 text-left"
                >
                  {/* Thumbnail area */}
                  <div className="aspect-[16/9] bg-black/50 flex items-center justify-center relative overflow-hidden">
                    {getImage(ch) ? (
                      <img
                        src={getImage(ch)}
                        alt={getName(ch)}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                        onError={e => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          img.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`${getImage(ch) ? 'hidden' : 'flex'} w-full h-full items-center justify-center`}>
                      <Radio size={28} className="text-gray-700" />
                    </div>

                    {/* Live badge */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Ao Vivo</span>
                    </div>

                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center transition-all duration-200 scale-0 group-hover:scale-100">
                        <svg viewBox="0 0 24 24" fill="black" className="w-4 h-4 ml-0.5"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-white text-xs font-bold truncate leading-tight">{getName(ch)}</p>
                    {getCat(ch) && (
                      <span className={`inline-block mt-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${getCategoryStyle(getCat(ch))}`}>
                        {getCat(ch)}
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CanaisTVPage;
