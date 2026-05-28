import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Play, Plus, Info, Star, Bell, Flame, Zap,
  ChevronRight, Eye, Film, Tv, Radio, BookOpen, Swords,
  Ghost, Rocket, Calendar, Heart, TrendingUp, Wifi,
  Baby, ChevronLeft, Check, Search, X, Clock, Users
} from 'lucide-react';
import { Movie, Profile } from '../types';
import { useNavigate } from 'react-router-dom';

// ─── helpers ───────────────────────────────────────────────────────────
const img = (path: string | null | undefined, size = 'w500') =>
  path ? (path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`) : null;

const fmtViewers = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const seededRandom = (seed: number) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

const FILTERS = [
  { id: 'all',  label: 'Tudo',          icon: Zap },
  { id: 'movie', label: 'Filmes',       icon: Film },
  { id: 'series', label: 'Séries',      icon: Tv },
  { id: 'canais', label: 'Canais',      icon: Radio },
  { id: 'anime',  label: 'Animes',      icon: Swords },
  { id: 'doc',    label: 'Docs',        icon: BookOpen },
];

const UNIVERSES = [
  { id: 'marvel', label: 'Marvel', color: '#e23636', glow: '#e23636', emoji: '⚡', query: 'marvel' },
  { id: 'dc',     label: 'DC',     color: '#1a73e8', glow: '#1a73e8', emoji: '🦇', query: 'batman' },
  { id: 'anime',  label: 'Anime',  color: '#ff6b35', glow: '#ff6b35', emoji: '⛩️', query: 'anime' },
  { id: 'terror', label: 'Terror', color: '#7c3aed', glow: '#7c3aed', emoji: '👻', query: 'horror' },
  { id: 'scifi',  label: 'Sci-Fi', color: '#0ea5e9', glow: '#0ea5e9', emoji: '🚀', query: 'sci-fi' },
  { id: 'acao',   label: 'Ação',   color: '#f59e0b', glow: '#f59e0b', emoji: '💥', query: 'action' },
  { id: 'kids',   label: 'Infantil', color: '#10b981', glow: '#10b981', emoji: '🌈', query: 'animation' },
];

// ─── sub-components ────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, badge, onViewAll }: { icon?: any; title: string; badge?: string; onViewAll?: () => void }) => (
  <div className="flex items-center justify-between mb-3 px-4">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={16} className="text-red-500" />}
      <h2 className="text-white font-black text-[15px] uppercase tracking-tight">{title}</h2>
      {badge && (
        <span className="text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
          {badge}
        </span>
      )}
    </div>
    {onViewAll && (
      <button onClick={onViewAll} className="flex items-center gap-1 text-[11px] font-bold text-white/40 hover:text-red-400 transition-colors">
        Ver todas <ChevronRight size={13} />
      </button>
    )}
  </div>
);

// Movie poster card
const PosterCard = React.memo(({ movie, onSelect, badge, rank, viewerCount }: {
  movie: Movie;
  onSelect: (m: Movie) => void;
  badge?: string;
  rank?: number;
  viewerCount?: number;
}) => {
  const poster = img(movie.poster_path, 'w342');
  const title  = movie.title || movie.name || '';
  const rating = movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;

  return (
    <motion.div
      whileTap={{ scale: 0.93 }}
      className="relative cursor-pointer flex-none"
      style={{ width: rank !== undefined ? 90 : 110 }}
      onClick={() => onSelect(movie)}
    >
      {rank !== undefined && (
        <div
          className="absolute -left-3 bottom-8 z-20 font-black leading-none select-none"
          style={{
            fontSize: 56,
            color: 'transparent',
            WebkitTextStroke: '2px rgba(255,255,255,0.15)',
            textShadow: '0 0 30px rgba(255,26,26,0.2)',
          }}
        >
          {rank}
        </div>
      )}

      <div className={`relative rounded-2xl overflow-hidden shadow-xl border border-white/[0.07] ${rank !== undefined ? 'ml-5' : ''}`}
           style={{ aspectRatio: '2/3' }}>
        {poster ? (
          <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <Film size={24} className="text-white/20" />
          </div>
        )}

        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* badge */}
        {badge && (
          <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shadow-lg shadow-red-600/40">
            {badge}
          </div>
        )}

        {/* HOT badge for ranking */}
        {rank !== undefined && (
          <div className="absolute top-1.5 right-1.5 bg-orange-500/90 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Flame size={7} fill="currentColor" /> HOT
          </div>
        )}

        {/* rating */}
        {rating && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Star size={8} className="text-yellow-400" fill="currentColor" />
            <span className="text-yellow-400 text-[9px] font-black">{rating}</span>
          </div>
        )}

        {/* viewer count */}
        {viewerCount !== undefined && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Eye size={7} className="text-white/60" />
            <span className="text-white/60 text-[8px] font-bold">{fmtViewers(viewerCount)}</span>
          </div>
        )}
      </div>

      {rank === undefined && (
        <p className="mt-1.5 text-white/80 text-[11px] font-bold leading-tight line-clamp-2 px-0.5">{title}</p>
      )}
    </motion.div>
  );
});

// Horizontal carousel
const HorizontalScroll = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {children}
    </div>
  );
};

// Upcoming card
const UpcomingCard = ({ movie, onSelect }: { movie: any; onSelect: (m: any) => void }) => {
  const backdrop = img(movie.backdrop_path, 'w500') || img(movie.poster_path, 'w342');
  const title = movie.title || movie.name || '';
  const date = movie.release_date || movie.first_air_date;
  const dateLabel = date ? new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase() : 'EM BREVE';

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className="relative cursor-pointer flex-none rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl"
      style={{ width: 200, height: 120 }}
      onClick={() => onSelect(movie)}
    >
      {backdrop ? (
        <img src={backdrop} alt={title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-red-900/20 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="inline-flex items-center gap-1 bg-red-600/90 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full mb-1">
          <Calendar size={7} /> {dateLabel}
        </div>
        <p className="text-white font-black text-[12px] leading-tight line-clamp-1">{title}</p>
        <p className="text-white/40 text-[10px] mt-0.5">{movie.genres?.split(',')[0] || 'Lançamento'}</p>
      </div>
      <div className="absolute top-2 right-2">
        <button
          className="flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <Bell size={8} /> Lembrar
        </button>
      </div>
    </motion.div>
  );
};

// Universe card
const UniverseCard = ({ universe, onClick }: { universe: typeof UNIVERSES[0]; onClick: () => void }) => (
  <motion.button
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    className="relative flex-none rounded-2xl overflow-hidden border border-white/[0.08] flex flex-col items-center justify-center gap-1"
    style={{
      width: 90,
      height: 90,
      background: `radial-gradient(circle at 40% 40%, ${universe.color}22, #050505 70%)`,
      boxShadow: `0 0 20px ${universe.glow}22`,
    }}
  >
    <span style={{ fontSize: 28 }}>{universe.emoji}</span>
    <span className="text-white font-black text-[10px] uppercase tracking-wide">{universe.label}</span>
    <div
      className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity"
      style={{ background: `radial-gradient(circle, ${universe.color}18, transparent 70%)` }}
    />
  </motion.button>
);

// Channel card
const ChannelCard = ({ movie, onSelect }: { movie: Movie; onSelect: (m: Movie) => void }) => {
  const backdrop = img(movie.backdrop_path, 'w500') || img(movie.poster_path, 'w342');
  const isLive = seededRandom(movie.id * 3) > 0.5;
  const viewers = Math.floor(seededRandom(movie.id * 7) * 8000 + 500);

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className="relative cursor-pointer flex-none rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl"
      style={{ width: 160, height: 100 }}
      onClick={() => onSelect(movie)}
    >
      {backdrop ? (
        <img src={backdrop} alt={movie.title || movie.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      {isLive && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full">
          <Wifi size={7} className="animate-pulse" /> AO VIVO
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-white font-black text-[11px] leading-tight truncate">{movie.title || movie.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Eye size={8} className="text-white/40" />
          <span className="text-white/40 text-[9px]">{fmtViewers(viewers)}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── main component ────────────────────────────────────────────────────
export interface NovidadesViewProps {
  newMovies:         Movie[];
  top10Movies:       Movie[];
  top10Series:       Movie[];
  myMovies:          Movie[];
  handleSelectMovie: (m: Movie) => void;
  toggleMyList:      (m: Movie) => void;
  myListIds:         Set<number>;
  profile?:          Profile | null;
}

const NovidadesView = React.memo(({
  newMovies,
  top10Movies,
  top10Series,
  myMovies,
  handleSelectMovie,
  toggleMyList,
  myListIds,
  profile,
}: NovidadesViewProps) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroInList, setHeroInList] = useState(false);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // hero movies = top 10 + new releases mixed
  const heroMovies = useMemo(() => {
    const pool = [...top10Movies.slice(0, 5), ...newMovies.slice(0, 5)];
    return pool.filter(m => m.backdrop_path);
  }, [top10Movies, newMovies]);

  const hero = heroMovies[heroIndex] || heroMovies[0];

  // auto-rotate hero
  useEffect(() => {
    if (heroMovies.length < 2) return;
    heroTimer.current = setInterval(() => {
      setHeroIndex(i => (i + 1) % heroMovies.length);
    }, 6000);
    return () => clearInterval(heroTimer.current);
  }, [heroMovies.length]);

  useEffect(() => {
    if (hero) setHeroInList(myListIds.has(hero.id));
  }, [hero, myListIds]);

  // derived carousels
  const chegouHoje = useMemo(() => newMovies.slice(0, 12), [newMovies]);
  const emAlta = useMemo(() => [...top10Movies.slice(0, 5), ...top10Series.slice(0, 5)], [top10Movies, top10Series]);
  const recemAdicionados = useMemo(() => [...myMovies].sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  ).slice(0, 12), [myMovies]);
  const bombando = useMemo(() => [...myMovies]
    .filter(m => m.vote_average > 7)
    .sort(() => 0.5 - Math.random())
    .slice(0, 12), [myMovies]);
  const topStreaming = useMemo(() => [...myMovies]
    .filter(m => m.vote_average > 6.5)
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 10), [myMovies]);
  const proximos = useMemo(() => [...newMovies]
    .filter(m => m.release_date && new Date(m.release_date) > new Date(Date.now() - 30 * 86400000))
    .slice(0, 8), [newMovies]);
  const porqueGostou = useMemo(() => {
    if (!myMovies.length) return [];
    return [...myMovies].sort(() => 0.5 - Math.random()).slice(0, 10);
  }, [myMovies]);

  const backdropUrl = img(hero?.backdrop_path, 'original');
  const heroTitle   = hero?.title || hero?.name || '';
  const heroRating  = hero && hero.vote_average > 0 ? hero.vote_average.toFixed(1) : null;
  const heroGenre   = hero?.genres?.split(',')[0]?.trim() || '';
  const heroYear    = hero?.release_date ? new Date(hero.release_date).getFullYear() : (hero?.first_air_date ? new Date(hero.first_air_date).getFullYear() : null);

  const handleHeroMyList = useCallback(() => {
    if (!hero) return;
    setHeroInList(v => !v);
    toggleMyList(hero);
  }, [hero, toggleMyList]);

  return (
    <div className="min-h-screen pb-28" style={{ background: '#050505' }}>

      {/* ── HERO BANNER ────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: '70vw', maxHeight: 420 }}>
        <AnimatePresence mode="wait">
          {backdropUrl && (
            <motion.img
              key={heroIndex}
              src={backdropUrl}
              alt={heroTitle}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
          )}
        </AnimatePresence>

        {/* multi-layer gradient */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, #050505 0%, #050505aa 25%, transparent 60%)',
        }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to right, #050505cc 0%, transparent 60%)',
        }} />
        {/* red glow at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: 'linear-gradient(to top, rgba(255,26,26,0.08), transparent)' }} />

        {/* hero dot indicators */}
        {heroMovies.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {heroMovies.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroIndex(i)}
                className={`rounded-full transition-all duration-300 ${i === heroIndex ? 'w-5 h-1.5 bg-red-500' : 'w-1.5 h-1.5 bg-white/25'}`}
              />
            ))}
          </div>
        )}

        {/* hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[8px] font-black uppercase tracking-widest bg-red-600/90 text-white px-2 py-0.5 rounded-full">NOVO</span>
                {heroRating && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                    <Star size={8} fill="currentColor" /> {heroRating} IMDb
                  </span>
                )}
                {heroYear && <span className="text-[9px] font-bold text-white/40">{heroYear}</span>}
                {heroGenre && <span className="text-[9px] font-bold text-white/40">{heroGenre}</span>}
              </div>

              {/* title */}
              <h1 className="text-white font-black text-3xl leading-tight tracking-tight drop-shadow-2xl mb-2 line-clamp-2">
                {heroTitle}
              </h1>

              {/* synopsis */}
              {hero?.overview && (
                <p className="text-white/55 text-[12px] leading-relaxed line-clamp-2 mb-3 max-w-xs">
                  {hero.overview}
                </p>
              )}

              {/* CTA buttons */}
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => hero && handleSelectMovie(hero)}
                  className="flex items-center gap-2 bg-white text-black font-black text-[12px] uppercase tracking-wide px-5 py-2.5 rounded-full shadow-xl shadow-white/20"
                >
                  <Play size={13} fill="currentColor" /> Assistir
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={handleHeroMyList}
                  className={`flex items-center gap-2 font-black text-[12px] uppercase tracking-wide px-4 py-2.5 rounded-full border transition-all ${
                    heroInList
                      ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-white/10 backdrop-blur-sm border-white/20 text-white'
                  }`}
                >
                  {heroInList ? <Check size={13} /> : <Plus size={13} />}
                  {heroInList ? 'Na lista' : 'Minha lista'}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => hero && handleSelectMovie(hero)}
                  className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-full"
                >
                  <Info size={16} />
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── PAGE HEADER ────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-black text-2xl tracking-tight">Novidades</h1>
          <Sparkles size={18} className="text-red-500" />
        </div>
        <p className="text-white/35 text-[12px] mt-0.5">Tudo que acabou de chegar para você.</p>
      </div>

      {/* ── FILTER PILLS ───────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        {FILTERS.map(f => (
          <motion.button
            key={f.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFilter(f.id)}
            className={`flex items-center gap-1.5 flex-none px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide transition-all ${
              activeFilter === f.id
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 border border-red-500/50'
                : 'bg-white/[0.07] text-white/50 border border-white/[0.08]'
            }`}
            style={activeFilter === f.id ? { boxShadow: '0 0 16px rgba(255,26,26,0.35)' } : {}}
          >
            <f.icon size={11} />
            {f.label}
          </motion.button>
        ))}
      </div>

      {/* ── CHEGOU HOJE ────────────────────────────────────── */}
      {chegouHoje.length > 0 && (
        <section className="mt-4">
          <SectionHeader icon={Zap} title="Chegou Hoje" badge="NOVO" />
          <HorizontalScroll>
            {chegouHoje.map(m => (
              <PosterCard key={m.id} movie={m} onSelect={handleSelectMovie} badge="NOVO" />
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── EM ALTA AGORA (Top 10) ──────────────────────────── */}
      {emAlta.length > 0 && (
        <section className="mt-6">
          <SectionHeader icon={TrendingUp} title="Em Alta Agora" onViewAll={() => navigate('/trending')} />
          <HorizontalScroll>
            {emAlta.map((m, i) => (
              <PosterCard key={m.id} movie={m} onSelect={handleSelectMovie} rank={i + 1} />
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── PRÓXIMOS LANÇAMENTOS ───────────────────────────── */}
      {proximos.length > 0 && (
        <section className="mt-6">
          <SectionHeader icon={Calendar} title="Próximos Lançamentos" />
          <HorizontalScroll>
            {proximos.map(m => (
              <UpcomingCard key={m.id} movie={m} onSelect={handleSelectMovie} />
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── RECÉM ADICIONADOS ──────────────────────────────── */}
      {recemAdicionados.length > 0 && (
        <section className="mt-6">
          <SectionHeader icon={Clock} title="Recém Adicionados" />
          <HorizontalScroll>
            {recemAdicionados.map(m => (
              <PosterCard key={m.id} movie={m} onSelect={handleSelectMovie} badge="NOVO" />
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── BOMBANDO NO MOMENTO ────────────────────────────── */}
      {bombando.length > 0 && (
        <section className="mt-6">
          <SectionHeader icon={Flame} title="Bombando no Momento" badge="VIRAL" />
          <HorizontalScroll>
            {bombando.map(m => (
              <PosterCard
                key={m.id}
                movie={m}
                onSelect={handleSelectMovie}
                viewerCount={Math.floor(seededRandom(m.id * 13) * 12000 + 1000)}
              />
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── TOP STREAMING ──────────────────────────────────── */}
      {topStreaming.length > 0 && (
        <section className="mt-6">
          <SectionHeader icon={Star} title="Top Streaming" />
          <div className="px-4 space-y-2">
            {topStreaming.slice(0, 5).map((m, i) => {
              const poster = img(m.poster_path, 'w92');
              const title  = m.title || m.name || '';
              const hype   = Math.round((m.vote_average / 10) * 100);
              return (
                <motion.div
                  key={m.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelectMovie(m)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] cursor-pointer active:bg-white/[0.07] transition-colors"
                >
                  <span className="text-[13px] font-black text-white/25 w-5 text-center flex-none">
                    #{i + 1}
                  </span>
                  <div className="w-10 h-14 rounded-xl overflow-hidden flex-none bg-white/5">
                    {poster && <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-[13px] truncate">{title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${hype}%`,
                            background: 'linear-gradient(to right, #ff1a1a, #ff6b35)',
                            boxShadow: '0 0 8px rgba(255,26,26,0.6)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-red-400 flex-none">{hype}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-none">
                    <Star size={10} className="text-yellow-400" fill="currentColor" />
                    <span className="text-yellow-400 text-[11px] font-black">
                      {m.vote_average > 0 ? m.vote_average.toFixed(1) : '—'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── UNIVERSOS ──────────────────────────────────────── */}
      <section className="mt-6">
        <SectionHeader icon={Rocket} title="Universos" />
        <HorizontalScroll>
          {UNIVERSES.map(u => (
            <UniverseCard key={u.id} universe={u} onClick={() => {}} />
          ))}
        </HorizontalScroll>
      </section>

      {/* ── LANÇAMENTOS NOS CANAIS ─────────────────────────── */}
      {myMovies.filter(m => m.type === 'series').length > 0 && (
        <section className="mt-6">
          <SectionHeader icon={Radio} title="Nos Canais" onViewAll={() => navigate('/canais')} />
          <HorizontalScroll>
            {myMovies.filter(m => m.type === 'series').slice(0, 8).map(m => (
              <ChannelCard key={m.id} movie={m} onSelect={handleSelectMovie} />
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── PORQUE VOCÊ GOSTOU ─────────────────────────────── */}
      {porqueGostou.length > 0 && (
        <section className="mt-6 mb-4">
          <SectionHeader
            icon={Heart}
            title="Porque Você Gostou"
            badge="IA"
          />
          <HorizontalScroll>
            {porqueGostou.map(m => (
              <PosterCard key={m.id} movie={m} onSelect={handleSelectMovie} />
            ))}
          </HorizontalScroll>
        </section>
      )}
    </div>
  );
});

export default NovidadesView;
