import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Check, Play, Calendar, Clock, Sparkles, Grid3X3, X } from 'lucide-react';
import { FRANCHISES } from '../lib/franchiseConstants';
import { CATEGORIES } from '../constants';

const CAROUSEL_LIMIT = 20;
const EXPAND_STEP = 30;

const GENRE_ALIASES: Record<string, string[]> = {
  'Anime':         ['Anime', 'Animação', 'Animation'],
  'Infantil':      ['Infantil', 'Família', 'Kids', 'Family'],
  'Documentários': ['Documentários', 'Documentário', 'Documentary'],
  'Animação':      ['Animação', 'Anime', 'Animation'],
  'Família':       ['Família', 'Infantil', 'Kids'],
  'Documentário':  ['Documentário', 'Documentários'],
};

const SECTION_ACCENT: Record<string, string> = {
  'Anime':         '#a855f7',
  'Infantil':      '#f59e0b',
  'Documentários': '#22d3ee',
  'Ação':          '#ef4444',
  'Comédia':       '#f97316',
  'Terror':        '#6366f1',
  'Drama':         '#3b82f6',
  'Romance':       '#ec4899',
  'Ficção':        '#06b6d4',
};

function MovieCard({
  movie,
  onSelect,
  onToggleMyList,
  inMyList,
  priority = false,
}: {
  movie: any;
  onSelect: (m: any) => void;
  onToggleMyList?: (m: any) => void;
  inMyList?: boolean;
  priority?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className="group relative cursor-pointer flex-shrink-0 w-[110px] sm:w-[130px] md:w-[150px]"
      onClick={() => onSelect(movie)}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/[0.07] group-hover:border-red-500/50 transition-all shadow-xl relative">
        <img
          src={
            movie.poster_path
              ? movie.poster_path.startsWith('http')
                ? movie.poster_path
                : `https://image.tmdb.org/t/p/w342${movie.poster_path}`
              : movie.backdrop_path
              ? `https://image.tmdb.org/t/p/w342${movie.backdrop_path}`
              : `https://picsum.photos/seed/${movie.id}/342/513`
          }
          alt={movie.title || movie.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading={priority ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
            <Play size={14} fill="white" className="text-white ml-0.5" />
          </div>
        </div>
        {onToggleMyList && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMyList(movie); }}
            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${inMyList ? 'bg-red-600 text-white' : 'bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'}`}
          >
            {inMyList ? <Check size={10} /> : <Plus size={10} />}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[9px] font-bold text-gray-400 truncate group-hover:text-white transition-colors leading-tight px-0.5">
        {movie.title || movie.name}
      </p>
      {movie.release_date && (
        <p className="text-[8px] text-gray-600 font-bold px-0.5">
          {movie.release_date.split('-')[0]}
        </p>
      )}
    </motion.div>
  );
}

function HorizontalCarousel({
  title,
  movies,
  icon,
  accent,
  totalCount,
  onSelect,
  onToggleMyList,
  myList,
  onViewAll,
}: {
  title: string;
  movies: any[];
  icon?: React.ReactNode;
  accent?: string;
  totalCount: number;
  onSelect: (m: any) => void;
  onToggleMyList?: (m: any) => void;
  myList?: any[];
  onViewAll?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -500 : 500, behavior: 'smooth' });
  }, []);

  if (movies.length === 0) return null;

  return (
    <section className="mb-8 md:mb-10">
      <div className="flex items-center justify-between mb-3 px-4 md:px-12">
        <div className="flex items-center gap-2.5">
          <span
            className="block w-1 h-5 rounded-full shadow-lg"
            style={{ background: accent || '#ef4444', boxShadow: `0 0 10px ${accent || '#ef4444'}80` }}
          />
          {icon && <span className="text-white/50">{icon}</span>}
          <h3 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter italic">{title}</h3>
          <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
            {totalCount} títulos
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > CAROUSEL_LIMIT && onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-full border border-white/[0.06]"
            >
              <Grid3X3 size={10} />
              Ver Tudo ({totalCount - CAROUSEL_LIMIT} a mais)
            </button>
          )}
          <button onClick={() => scroll('left')} className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft size={13} className="text-white" />
          </button>
          <button onClick={() => scroll('right')} className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronRight size={13} className="text-white" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-12 pb-2"
      >
        {movies.map((m, i) => (
          <MovieCard
            key={m.id}
            movie={m}
            onSelect={onSelect}
            onToggleMyList={onToggleMyList}
            inMyList={myList?.some((x: any) => x.id === m.id)}
            priority={i < 6}
          />
        ))}
        {totalCount > CAROUSEL_LIMIT && onViewAll && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-[90px] sm:w-[110px] gap-2">
            <button
              onClick={onViewAll}
              className="aspect-[2/3] w-full rounded-xl border-2 border-dashed border-white/10 hover:border-white/25 flex flex-col items-center justify-center gap-2 transition-colors group"
            >
              <Grid3X3 size={18} className="text-gray-600 group-hover:text-white transition-colors" />
              <span className="text-[8px] font-black text-gray-600 group-hover:text-white uppercase tracking-wider text-center transition-colors leading-tight">Ver<br/>Tudo</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ExpandedGrid({
  title,
  movies,
  accent,
  onSelect,
  onToggleMyList,
  myList,
  onClose,
}: {
  title: string;
  movies: any[];
  accent?: string;
  onSelect: (m: any) => void;
  onToggleMyList?: (m: any) => void;
  myList?: any[];
  onClose: () => void;
}) {
  const [count, setCount] = useState(EXPAND_STEP);
  const visible = movies.slice(0, count);

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mb-8 md:mb-10 px-4 md:px-12 overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="block w-1 h-5 rounded-full"
              style={{ background: accent || '#ef4444' }}
            />
            <h3 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter italic">{title}</h3>
            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{movies.length} títulos</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-red-600/20 hover:border-red-600/30 transition-colors"
          >
            <X size={12} className="text-white" />
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 md:gap-3">
          {visible.map((m, i) => (
            <MovieCard
              key={m.id}
              movie={m}
              onSelect={onSelect}
              onToggleMyList={onToggleMyList}
              inMyList={myList?.some((x: any) => x.id === m.id)}
            />
          ))}
        </div>

        {count < movies.length && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setCount(c => c + EXPAND_STEP)}
              className="flex items-center gap-2 px-8 py-3 bg-white/[0.04] border border-white/[0.08] rounded-full font-black uppercase text-[10px] tracking-widest text-gray-300 hover:bg-white/[0.08] hover:text-white hover:border-red-600/30 transition-all"
            >
              Carregar mais 30
              <ChevronRight size={12} className="text-red-500" />
            </motion.button>
            <span className="text-gray-700 font-bold text-[9px] uppercase tracking-widest">
              {movies.length - count} restantes
            </span>
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  );
}

const GenreViewWrapper = ({
  myMovies,
  moviesByGenre,
  handleSelectMovie,
  navigate,
  toggleMyList,
  myList,
}: any) => {
  const { genreName } = useParams();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const accent = SECTION_ACCENT[genreName || ''] || '#ef4444';

  const genreMovies = useMemo(() => {
    if (!genreName) return [];
    if (genreName === 'Adicionados Recentemente') return myMovies;

    const aliases = GENRE_ALIASES[genreName] || [genreName];
    const seen = new Set<any>();
    const result: any[] = [];
    for (const alias of aliases) {
      for (const m of (moviesByGenre[alias] || [])) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          result.push(m);
        }
      }
    }
    return result;
  }, [genreName, myMovies, moviesByGenre]);

  const recentlyAdded = useMemo(() =>
    [...genreMovies].sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ),
    [genreMovies]
  );

  const byYear = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const m of genreMovies) {
      const yr = m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0] || 'Sem data';
      if (!map[yr]) map[yr] = [];
      map[yr].push(m);
    }
    return Object.entries(map)
      .filter(([, arr]) => arr.length > 0)
      .sort(([a], [b]) => (b === 'Sem data' ? -1 : a === 'Sem data' ? 1 : Number(b) - Number(a)));
  }, [genreMovies]);

  const theme = useMemo(() =>
    FRANCHISES.find(f =>
      f.name.toLowerCase() === genreName?.toLowerCase() ||
      f.id === genreName?.toLowerCase()
    ),
    [genreName]
  );

  const category = useMemo(() =>
    CATEGORIES.find((c: any) => c.name.toLowerCase() === genreName?.toLowerCase()),
    [genreName]
  );

  const heroMovie = genreMovies[Math.floor(Math.random() * Math.min(genreMovies.length, 5))] || genreMovies[0];

  const toggleExpand = useCallback((key: string) => {
    setExpandedSection(prev => prev === key ? null : key);
  }, []);

  return (
    <div className="min-h-screen pb-40 relative overflow-hidden animate-fade-in bg-[#050505]">
      {/* Cinematic background */}
      <div className="absolute top-0 left-0 w-full h-[55vh] pointer-events-none">
        <img
          src={
            theme?.backdrop ||
            (heroMovie?.backdrop_path
              ? heroMovie.backdrop_path.startsWith('http')
                ? heroMovie.backdrop_path
                : `https://image.tmdb.org/t/p/w1280${heroMovie.backdrop_path}`
              : `https://picsum.photos/seed/${genreName}/1280/720`)
          }
          className="w-full h-full object-cover opacity-25 blur-sm scale-105"
          alt=""
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />
      </div>

      {/* Header */}
      <div className="relative z-10 pt-24 pb-8 px-4 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-2 h-7 rounded-full shadow-lg"
                style={{ background: accent, boxShadow: `0 0 14px ${accent}80` }}
              />
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-white/40">Explorar Categoria</span>
            </div>
            <div className="flex items-center gap-4">
              {category && (
                <div className="p-3 bg-white/[0.05] rounded-2xl border border-white/[0.08] backdrop-blur-xl">
                  <category.icon size={32} className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
                </div>
              )}
              <h1
                className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter italic leading-none drop-shadow-2xl"
                style={{ textShadow: `0 0 60px ${accent}30` }}
              >
                {genreName}
              </h1>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                {genreMovies.length} títulos na biblioteca
              </span>
              {byYear.length > 0 && (
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                  · {byYear.length} períodos
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-[9px] italic bg-white/[0.05] px-6 py-3 rounded-2xl border border-white/10 hover:bg-red-600 hover:border-red-600 transition-all shadow-xl backdrop-blur-2xl group self-start md:self-auto"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Voltar
          </button>
        </div>
      </div>

      {/* Content */}
      {genreMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 mx-4 md:mx-12 bg-white/[0.02] rounded-3xl border-2 border-dashed border-white/[0.04]">
          <Sparkles className="text-gray-800 mb-6 animate-pulse" size={60} />
          <h3 className="text-2xl font-black text-white italic uppercase mb-2">Sem resultados</h3>
          <p className="text-gray-500 font-bold max-w-xs text-center italic text-xs uppercase tracking-widest">
            A biblioteca desta categoria ainda está sendo mapeada.
          </p>
        </div>
      ) : (
        <div className="relative z-10 space-y-0">

          {/* ADICIONADOS RECENTEMENTE */}
          <HorizontalCarousel
            title="Adicionados Recentemente"
            movies={recentlyAdded.slice(0, CAROUSEL_LIMIT)}
            totalCount={recentlyAdded.length}
            icon={<Clock size={13} />}
            accent={accent}
            onSelect={handleSelectMovie}
            onToggleMyList={toggleMyList}
            myList={myList}
            onViewAll={() => toggleExpand('recent')}
          />
          {expandedSection === 'recent' && (
            <ExpandedGrid
              title="Adicionados Recentemente — Tudo"
              movies={recentlyAdded}
              accent={accent}
              onSelect={handleSelectMovie}
              onToggleMyList={toggleMyList}
              myList={myList}
              onClose={() => setExpandedSection(null)}
            />
          )}

          {/* POR ANO */}
          {byYear.map(([year, movies]) => (
            <React.Fragment key={year}>
              <HorizontalCarousel
                title={year === 'Sem data' ? 'Outros' : year}
                movies={movies.slice(0, CAROUSEL_LIMIT)}
                totalCount={movies.length}
                icon={<Calendar size={13} />}
                accent={accent}
                onSelect={handleSelectMovie}
                onToggleMyList={toggleMyList}
                myList={myList}
                onViewAll={() => toggleExpand(`year-${year}`)}
              />
              {expandedSection === `year-${year}` && (
                <ExpandedGrid
                  title={`${year === 'Sem data' ? 'Outros' : year} — Tudo`}
                  movies={movies}
                  accent={accent}
                  onSelect={handleSelectMovie}
                  onToggleMyList={toggleMyList}
                  myList={myList}
                  onClose={() => setExpandedSection(null)}
                />
              )}
            </React.Fragment>
          ))}

        </div>
      )}
    </div>
  );
};

export default GenreViewWrapper;
