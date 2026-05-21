import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Search, X, RefreshCcw, Tv2, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { getBetterFlixKey } from '../components/admin/AdminFlixAPITab';

interface Channel {
  id: string | number;
  nome?: string;
  name?: string;
  imagem?: string;
  image?: string;
  categoria?: string;
  category?: string;
}

const CATEGORY_META: Record<string, { gradient: string; accent: string; icon: string }> = {
  Esportes:       { gradient: 'from-green-900/40 to-black', accent: 'text-green-400', icon: '⚽' },
  Notícias:       { gradient: 'from-blue-900/40 to-black',  accent: 'text-blue-400',  icon: '📰' },
  Entretenimento: { gradient: 'from-purple-900/40 to-black',accent: 'text-purple-400',icon: '🎬' },
  Filmes:         { gradient: 'from-red-900/40 to-black',   accent: 'text-red-400',   icon: '🎥' },
  Séries:         { gradient: 'from-orange-900/40 to-black',accent: 'text-orange-400',icon: '📺' },
  Infantil:       { gradient: 'from-yellow-900/40 to-black',accent: 'text-yellow-400',icon: '🧒' },
  Música:         { gradient: 'from-pink-900/40 to-black',  accent: 'text-pink-400',  icon: '🎵' },
  Documentários:  { gradient: 'from-teal-900/40 to-black',  accent: 'text-teal-400',  icon: '🔭' },
};

function getCatMeta(cat?: string) {
  if (!cat) return { gradient: 'from-gray-900/40 to-black', accent: 'text-gray-400', icon: '📡' };
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { gradient: 'from-gray-900/40 to-black', accent: 'text-gray-400', icon: '📡' };
}

const getName  = (ch: Channel) => ch.nome  || ch.name     || 'Canal';
const getImage = (ch: Channel) => ch.imagem || ch.image   || '';
const getCat   = (ch: Channel) => ch.categoria || ch.category || '';

function buildChannelPlayerUrl(ch: Channel): string {
  const key = getBetterFlixKey();
  let url = `https://betterflix.click/api/player?id=${ch.id}&type=channel`;
  if (key) url += `&key=${encodeURIComponent(key)}`;
  return url;
}

function ChannelCard({ ch, onClick }: { ch: Channel; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group relative bg-[#111] border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-colors shadow-lg text-left shrink-0"
      style={{ width: 148 }}
    >
      <div className="w-full aspect-[16/9] bg-black/50 flex items-center justify-center relative overflow-hidden">
        {img && !imgErr ? (
          <img
            src={img}
            alt={getName(ch)}
            className="w-full h-full object-contain p-2.5 group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgErr(true)}
          />
        ) : (
          <Radio size={26} className="text-gray-700" />
        )}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md pointer-events-none">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
          <span className="text-[7px] font-black text-white uppercase tracking-widest">Live</span>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center scale-0 group-hover:scale-100 transition-all duration-200 shadow-2xl">
            <Play size={13} fill="black" className="text-black ml-0.5" />
          </div>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-white text-[11px] font-bold truncate leading-tight">{getName(ch)}</p>
      </div>
    </motion.button>
  );
}

function SearchResultCard({ ch, onClick }: { ch: Channel; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group relative bg-[#111] border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-colors text-left"
    >
      <div className="aspect-[16/9] bg-black/50 flex items-center justify-center relative overflow-hidden">
        {img && !imgErr ? (
          <img src={img} alt={getName(ch)} className="w-full h-full object-contain p-2.5 group-hover:scale-105 transition-transform duration-300" onError={() => setImgErr(true)} />
        ) : (
          <Radio size={24} className="text-gray-700" />
        )}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600/90 px-1.5 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
          <span className="text-[7px] font-black text-white uppercase tracking-widest">Live</span>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center scale-0 group-hover:scale-100 transition-all">
            <Play size={13} fill="black" className="ml-0.5" />
          </div>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-white text-[11px] font-bold truncate">{getName(ch)}</p>
        {getCat(ch) && (
          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${getCatMeta(getCat(ch)).accent}`}>
            {getCat(ch)}
          </p>
        )}
      </div>
    </motion.button>
  );
}

function CategoryRow({ category, channels, onPlay }: { category: string; channels: Channel[]; onPlay: (ch: Channel) => void }) {
  const meta = getCatMeta(category);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 px-4 md:px-10 mb-4">
        <span className="text-2xl">{meta.icon}</span>
        <h2 className={`text-base font-black uppercase tracking-tighter italic ${meta.accent}`}>{category}</h2>
        <div className="flex-1 h-px bg-white/5 ml-1" />
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-700">{channels.length} canais</span>
        <button
          onClick={() => scroll('left')}
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => scroll('right')}
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-none px-4 md:px-10 pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {channels.map(ch => (
          <ChannelCard key={ch.id} ch={ch} onClick={() => onPlay(ch)} />
        ))}
      </div>
    </div>
  );
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

  const searchLower = search.toLowerCase();
  const filteredAll = channels.filter(ch => {
    const n = getName(ch).toLowerCase();
    return !search || n.includes(searchLower);
  });

  const channelsByCategory = (cat: string) =>
    channels.filter(ch => {
      const c = getCat(ch);
      const n = getName(ch).toLowerCase();
      const matchCat = c === cat;
      const matchSearch = !search || n.includes(searchLower);
      return matchCat && matchSearch;
    });

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

  const CATEGORY_ORDER = ['Esportes', 'Notícias', 'Entretenimento', 'Filmes', 'Séries', 'Infantil', 'Música', 'Documentários'];
  const sortedCategories = [
    ...CATEGORY_ORDER.filter(c => categories.includes(c)),
    ...categories.filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  const showSearchResults = !!search;
  const showCategoryFilter = !search;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/20 via-black to-black pointer-events-none" />
        <div className="relative px-4 md:px-10 pt-6 pb-6">
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500/30 to-red-600/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Tv2 size={18} className="text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Canais de TV</h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                  {loading ? 'Carregando...' : `${channels.length} canais ao vivo`}
                </p>
              </div>
            </div>
            <button
              onClick={fetchChannels}
              disabled={loading}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
            >
              <RefreshCcw size={15} className={loading ? 'animate-spin text-orange-400' : 'text-gray-400'} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar canal por nome..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-9 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 focus:bg-white/8 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category pills — hidden during search */}
          {showCategoryFilter && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  !activeCategory
                    ? 'bg-orange-500/30 border-orange-500/50 text-orange-300'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                }`}
              >
                Todos
              </button>
              {sortedCategories.map(cat => {
                const m = getCatMeta(cat);
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(isActive ? null : cat)}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                      isActive
                        ? `bg-white/10 border-white/20 ${m.accent}`
                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-2">
        {/* Error state */}
        {error && (
          <div className="mx-4 md:mx-10 bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 mb-8">
            <Radio size={22} className="text-red-500 shrink-0" />
            <div className="flex-1 text-red-400 text-sm">{error}</div>
            <button onClick={fetchChannels} className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading skeleton rows */}
        {loading && (
          <div className="px-4 md:px-10">
            {[1, 2, 3].map(r => (
              <div key={r} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="flex gap-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="shrink-0 w-[148px] aspect-[16/9] bg-white/5 rounded-2xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center px-4">
            <Radio size={60} className="text-gray-800 mb-4" />
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Nenhum canal disponível</h3>
            <p className="text-gray-600 text-sm">Verifique sua conexão e tente novamente.</p>
          </div>
        )}

        {/* Search results grid */}
        {!loading && !error && showSearchResults && (
          <div className="px-4 md:px-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4">
              {filteredAll.length} resultado{filteredAll.length !== 1 ? 's' : ''} para "{search}"
            </p>
            {filteredAll.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search size={40} className="text-gray-800 mb-4" />
                <p className="text-gray-600 text-sm">Nenhum canal encontrado para "{search}".</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              >
                {filteredAll.map(ch => (
                  <SearchResultCard key={ch.id} ch={ch} onClick={() => setPlayingChannel(ch)} />
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Category rows — shown when NOT searching */}
        {!loading && !error && !showSearchResults && channels.length > 0 && (
          <AnimatePresence mode="wait">
            {activeCategory ? (
              <motion.div key={activeCategory} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CategoryRow
                  category={activeCategory}
                  channels={channelsByCategory(activeCategory)}
                  onPlay={setPlayingChannel}
                />
              </motion.div>
            ) : (
              <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sortedCategories.map(cat => {
                  const chs = channelsByCategory(cat);
                  if (chs.length === 0) return null;
                  return (
                    <CategoryRow key={cat} category={cat} channels={chs} onPlay={setPlayingChannel} />
                  );
                })}
                {/* Uncategorized */}
                {(() => {
                  const uncategorized = channels.filter(ch => !getCat(ch));
                  if (uncategorized.length === 0) return null;
                  return <CategoryRow key="outros" category="Outros" channels={uncategorized} onPlay={setPlayingChannel} />;
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default CanaisTVPage;
