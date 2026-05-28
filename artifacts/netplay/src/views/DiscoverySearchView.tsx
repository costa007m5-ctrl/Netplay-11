import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Mic, X, TrendingUp, Radio, Sparkles, Play,
  Clock, Star, Flame, Zap, Ghost, Wand2, Rocket, Tv,
  ChevronRight, Loader2, Laugh, Brain, Popcorn, Trophy,
  Crown, Eye, Film, Heart, Activity,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Movie, Profile } from '../types';
import { CATEGORIES } from '../constants';
import { supabase } from '../lib/supabase';
import tmdb, { requests } from '../services/tmdb';

// ─── tipos ──────────────────────────────────────────────────────────────────
interface DiscoverySearchViewProps {
  onSelectMovie:    (m: Movie) => void;
  myMovies:         Movie[];
  moviesByGenre:    Record<string, Movie[]>;
  dynamicFranchises: any[];
  onSelectFranchise: (f: any) => void;
  categories?:      any[];
  onMovieAdded?:    (m: Movie) => void;
  top10Movies?:     Movie[];
  newMovies?:       Movie[];
  continueWatching?: Movie[];
  profile?:         Profile | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────
const TMDB_IMG = (path: string | null | undefined, sz = 'w342') =>
  path
    ? path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${sz}${path}`
    : null;

const LS_KEY = 'netplay_recent_searches';
function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function saveHistory(q: string) {
  const h = loadHistory().filter(x => x !== q).slice(0, 9);
  try { localStorage.setItem(LS_KEY, JSON.stringify([q, ...h])); } catch {}
}

// ─── mood config ─────────────────────────────────────────────────────────────
const MOODS = [
  { id: 'epic',     label: 'Algo épico',     icon: Crown,   query: 'action adventure', color: '#f59e0b', bg: 'from-yellow-900/40' },
  { id: 'laugh',    label: 'Quero rir',       icon: Laugh,   query: 'comedy',           color: '#22c55e', bg: 'from-green-900/40' },
  { id: 'suspense', label: 'Quero suspense',  icon: Ghost,   query: 'thriller mystery', color: '#7c3aed', bg: 'from-purple-900/40' },
  { id: 'live',     label: 'Ao vivo agora',   icon: Radio,   query: null,               color: '#ff1a1a', bg: 'from-red-900/40', nav: '/canais' },
  { id: 'light',    label: 'Algo leve',       icon: Popcorn, query: 'family romance',   color: '#0ea5e9', bg: 'from-blue-900/40' },
];

// ─── gêneros premium (mistura CATEGORIES + esportes) ────────────────────────
const GENRES = [
  { name: 'Ação',    backdrop: CATEGORIES.find(c => c.name === 'Ação')?.backdrop    || '', color: '#f59e0b', icon: Zap },
  { name: 'Terror',  backdrop: CATEGORIES.find(c => c.name === 'Terror')?.backdrop  || '', color: '#7c3aed', icon: Ghost },
  { name: 'Anime',   backdrop: 'https://image.tmdb.org/t/p/original/2vFuG6bWGyQUzYS9d69E5l85nIz.jpg', color: '#ff6600', icon: Zap },
  { name: 'Futebol', backdrop: 'https://image.tmdb.org/t/p/original/fkHJT8bHMXFbHaUB3RMYMFNdgjr.jpg', color: '#22c55e', icon: Activity },
  { name: 'Drama',   backdrop: CATEGORIES.find(c => c.name === 'Drama')?.backdrop   || '', color: '#0ea5e9', icon: Heart },
  { name: 'Ficção',  backdrop: CATEGORIES.find(c => c.name === 'Ficção')?.backdrop  || '', color: '#00d4ff', icon: Rocket },
];

// ─── sub-componentes ─────────────────────────────────────────────────────────

// Chip de sugestão rápida
const QuickChip = ({ label, icon: Icon, active, onClick, color = '#ff1a1a' }: {
  label: string; icon: any; active?: boolean; onClick: () => void; color?: string;
}) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className="flex-none flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all"
    style={{
      background:   active ? `${color}22` : 'rgba(255,255,255,0.04)',
      borderColor:  active ? color        : 'rgba(255,255,255,0.07)',
      boxShadow:    active ? `0 0 16px ${color}44` : 'none',
      minWidth: 66,
    }}
  >
    <Icon size={16} style={{ color: active ? color : 'rgba(255,255,255,0.4)' }} />
    <span
      className="text-[9px] font-black uppercase tracking-wide text-center leading-tight"
      style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}
    >
      {label}
    </span>
  </motion.button>
);

// Card de gênero premium
const GenreCard = ({ genre, onClick }: { genre: typeof GENRES[0]; onClick: () => void }) => (
  <motion.div
    whileTap={{ scale: 0.94 }}
    onClick={onClick}
    className="relative flex-none cursor-pointer rounded-2xl overflow-hidden border border-white/[0.08]"
    style={{ width: 108, height: 70, boxShadow: `0 4px 20px ${genre.color}30` }}
  >
    {genre.backdrop ? (
      <img src={genre.backdrop} alt={genre.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
    ) : (
      <div className="absolute inset-0" style={{ background: `${genre.color}33` }} />
    )}
    <div className="absolute inset-0" style={{
      background: `linear-gradient(to top, ${genre.color}cc 0%, ${genre.color}55 40%, rgba(0,0,0,0.3) 100%)`,
    }} />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-1">
        <genre.icon size={14} color="#fff" />
        <span className="text-white font-black text-[10px] uppercase tracking-wide drop-shadow-xl">{genre.name}</span>
      </div>
    </div>
  </motion.div>
);

// Card de tendência
const TrendCard = ({ movie, badge, onSelect }: {
  movie: Movie; badge?: 'HOT' | 'NOVO EPISÓDIO' | 'AO VIVO'; onSelect: (m: Movie) => void;
}) => {
  const poster = TMDB_IMG(movie.poster_path, 'w342');
  const title  = movie.title || movie.name || '';
  const BADGE_COLORS: Record<string, string> = { HOT: '#ff1a1a', 'NOVO EPISÓDIO': '#22c55e', 'AO VIVO': '#ff1a1a' };
  const bc = badge ? BADGE_COLORS[badge] || '#ff1a1a' : '#ff1a1a';

  return (
    <motion.div
      whileTap={{ scale: 0.94 }}
      onClick={() => onSelect(movie)}
      className="relative flex-none cursor-pointer rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{ width: 130, height: 185, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
    >
      {poster ? (
        <img src={poster} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 bg-white/5" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      {badge && (
        <div
          className="absolute top-2 left-2 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full"
          style={{ background: bc, boxShadow: `0 0 10px ${bc}88` }}
        >
          {badge === 'HOT' ? '🔥 HOT' : badge === 'AO VIVO' ? '● AO VIVO' : badge}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="text-white font-black text-[11px] leading-tight line-clamp-2">{title}</p>
        <div className="flex items-center gap-1 mt-1">
          <Star size={9} className="text-yellow-400" fill="currentColor" />
          <span className="text-yellow-400 text-[10px] font-black">
            {movie.vote_average > 0 ? movie.vote_average.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      {/* play overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
        <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/40">
          <Play size={14} fill="white" className="text-white ml-0.5" />
        </div>
      </div>
    </motion.div>
  );
};

// Card de resultado de busca — layout cinemático
const SearchResultCard = ({
  movie, inLibrary, onSelect,
}: {
  movie: any; inLibrary?: boolean; onSelect: (m: any) => void;
}) => {
  const poster   = TMDB_IMG(movie.poster_path, 'w342');
  const backdrop = TMDB_IMG(movie.backdrop_path, 'w500');
  const title    = movie.title || movie.name || '';
  const year     = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const type     = movie.type === 'series' || movie.media_type === 'tv' ? 'Série' : 'Filme';
  const seasons  = movie.number_of_seasons;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(movie)}
      className="relative rounded-2xl overflow-hidden cursor-pointer border border-white/[0.07] flex-none"
      style={{
        height: 96,
        background: 'rgba(255,255,255,0.03)',
        boxShadow: inLibrary ? '0 0 0 1px rgba(255,26,26,0.3)' : 'none',
      }}
    >
      {/* backdrop blur bg */}
      {backdrop && (
        <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent" />

      <div className="relative flex items-center gap-3 h-full px-3">
        {/* poster */}
        <div className="w-14 h-20 rounded-xl overflow-hidden flex-none border border-white/[0.08] shadow-lg -my-2">
          {poster ? (
            <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <Film size={18} className="text-white/20" />
            </div>
          )}
        </div>

        {/* meta */}
        <div className="flex-1 min-w-0 py-2">
          {inLibrary && (
            <span className="inline-flex items-center gap-1 bg-red-600/90 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full mb-1">
              <div className="w-1 h-1 rounded-full bg-white animate-pulse" /> Na Biblioteca
            </span>
          )}
          <p className="text-white font-black text-[14px] leading-tight truncate">{title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-white/40 text-[10px] font-bold">{type}</span>
            {year && <span className="text-white/30 text-[10px]">• {year}</span>}
            {seasons && <span className="text-white/30 text-[10px]">• {seasons} Temp.</span>}
            {movie.vote_average > 0 && (
              <span className="flex items-center gap-0.5 text-yellow-400 text-[10px] font-black">
                <Star size={8} fill="currentColor" /> {movie.vote_average.toFixed(1)}
              </span>
            )}
          </div>
          {movie.overview && (
            <p className="text-white/30 text-[10px] mt-1 line-clamp-1">{movie.overview}</p>
          )}
        </div>

        {/* play button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={e => { e.stopPropagation(); onSelect(movie); }}
          className="flex-none w-9 h-9 rounded-full flex items-center justify-center border border-white/20 bg-white/10 backdrop-blur-sm mr-1"
          style={inLibrary ? { background: '#ff1a1a', border: '1px solid #ff4444' } : {}}
        >
          <Play size={13} fill="white" className="text-white ml-0.5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

// Skeleton de loading
const SearchSkeleton = () => (
  <div className="space-y-3">
    {[0,1,2,3,4].map(i => (
      <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
    ))}
  </div>
);

// Waveform animado para voz
const VoiceWaveform = () => (
  <div className="flex items-center justify-center gap-1 h-8">
    {[0,1,2,3,4,5,6].map(i => (
      <motion.div
        key={i}
        className="w-1 rounded-full bg-red-500"
        animate={{ height: [4, 20, 8, 28, 6, 24, 4][i % 7] }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.4 + i * 0.1, ease: 'easeInOut' }}
        style={{ boxShadow: '0 0 8px rgba(255,26,26,0.6)' }}
      />
    ))}
  </div>
);

// ─── componente principal ─────────────────────────────────────────────────────
const DiscoverySearchView = React.memo(({
  onSelectMovie,
  myMovies,
  moviesByGenre,
  dynamicFranchises,
  onSelectFranchise,
  categories = CATEGORIES,
  onMovieAdded,
  top10Movies   = [],
  newMovies     = [],
  continueWatching = [],
  profile,
}: DiscoverySearchViewProps) => {
  const navigate            = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef            = useRef<HTMLInputElement>(null);

  const initialQ = searchParams.get('q') || '';
  const [query,          setQuery]          = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [isFocused,      setIsFocused]      = useState(false);
  const [isListening,    setIsListening]    = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadHistory);
  const [activeChip,     setActiveChip]     = useState<string | null>(null);

  // resultados
  const [localResults,    setLocalResults]    = useState<Movie[]>([]);
  const [externalResults, setExternalResults] = useState<Movie[]>([]);
  const [dbResults,       setDbResults]       = useState<Movie[]>([]);
  const [savedIds,        setSavedIds]        = useState<Set<number>>(new Set());
  const [isTmdbLoading,   setIsTmdbLoading]   = useState(false);
  const [isDbLoading,     setIsDbLoading]     = useState(false);

  const isSearching = query.length > 0;
  const isLoading   = isTmdbLoading || isDbLoading;

  // debounce
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query), 600);
    return () => clearTimeout(h);
  }, [query]);

  // sincroniza URL ↔ state
  useEffect(() => {
    const qp = searchParams.get('q');
    if (qp !== null && qp !== query) setQuery(qp);
  }, [searchParams]);

  // busca local instantânea
  useEffect(() => {
    if (!query) { setLocalResults([]); return; }
    const q = query.toLowerCase();
    setLocalResults(
      myMovies.filter(m =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.name  || '').toLowerCase().includes(q) ||
        (m.genres || '').toLowerCase().includes(q)
      )
    );
  }, [query, myMovies]);

  // busca Supabase
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setDbResults([]); return; }
    let cancelled = false;
    setIsDbLoading(true);
    const COLS = 'id,title,type,poster_path,backdrop_path,release_date,first_air_date,rating,vote_average,genres,video_url,video_url_2,logo_path,is_hidden,created_at,overview';
    supabase
      .from('movies')
      .select(COLS)
      .ilike('title', `%${debouncedQuery}%`)
      .order('rating', { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data)
          setDbResults(
            data
              .filter((m: any) => !m.is_hidden)
              .map((m: any) => ({ ...m, videoUrl: m.video_url, videoUrl2: m.video_url_2, vote_average: m.vote_average || m.rating || 0 }))
          );
        setIsDbLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // busca TMDB
  useEffect(() => {
    if (!debouncedQuery) { setExternalResults([]); return; }
    let cancelled = false;
    setIsTmdbLoading(true);
    const fetchTmdb = async () => {
      try {
        const ql = debouncedQuery.toLowerCase();
        let endpoint = requests.searchMulti;
        let params: any = { query: debouncedQuery, language: 'pt-BR' };
        if (ql === 'marvel')   { endpoint = '/discover/movie'; params = { with_companies: 420, sort_by: 'popularity.desc', language: 'pt-BR' }; }
        else if (ql === 'dc')  { endpoint = '/discover/movie'; params = { with_companies: 128064, sort_by: 'popularity.desc', language: 'pt-BR' }; }
        const { data } = await tmdb.get(endpoint, { params });
        if (cancelled) return;
        const results = (data.results || [])
          .filter((r: any) => r.media_type !== 'person')
          .map((r: any) => ({
            ...r,
            title: r.title || r.name,
            type: r.media_type === 'tv' || r.first_air_date ? 'series' : 'movie',
            _isTmdb: true,
          }));
        if (!cancelled) setExternalResults(results);
      } catch { if (!cancelled) setExternalResults([]); }
      finally  { if (!cancelled) setIsTmdbLoading(false); }
    };
    fetchTmdb();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // deduplica resultados
  const mergedResults = useMemo(() => {
    const norm  = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]/gi, '');
    const byId  = new Map<any, any>();
    localResults.forEach(m => byId.set(m.id, { ...m, _isLocal: true }));
    dbResults.forEach(m => { if (!byId.has(m.id)) byId.set(m.id, { ...m, _isLocal: true }); });
    const externals: any[] = [];
    externalResults.forEach((ext: any) => {
      const found = byId.get(ext.id) || Array.from(byId.values()).find(m =>
        norm(m.title || '') === norm(ext.title || ext.name || '') && norm(m.title || '').length > 2
      );
      if (found) {
        if (!byId.has(found.id)) byId.set(found.id, { ...found, _isLocal: true });
      } else if (!externals.some(e => e.id === ext.id)) {
        externals.push({ ...ext, _isLocal: false });
      }
    });
    return [...Array.from(byId.values()), ...externals];
  }, [localResults, externalResults, dbResults]);

  // clique num resultado — abre imediatamente + salva em background
  const handleResultClick = useCallback(async (m: any) => {
    if (query) {
      saveHistory(query);
      setRecentSearches(loadHistory());
    }
    onSelectMovie(m._isLocal ? m : { ...m, _isLocal: true } as any);
    if (m._isLocal || savedIds.has(m.id)) return;
    try {
      const derivedType = m.type || (m.media_type === 'tv' ? 'series' : 'movie');
      const ep = derivedType === 'series' ? `/tv/${m.id}` : `/movie/${m.id}`;
      const { data: det } = await tmdb.get(ep, { params: { language: 'pt-BR' } });
      const movieData = {
        id: m.id, title: det.title || det.name || m.title, type: derivedType,
        overview: det.overview || '', poster_path: det.poster_path || m.poster_path || '',
        backdrop_path: det.backdrop_path || m.backdrop_path || '',
        release_date: det.release_date || '', first_air_date: det.first_air_date || '',
        release_year: parseInt((det.release_date || det.first_air_date || '').slice(0,4)) || null,
        rating: det.vote_average || m.vote_average || 0,
        genres: (det.genres || []).map((g: any) => g.name).join(', '), video_url: '',
      };
      const res = await fetch('/api/movies/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieData),
      });
      if (res.ok) {
        setSavedIds(p => new Set(p).add(m.id));
        onMovieAdded?.({ ...movieData, vote_average: movieData.rating, videoUrl: '' } as any);
      }
    } catch {}
  }, [query, onSelectMovie, savedIds, onMovieAdded]);

  const clearSearch = useCallback(() => {
    setQuery(''); setDebouncedQuery('');
    setLocalResults([]); setExternalResults([]); setDbResults([]);
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  }, [setSearchParams]);

  const doSearch = useCallback((q: string) => {
    setQuery(q); setDebouncedQuery(q);
    setSearchParams({ q }, { replace: true });
    inputRef.current?.blur();
    if (q) { saveHistory(q); setRecentSearches(loadHistory()); }
  }, [setSearchParams]);

  const handleMoodClick = useCallback((mood: typeof MOODS[0]) => {
    if (mood.nav) { navigate(mood.nav); return; }
    if (mood.query) doSearch(mood.query);
  }, [navigate, doSearch]);

  const handleGenreClick = useCallback((name: string) => {
    navigate(`/genre/${name}`);
  }, [navigate]);

  // carrosséis de descoberta
  const trendingCards = useMemo(() =>
    [...top10Movies.slice(0, 4), ...newMovies.slice(0, 4)].filter((m, i, a) => a.findIndex(x => x.id === m.id) === i).slice(0, 8),
    [top10Movies, newMovies]
  );

  return (
    <div className="min-h-screen pb-28" style={{ background: '#050505' }}>

      {/* ── BARRA DE BUSCA PREMIUM ──────────────────────── */}
      <div
        className="sticky top-0 z-50 px-4 pt-4 pb-3"
        style={{ background: 'linear-gradient(to bottom, #050505 80%, transparent)' }}
      >
        {/* campo principal */}
        <motion.div
          animate={isFocused ? { boxShadow: '0 0 0 2px #ff1a1a, 0 0 40px rgba(255,26,26,0.3)' } : { boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}
          transition={{ duration: 0.2 }}
          className="relative flex items-center gap-2 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}
        >
          <Search size={18} className={isFocused ? 'text-red-500' : 'text-white/30'} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={e => e.key === 'Enter' && query && doSearch(query)}
            placeholder="Buscar filmes, séries, canais, atores..."
            className="flex-1 bg-transparent text-white text-[14px] font-medium placeholder-white/25 outline-none"
            autoComplete="off"
          />
          <AnimatePresence>
            {query ? (
              <motion.button
                key="clear"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                onClick={clearSearch}
                className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center flex-none"
              >
                <X size={12} className="text-white" />
              </motion.button>
            ) : null}
          </AnimatePresence>
          {isLoading ? (
            <Loader2 size={18} className="text-red-500 animate-spin flex-none" />
          ) : (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setIsListening(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-none"
              style={{
                background: isListening ? '#ff1a1a' : 'rgba(255,255,255,0.08)',
                boxShadow: isListening ? '0 0 20px rgba(255,26,26,0.5)' : 'none',
              }}
            >
              <Mic size={15} className={isListening ? 'text-white' : 'text-white/40'} />
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* ── VOICE MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ background: 'rgba(5,5,5,0.96)', backdropFilter: 'blur(20px)' }}
            onClick={() => setIsListening(false)}
          >
            <motion.div
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center gap-8"
            >
              <motion.div
                animate={{ boxShadow: ['0 0 0 0 rgba(255,26,26,0)', '0 0 0 32px rgba(255,26,26,0)'] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: '#ff1a1a' }}
              >
                <Mic size={32} className="text-white" />
              </motion.div>
              <VoiceWaveform />
              <p className="text-white/50 text-[13px] font-bold tracking-widest uppercase">Estou ouvindo...</p>
              <p className="text-white/20 text-[11px]">Toque para cancelar</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTEÚDO ──────────────────────────────────────── */}
      <div className="px-4">

        {/* ── ESTADO DE BUSCA ATIVO ─────────────────────── */}
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2"
            >
              {/* contagem */}
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-white/40 text-[11px] font-bold">
                  {isLoading ? 'Buscando...' : `${mergedResults.length} resultado${mergedResults.length !== 1 ? 's' : ''}`}
                </p>
                {mergedResults.length > 0 && (
                  <span className="text-[10px] text-white/25 font-bold">
                    {mergedResults.filter(m => m._isLocal || savedIds.has(m.id)).length} na biblioteca
                  </span>
                )}
              </div>

              {/* loading skeleton */}
              {isLoading && mergedResults.length === 0 && <SearchSkeleton />}

              {/* resultados */}
              {mergedResults.length > 0 && (
                <div className="space-y-2">
                  {mergedResults.slice(0, 40).map((m: any) => (
                    <SearchResultCard
                      key={`${m.id}-${m._isLocal ? 'l' : 'e'}`}
                      movie={m}
                      inLibrary={m._isLocal || savedIds.has(m.id)}
                      onSelect={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {/* vazio */}
              {!isLoading && mergedResults.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <Search size={24} className="text-white/20" />
                  </div>
                  <p className="text-white/40 font-bold text-[14px]">Nada encontrado</p>
                  <p className="text-white/20 text-[12px] text-center max-w-xs">
                    Tente outros termos ou explore por gênero abaixo
                  </p>
                  <button onClick={clearSearch} className="mt-2 px-6 py-2 bg-red-600 rounded-full text-white text-[11px] font-black uppercase tracking-widest">
                    Limpar
                  </button>
                </motion.div>
              )}
            </motion.div>

          ) : (
            /* ── MODO DESCOBERTA (sem busca ativa) ──── */
            <motion.div
              key="discovery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-0"
            >

              {/* ── CHIPS RÁPIDOS ───────────────────── */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 -mx-4 px-4">
                <QuickChip label="Em Alta"       icon={TrendingUp} active={activeChip === 'trending'} onClick={() => { setActiveChip('trending'); doSearch('tendências'); }} />
                <QuickChip label="Ao Vivo"        icon={Radio}      active={activeChip === 'live'}    onClick={() => { setActiveChip('live'); navigate('/canais'); }} color="#ff1a1a" />
                <QuickChip label="Novidades"      icon={Sparkles}   active={activeChip === 'new'}     onClick={() => { setActiveChip('new'); navigate('/novidades'); }} />
                <QuickChip label="Rec. IA"         icon={Brain}      active={activeChip === 'ai'}      onClick={() => { setActiveChip('ai'); doSearch('recomendados'); }} color="#a855f7" />
                {continueWatching.length > 0 && (
                  <QuickChip label="Continuar" icon={Play} active={activeChip === 'continue'} onClick={() => { setActiveChip('continue'); navigate('/mylist'); }} />
                )}
              </div>

              {/* ── PESQUISAS RECENTES ──────────────── */}
              {recentSearches.length > 0 && (
                <section className="mt-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-white/30" />
                      <span className="text-white/50 font-black text-[12px] uppercase tracking-wide">Pesquisas recentes</span>
                    </div>
                    <button
                      onClick={() => { localStorage.removeItem(LS_KEY); setRecentSearches([]); }}
                      className="text-[10px] text-white/25 font-bold uppercase tracking-wide active:text-red-400"
                    >
                      Limpar tudo
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map(h => (
                      <motion.button
                        key={h}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => doSearch(h)}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/50 text-[11px] font-bold"
                      >
                        {h}
                        <span
                          onClick={e => {
                            e.stopPropagation();
                            const updated = recentSearches.filter(x => x !== h);
                            try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch {}
                            setRecentSearches(updated);
                          }}
                          className="text-white/20 hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </section>
              )}

              {/* ── EM ALTA AGORA ───────────────────── */}
              {top10Movies.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flame size={15} className="text-red-500" />
                      <h2 className="text-white font-black text-[15px] uppercase tracking-tight">Em alta agora</h2>
                    </div>
                    <button onClick={() => navigate('/trending')} className="flex items-center gap-1 text-[10px] font-bold text-white/30">
                      Ver todos <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                    {top10Movies.slice(0, 10).map((m, i) => {
                      const poster = TMDB_IMG(m.poster_path, 'w342');
                      const title  = m.title || m.name || '';
                      return (
                        <motion.div
                          key={m.id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => handleResultClick(m)}
                          className="relative flex-none cursor-pointer"
                          style={{ width: 80 }}
                        >
                          <div
                            className="absolute -left-2.5 bottom-7 z-20 font-black leading-none select-none"
                            style={{ fontSize: 50, color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,0.12)', textShadow: '0 0 20px rgba(255,26,26,0.15)' }}
                          >
                            {i + 1}
                          </div>
                          <div className="relative rounded-2xl overflow-hidden ml-4 border border-white/[0.07]" style={{ aspectRatio: '2/3' }}>
                            {poster
                              ? <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
                              : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Film size={18} className="text-white/20" /></div>
                            }
                            {/* red glow top ranking */}
                            {i < 3 && <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,26,26,0.12) 0%, transparent 50%)' }} />}
                          </div>
                          <p className="text-white/50 text-[9px] font-bold mt-1.5 truncate px-0.5 ml-4">{title}</p>
                          {m.vote_average > 0 && (
                            <div className="flex items-center gap-0.5 mt-0.5 ml-4">
                              <Star size={7} className="text-yellow-400" fill="currentColor" />
                              <span className="text-yellow-400 text-[8px] font-black">{m.vote_average.toFixed(1)}</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── EXPLORAR POR GÊNERO ─────────────── */}
              <section className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={14} className="text-red-500" />
                  <h2 className="text-white font-black text-[15px] uppercase tracking-tight">Explorar por gênero</h2>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                  {GENRES.map(g => (
                    <GenreCard key={g.name} genre={g} onClick={() => handleGenreClick(g.name)} />
                  ))}
                </div>
              </section>

              {/* ── O QUE QUER ASSISTIR HOJE? ───────── */}
              <section className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={14} className="text-purple-400" />
                  <h2 className="text-white font-black text-[15px] uppercase tracking-tight">O que quer assistir hoje?</h2>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                  {MOODS.map(mood => (
                    <motion.button
                      key={mood.id}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleMoodClick(mood)}
                      className="flex-none flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.07] cursor-pointer"
                      style={{
                        width: 88, height: 88,
                        background: `linear-gradient(135deg, ${mood.bg.replace('from-', '').replace('/40', '20')}33, rgba(5,5,5,0.9))`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: `${mood.color}22`, border: `1px solid ${mood.color}44` }}
                      >
                        <mood.icon size={18} style={{ color: mood.color }} />
                      </div>
                      <span className="text-white/60 text-[9px] font-black uppercase tracking-wide text-center leading-tight px-1">
                        {mood.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* ── TENDÊNCIAS ──────────────────────── */}
              {trendingCards.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-red-500" />
                      <h2 className="text-white font-black text-[15px] uppercase tracking-tight">Tendências</h2>
                    </div>
                    <button onClick={() => navigate('/trending')} className="flex items-center gap-1 text-[10px] font-bold text-white/30">
                      Ver todos <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                    {trendingCards.map((m, i) => (
                      <TrendCard
                        key={m.id}
                        movie={m}
                        badge={i % 3 === 0 ? 'HOT' : i % 3 === 1 ? 'NOVO EPISÓDIO' : undefined}
                        onSelect={handleResultClick}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── UNIVERSOS & SAGAS ───────────────── */}
              {dynamicFranchises.length > 0 && (
                <section className="mt-6 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-yellow-500" />
                    <h2 className="text-white font-black text-[15px] uppercase tracking-tight">Universos & Sagas</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {dynamicFranchises.slice(0, 6).map(f => (
                      <motion.div
                        key={f.id}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => { onSelectFranchise(f); navigate(`/universe/${f.id}`); }}
                        className="relative rounded-2xl overflow-hidden cursor-pointer border border-white/[0.07]"
                        style={{ height: 70 }}
                      >
                        {f.backdrop && (
                          <img src={f.backdrop} alt={f.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        <div className="absolute inset-0 flex items-end p-2">
                          <p className="text-white font-black text-[10px] uppercase tracking-tight leading-tight line-clamp-2">{f.name}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default DiscoverySearchView;
