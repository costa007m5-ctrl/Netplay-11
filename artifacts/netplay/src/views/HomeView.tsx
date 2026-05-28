import React, { useState, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, TrendingUp, Sparkles, ListPlus, Shuffle, Zap, Tv2, Activity, Star, Search, Film, Tv, ChevronRight } from 'lucide-react';
import Banner from '../components/Banner';
import Row from '../components/Row';
import ParticlesAmbience from '../components/ParticlesAmbience';

const StreamingHub = React.lazy(() => import('../components/StreamingHub'));
const ContinueWatchingRow = React.lazy(() => import('../components/ContinueWatchingRow'));
const NewReleasesRow = React.lazy(() => import('../components/NewReleasesRow'));
const FlixLatestRow = React.lazy(() => import('../components/FlixLatestRow'));
const CinemaRow = React.lazy(() => import('../components/CinemaRow'));
const Top10Row = React.lazy(() => import('../components/Top10Row'));
const TMDBCategoryCarousels = React.lazy(() => import('../components/TMDBCategoryCarousels'));

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Filmes': <Film size={14} />,
  'Séries': <Tv size={14} />,
  'Anime': <Sparkles size={14} />,
  'Documentários': <Activity size={14} />,
  'Ação': <Zap size={14} />,
  'Comédia': <Star size={14} />,
  'Terror': <Zap size={14} />,
  'Infantil': <Sparkles size={14} />,
};

const CATEGORY_COLORS: string[] = [
  'from-red-900/50 to-red-950/80 border-red-800/30',
  'from-blue-900/50 to-blue-950/80 border-blue-800/30',
  'from-purple-900/50 to-purple-950/80 border-purple-800/30',
  'from-green-900/50 to-green-950/80 border-green-800/30',
  'from-orange-900/50 to-orange-950/80 border-orange-800/30',
  'from-pink-900/50 to-pink-950/80 border-pink-800/30',
  'from-yellow-900/50 to-yellow-950/80 border-yellow-800/30',
  'from-cyan-900/50 to-cyan-950/80 border-cyan-800/30',
];

const HomeView = React.memo(({
  myMovies,
  streamingProviders,
  continueWatching,
  newMovies,
  top10Movies,
  top10Series,
  caraNovaMovies,
  moviesByGenre,
  handleSelectMovie,
  handlePlayMovie,
  toggleMyList,
  toggleFavorite,
  myListIds,
  favoriteIds,
  setViewAllGenre,
  setIsModalOpen,
  profile,
  cinemaMovies,
  searchQuery,
  searchResults,
  episodeSearchResults,
  onEpisodePlay,
  categories,
  franchises,
  isGlobalSearching,
  personalizedMovies,
}: any) => {
  const navigate = useNavigate();

  const bannerMovies = useMemo(() => {
    if (myMovies.length === 0) return [];
    const pool = [...newMovies, ...top10Movies, ...myMovies.slice(0, 20)];
    return [...new Set(pool)].slice(0, 10);
  }, [myMovies, newMovies, top10Movies]);

  const franchiseToMovie = (f: any) => ({
    ...f,
    title: f.name,
    poster_path: f.poster || f.backdrop || f.logo,
    backdrop_path: f.backdrop || f.poster,
    logo_path: f.logo,
    overview: f.description,
    type: 'franchise',
    isFranchise: true
  });

  const franchiseMovies = useMemo(() => franchises.map(franchiseToMovie), [franchises]);
  const top10Franchises = useMemo(() => franchiseMovies.slice(0, 10), [franchiseMovies]);
  const animationFranchises = useMemo(() => {
    return franchiseMovies.filter((f: any) =>
      f.id === 'disney' || f.id === 'pixar' || f.name.toLowerCase().includes('anime')
    );
  }, [franchiseMovies]);

  const optimizedGenreMovies = useMemo(() => {
    const optimized: Record<string, any[]> = {};
    for (const [genre, movies] of Object.entries(moviesByGenre as Record<string, any[]>)) {
      optimized[genre] = [...movies].sort(() => 0.5 - Math.random()).slice(0, 10);
    }
    return optimized;
  }, [moviesByGenre, profile?.id]);

  const [recentlyAddedExpanded, setRecentlyAddedExpanded] = useState(false);
  const [recentlyAddedCount, setRecentlyAddedCount] = useState(30);

  const recentlyAddedSorted = useMemo(() =>
    [...myMovies].sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ), [myMovies]);

  const RecentlyAddedCard = useMemo(() => React.memo(({ m, idx }: { m: any; idx: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.015, 0.3) }}
      className="group cursor-pointer"
      onClick={() => handleSelectMovie(m)}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-white/[0.06] group-hover:border-red-600/50 transition-all shadow-xl">
        <img
          src={m.poster_path ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185${m.poster_path}`) : (m.backdrop_path ? `https://image.tmdb.org/t/p/w185${m.backdrop_path}` : '/placeholder.png')}
          alt={m.title || m.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading={idx < 5 ? 'eager' : 'lazy'}
          fetchPriority={idx < 5 ? 'high' : 'auto'}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
          <p className="text-white font-black text-[10px] uppercase leading-tight truncate">{m.title || m.name}</p>
          {m.vote_average ? <p className="text-yellow-400 text-[9px] font-bold mt-0.5">★ {(m.vote_average as number).toFixed(1)}</p> : null}
        </div>
        <div className="absolute top-2 left-2 bg-red-600/90 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full">Novo</div>
      </div>
      <p className="text-gray-400 text-[10px] font-bold mt-1.5 truncate group-hover:text-white transition-colors leading-tight">{m.title || m.name}</p>
    </motion.div>
  )), [handleSelectMovie]);

  if (searchQuery) {
    return (
      <div key="search-mode" className="pt-24 px-4 md:px-12 min-h-screen animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter section-title-premium">
            Resultados para: <span className="text-red-500 text-glow-red">"{searchQuery}"</span>
          </h2>
          <div className="flex items-center gap-3">
            {isGlobalSearching && (
              <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest italic">
                <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                Buscando no catálogo...
              </div>
            )}
            <span className="bg-white/[0.04] border border-white/[0.08] px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 italic">
              {searchResults.length} Títulos
            </span>
          </div>
        </div>

        {searchResults.length === 0 && (!episodeSearchResults || episodeSearchResults.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white/[0.02] rounded-[3rem] border-2 border-dashed border-white/[0.05]">
            <Search className="text-gray-800 mb-8 animate-float" size={72} />
            <h3 className="text-3xl font-black text-white italic uppercase mb-2 section-title-premium">Sem resultados na biblioteca</h3>
            <p className="text-gray-500 font-medium max-w-sm text-center text-sm">Tente buscar por termos mais genéricos ou use a Busca Premium.</p>
            <button
              onClick={() => navigate('/search')}
              className="mt-10 px-10 py-4 btn-premium-red text-white rounded-2xl font-black uppercase tracking-widest italic"
            >
              Ir para Busca Premium
            </button>
          </div>
        ) : (
          <>
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {searchResults.map((movie: any) => (
                  <div
                    key={movie.id}
                    className="relative cursor-pointer group hover:-translate-y-2 transition-all duration-300 animate-fade-in"
                    onClick={() => handleSelectMovie(movie)}
                  >
                    <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/[0.07] group-hover:border-red-600/50 transition-all duration-300 shadow-xl relative">
                      <img
                        src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        alt={movie.title || movie.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white font-black text-[10px] uppercase italic truncate leading-none">{movie.title || movie.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {episodeSearchResults && episodeSearchResults.length > 0 && (
              <div className={searchResults.length > 0 ? 'mt-12' : ''}>
                <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter mb-4 section-title-premium">
                  Episódios <span className="text-gray-500 text-base font-normal not-italic normal-case">{episodeSearchResults.length} encontrados</span>
                </h3>
                <div className="flex flex-col gap-2.5 pb-40">
                  {episodeSearchResults.map(({ movie, episode, episodeIndex }: any) => (
                    <motion.div
                      key={`ep-${movie.id}-${episode.id || episode.episode}`}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => onEpisodePlay?.(movie, episode.videoUrl || episode.videoUrl2 || '', episodeIndex)}
                      className="flex items-center gap-4 p-3 bg-white/[0.04] rounded-2xl border border-white/[0.06] hover:border-red-600/30 cursor-pointer transition-all"
                    >
                      <div className="relative w-28 md:w-40 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-gray-900">
                        <img src={episode.still_path || (movie.backdrop_path ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w300/${movie.backdrop_path}`) : '')} alt={episode.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                          <Play size={18} fill="white" className="text-white" />
                        </div>
                        <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                          T{episode.season || 1}·E{episode.episode || '?'}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-red-400 font-black uppercase tracking-widest truncate">{movie.title || movie.name}</p>
                        <p className="text-white font-bold text-sm md:text-base truncate mt-0.5">{episode.title || `Episódio ${episode.episode}`}</p>
                        <p className="text-gray-500 text-[10px] mt-1 line-clamp-2 hidden md:block">{episode.overview}</p>
                        {episode.runtime > 0 && <p className="text-gray-600 text-[9px] font-bold mt-1">{episode.runtime} min</p>}
                      </div>
                      <div className="flex-shrink-0 pr-2">
                        <div className="w-9 h-9 bg-red-600/20 rounded-full flex items-center justify-center border border-red-600/30">
                          <Play size={13} fill="currentColor" className="text-red-400 ml-0.5" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div key="home" className="animate-fade-in relative">
      <ParticlesAmbience />

      <div className="relative z-10">
        {/* HERO BANNER */}
        {bannerMovies.length > 0 ? (
          <Banner
            movies={bannerMovies}
            onPlay={(m: any, url: any) => handlePlayMovie(m, url)}
            onInfo={handleSelectMovie}
          />
        ) : (
          <Banner
            onPlay={(m: any, url: any) => handlePlayMovie(m, url)}
            onInfo={handleSelectMovie}
          />
        )}

        <div className="pb-8 mt-[-30px] md:mt-[-80px] relative z-20 space-y-0">

          {/* HERO DASHBOARD */}
          <section className="px-4 md:px-12 flex flex-col md:flex-row gap-3 md:gap-5 items-stretch mb-6 md:mb-10 -mt-6 relative z-30">
            {/* Quick Resume Card */}
            <motion.div
              whileHover={{ scale: 1.015 }}
              className="flex-1 card-premium rounded-[1.5rem] p-5 md:p-7 flex items-center justify-between shadow-[0_20px_60px_rgba(0,0,0,0.6)] group cursor-pointer relative overflow-hidden"
              onClick={() => {
                if (continueWatching.length > 0) handleSelectMovie(continueWatching[0]);
              }}
            >
              <div className="absolute inset-0 bg-red-600/[0.04] group-hover:bg-red-600/[0.08] transition-colors duration-500 rounded-[1.5rem]" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,26,26,1)]" />
                  <span className="text-[9px] md:text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">
                    {profile ? `Bem-vindo de volta, ${profile.name}` : 'Bem-vindo ao NetPlay'}
                  </span>
                </div>
                <h3 className="text-xl md:text-3xl font-black text-white italic tracking-tighter uppercase leading-[0.9] section-title-premium">
                  {continueWatching.length > 0 ? continueWatching[0].title || continueWatching[0].name : 'Radar de Hoje'}
                </h3>
                <p className="text-gray-500 font-bold text-[10px] mt-1.5 uppercase tracking-widest">
                  {continueWatching.length > 0 ? "Continue de onde parou" : "Descubra novos títulos"}
                </p>
              </div>

              <div className="w-14 h-14 md:w-16 md:h-16 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-500 group-hover:neon-glow-red transition-all shadow-xl relative z-10 shrink-0">
                <Play size={22} className="text-white ml-1.5" fill="white" />
              </div>

              {continueWatching.length > 0 && (
                <div className="absolute right-0 top-0 bottom-0 w-2/5 opacity-15 group-hover:opacity-30 transition-opacity duration-700 mix-blend-screen pointer-events-none fade-mask-left">
                  <img src={continueWatching[0].backdrop_path?.startsWith('http') ? continueWatching[0].backdrop_path : `https://image.tmdb.org/t/p/w780/${continueWatching[0].backdrop_path}`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                </div>
              )}
            </motion.div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-3 md:grid-cols-3 gap-2.5 md:gap-3 flex-none md:w-[380px]">
              {[
                { icon: TrendingUp, label: 'Em Alta', color: 'text-yellow-400', path: '/trending', hoverBg: 'hover:bg-yellow-500/10 hover:border-yellow-500/20' },
                { icon: Sparkles, label: 'Universos', color: 'text-blue-400', path: '/universe', hoverBg: 'hover:bg-blue-500/10 hover:border-blue-500/20' },
                { icon: ListPlus, label: 'Minha Lista', color: 'text-emerald-400', path: '/mylist', hoverBg: 'hover:bg-emerald-500/10 hover:border-emerald-500/20' },
                { icon: Shuffle, label: 'Surpresa', color: 'text-white', path: null, hoverBg: 'hover:bg-white/10', special: true },
                { icon: Tv2, label: 'Canais TV', color: 'text-orange-400', path: '/canais', hoverBg: 'hover:bg-orange-500/10 hover:border-orange-500/20' },
                { icon: Zap, label: 'Novidades', color: 'text-red-400', path: '/novidades-flix', hoverBg: 'hover:bg-red-500/10 hover:border-red-500/20' },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (item.special) {
                      if (myMovies.length > 0) handleSelectMovie(myMovies[Math.floor(Math.random() * myMovies.length)]);
                    } else if (item.path) {
                      navigate(item.path);
                    }
                  }}
                  className={`bg-black/50 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all shadow-lg ${item.hoverBg}`}
                >
                  <item.icon size={20} className={`${item.color} mb-1.5`} />
                  <span className="text-white font-black text-[9px] md:text-[10px] italic uppercase tracking-tight text-center leading-tight">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </section>

          {/* TRENDING MARQUEE */}
          <div className="w-full overflow-hidden bg-red-600/[0.07] border-y border-red-500/15 py-2 mb-6 md:mb-8 relative flex items-center">
            <div className="absolute left-0 w-16 h-full bg-gradient-to-r from-[#050505] to-transparent z-10" />
            <div className="absolute right-0 w-16 h-full bg-gradient-to-l from-[#050505] to-transparent z-10" />
            <motion.div
              animate={{ x: [0, -1035] }}
              transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
              className="flex gap-8 items-center whitespace-nowrap"
            >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-8 items-center">
                  {['TENDÊNCIA GLOBAL', 'MAIS ASSISTIDOS', 'TOP BILHETERIA', 'CRÍTICA ACLAMADA', 'LOUCURA MULTIVERSO', 'AÇÃO EXPLOSIVA', 'ESTREIAS EXCLUSIVAS'].map((text, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <span className="text-red-500 text-xs">⚡</span>
                      <span className="text-[9px] md:text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">{text}</span>
                    </div>
                  ))}
                </div>
              ))}
            </motion.div>
          </div>

          {/* STREAMING HUB */}
          <Suspense fallback={null}>
            <StreamingHub
              onSelectProvider={(p: any) => navigate(`/provider/${p}`)}
              streamingProviders={streamingProviders}
            />
          </Suspense>

          {/* CATEGORIAS GRID */}
          <section className="px-4 md:px-12 mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base md:text-3xl font-black text-white uppercase tracking-tighter italic section-title-premium flex items-center gap-2.5">
                <span className="block w-1 md:w-2 h-5 md:h-10 bg-red-600 rounded-full shadow-[0_0_12px_rgba(255,26,26,0.6)]" />
                Categorias
              </h2>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
              {[
                { name: 'Filmes', icon: Film },
                { name: 'Séries', icon: Tv },
                { name: 'Anime', icon: Sparkles },
                { name: 'Documentários', icon: Activity },
                { name: 'Ação', icon: Zap },
                { name: 'Comédia', icon: Star },
                { name: 'Terror', icon: Zap },
                { name: 'Infantil', icon: Sparkles },
              ].map((cat, idx) => (
                <motion.button
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/genre/${cat.name}`)}
                  className={`relative flex flex-col items-center justify-center gap-1.5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-gradient-to-br ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} border backdrop-blur-xl cursor-pointer transition-all overflow-hidden group`}
                >
                  <cat.icon size={16} className="text-white/80 group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] md:text-[10px] font-black text-white/80 uppercase tracking-tight">{cat.name}</span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* GENRE FILTER PILLS */}
          <section className="px-4 md:px-12 flex flex-wrap gap-2 md:gap-2.5 mb-6 md:mb-8 relative z-20">
            {['Em Alta', 'Universos', 'Ação', 'Comédia', 'Drama', 'Sci-Fi', 'Romance'].map((tag, idx) => (
              <motion.button
                key={tag}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => navigate(`/genre/${tag}`)}
                className="relative px-4 py-1.5 overflow-hidden bg-white/[0.04] border border-white/[0.08] rounded-full group hover:border-red-500/40 hover:bg-red-500/10 transition-all shadow-md"
              >
                <span className="relative z-10 text-[9px] md:text-[10px] font-black text-white/50 group-hover:text-white uppercase tracking-wider italic transition-colors">
                  {tag}
                </span>
              </motion.button>
            ))}
          </section>

          {/* STATS CARDS */}
          <section className="px-4 md:px-12 mb-6 md:mb-8">
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <div className="card-premium rounded-2xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 blur-[40px] -mr-8 -mt-8 group-hover:bg-red-600/20 transition-colors" />
                <Activity size={20} className="text-red-500 mb-3" />
                <h4 className="text-white font-black text-2xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">98%</h4>
                <p className="text-gray-500 font-bold text-[8px] md:text-[10px] uppercase tracking-wider">Hype</p>
                <div className="w-full bg-white/[0.05] h-0.5 mt-3 rounded-full overflow-hidden">
                  <div className="progress-bar-animated w-[98%] h-full rounded-full" />
                </div>
              </div>
              <div className="card-premium rounded-2xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/10 blur-[40px] -mr-8 -mt-8 group-hover:bg-blue-600/20 transition-colors" />
                <Star size={20} className="text-blue-400 mb-3" />
                <h4 className="text-white font-black text-2xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">Top 10</h4>
                <p className="text-gray-500 font-bold text-[8px] md:text-[10px] uppercase tracking-wider">Atualizado</p>
                <div className="flex -space-x-2.5 mt-2">
                  {top10Movies.slice(0, 4).map((m: any, i: number) => (
                    <div key={m.id} className="w-6 h-6 rounded-full border-2 border-black overflow-hidden">
                      <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-full h-full object-cover" alt="" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-premium rounded-2xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 blur-[40px] -mr-8 -mt-8 group-hover:bg-purple-600/20 transition-colors" />
                <Zap size={20} className="text-purple-400 mb-3" />
                <h4 className="text-white font-black text-2xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">Radar</h4>
                <p className="text-gray-500 font-bold text-[8px] md:text-[10px] uppercase tracking-wider">AI Ativo</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
          </section>

          {/* CANAIS PREMIUM */}
          <section className="px-4 md:px-12 mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base md:text-3xl font-black text-white uppercase tracking-tighter italic section-title-premium flex items-center gap-2.5">
                <span className="block w-1 md:w-2 h-5 md:h-10 bg-red-600 rounded-full shadow-[0_0_12px_rgba(255,26,26,0.6)]" />
                Canais Premium
              </h2>
              <button
                onClick={() => navigate('/canais')}
                className="text-[8px] md:text-[10px] font-black text-gray-400 hover:text-white flex items-center gap-1 uppercase tracking-widest transition-colors"
              >
                Ver Todos <ChevronRight size={11} />
              </button>
            </div>
            <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
              {[
                { name: 'Netflix', bg: 'bg-[#0a0a0a]', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', border: 'border-red-900/40', glow: 'hover:shadow-[0_0_25px_rgba(229,9,20,0.3)]' },
                { name: 'Disney+', bg: 'bg-[#040714]', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', border: 'border-blue-900/40', glow: 'hover:shadow-[0_0_25px_rgba(0,99,229,0.3)]' },
                { name: 'HBO', bg: 'bg-[#000814]', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg', border: 'border-blue-800/40', glow: 'hover:shadow-[0_0_25px_rgba(0,43,231,0.3)]' },
                { name: 'Prime', bg: 'bg-[#0f171e]', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png', border: 'border-blue-700/30', glow: 'hover:shadow-[0_0_25px_rgba(0,168,225,0.2)]' },
                { name: 'Apple TV+', bg: 'bg-[#111]', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg', border: 'border-gray-800/40', glow: 'hover:shadow-[0_0_25px_rgba(255,255,255,0.1)]' },
              ].map((channel) => (
                <motion.button
                  key={channel.name}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(`/provider/${channel.name}`)}
                  className={`${channel.bg} border ${channel.border} rounded-2xl flex items-center justify-center min-w-[110px] md:min-w-[160px] h-14 md:h-20 flex-shrink-0 transition-all ${channel.glow} cursor-pointer p-3 md:p-5`}
                >
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="h-5 md:h-8 object-contain w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>
              ))}
            </div>
          </section>

          {/* CONTINUE WATCHING */}
          {profile && continueWatching.length > 0 && (
            <Suspense fallback={null}>
              <ContinueWatchingRow
                title={`Continue Assistindo`}
                movies={continueWatching}
                onSelectMovie={handleSelectMovie}
                onPlayMovie={handlePlayMovie}
                profileName={profile.name}
              />
            </Suspense>
          )}

          {/* TOP 10 SÉRIES */}
          {top10Series.length > 0 && (
            <Suspense fallback={null}>
              <Top10Row
                title="Top 10 Séries de Hoje"
                movies={top10Series}
                onSelectMovie={handleSelectMovie}
              />
            </Suspense>
          )}

          {/* TOP 10 FILMES */}
          {top10Movies.length > 0 && (
            <Suspense fallback={null}>
              <Top10Row
                title="Top 10 Filmes de Hoje"
                movies={top10Movies}
                onSelectMovie={handleSelectMovie}
              />
            </Suspense>
          )}

          {/* ANIMAÇÕES & UNIVERSOS */}
          {animationFranchises.length > 0 && (
            <Row
              title="Animações & Universos Mágicos"
              movies={animationFranchises}
              onSelectMovie={(f: any) => navigate(`/universe/${f.id}`)}
              type="standard"
              accentColor="#3b82f6"
            />
          )}

          {/* EM ALTA */}
          {newMovies.length > 0 && (
            <Suspense fallback={null}>
              <NewReleasesRow
                title="Em Alta"
                movies={newMovies}
                onSelectMovie={handleSelectMovie}
              />
            </Suspense>
          )}

          {/* MINHA LISTA */}
          {myListIds && myListIds.size > 0 && (
            <Row
              title="Minha Lista"
              movies={myMovies.filter((m: any) => myListIds.has(m.id))}
              onSelectMovie={handleSelectMovie}
              onToggleMyList={toggleMyList}
              onToggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
              onViewAll={() => navigate('/mylist')}
              accentColor="#10b981"
            />
          )}

          {/* RECOMENDADOS */}
          {profile && personalizedMovies.length > 0 && (
            <Row
              title={`Recomendados para ${profile.name.split(' ')[0]}`}
              movies={personalizedMovies}
              onSelectMovie={handleSelectMovie}
              onToggleMyList={toggleMyList}
              onToggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
              isLargeRow
              accentColor="#a855f7"
            />
          )}

          {/* CINEMA / SAGAS */}
          {top10Franchises.length > 0 && (
            <Suspense fallback={null}>
              <Top10Row
                title="Sagas Populares"
                movies={top10Franchises as any}
                onSelectMovie={(f: any) => navigate(`/universe/${f.id}`)}
              />
            </Suspense>
          )}

          {myMovies.length > 0 && (
            <>
              {cinemaMovies.length > 0 && (
                <Suspense fallback={null}>
                  <CinemaRow
                    title="Fresquinho do Cinema"
                    movies={cinemaMovies}
                    onSelectMovie={handleSelectMovie}
                  />
                </Suspense>
              )}

              <Row
                title="Adicionados Recentemente"
                movies={recentlyAddedSorted.slice(0, 20)}
                type="wide"
                onSelectMovie={handleSelectMovie}
                onToggleMyList={toggleMyList}
                onToggleFavorite={toggleFavorite}
                myListIds={myListIds}
                favoriteIds={favoriteIds}
                streamingProviders={streamingProviders}
              />

              {!recentlyAddedExpanded ? (
                recentlyAddedSorted.length > 20 && (
                  <div className="flex items-center justify-center gap-4 mb-4 ml-2 md:ml-12">
                    <button
                      onClick={() => setRecentlyAddedExpanded(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-full font-black uppercase text-[10px] tracking-widest text-gray-400 hover:bg-white/[0.08] hover:text-white hover:border-red-600/30 transition-all"
                    >
                      Ver mais <ChevronRight size={12} className="text-red-500" />
                    </button>
                    <span className="text-gray-700 font-bold text-[10px] uppercase tracking-widest">
                      {recentlyAddedSorted.length - 20} títulos a mais
                    </span>
                  </div>
                )
              ) : (
                <div className="ml-2 md:ml-12 pr-2 md:pr-12">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => { setRecentlyAddedExpanded(false); setRecentlyAddedCount(30); }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-black uppercase tracking-widest text-xs"
                    >
                      ← Recolher
                    </button>
                    <span className="text-gray-600 font-bold text-[10px] uppercase tracking-widest">
                      {recentlyAddedSorted.length} títulos
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-4">
                    {recentlyAddedSorted.slice(0, recentlyAddedCount).map((m: any, idx: number) =>
                      <RecentlyAddedCard key={m.id} m={m} idx={idx} />
                    )}
                  </div>
                  {recentlyAddedCount < recentlyAddedSorted.length && (
                    <div className="flex justify-center mt-8">
                      <button
                        onClick={() => setRecentlyAddedCount(c => c + 30)}
                        className="px-10 py-3 bg-white/[0.04] border border-white/[0.08] rounded-full font-black uppercase text-[10px] tracking-widest text-gray-400 hover:bg-white/[0.08] hover:text-white hover:border-red-600/30 transition-all"
                      >
                        Carregar mais 30
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TENDÊNCIA GLOBAL */}
              {newMovies.length > 0 && (
                <section className="px-4 md:px-12 mb-6 md:mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base md:text-3xl font-black text-white uppercase tracking-tighter italic section-title-premium flex items-center gap-2.5">
                      <span className="block w-1 md:w-2 h-5 md:h-10 bg-yellow-500 rounded-full shadow-[0_0_12px_rgba(234,179,8,0.6)]" />
                      Tendência Global
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {newMovies.slice(0, 3).map((movie: any) => (
                      <motion.div
                        key={`trend-${movie.id}`}
                        whileHover={{ scale: 1.02 }}
                        className="aspect-video bg-black rounded-2xl overflow-hidden relative cursor-pointer group border border-white/[0.06] hover:border-white/20 transition-all shadow-2xl"
                        onClick={() => handleSelectMovie(movie)}
                      >
                        <img
                          src={movie.backdrop_path?.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w780/${movie.backdrop_path}`}
                          className="w-full h-full object-cover opacity-50 group-hover:opacity-80 group-hover:scale-105 transition-all duration-600"
                          alt={movie.title || movie.name}
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute top-3 left-3 bg-red-600 text-white text-[7px] md:text-[9px] font-black italic uppercase px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                          <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                          EM ALTA
                        </div>
                        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                          <div>
                            <h4 className="text-white font-black italic uppercase text-sm md:text-base tracking-tighter leading-none mb-0.5 section-title-premium">{movie.title || movie.name}</h4>
                            <p className="text-gray-400 font-bold text-[9px] uppercase">{movie.genres || 'Ação'}</p>
                          </div>
                          <div className="w-9 h-9 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 group-hover:bg-red-600 transition-colors shrink-0">
                            <Play size={13} className="text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              <Suspense fallback={null}>
                <FlixLatestRow onSelectMovie={handleSelectMovie} />
              </Suspense>

              {Object.entries(optimizedGenreMovies).map(([genre, genreMovies]: [string, any]) => (
                <Row
                  key={genre}
                  title={genre}
                  movies={genreMovies}
                  onSelectMovie={handleSelectMovie}
                  onToggleMyList={toggleMyList}
                  onToggleFavorite={toggleFavorite}
                  myListIds={myListIds}
                  favoriteIds={favoriteIds}
                  onViewAll={setViewAllGenre}
                  streamingProviders={streamingProviders}
                />
              ))}
            </>
          )}

          <Suspense fallback={null}>
            <TMDBCategoryCarousels onSelectMovie={handleSelectMovie} />
          </Suspense>

        </div>
      </div>
    </div>
  );
});

export default HomeView;
