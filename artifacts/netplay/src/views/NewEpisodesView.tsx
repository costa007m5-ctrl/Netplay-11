import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Play, Search, X } from 'lucide-react';
import { Movie } from '../types';

const NewEpisodesView = React.memo(({ myMovies, onEpisodeClick, onSelectMovie }: any) => {
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const [heroIdx, setHeroIdx] = React.useState(0);
  const [expandedCard, setExpandedCard] = React.useState<number | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('Todos');
  const heroTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const dynamicScrollRef = React.useRef<HTMLDivElement>(null);

  const formatRelativeDate = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = now - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (hours < 1) return 'Agora';
    if (hours < 24) return `Há ${hours}h`;
    if (days === 1) return 'Ontem';
    return `Há ${days}d`;
  };

  const getBackdropUrl = (movie: any, w = 500) =>
    movie.backdrop_path
      ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w${w}/${movie.backdrop_path}`)
      : movie.poster_path
        ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w${w}/${movie.poster_path}`)
        : '';

  const getPosterUrl = (movie: any) =>
    movie.poster_path
      ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`)
      : '';

  const getLogoUrl = (movie: any) =>
    movie.logo_path
      ? (movie.logo_path.startsWith('http') ? movie.logo_path : `https://image.tmdb.org/t/p/w185/${movie.logo_path}`)
      : null;

  const getRecentDate = (m: any): number => {
    const c = m.created_at ? new Date(m.created_at).getTime() : 0;
    const u = m.updated_at ? new Date(m.updated_at).getTime() : 0;
    return Math.max(c, u);
  };

  const allRecent = useMemo(() =>
    myMovies
      .filter((m: any) => (now - getRecentDate(m)) <= SIXTY_DAYS_MS)
      .sort((a: any, b: any) => getRecentDate(b) - getRecentDate(a)),
    [myMovies]);

  const latestSeries = useMemo(() => allRecent.filter((m: any) => m.type === 'series'), [allRecent]);
  const latestMovies = useMemo(() => allRecent.filter((m: any) => m.type !== 'series'), [allRecent]);
  const destaques = useMemo(() => allRecent.slice(0, 6), [allRecent]);
  const storyItems = useMemo(() => allRecent.slice(0, 10), [allRecent]);
  const dynamicItems = useMemo(() => latestSeries.slice(0, 20), [latestSeries]);
  const recomendados = useMemo(() => latestMovies.slice(0, 12), [latestMovies]);
  const saiindoBreve = useMemo(() =>
    [...myMovies].sort((a: any, b: any) => getRecentDate(a) - getRecentDate(b)).slice(0, 8),
    [myMovies]);

  const FILTERS = ['Todos', 'Séries', 'Filmes', 'Animes', 'Ação', 'Drama'];
  const filteredSearch = useMemo(() => {
    if (!searchText && activeFilter === 'Todos') return [];
    return allRecent.filter((m: any) => {
      const name = (m.title || m.name || '').toLowerCase();
      const matchSearch = !searchText || name.includes(searchText.toLowerCase());
      const matchFilter = activeFilter === 'Todos' ? true
        : activeFilter === 'Séries' ? m.type === 'series'
        : activeFilter === 'Filmes' ? m.type !== 'series'
        : (m.genres || m.genre || '').toLowerCase().includes(activeFilter.toLowerCase());
      return matchSearch && matchFilter;
    });
  }, [searchText, activeFilter, allRecent]);

  React.useEffect(() => {
    if (destaques.length <= 1) return;
    heroTimerRef.current = setInterval(() => setHeroIdx(i => (i + 1) % Math.min(destaques.length, 6)), 5000);
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [destaques.length]);

  const goHero = (i: number) => {
    setHeroIdx(i);
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => setHeroIdx(x => (x + 1) % Math.min(destaques.length, 6)), 5000);
  };

  const heroItem = destaques[heroIdx] as any;

  if (myMovies.length === 0) return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-2">
        <Sparkles size={28} className="text-white/20" />
      </div>
      <p className="text-white font-black text-lg uppercase tracking-widest">Nenhuma novidade</p>
      <p className="text-gray-600 text-xs max-w-xs">Filmes e séries novos aparecerão aqui assim que forem adicionados ao catálogo.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-32">

      {/* ── DESTAQUES ── */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-white font-black text-base tracking-tight mb-3">Destaques</h2>

        {heroItem && (
          <div className="relative rounded-2xl overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={heroItem.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative aspect-video cursor-pointer"
                onClick={() => onSelectMovie && onSelectMovie(heroItem)}
              >
                <img
                  src={getBackdropUrl(heroItem, 780)}
                  alt={heroItem.title || heroItem.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                  <span className="bg-red-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-widest shadow">
                    {heroItem.type === 'series' ? 'Nova Série' : 'Novo Filme'}
                  </span>
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-white/70 text-[8px] font-bold">Disponível</span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12">
                  {getLogoUrl(heroItem) ? (
                    <img src={getLogoUrl(heroItem)!} alt="" className="h-10 object-contain object-left drop-shadow-2xl mb-2 max-w-[180px]" referrerPolicy="no-referrer" decoding="async" />
                  ) : (
                    <p className="text-white font-black text-lg leading-tight drop-shadow-2xl mb-2 line-clamp-1">{heroItem.title || heroItem.name}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {heroItem.vote_average > 0 && (
                      <span className="text-yellow-400 text-[10px] font-black">★ {heroItem.vote_average.toFixed(1)}</span>
                    )}
                    {heroItem.type === 'series' && heroItem.episodes?.length > 0 && (
                      <span className="text-white/50 text-[9px] font-bold">{heroItem.episodes.length} ep.</span>
                    )}
                    <span className="text-white/40 text-[9px] font-bold">{formatRelativeDate(heroItem.updated_at || heroItem.created_at)}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            {destaques.length > 1 && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                {destaques.slice(0, 6).map((_: unknown, i: number) => (
                  <button
                    key={i}
                    onClick={() => goHero(i)}
                    className={`rounded-full transition-all duration-300 ${i === heroIdx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {destaques.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
            {destaques.slice(0, 6).map((m: any, i: number) => (
              <button
                key={m.id}
                onClick={() => goHero(i)}
                className={`flex-none relative rounded-xl overflow-hidden transition-all duration-200 ${i === heroIdx ? 'ring-2 ring-red-600 opacity-100' : 'opacity-40 hover:opacity-70'}`}
                style={{ width: 72, height: 44 }}
              >
                <img src={getBackdropUrl(m, 300)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── STORY STYLE ── */}
      {storyItems.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div className="mb-3">
            <h2 className="text-white font-black text-base tracking-tight">Atualizado Recentemente</h2>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">Últimas adições ao catálogo</p>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {storyItems.map((m: any, i: number) => (
              <button key={m.id} onClick={() => onSelectMovie && onSelectMovie(m)} className="flex-none flex flex-col items-center gap-1.5">
                <div className={`w-[62px] h-[62px] rounded-2xl overflow-hidden border-2 ${i < 3 ? 'border-red-600' : 'border-white/10'} shadow-lg`}>
                  <img src={getPosterUrl(m) || getBackdropUrl(m, 185)} alt={m.title || m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                </div>
                <span className="text-[8px] text-gray-400 font-bold w-[62px] text-center truncate leading-tight">
                  {(m.title || m.name || '').split(':')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── DYNAMIC SERIES ── */}
      {dynamicItems.length > 0 && (
        <div className="pt-4 pb-2">
          <div className="px-4 mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-white font-black text-base tracking-tight">Séries em Destaque</h2>
              <p className="text-gray-500 text-[10px] font-medium mt-0.5">Séries com novos episódios</p>
            </div>
            <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">{dynamicItems.length} séries</span>
          </div>
          <div ref={dynamicScrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
            {dynamicItems.map((movie: any, i: number) => {
              const maxSeason = movie.episodes?.reduce((mx: number, ep: any) => Math.max(mx, ep.season || 0), 0) || 0;
              const epCount = movie.episodes?.length || 0;
              const isExpanded = expandedCard === movie.id;
              const relDate = formatRelativeDate(movie.updated_at || movie.created_at);
              return (
                <div key={movie.id} className={`flex-none transition-all duration-300 ${isExpanded ? 'w-[240px]' : 'w-[140px]'}`}>
                  <div
                    className="relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border border-white/[0.06] hover:border-white/20 transition-all"
                    onClick={() => setExpandedCard(isExpanded ? null : movie.id)}
                  >
                    <img src={getPosterUrl(movie) || getBackdropUrl(movie)} alt={movie.title || movie.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span className="bg-red-600 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest">NOVO</span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="bg-[#1a2a3a] text-sky-300 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wide border border-sky-900/40">{relDate}</span>
                    </div>
                    {movie.vote_average > 0 && (
                      <div className="absolute bottom-2 right-2">
                        <span className="bg-black/70 backdrop-blur-sm text-yellow-400 text-[8px] font-black px-1.5 py-0.5 rounded-lg">
                          {movie.vote_average.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 px-0.5">
                    {getLogoUrl(movie) ? (
                      <img src={getLogoUrl(movie)!} alt="" className="h-4 object-contain object-left mb-1 max-w-[120px]" referrerPolicy="no-referrer" decoding="async" />
                    ) : (
                      <p className="text-white font-black text-[11px] leading-tight line-clamp-1 mb-0.5">{movie.title || movie.name}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-bold mb-1.5">
                      {maxSeason > 0 && <span>{maxSeason} TEMP.</span>}
                      {epCount > 0 && <span>{epCount} EP.</span>}
                    </div>
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                        {movie.overview && (
                          <p className="text-gray-400 text-[9px] leading-relaxed line-clamp-3 mb-2">{movie.overview}</p>
                        )}
                        <button
                          onClick={() => { onSelectMovie && onSelectMovie(movie); setExpandedCard(null); }}
                          className="w-full flex items-center justify-center gap-1.5 bg-white/8 hover:bg-white/15 border border-white/10 hover:border-white/25 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl transition-all"
                        >
                          <Play size={10} fill="white" /> Ver Episódios
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RECOMENDADOS ── */}
      {recomendados.length > 0 && (
        <div className="pt-4 pb-2">
          <div className="px-4 mb-3">
            <h2 className="text-white font-black text-base tracking-tight">Filmes Recentes</h2>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">Adicionados ao catálogo</p>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
            {recomendados.map((movie: any) => (
              <div key={movie.id} className="flex-none w-[110px] cursor-pointer" onClick={() => onEpisodeClick(movie, movie.videoUrl || '', 0)}>
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-red-600/40 transition-all">
                  <img src={getPosterUrl(movie) || getBackdropUrl(movie)} alt={movie.title || movie.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-2 left-2">
                    <span className="bg-red-600 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest">NOVO</span>
                  </div>
                  {movie.vote_average > 0 && (
                    <div className="absolute bottom-2 right-2">
                      <span className="bg-black/70 text-yellow-400 text-[7px] font-black px-1 py-0.5 rounded">★ {movie.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 px-0.5">
                  <p className="text-white text-[9px] font-black leading-tight line-clamp-1">{movie.title || movie.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base">🔥</span>
                    <span className="text-base">❤️</span>
                    <span className="text-base">👍</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SEARCH + FILTERS ── */}
      <div className="px-4 pt-5 pb-2">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-2xl pl-9 pr-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                activeFilter === f
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {(searchText || activeFilter !== 'Todos') && (
        <div className="px-4 pt-3 pb-2">
          {filteredSearch.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8 font-bold uppercase tracking-widest">Nenhum resultado</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredSearch.slice(0, 18).map((movie: any) => (
                <div key={movie.id} className="cursor-pointer" onClick={() => onSelectMovie && onSelectMovie(movie)}>
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/[0.06]">
                    <img src={getPosterUrl(movie) || getBackdropUrl(movie)} alt={movie.title || movie.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <p className="text-white/80 text-[9px] font-bold mt-1 line-clamp-1 leading-tight">{movie.title || movie.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SAINDO EM BREVE ── */}
      {saiindoBreve.length > 0 && !searchText && activeFilter === 'Todos' && (
        <div className="pt-4 pb-2">
          <div className="px-4 mb-3">
            <h2 className="text-white font-black text-base tracking-tight">Saindo em Breve</h2>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">Última chance de assistir</p>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
            {saiindoBreve.map((movie: any, i: number) => (
              <div key={movie.id} className="flex-none w-[140px] cursor-pointer" onClick={() => onSelectMovie && onSelectMovie(movie)}>
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/[0.06] hover:border-orange-500/40 transition-all">
                  <img src={getBackdropUrl(movie) || getPosterUrl(movie)} alt={movie.title || movie.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute top-2 left-2">
                    <span className="bg-red-600/90 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wide border border-red-400/30">
                      {`${Math.max(3, 7 - i)} dias restantes`}
                    </span>
                  </div>
                  <p className="absolute bottom-2 left-2 right-2 text-white text-[8px] font-black line-clamp-1 leading-tight">{movie.title || movie.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default NewEpisodesView;
