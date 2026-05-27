import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import tmdb from '../services/tmdb';
import { fmtMovieRow } from '../lib/movieUtils';
import { Movie } from '../types';
import LazyGenreRow from '../components/LazyGenreRow';

const ContentFilteredPage = React.memo(({ myMovies, type, onSelectMovie, isLoading, newOnPlatform, totalCount }: { myMovies: Movie[]; type: 'filmes' | 'series'; onSelectMovie: (m: Movie) => void; isLoading?: boolean; newOnPlatform?: Movie[]; totalCount?: number | null }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [expandedGenre, setExpandedGenre] = React.useState<string | null>(null);
  const [expandedCount, setExpandedCount] = React.useState(30);
  const [isSearching, setIsSearching] = React.useState(false);
  const [supabaseResults, setSupabaseResults] = React.useState<Movie[]>([]);
  const [tmdbResults, setTmdbResults] = React.useState<any[]>([]);
  const [isTmdbSearching, setIsTmdbSearching] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  React.useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSupabaseResults([]);
      setTmdbResults([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);

    const SAFE_COLS = 'id,title,type,poster_path,backdrop_path,release_date,rating,vote_average,genres,video_url,video_url_2,logo_path,is_hidden,created_at,updated_at';
    const dbType = type === 'series' ? 'series' : 'movie';

    const doSearch = async () => {
      try {
        const { data, error } = await supabase
          .from('movies')
          .select(SAFE_COLS)
          .eq('type', dbType)
          .ilike('title', `%${debouncedSearch}%`)
          .order('rating', { ascending: false })
          .limit(200);

        if (cancelled) return;
        if (error) {
          console.warn('[ContentFilteredPage] Erro na busca Supabase:', error.message);
          setSupabaseResults([]);
        } else {
          setSupabaseResults((data || []).filter((m: any) => !m.is_hidden).map(fmtMovieRow));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ContentFilteredPage] Erro inesperado na busca:', err);
          setSupabaseResults([]);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    doSearch();
    return () => { cancelled = true; };
  }, [debouncedSearch, type]);

  React.useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setTmdbResults([]);
      return;
    }
    let cancelled = false;
    setIsTmdbSearching(true);

    const doTmdbSearch = async () => {
      try {
        const tmdbType = type === 'series' ? 'tv' : 'movie';
        const endpoint = tmdbType === 'tv' ? '/search/tv' : '/search/movie';
        const { data } = await tmdb.get(endpoint, { params: { query: debouncedSearch, language: 'pt-BR' } });
        if (cancelled) return;
        const dbIds = new Set(supabaseResults.map((m: any) => m.id));
        const external = (data.results || [])
          .filter((r: any) => !dbIds.has(r.id))
          .map((r: any) => ({
            ...r,
            title: r.title || r.name,
            type: tmdbType === 'tv' ? 'series' : 'movie',
            _isTmdb: true,
          }));
        if (!cancelled) setTmdbResults(external);
      } catch {
        if (!cancelled) setTmdbResults([]);
      } finally {
        if (!cancelled) setIsTmdbSearching(false);
      }
    };

    doTmdbSearch();
    return () => { cancelled = true; };
  }, [debouncedSearch, type, supabaseResults]);

  const label = type === 'series' ? 'Séries' : 'Filmes';

  const baseItems = React.useMemo(() => {
    return type === 'series'
      ? myMovies.filter((m: any) => m.type === 'series')
      : myMovies.filter((m: any) => m.type === 'movie' || (!m.type && m.type !== 'series'));
  }, [myMovies, type]);

  const genreGroups = React.useMemo(() => {
    const map = new Map<string, Movie[]>();
    for (const m of baseItems) {
      const genres = (m.genres || '').split(',').map((g: string) => g.trim()).filter(Boolean);
      const keys = genres.length > 0 ? genres : ['Outros'];
      for (const g of keys) {
        const arr = map.get(g) || [];
        arr.push(m as Movie);
        map.set(g, arr);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([genre, items]) => ({ genre, items }));
  }, [baseItems]);

  const expandedItems = React.useMemo(() => {
    if (!expandedGenre) return [];
    const group = genreGroups.find(g => g.genre === expandedGenre);
    return group ? group.items.slice(0, expandedCount) : [];
  }, [expandedGenre, genreGroups, expandedCount]);

  const handleExpandGenre = (genre: string) => {
    setExpandedGenre(genre);
    setExpandedCount(30);
  };

  const handleBackToCarousels = () => {
    setExpandedGenre(null);
    setExpandedCount(30);
  };

  const MovieCard = useMemo(() => React.memo(({ m, idx }: { m: any; idx: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
      className="group cursor-pointer"
      onClick={() => onSelectMovie(m)}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-white/5 group-hover:border-red-600/50 transition-all shadow-xl">
        <img
          src={m.poster_path ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185${m.poster_path}`) : (m.backdrop_path ? `https://image.tmdb.org/t/p/w185${m.backdrop_path}` : 'https://via.placeholder.com/185x278?text=Sem+Poster')}
          alt={m.title || m.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading={idx < 6 ? 'eager' : 'lazy'}
          fetchPriority={idx < 6 ? 'high' : 'auto'}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
          <p className="text-white font-black text-[10px] uppercase leading-tight truncate">{m.title || m.name}</p>
          {m.vote_average ? <p className="text-yellow-400 text-[9px] font-bold mt-0.5">★ {(m.vote_average as number).toFixed(1)}</p> : null}
        </div>
        {m.type === 'series' && type === 'series' && (
          <div className="absolute top-2 right-2 bg-red-600/80 px-1.5 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-widest">Série</div>
        )}
      </div>
      <p className="text-gray-400 text-[10px] font-bold mt-1.5 truncate group-hover:text-white transition-colors leading-tight">{m.title || m.name}</p>
    </motion.div>
  )), [onSelectMovie, type]);

  const NewCard = useMemo(() => React.memo(({ m, idx }: { m: any; idx: number }) => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(idx * 0.04, 0.5) }}
      className="flex-none w-28 sm:w-36 cursor-pointer group"
      onClick={() => onSelectMovie(m)}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-white/5 group-hover:border-red-600/60 transition-all shadow-lg">
        <img
          src={m.poster_path ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185${m.poster_path}`) : 'https://via.placeholder.com/185x278?text=Sem+Poster'}
          alt={m.title || m.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading={idx < 5 ? 'eager' : 'lazy'}
          fetchPriority={idx < 5 ? 'high' : 'auto'}
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full">Novo</div>
      </div>
      <p className="text-gray-400 text-[10px] font-bold mt-1.5 truncate group-hover:text-white transition-colors leading-tight">{m.title || m.name}</p>
    </motion.div>
  )), [onSelectMovie]);

  const [emptyGuard, setEmptyGuard] = React.useState(false);
  React.useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => setEmptyGuard(true), 800);
      return () => clearTimeout(t);
    }
    setEmptyGuard(false);
    return undefined;
  }, [isLoading]);

  return (
    <div className="min-h-screen bg-[#111] text-white pb-32 pt-20 md:pt-28">

      {/* Banner de carregamento */}
      {isLoading && (
        <div className="fixed top-16 left-0 right-0 z-40 overflow-hidden shadow-xl border-b border-red-500/20">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-red-950/60 via-red-900/40 to-red-950/60" />
          <div className="relative flex items-center gap-4 px-4 py-2.5">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-5 h-5 bg-gradient-to-br from-red-500 to-red-800 rounded-md flex items-center justify-center shadow-lg shadow-red-900/60 flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black uppercase tracking-widest text-[10px] leading-none">
                  Carregando {label.toLowerCase()}
                </span>
                <span className="text-red-400/70 text-[8px] font-bold uppercase tracking-widest leading-none mt-0.5">
                  Aguarde, buscando conteúdo...
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative h-8 flex items-center">
              <div className="flex gap-1.5 animate-[slideLeft_8s_linear_infinite]">
                {[
                  'https://image.tmdb.org/t/p/w92/8Gxv8ZiiQjLTVq9hlqU1Mv2U0qO.jpg',
                  'https://image.tmdb.org/t/p/w92/q719jsmZvqb6tUFiBbqB8p6mw1m.jpg',
                  'https://image.tmdb.org/t/p/w92/6oom5QYdwZ71TCWbkvMvS0n0Dby.jpg',
                  'https://image.tmdb.org/t/p/w92/r2J0VzYnUEsIbiSSTSksvUo7mo1.jpg',
                  'https://image.tmdb.org/t/p/w92/uY7URv89yS6Om9j32oOM4STU68B.jpg',
                  'https://image.tmdb.org/t/p/w92/h8mzmDcYmCcy1ar9Mdh9ofjH7s8.jpg',
                  'https://image.tmdb.org/t/p/w92/A7uByuyGKE69uYv7SFF9vI9Ym96.jpg',
                  'https://image.tmdb.org/t/p/w92/9l1eZiJHmhr5jIlthMdJN5WYoff.jpg',
                  'https://image.tmdb.org/t/p/w92/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
                  'https://image.tmdb.org/t/p/w92/jtnfNzqZwN4E32FGGxx1YZaBWWf.jpg',
                  'https://image.tmdb.org/t/p/w92/8Gxv8ZiiQjLTVq9hlqU1Mv2U0qO.jpg',
                  'https://image.tmdb.org/t/p/w92/q719jsmZvqb6tUFiBbqB8p6mw1m.jpg',
                  'https://image.tmdb.org/t/p/w92/6oom5QYdwZ71TCWbkvMvS0n0Dby.jpg',
                  'https://image.tmdb.org/t/p/w92/r2J0VzYnUEsIbiSSTSksvUo7mo1.jpg',
                ].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-[22px] h-[30px] rounded object-cover flex-shrink-0 opacity-50 border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none" />
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-1 h-1 bg-red-500/80 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
            <div className="h-full bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-[loadbar_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      <div className="px-5 md:px-12 max-w-[1920px] mx-auto">

        {/* Header */}
        <div className="flex items-end gap-4 mb-8">
          {expandedGenre ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToCarousels}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-black uppercase tracking-widest text-xs"
              >
                ← Voltar
              </button>
              <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-none">{expandedGenre}</h1>
              <span className="text-gray-600 font-black uppercase tracking-widest text-xs mb-0.5">
                {genreGroups.find(g => g.genre === expandedGenre)?.items.length || 0} títulos
              </span>
            </div>
          ) : (
            <>
              <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter text-white leading-none">{label}</h1>
              <div className="flex flex-col mb-2">
                <span className="text-gray-600 font-black uppercase tracking-widest text-xs">
                  {isLoading ? 'Carregando...' : totalCount != null ? `${totalCount.toLocaleString('pt-BR')} títulos` : `${baseItems.length} títulos`}
                </span>
                {totalCount != null && totalCount > baseItems.length && (
                  <span className="text-gray-700 font-bold text-[10px] uppercase tracking-widest">
                    Pesquise para explorar todo o catálogo
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Search bar */}
        {!expandedGenre && (
          <div className="flex flex-col gap-2 mb-10">
            <div className="relative max-w-lg">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Buscar em toda a biblioteca de ${label.toLowerCase()}...`}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-10 text-sm font-bold text-white placeholder-gray-600 outline-none focus:border-red-600 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={15} />
                </button>
              )}
            </div>
            {!searchQuery && (
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest pl-1">
                Pesquise para explorar toda a biblioteca de 22 mil títulos
              </p>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-10">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="h-4 w-36 bg-white/[0.06] rounded-lg animate-pulse mb-4" />
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <div
                      key={j}
                      className="flex-none w-28 sm:w-36 aspect-[2/3] rounded-xl bg-gradient-to-br from-[#1c1c1c] to-[#141414] border border-white/[0.04] relative overflow-hidden flex items-center justify-center"
                      style={{ animationDelay: `${(i * 10 + j) * 0.04}s` }}
                    >
                      <div className="flex flex-col items-center gap-1 opacity-20 select-none">
                        <div className="w-5 h-5 bg-gradient-to-br from-red-500 to-red-800 rounded-md flex items-center justify-center shadow-lg shadow-red-900/40">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                        </div>
                        <span className="text-[6px] font-black uppercase tracking-tighter italic text-white leading-none">
                          NET<span className="text-red-500">PLAY</span>
                        </span>
                      </div>
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" style={{ animationDelay: `${j * 0.1}s` }} />
                      <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
                        <div className="h-2 rounded-full bg-white/[0.06] w-3/4 animate-pulse" />
                        <div className="h-1.5 rounded-full bg-white/[0.04] w-1/2 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (debouncedSearch ? (
          isSearching ? (
            <div className="flex items-center gap-3 py-20">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Buscando na biblioteca completa...</span>
            </div>
          ) : (supabaseResults.length > 0 || tmdbResults.length > 0) ? (
            <div className="space-y-10">
              {supabaseResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <p className="text-gray-400 text-xs font-black uppercase tracking-widest border-l-4 border-red-600 pl-3">
                      Na Biblioteca · {supabaseResults.length} resultado{supabaseResults.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5">
                    {supabaseResults.map((m: any, idx: number) => <MovieCard key={m.id} m={m} idx={idx} />)}
                  </div>
                </div>
              )}
              {(isTmdbSearching || tmdbResults.length > 0) && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <p className="text-gray-400 text-xs font-black uppercase tracking-widest border-l-4 border-white/20 pl-3">
                      Sugestões TMDB {isTmdbSearching ? '· Buscando...' : `· ${tmdbResults.length} título${tmdbResults.length !== 1 ? 's' : ''}`}
                    </p>
                    {isTmdbSearching && <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />}
                  </div>
                  {!isTmdbSearching && tmdbResults.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5">
                      {tmdbResults.map((m: any, idx: number) => (
                        <motion.div
                          key={`tmdb-${m.id}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                          className="group cursor-pointer"
                          onClick={() => onSelectMovie(m)}
                        >
                          <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-white/5 group-hover:border-white/20 transition-all shadow-xl">
                            <img
                              src={m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : 'https://via.placeholder.com/185x278?text=Sem+Poster'}
                              alt={m.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[7px] font-black text-gray-400 uppercase tracking-widest border border-white/10">TMDB</div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                              <p className="text-white font-black text-[10px] uppercase leading-tight truncate">{m.title}</p>
                              {m.vote_average ? <p className="text-yellow-400 text-[9px] font-bold mt-0.5">★ {(m.vote_average as number).toFixed(1)}</p> : null}
                            </div>
                          </div>
                          <p className="text-gray-500 text-[10px] font-bold mt-1.5 truncate group-hover:text-white transition-colors leading-tight">{m.title}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                <Search size={40} className="text-gray-700" />
              </div>
              <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Nenhum resultado para "{debouncedSearch}"</p>
              <button onClick={() => setSearchQuery('')} className="mt-6 px-8 py-3 bg-red-600 rounded-full font-black uppercase text-[10px] tracking-widest">Limpar busca</button>
            </div>
          )

        ) : expandedGenre ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5">
              {expandedItems.map((m: any, idx: number) => <MovieCard key={m.id} m={m} idx={idx} />)}
            </div>
            {expandedCount < (genreGroups.find(g => g.genre === expandedGenre)?.items.length || 0) && (
              <div className="flex justify-center mt-12">
                <button
                  onClick={() => setExpandedCount(c => c + 30)}
                  className="px-10 py-3 bg-white/5 border border-white/10 rounded-full font-black uppercase text-[10px] tracking-widest text-gray-300 hover:bg-white/10 hover:text-white hover:border-red-600/40 transition-all"
                >
                  Carregar mais 30
                </button>
              </div>
            )}
          </>

        ) : genreGroups.length > 0 ? (
          <div className="space-y-10">

            {newOnPlatform && newOnPlatform.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-white font-black uppercase tracking-widest text-xs">Novos na Plataforma</h2>
                  <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Hoje</span>
                  <span className="text-gray-600 font-black uppercase tracking-widest text-[10px]">{newOnPlatform.length} adicionados</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {newOnPlatform.map((m, idx) => <NewCard key={m.id} m={m} idx={idx} />)}
                </div>
              </div>
            )}

            {genreGroups.map(({ genre, items }) => (
              <LazyGenreRow
                key={genre}
                genre={genre}
                items={items}
                onExpand={handleExpandGenre}
                MovieCard={MovieCard}
              />
            ))}

            <div className="flex items-center gap-3 py-8 border-t border-white/5 mt-4">
              <Search size={14} className="text-gray-700 flex-none" />
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                Use a busca acima para explorar toda a biblioteca · novos títulos aparecem conforme você assiste
              </p>
            </div>
          </div>

        ) : emptyGuard ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Search size={40} className="text-gray-700" />
            </div>
            {type === 'filmes' ? (
              <>
                <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Nenhum filme encontrado</p>
                <p className="text-gray-500 text-xs max-w-xs leading-relaxed mb-1">Os filmes são adicionados pelo <span className="text-red-400 font-bold">Sync Flix 3.0</span> no painel admin.</p>
                <p className="text-gray-600 text-[10px] max-w-xs leading-relaxed">Certifique-se de rodar a migration SQL no Supabase para adicionar a coluna <code className="bg-white/5 px-1 rounded">tmdb_id</code> e depois execute o sync de <span className="text-emerald-400 font-bold">Filmes</span>.</p>
              </>
            ) : (
              <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Nenhum conteúdo encontrado</p>
            )}
          </div>
        ) : null)}

      </div>
    </div>
  );
});

export default ContentFilteredPage;
