import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark, Clock, Film, Tv, Play, X, Heart, Star,
  ChevronRight, MoreVertical, Trash2, Check, Sparkles,
  Monitor, Radio
} from 'lucide-react';
import { Movie, Profile } from '../types';
import { useNavigate } from 'react-router-dom';

// ─── helpers ────────────────────────────────────────────────────────────
const img = (path: string | null | undefined, size = 'w500') =>
  path ? (path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`) : null;

const fmtDuration = (mins: number) => {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const FILTERS = [
  { id: 'all',      label: 'Todos',     icon: Bookmark },
  { id: 'movie',    label: 'Filmes',    icon: Film },
  { id: 'series',   label: 'Séries',    icon: Tv },
  { id: 'canais',   label: 'Canais',    icon: Radio },
  { id: 'programs', label: 'Programas', icon: Monitor },
];

// ─── StatCard ────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, value, label, color }: {
  icon: any; value: string | number; label: string; color: string;
}) => (
  <div
    className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border border-white/[0.07]"
    style={{ background: `linear-gradient(135deg, ${color}14, ${color}06)` }}
  >
    <Icon size={16} style={{ color }} />
    <span className="text-white font-black text-[17px] leading-none">{value}</span>
    <span className="text-white/35 text-[9px] font-bold uppercase tracking-wider text-center leading-tight">{label}</span>
  </div>
);

// ─── ContinueCard ────────────────────────────────────────────────────────
const ContinueCard = React.memo(({ movie, progress, onSelect, onRemove }: {
  movie: Movie;
  progress: number;
  onSelect: (m: Movie) => void;
  onRemove: (id: number) => void;
}) => {
  const poster = img(movie.poster_path, 'w342');
  const backdrop = img(movie.backdrop_path, 'w500');
  const title = movie.title || movie.name || '';
  const pct = Math.min(Math.max(Math.round(progress * 100), 0), 100);
  const isLive = (movie as any).isLive;

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      className="relative flex-none cursor-pointer"
      style={{ width: 140 }}
      onClick={() => onSelect(movie)}
    >
      {/* thumbnail */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl" style={{ aspectRatio: '2/3' }}>
        {poster || backdrop ? (
          <img src={poster || backdrop!} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <Film size={24} className="text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* remove btn */}
        <button
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20"
          onClick={(e) => { e.stopPropagation(); onRemove(movie.id); }}
        >
          <X size={11} className="text-white/70" />
        </button>

        {/* LIVE badge */}
        {isLive && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full animate-pulse">
            AO VIVO
          </div>
        )}

        {/* play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Play size={16} fill="white" className="text-white ml-0.5" />
          </div>
        </div>

        {/* progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(to right, #ff1a1a, #ff4444)',
              boxShadow: '0 0 6px rgba(255,26,26,0.8)',
            }}
          />
        </div>
      </div>

      {/* info */}
      <div className="mt-1.5 px-0.5">
        <p className="text-white font-bold text-[11px] leading-tight line-clamp-1">{title}</p>
        <p className="text-red-400 text-[10px] font-bold mt-0.5">
          {isLive ? 'Ao vivo' : pct > 0 ? `${100 - pct}% restante` : 'Não iniciado'}
        </p>
      </div>
    </motion.div>
  );
});

// ─── FavoriteCard ────────────────────────────────────────────────────────
const FavoriteCard = React.memo(({ movie, onSelect }: {
  movie: Movie;
  onSelect: (m: Movie) => void;
}) => {
  const poster = img(movie.poster_path, 'w342');
  const title  = movie.title || movie.name || '';
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;

  return (
    <motion.div
      whileTap={{ scale: 0.93 }}
      className="relative cursor-pointer"
      onClick={() => onSelect(movie)}
    >
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl" style={{ aspectRatio: '2/3' }}>
        {poster ? (
          <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <Film size={24} className="text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* heart */}
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600/80 flex items-center justify-center shadow-lg shadow-red-600/40">
          <Heart size={11} fill="white" className="text-white" />
        </div>

        {/* rating */}
        {rating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Star size={8} className="text-yellow-400" fill="currentColor" />
            <span className="text-yellow-400 text-[9px] font-black">{rating}</span>
          </div>
        )}

        {/* type badge */}
        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white/60 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full">
          {movie.type === 'series' ? 'Série' : 'Filme'}
        </div>
      </div>
      <p className="mt-1.5 text-white/75 text-[11px] font-bold leading-tight line-clamp-2 px-0.5">{title}</p>
    </motion.div>
  );
});

// ─── SavedRow ────────────────────────────────────────────────────────────
const SavedRow = React.memo(({ movie, progress, onSelect, onRemove }: {
  movie: Movie;
  progress: number;
  onSelect: (m: Movie) => void;
  onRemove: (id: number) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const poster  = img(movie.poster_path, 'w92');
  const title   = movie.title || movie.name || '';
  const pct     = Math.min(Math.max(Math.round(progress * 100), 0), 100);
  const runtime = movie.runtime ? fmtDuration(movie.runtime) : '';
  const year    = movie.release_date ? new Date(movie.release_date).getFullYear() : (movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : null);

  return (
    <div className="relative flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
      {/* thumbnail */}
      <div
        className="w-14 h-20 rounded-xl overflow-hidden flex-none bg-white/5 cursor-pointer"
        onClick={() => onSelect(movie)}
      >
        {poster ? (
          <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={16} className="text-white/20" />
          </div>
        )}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(movie)}>
        <p className="text-white font-bold text-[13px] leading-tight line-clamp-1">{title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {year && <span className="text-white/35 text-[10px]">{year}</span>}
          {runtime && <span className="text-white/35 text-[10px]">• {runtime}</span>}
        </div>

        {/* progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct > 0 ? 'linear-gradient(to right, #ff1a1a, #ff4444)' : 'transparent',
                boxShadow: pct > 0 ? '0 0 6px rgba(255,26,26,0.6)' : 'none',
              }}
            />
          </div>
          <span className="text-[10px] font-black text-white/30 flex-none">{pct}%</span>
        </div>
      </div>

      {/* play + menu */}
      <div className="flex flex-col items-center gap-2 flex-none">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => onSelect(movie)}
          className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40"
        >
          <Play size={14} fill="white" className="text-white ml-0.5" />
        </motion.button>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center"
        >
          <MoreVertical size={13} className="text-white/40" />
        </button>
      </div>

      {/* context menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute right-3 top-12 z-30 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-[140px]"
          >
            <button
              onClick={() => { onRemove(movie.id); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-red-400 text-[12px] font-bold hover:bg-white/5 transition-colors"
            >
              <Trash2 size={13} /> Remover
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── EmptyState ──────────────────────────────────────────────────────────
const EmptyState = ({ onExplore }: { onExplore: () => void }) => (
  <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 border border-red-500/20"
      style={{ background: 'radial-gradient(circle, rgba(255,26,26,0.12), transparent 70%)' }}
    >
      <Bookmark size={32} className="text-red-500/50" />
    </div>
    <h3 className="text-white font-black text-xl mb-2">Lista Vazia</h3>
    <p className="text-white/35 text-[13px] leading-relaxed mb-6">
      Adicione filmes e séries para assistir depois.
    </p>
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onExplore}
      className="px-6 py-3 bg-red-600 text-white font-black text-[13px] uppercase tracking-wide rounded-full shadow-lg shadow-red-600/30"
    >
      Explorar Catálogo
    </motion.button>
  </div>
);

// ─── SectionHeader ───────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, onViewAll }: {
  icon?: any; title: string; onViewAll?: () => void;
}) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={15} className="text-red-500" />}
      <h2 className="text-white font-black text-[14px] uppercase tracking-tight">{title}</h2>
    </div>
    {onViewAll && (
      <button onClick={onViewAll} className="flex items-center gap-1 text-[11px] font-bold text-white/35 hover:text-red-400 transition-colors">
        Ver tudo <ChevronRight size={13} />
      </button>
    )}
  </div>
);

// ─── main component ──────────────────────────────────────────────────────
export interface MinhaListaPremiumViewProps {
  myList:             Movie[];
  continueWatching:   Movie[];
  favorites:          Movie[];
  watchHistory:       Record<number, number>;
  handleSelectMovie:  (m: Movie) => void;
  toggleMyList:       (m: Movie) => void;
  profile?:           Profile | null;
}

const MinhaListaPremiumView = React.memo(({
  myList,
  continueWatching,
  favorites,
  watchHistory,
  handleSelectMovie,
  toggleMyList,
  profile,
}: MinhaListaPremiumViewProps) => {
  const goTo = useNavigate();

  const [activeFilter, setActiveFilter] = useState('all');
  const [removed, setRemoved]           = useState<Set<number>>(new Set());

  const handleRemove = (id: number) => {
    setRemoved(prev => new Set([...prev, id]));
    const movie = myList.find(m => m.id === id);
    if (movie) toggleMyList(movie);
  };

  const filteredList = useMemo(() => {
    const base = myList.filter(m => !removed.has(m.id));
    if (activeFilter === 'all')    return base;
    if (activeFilter === 'movie')  return base.filter(m => m.type === 'movie' || !m.type);
    if (activeFilter === 'series') return base.filter(m => m.type === 'series');
    return base;
  }, [myList, removed, activeFilter]);

  const validContinue = useMemo(() =>
    continueWatching.filter(m => !removed.has(m.id) && (watchHistory[m.id] ?? 0) > 0),
    [continueWatching, removed, watchHistory]
  );

  const totalMovies  = filteredList.filter(m => m.type === 'movie' || !m.type).length;
  const totalSeries  = filteredList.filter(m => m.type === 'series').length;
  const totalRuntime = filteredList.reduce((acc, m) => acc + (m.runtime || 100), 0);
  const totalHours   = Math.floor(totalRuntime / 60);
  const totalMins    = totalRuntime % 60;

  const avatarUrl = profile?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png';

  return (
    <div className="min-h-screen pb-28" style={{ background: '#050505' }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div className="pt-5 pb-4 px-4">
        {/* top row: logo + avatar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/40">
              <Play size={14} fill="white" className="text-white ml-0.5" />
            </div>
            <span className="text-[20px] font-black text-white uppercase tracking-tighter italic leading-none">
              NET<span className="text-red-500">PLAY</span>
            </span>
          </div>
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-red-500/40 shadow-lg shadow-red-600/20">
            <img src={avatarUrl} alt="Perfil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>

        {/* title */}
        <h1 className="text-white font-black text-2xl tracking-tight mb-0.5">Minha Lista</h1>
        <p className="text-white/35 text-[12px]">Tudo que você salvou para assistir depois.</p>
      </div>

      {/* ── STATS ───────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 mb-5">
        <StatCard icon={Bookmark} value={filteredList.length} label="Itens na lista" color="#ff1a1a" />
        <StatCard icon={Clock}    value={`${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''}`} label="Tempo total" color="#3b82f6" />
        <StatCard icon={Film}     value={totalMovies}   label="Filmes"  color="#f59e0b" />
        <StatCard icon={Tv}       value={totalSeries}   label="Séries"  color="#8b5cf6" />
      </div>

      {/* ── FILTER PILLS ────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 mb-5 scrollbar-hide">
        {FILTERS.map(f => (
          <motion.button
            key={f.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFilter(f.id)}
            className={`flex items-center gap-1.5 flex-none px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide transition-all ${
              activeFilter === f.id
                ? 'bg-red-600 text-white shadow-lg border border-red-500/50'
                : 'bg-white/[0.07] text-white/50 border border-white/[0.08]'
            }`}
            style={activeFilter === f.id ? { boxShadow: '0 0 16px rgba(255,26,26,0.35)' } : {}}
          >
            <f.icon size={11} />
            {f.label}
          </motion.button>
        ))}
        {/* filter icon */}
        <button className="flex-none w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.07] border border-white/[0.08]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
          </svg>
        </button>
      </div>

      <div className="px-4 space-y-8">

        {/* ── CONTINUE ASSISTINDO ─────────────────────────── */}
        {validContinue.length > 0 && (
          <section>
            <SectionHeader icon={Play} title="Continue Assistindo" onViewAll={() => {}} />
            <div
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {validContinue.map(m => {
                const pos      = watchHistory[m.id] ?? 0;
                const runtime  = m.runtime ? m.runtime * 60 : 5400;
                const progress = pos > 0 ? Math.min(pos / runtime, 1) : 0;
                return (
                  <ContinueCard
                    key={m.id}
                    movie={m}
                    progress={progress}
                    onSelect={handleSelectMovie}
                    onRemove={handleRemove}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── MEUS FAVORITOS ──────────────────────────────── */}
        {favorites.length > 0 && (
          <section>
            <SectionHeader icon={Heart} title="Meus Favoritos" onViewAll={() => {}} />
            <div className="grid grid-cols-3 gap-3">
              {favorites.slice(0, 6).map(m => (
                <FavoriteCard key={m.id} movie={m} onSelect={handleSelectMovie} />
              ))}
            </div>
          </section>
        )}

        {/* ── SALVOS PARA DEPOIS ──────────────────────────── */}
        {filteredList.length > 0 ? (
          <section>
            <SectionHeader icon={Bookmark} title="Salvos para Depois" />
            <div className="space-y-2">
              <AnimatePresence>
                {filteredList.map(m => {
                  const pos      = watchHistory[m.id] ?? 0;
                  const runtime  = m.runtime ? m.runtime * 60 : 5400;
                  const progress = pos > 0 ? Math.min(pos / runtime, 1) : 0;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <SavedRow
                        movie={m}
                        progress={progress}
                        onSelect={handleSelectMovie}
                        onRemove={handleRemove}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>
        ) : (
          <EmptyState onExplore={() => goTo('/menu')} />
        )}
      </div>
    </div>
  );
});

export default MinhaListaPremiumView;
