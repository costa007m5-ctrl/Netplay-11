import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Filter, Star, X, ChevronRight, History, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import tmdb, { requests } from '../services/tmdb';
import { Movie } from '../types';
import { CATEGORIES } from '../constants';
import { supabase } from '../lib/supabase';

interface AdvancedSearchProps {
  onSelectMovie: (movie: Movie) => void;
  myMovies: Movie[];
  moviesByGenre: Record<string, Movie[]>;
  dynamicFranchises: any[];
  onSelectFranchise: (franchise: any) => void;
  categories?: any[];
  onMovieAdded?: (movie: Movie) => void;
}

const AdvancedSearch = React.memo(({ onSelectMovie, myMovies, moviesByGenre, dynamicFranchises, onSelectFranchise, categories = CATEGORIES, onMovieAdded }: AdvancedSearchProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [localResults, setLocalResults] = useState<Movie[]>([]);
  const [externalResults, setExternalResults] = useState<Movie[]>([]);
  const [dbResults, setDbResults] = useState<Movie[]>([]);
  const [franchiseResults, setFranchiseResults] = useState<any[]>([]);
  const [isTmdbLoading, setIsTmdbLoading] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [history] = useState(['Oppenheimer', 'Marvel', 'Terror', 'Ficção']);
  const [year, setYear] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(0);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [displayCount, setDisplayCount] = useState(30);

  const popularTags = ['Novidades', 'Top 10', 'Oscar 2024', 'Marvel', 'DC', 'Dublados'];

  const isLoading = isTmdbLoading || isDbLoading;

  // Reseta paginação ao mudar a busca
  useEffect(() => { setDisplayCount(30); }, [debouncedQuery]);

  // Debounce 600ms para TMDB + DB
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 600);
    return () => clearTimeout(handler);
  }, [query]);

  // Busca local instantânea em myMovies (sem debounce)
  useEffect(() => {
    if (!query) {
      setLocalResults([]);
      setFranchiseResults([]);
      return;
    }
    const q = query.toLowerCase();
    setLocalResults(
      myMovies.filter(m =>
        (m.title || (m as any).name || '').toLowerCase().includes(q) ||
        ((m as any).genres || '').toLowerCase().includes(q)
      )
    );
    setFranchiseResults(
      dynamicFranchises.filter(f => f.name.toLowerCase().includes(q))
    );
  }, [query, myMovies, dynamicFranchises]);

  // ──────────────────────────────────────────────
  // Busca independente no Supabase (biblioteca completa)
  // Roda sozinha — não depende do TMDB
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setDbResults([]);
      return;
    }
    let cancelled = false;
    setIsDbLoading(true);
    const DB_COLS = 'id,title,type,poster_path,backdrop_path,release_date,first_air_date,rating,vote_average,genres,video_url,video_url_2,logo_path,is_hidden,created_at';
    supabase
      .from('movies')
      .select(DB_COLS)
      .ilike('title', `%${debouncedQuery}%`)
      .order('rating', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setDbResults(
            data
              .filter((m: any) => !m.is_hidden)
              .map((m: any) => ({
                ...m,
                videoUrl: m.video_url,
                videoUrl2: m.video_url_2,
                vote_average: m.vote_average || m.rating || 0,
                rating: m.rating || m.vote_average || 0,
              }))
          );
        }
        setIsDbLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ──────────────────────────────────────────────
  // Busca TMDB (sugestões externas)
  // Roda independente do Supabase
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery && selectedGenres.length === 0) {
      setExternalResults([]);
      return;
    }
    if (!debouncedQuery) return;

    let cancelled = false;
    setIsTmdbLoading(true);

    const fetchTmdb = async () => {
      try {
        const activeQuery = debouncedQuery;
        const queryLower = activeQuery.toLowerCase();
        let endpoint = requests.searchMulti;
        let params: any = { query: activeQuery, language: 'pt-BR' };

        if (queryLower === 'novidades') { endpoint = '/movie/now_playing'; params = { language: 'pt-BR' }; }
        else if (queryLower === 'top 10' || queryLower === 'em alta') { endpoint = '/trending/all/week'; params = { language: 'pt-BR' }; }
        else if (queryLower === 'marvel') { endpoint = '/discover/movie'; params = { with_companies: 420, sort_by: 'popularity.desc', language: 'pt-BR' }; }
        else if (queryLower === 'dc') { endpoint = '/discover/movie'; params = { with_companies: 128064, sort_by: 'popularity.desc', language: 'pt-BR' }; }
        else if (queryLower === 'oscar 2024') { endpoint = '/discover/movie'; params = { primary_release_year: 2023, sort_by: 'vote_average.desc', 'vote_count.gte': 1000, language: 'pt-BR' }; }
        else if (queryLower === 'dublados') { endpoint = '/discover/movie'; params = { with_original_language: 'pt', sort_by: 'popularity.desc', language: 'pt-BR' }; }

        const { data } = await tmdb.get(endpoint, { params });
        if (cancelled) return;

        const results = (data.results || [])
          .filter((r: any) => r.media_type !== 'person')
          .map((r: any) => {
            const mediaType = r.media_type || (r.first_air_date !== undefined ? 'tv' : 'movie');
            return {
              ...r,
              title: r.title || r.name,
              media_type: mediaType,
              type: mediaType === 'tv' ? 'series' : 'movie',
              _isTmdb: true,
            };
          })
          .filter((r: any) => (!minRating || r.vote_average >= minRating) && (!year || (r.release_date || r.first_air_date || '').includes(year)));

        if (!cancelled) setExternalResults(results);
      } catch (e) {
        if (!cancelled) setExternalResults([]);
      } finally {
        if (!cancelled) setIsTmdbLoading(false);
      }
    };

    fetchTmdb();
    return () => { cancelled = true; };
  }, [debouncedQuery, minRating, year, selectedGenres]);

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setLocalResults([]);
    setExternalResults([]);
    setDbResults([]);
    setFranchiseResults([]);
    setSearchParams({}, { replace: true });
  };

  const setSyncQuery = (q: string) => {
    setQuery(q);
    setDebouncedQuery(q);
    setSearchParams({ q }, { replace: true });
  };

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== query) setQuery(qParam);
  }, [searchParams]);

  // ──────────────────────────────────────────────
  // Auto-save: clicou num resultado TMDB (não está na biblioteca)
  // → abre imediatamente → salva em background via API server
  // ──────────────────────────────────────────────
  const handleResultClick = useCallback(async (m: any) => {
    if (m._isLocal) {
      onSelectMovie(m);
      return;
    }

    // Abre o conteúdo imediatamente sem esperar o save
    onSelectMovie({ ...m, _isLocal: true } as any);

    // Salva em background silenciosamente via API server (evita RLS do Supabase)
    try {
      const endpoint = m.type === 'series' ? `/tv/${m.id}` : `/movie/${m.id}`;
      const { data: details } = await tmdb.get(endpoint, { params: { language: 'pt-BR' } });

      const genres = (details.genres || []).map((g: any) => g.name).join(', ');
      const releaseDate = details.release_date || details.first_air_date || '';
      const releaseYear = parseInt(releaseDate.substring(0, 4)) || null;

      const movieData = {
        id: m.id,
        title: details.title || details.name || m.title,
        type: m.type,
        overview: details.overview || '',
        poster_path: details.poster_path || m.poster_path || '',
        backdrop_path: details.backdrop_path || m.backdrop_path || '',
        release_date: details.release_date || '',
        first_air_date: details.first_air_date || '',
        release_year: releaseYear,
        rating: details.vote_average || m.vote_average || 0,
        runtime: details.runtime || null,
        genres,
        genre: details.genres?.[0]?.name || '',
        video_url: '',
      };

      const res = await fetch('/api/movies/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieData),
      });

      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(m.id));
        // Notifica o App para adicionar o filme ao estado local (persiste no refresh via Supabase)
        if (onMovieAdded) {
          onMovieAdded({
            ...movieData,
            vote_average: movieData.rating,
            videoUrl: movieData.video_url,
          } as unknown as Movie);
        }
      }
    } catch (_e) {
      // Falha silenciosa — o usuário já está vendo o conteúdo
    }
  }, [onSelectMovie, onMovieAdded]);

  // Deduplica: biblioteca (local + DB) tem prioridade sobre TMDB
  const mergedDisplayResults = useMemo(() => {
    const normalizeTitle = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]/gi, '');
    const libraryById = new Map<any, any>();

    localResults.forEach(loc => libraryById.set(loc.id, { ...loc, _isLocal: true }));
    dbResults.forEach(db => {
      if (!libraryById.has(db.id)) libraryById.set(db.id, { ...db, _isLocal: true });
    });

    const externals: any[] = [];
    externalResults.forEach((ext: any) => {
      const existingInLibrary =
        libraryById.get(ext.id) ||
        Array.from(libraryById.values()).find(m =>
          normalizeTitle(m.title || (m as any).name || '') === normalizeTitle(ext.title || ext.name || '') &&
          normalizeTitle(m.title || (m as any).name || '').length > 2
        );

      if (existingInLibrary) {
        if (!libraryById.has(existingInLibrary.id)) {
          libraryById.set(existingInLibrary.id, { ...existingInLibrary, _isLocal: true });
        }
      } else {
        if (!externals.some(e => e.id === ext.id)) {
          externals.push({ ...ext, _isLocal: false });
        }
      }
    });

    return [...Array.from(libraryById.values()), ...externals];
  }, [localResults, externalResults, dbResults]);

  const hasResults = mergedDisplayResults.length > 0 || franchiseResults.length > 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-space overflow-x-hidden">
      {/* Barra de busca */}
      <div className="sticky top-0 z-[60] bg-black/80 backdrop-blur-3xl border-b border-white/5 py-6 md:py-10 px-5 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className="w-full relative group">
            <div className="relative flex items-center bg-[#111] border-2 border-white/5 focus-within:border-red-600 rounded-2xl md:rounded-[2rem] p-1.5 transition-colors shadow-2xl group-hover:bg-[#151515]">
              <div className="flex gap-1 md:gap-2 mr-1">
                <div className="px-3 md:px-5 py-2.5 rounded-xl md:rounded-2xl font-black text-[7px] md:text-[9px] uppercase tracking-widest flex items-center gap-1.5 bg-gray-600 text-white">
                  <Search size={12} /> Busca
                </div>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="O que vamos explorar hoje?..."
                className="flex-1 bg-transparent py-3 px-2 md:px-4 text-xs md:text-lg font-bold outline-none placeholder-gray-700"
                autoFocus
              />
              <div className="flex items-center gap-1 md:gap-2 ml-2">
                {query && (
                  <button onClick={clearSearch} className="p-2 hover:text-red-500 transition-colors">
                    <X size={18} />
                  </button>
                )}
                <div className="p-3 md:p-4 bg-red-600 rounded-xl md:rounded-2xl text-white shadow-xl shadow-red-600/20">
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </div>
              </div>
            </div>

            <div className="flex overflow-x-auto no-scrollbar gap-2 mt-4">
              {popularTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSyncQuery(tag)}
                  className={`whitespace-nowrap px-4 py-1.5 bg-white/5 border border-white/5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${query === tag ? 'text-red-500 border-red-500/50 bg-red-500/5' : 'text-gray-500 hover:text-white'}`}
                >
                  {tag}
                </button>
              ))}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="whitespace-nowrap px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[8px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 flex items-center gap-2"
              >
                <Filter size={10} /> Filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-20 max-w-[1920px] mx-auto mt-12 min-h-[400px]">
        {/* Loading inicial — nenhum resultado ainda mas está buscando */}
        {!hasResults && isLoading && (
          <div className="flex items-center gap-3 py-20">
            <Loader2 size={18} className="text-red-500 animate-spin" />
            <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Buscando na biblioteca completa...</span>
          </div>
        )}

        {hasResults ? (
          <div className="space-y-24">
            {franchiseResults.length > 0 && (
              <div className="space-y-12">
                <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter">Sagas & Universos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {franchiseResults.map(f => (
                    <div
                      key={f.id}
                      onClick={() => { onSelectFranchise(f); navigate(`/universe/${f.id}`); }}
                      className="h-64 rounded-[2rem] overflow-hidden group cursor-pointer border border-white/5 relative"
                    >
                      <img src={f.backdrop} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-10 flex flex-col justify-end">
                        <span className="text-red-600 font-black text-[10px] uppercase tracking-[0.4em] mb-2">Dados de Origem</span>
                        <h4 className="text-white font-black text-3xl uppercase italic tracking-tighter leading-none">{f.name}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mergedDisplayResults.length > 0 && (
              <div className="space-y-12 pb-20">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter border-l-4 border-red-600 pl-6">
                    Arquivos Detectados
                  </h3>
                  <div className="flex items-center gap-4">
                    {isDbLoading && (
                      <span className="flex items-center gap-1.5 text-gray-500 font-bold uppercase tracking-widest text-[9px]">
                        <Loader2 size={10} className="animate-spin" /> Banco...
                      </span>
                    )}
                    {isTmdbLoading && (
                      <span className="flex items-center gap-1.5 text-gray-500 font-bold uppercase tracking-widest text-[9px]">
                        <Loader2 size={10} className="animate-spin" /> Sugestões...
                      </span>
                    )}
                    <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                      {displayCount < mergedDisplayResults.length
                        ? `${displayCount} de ${mergedDisplayResults.length}`
                        : `${mergedDisplayResults.length}`} Títulos
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-10">
                  {mergedDisplayResults.slice(0, displayCount).map((m: any, idx) => {
                    const wasSaved = savedIds.has(m.id);
                    return (
                      <motion.div
                        key={`${m.id}-${m._isLocal ? 'local' : 'ext'}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                        className="group cursor-pointer relative"
                        onClick={() => handleResultClick(m)}
                      >
                        <div className={`aspect-[2/3] rounded-2xl md:rounded-3xl overflow-hidden relative shadow-2xl transition-all ${m._isLocal || wasSaved ? 'border-2 border-red-600/30 group-hover:border-red-600' : 'border border-white/5 group-hover:border-white/20'}`}>
                          <img
                            src={m.poster_path ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w500/${m.poster_path}`) : 'https://via.placeholder.com/500x750?text=Sem+Poster'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                            <span className="text-red-600 font-black text-[10px] mb-2">{m.vote_average?.toFixed(1) || '-'} ★</span>
                            <h4 className="text-white font-black text-sm md:text-lg uppercase leading-none truncate">{m.title}</h4>
                          </div>
                          {(m._isLocal || wasSaved) && (
                            <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 bg-red-600 px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-red-500 shadow-lg shadow-red-600/30 z-10">
                              <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)] animate-pulse" />
                              <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest text-white leading-none mt-0.5">Na Biblioteca</span>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-400 text-[10px] font-bold mt-2 truncate">{m.title || (m as any).name}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {displayCount < mergedDisplayResults.length && (
                  <div className="flex flex-col items-center gap-3 pt-4">
                    <button
                      onClick={() => setDisplayCount(c => c + 30)}
                      className="px-10 py-3 bg-white/5 border border-white/10 rounded-full font-black uppercase text-[10px] tracking-widest text-gray-300 hover:bg-white/10 hover:text-white hover:border-red-600/40 transition-all"
                    >
                      Carregar mais 30
                    </button>
                    <span className="text-gray-700 text-[9px] font-bold uppercase tracking-widest">
                      {mergedDisplayResults.length - displayCount} títulos restantes
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        ) : query && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 md:w-40 md:h-40 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10"
            >
              <Search size={48} className="text-gray-700" />
            </motion.div>
            <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4">Nada Encontrado</h3>
            <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs max-w-md">
              O multiverso é vasto, mas não localizamos esse título. Tente mudar os filtros para uma busca mais assertiva.
            </p>
            <button onClick={clearSearch} className="mt-10 px-10 py-4 bg-red-600 rounded-full font-black uppercase text-[10px] tracking-widest hover:scale-110 transition-transform">
              Limpar Busca
            </button>
          </div>

        ) : !query ? (
          <div className="space-y-32 mt-[-20px]">
            {/* Explorar por Gênero */}
            <section className="space-y-10 group">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter">Explorar por Gênero</h3>
              </div>
              <div className="flex overflow-x-auto no-scrollbar gap-4 md:gap-12 pb-12 snap-x">
                {categories.map(cat => (
                  <motion.div
                    key={cat.id}
                    whileHover={{ y: -10, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/genre/${cat.name}`)}
                    className="relative min-w-[320px] md:min-w-[550px] aspect-video rounded-[2.5rem] md:rounded-[4rem] overflow-hidden group/card cursor-pointer border border-white/5 bg-[#0a0a0a] snap-center shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all"
                  >
                    <img
                      src={cat.backdrop}
                      className="w-full h-full object-cover transition-all duration-1000 opacity-60 group-hover/card:scale-110 group-hover/card:opacity-100"
                      referrerPolicy="no-referrer"
                      alt={cat.name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent p-8 md:p-14 flex flex-col justify-end">
                      <div className="mb-6 w-14 h-14 md:w-20 md:h-20 bg-white/10 backdrop-blur-3xl rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center border border-white/10 group-hover/card:bg-red-600 group-hover/card:border-red-400/50 transition-all shadow-2xl">
                        <cat.icon size={28} className="text-white" />
                      </div>
                      <h4 className="text-white font-black uppercase text-2xl md:text-[4rem] tracking-tighter italic mb-4 leading-[0.8] drop-shadow-2xl">{cat.name}</h4>
                      <div className="flex items-center gap-6">
                        <span className="text-gray-300 font-bold text-[10px] md:text-sm uppercase tracking-[0.3em] italic">Explorar Nexus</span>
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full w-[10%] bg-red-600 group-hover/card:w-full transition-all duration-1000 ease-in-out" />
                        </div>
                        <ChevronRight size={20} className="text-white/40 group-hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Histórico */}
            <section className="bg-white/5 rounded-[2.5rem] md:rounded-[4rem] p-10 md:p-20 border border-white/5">
              <div className="flex items-center gap-6 mb-12">
                <History className="text-red-600" size={32} />
                <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter">Histórico de Missão</h3>
              </div>
              <div className="space-y-6">
                {history.map(item => (
                  <div
                    key={item}
                    onClick={() => setSyncQuery(item)}
                    className="flex items-center justify-between p-6 bg-black/40 border border-white/5 rounded-2xl md:rounded-3xl cursor-pointer hover:bg-white/5 group"
                  >
                    <span className="text-gray-400 font-black uppercase text-[10px] md:text-sm tracking-widest group-hover:text-white transition-colors">{item}</span>
                    <ChevronRight size={18} className="text-gray-600 group-hover:text-red-600 transition-colors" />
                  </div>
                ))}
              </div>
            </section>

            {/* Trending Bento */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-red-900/20 to-transparent p-12 rounded-[3rem] border border-red-900/10 flex flex-col justify-between">
                <TrendingUp className="text-red-600 mb-10" size={40} />
                <h4 className="text-white font-black text-3xl uppercase italic tracking-tighter leading-none">Bombando Agora</h4>
                <p className="text-gray-500 font-bold text-xs mt-4 uppercase tracking-widest">Gêneros de Ação e Aventura estão vendo um aumento de 40% nas solicitações de busca.</p>
              </div>
              <div className="md:col-span-2 bg-[#111] p-12 rounded-[3rem] border border-white/5 flex flex-col md:flex-row gap-10">
                <div className="flex-1">
                  <h4 className="text-white font-black text-3xl md:text-5xl uppercase italic tracking-tighter mb-6 leading-none">Filtragem Avançada</h4>
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-widest leading-relaxed mb-8">Acesse nossa suíte completa de filtros para refinar sua busca por ano, avaliação e duração com precisão cirúrgica.</p>
                  <button onClick={() => setShowFilters(!showFilters)} className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-[10px]">Abrir Filtros</button>
                </div>
                <div className="shrink-0 w-32 md:w-48 h-32 md:h-48 rounded-full border border-white/10 flex items-center justify-center animate-pulse">
                  <Activity size={48} className="text-red-600" />
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
});

export default AdvancedSearch;
