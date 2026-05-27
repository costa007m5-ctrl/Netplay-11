import React, { useState, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, TrendingUp, Sparkles, ListPlus, Shuffle, Zap, Tv2, Activity, Star, Search } from 'lucide-react';
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

  const franchiseMovies = useMemo(() => {
    return franchises.map(franchiseToMovie);
  }, [franchises]);

  const top10Franchises = useMemo(() => {
    return franchiseMovies.slice(0, 10);
  }, [franchiseMovies]);

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
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative border border-white/5 group-hover:border-red-600/50 transition-all shadow-xl">
        <img
          src={m.poster_path ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185${m.poster_path}`) : (m.backdrop_path ? `https://image.tmdb.org/t/p/w185${m.backdrop_path}` : 'https://via.placeholder.com/185x278?text=Sem+Poster')}
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
      <div
        key="search-mode"
        className="pt-24 px-4 md:px-12 min-h-screen animate-fade-in"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter">Resultados para: <span className="text-red-600">"{searchQuery}"</span></h2>
          <div className="flex items-center gap-3">
            {isGlobalSearching && (
              <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest italic">
                <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                Buscando no catálogo completo...
              </div>
            )}
             <span className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 italic">
               {searchResults.length} Títulos Encontrados
             </span>
          </div>
        </div>

        {searchResults.length === 0 && (!episodeSearchResults || episodeSearchResults.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white/[0.02] rounded-[4rem] border-2 border-dashed border-white/5">
            <Search className="text-gray-800 mb-8 animate-float" size={80} />
            <h3 className="text-3xl font-black text-white italic uppercase mb-2">Sem resultados na biblioteca</h3>
            <p className="text-gray-500 font-bold max-w-sm text-center">Tente buscar por termos mais genéricos ou use a Busca Premium.</p>
            <button
              onClick={() => navigate('/search')}
              className="mt-10 px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest italic hover:scale-105 transition-all shadow-xl"
            >
              Ir para Busca Premium
            </button>
          </div>
        ) : (
          <>
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-10">
                {searchResults.map((movie: any) => (
                  <div
                    key={movie.id}
                    className="relative cursor-pointer group hover:-translate-y-2 transition-transform animate-fade-in"
                    onClick={() => handleSelectMovie(movie)}
                  >
                    <div className="aspect-[2/3] rounded-[2rem] overflow-hidden border border-white/10 group-hover:border-red-600 transition-colors duration-300 shadow-xl relative">
                       <img
                        src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500/${movie.poster_path}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        alt={movie.title || movie.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                       <div className="absolute bottom-4 left-4 right-4">
                          <p className="text-white font-black text-sm uppercase italic truncate leading-none">{movie.title || movie.name}</p>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {episodeSearchResults && episodeSearchResults.length > 0 && (
              <div className={searchResults.length > 0 ? 'mt-12' : ''}>
                <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter mb-4">
                  Episódios <span className="text-gray-500 text-base font-normal not-italic">{episodeSearchResults.length} encontrados</span>
                </h3>
                <div className="flex flex-col gap-3 pb-40">
                  {episodeSearchResults.map(({ movie, episode, episodeIndex }: any) => (
                    <motion.div
                      key={`ep-${movie.id}-${episode.id || episode.episode}`}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.06)' }}
                      onClick={() => onEpisodePlay?.(movie, episode.videoUrl || episode.videoUrl2 || '', episodeIndex)}
                      className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-red-600/30 cursor-pointer transition-all"
                    >
                      <div className="relative w-28 md:w-40 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-gray-900">
                        <img src={episode.still_path || (movie.backdrop_path ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w300/${movie.backdrop_path}`) : '')} alt={episode.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                          <Play size={20} fill="white" className="text-white" />
                        </div>
                        <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">
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
                          <Play size={14} fill="currentColor" className="text-red-400 ml-0.5" />
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
    <div
      key="home"
      className="animate-fade-in relative"
    >
      <ParticlesAmbience />

      <div className="relative z-10">
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

      <div className="pb-4 mt-[-40px] md:mt-[-100px] relative z-20 space-y-6 md:space-y-8">
        {/* HERO DASHBOARD INTERATIVO */}
        <section className="px-4 md:px-12 flex flex-col md:flex-row gap-4 md:gap-6 items-stretch mb-8 md:mb-16 -mt-8 relative z-30">
          {/* Quick Resume Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex-1 bg-gradient-to-br from-black/80 to-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 md:p-8 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] group cursor-pointer relative overflow-hidden"
            onClick={() => {
               if(continueWatching.length > 0) {
                 handleSelectMovie(continueWatching[0]);
               }
            }}
          >
            <div className="absolute inset-0 bg-red-600/5 group-hover:bg-red-600/10 transition-colors duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,1)]" />
                <span className="text-[10px] md:text-xs font-black text-red-500 uppercase tracking-[0.3em]">{profile ? `Bem-vindo volta, ${profile.name}` : 'Bem-vindo ao NetPlay'}</span>
              </div>
              <h3 className="text-2xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
                {continueWatching.length > 0 ? continueWatching[0].title || continueWatching[0].name : 'O Radar de Hoje'}
              </h3>
              <p className="text-gray-400 font-bold text-xs mt-2 uppercase tracking-widest">{continueWatching.length > 0 ? "Continue de onde parou" : "Descubra novos títulos incríveis"}</p>
            </div>

            <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-500 transition-all shadow-xl relative z-10 shrink-0">
               <Play size={28} className="text-white ml-2" fill="white" />
            </div>

            {continueWatching.length > 0 && (
              <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 mix-blend-screen pointer-events-none fade-mask-left">
                <img src={continueWatching[0].backdrop_path?.startsWith('http') ? continueWatching[0].backdrop_path : `https://image.tmdb.org/t/p/w1280/${continueWatching[0].backdrop_path}`} className="w-full h-full object-cover" alt="" />
              </div>
            )}
          </motion.div>

          {/* Action Stats / Shortcuts */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 flex-none md:w-[400px]">
            <motion.div
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/trending')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-all shadow-xl relative overflow-hidden"
             >
               <TrendingUp size={24} className="text-yellow-500 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Em Alta</span>
            </motion.div>

            <motion.div
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/universe')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-all shadow-xl relative overflow-hidden"
             >
               <Sparkles size={24} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Universos</span>
            </motion.div>

            <motion.div
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/mylist')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-all shadow-xl relative overflow-hidden"
             >
               <ListPlus size={24} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Minha Lista</span>
            </motion.div>

            <motion.div
               initial={{ backgroundPosition: '0% 50%' }}
               animate={{ backgroundPosition: '100% 50%' }}
               transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
               whileHover={{ scale: 1.05 }}
               onClick={() => {
                  if(myMovies.length > 0) {
                     const random = myMovies[Math.floor(Math.random() * myMovies.length)];
                     handleSelectMovie(random);
                  }
               }}
               className="bg-gradient-to-br from-red-900/40 via-purple-900/40 to-blue-900/40 bg-[length:200%_200%] backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group shadow-xl relative overflow-hidden"
             >
               <Shuffle size={24} className="text-white mb-2 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter drop-shadow-md">Surpreenda</span>
            </motion.div>

            <motion.div
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/canais')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-orange-500/10 hover:border-orange-500/30 transition-all shadow-xl relative overflow-hidden"
             >
               <Tv2 size={24} className="text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Canais de TV</span>
            </motion.div>

            <motion.div
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/novidades-flix')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-red-500/10 hover:border-red-500/30 transition-all shadow-xl relative overflow-hidden"
             >
               <Zap size={24} className="text-red-500 mb-2 group-hover:scale-110 transition-transform" fill="currentColor" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Novidades Flix</span>
            </motion.div>
          </div>
        </section>

        {/* RADAR DE TENDÊNCIAS MARQUEE */}
        <div className="w-full overflow-hidden bg-red-600/10 border-y border-red-500/20 py-2 mb-8 md:mb-12 relative flex items-center">
           <div className="absolute left-0 w-20 h-full bg-gradient-to-r from-black to-transparent z-10" />
           <div className="absolute right-0 w-20 h-full bg-gradient-to-l from-black to-transparent z-10" />

           <motion.div
             animate={{ x: [0, -1035] }}
             transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
             className="flex gap-8 items-center whitespace-nowrap"
           >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-8 items-center">
                  {['TENDÊNCIA GLOBAL', 'MAIS ASSISTIDOS', 'TOP BILHETERIA', 'CRÍTICA ACLAMADA', 'LOUCURA MULTIVERSO', 'AÇÃO EXPLOSIVA'].map((text, j) => (
                     <div key={j} className="flex items-center gap-4">
                        <span className="text-red-500 font-bold">⚡</span>
                        <span className="text-[10px] md:text-sm font-black text-white/50 uppercase tracking-[0.3em]">{text}</span>
                     </div>
                  ))}
                </div>
              ))}
           </motion.div>
        </div>

        <Suspense fallback={null}>
          <StreamingHub
            onSelectProvider={(p: any) => navigate(`/provider/${p}`)}
            streamingProviders={streamingProviders}
          />
        </Suspense>

        {/* CYBER SHORTCUTS */}
        <section className="px-4 md:px-12 flex flex-wrap gap-2 md:gap-3 mb-8 md:mb-12 relative z-20">
           {['Filmes', 'Séries', 'Documentários', 'Anime', 'Infantil', 'Ação', 'Terror'].map((tag, idx) => (
             <motion.button
               key={tag}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.05 }}
               onClick={() => navigate(`/genre/${tag}`)}
               className="relative px-5 py-2 overflow-hidden bg-[#0f0f0f] border border-white/10 rounded-full group hover:border-red-500/50 transition-colors shadow-lg"
             >
               <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/10 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
               <span className="relative z-10 text-[10px] md:text-xs font-black text-white/60 group-hover:text-white uppercase tracking-widest italic transition-colors">
                 {tag}
               </span>
             </motion.button>
           ))}
        </section>

        {/* AI HYPE STATS */}
        <section className="px-4 md:px-12 mb-8 md:mb-12">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 relative overflow-hidden backdrop-blur-3xl group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-[50px] -mr-10 -mt-10 group-hover:bg-red-600/20 transition-colors" />
                 <Activity size={24} className="text-red-500 mb-4" />
                 <h4 className="text-white font-black text-3xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">98% Hype</h4>
                 <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Nível de Energia da Comunidade</p>
                 <div className="w-full bg-white/5 h-1 mt-4 rounded-full overflow-hidden">
                    <div className="bg-red-600 w-[98%] h-full rounded-full animate-pulse" />
                 </div>
              </div>
              <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 relative overflow-hidden backdrop-blur-3xl group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px] -mr-10 -mt-10 group-hover:bg-blue-600/20 transition-colors" />
                 <Star size={24} className="text-blue-500 mb-4" />
                 <h4 className="text-white font-black text-3xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">Top 10</h4>
                 <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Listas Atualizadas a cada 10m</p>
                 <div className="flex -space-x-4 mt-3">
                    {top10Movies.slice(0,4).map((m: any, i: number) => (
                      <div key={m.id} className="w-8 h-8 rounded-full border-2 border-black overflow-hidden relative z-[4-i]">
                        <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                 </div>
              </div>
              <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 relative overflow-hidden backdrop-blur-3xl group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-[50px] -mr-10 -mt-10 group-hover:bg-purple-600/20 transition-colors" />
                 <Zap size={24} className="text-purple-500 mb-4" />
                 <h4 className="text-white font-black text-3xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">Radar.AI</h4>
                 <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Seu Motor Neural Ativo</p>
                 <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-white/50 uppercase">
                    <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-ping" />
                    Buscando novas joias...
                 </div>
              </div>
           </div>
        </section>

        {/* LIVE CHANNELS / TRAILER HUB */}
        {newMovies.length > 0 && (
          <section className="px-4 md:px-12 mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1 items-end h-5">
                <div className="w-1.5 h-3 bg-red-600 animate-pulse delay-75" />
                <div className="w-1.5 h-5 bg-red-600 animate-pulse delay-150" />
                <div className="w-1.5 h-4 bg-red-600 animate-pulse delay-300" />
              </div>
              <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Live Trailers Hub</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
               {newMovies.slice(0, 3).map((movie: any) => (
                  <motion.div
                    key={`live-${movie.id}`}
                    whileHover={{ scale: 1.02 }}
                    className="aspect-video bg-black rounded-3xl overflow-hidden relative cursor-pointer group border border-white/10"
                    onClick={() => handleSelectMovie(movie)}
                  >
                     <img src={movie.backdrop_path?.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w780/${movie.backdrop_path}`} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-all duration-700" alt="" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                     <div className="absolute top-4 left-4 bg-red-600 text-white text-[8px] font-black italic uppercase px-2 py-1 rounded shadow-lg flex items-center gap-1">
                        <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                        ESTREIA
                     </div>
                     <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                        <div>
                           <h4 className="text-white font-black italic uppercase text-lg md:text-xl tracking-tighter leading-none mb-1">{movie.title || movie.name}</h4>
                           <p className="text-gray-400 font-bold text-[10px] uppercase">{movie.genres || 'Ação'}</p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 group-hover:bg-red-600 transition-colors shrink-0">
                           <Play size={16} className="text-white ml-0.5" fill="white" />
                        </div>
                     </div>
                  </motion.div>
               ))}
            </div>
          </section>
        )}

        {top10Franchises.length > 0 && (
          <Suspense fallback={null}>
            <Top10Row
              title="Top 10 Sagas Populares"
              movies={top10Franchises as any}
              onSelectMovie={(f: any) => navigate(`/universe/${f.id}`)}
            />
          </Suspense>
        )}

        {animationFranchises.length > 0 && (
          <Row
            title="Animações & Universos Mágicos"
            movies={animationFranchises}
            onSelectMovie={(f: any) => navigate(`/universe/${f.id}`)}
            type="standard"
          />
        )}

        {top10Movies.length > 0 && (
          <Suspense fallback={null}>
            <Top10Row
              title="TOP 10 Filmes de Hoje"
              movies={top10Movies}
              onSelectMovie={handleSelectMovie}
            />
          </Suspense>
        )}

        {top10Series.length > 0 && (
          <Suspense fallback={null}>
            <Top10Row
              title="TOP 10 Séries de Hoje"
              movies={top10Series}
              onSelectMovie={handleSelectMovie}
            />
          </Suspense>
        )}

        {/* ONDA NEURAL COMPACTA */}
        <section className="space-y-4 md:space-y-6 group py-6 md:py-8 px-4 md:px-12 bg-gradient-to-b from-black/80 via-[#0a0a0a] to-transparent relative border-t border-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse" />
                <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Onda Neural</h3>
              </div>
            </div>
            <button
              className="flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group scale-90 md:scale-100"
              onClick={() => navigate('/search')}
            >
              <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Global</span>
              <ChevronLeft className="rotate-180 text-red-500 group-hover:translate-x-1 transition-transform" size={14} />
            </button>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-3 md:gap-4 pb-4 snap-x -mx-4 px-4 md:mx-0 md:px-0">
            {categories.map((cat: any, idx: number) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/genre/${cat.name}`)}
                className="relative flex items-center gap-3 min-w-[140px] md:min-w-[180px] h-14 md:h-16 rounded-2xl overflow-hidden group/card cursor-pointer bg-white/5 border border-white/10 snap-center shrink-0 hover:bg-white/10 transition-colors"
              >
                <div className="w-12 md:w-16 h-full relative shrink-0">
                   <img
                     src={cat.backdrop}
                     className="w-full h-full object-cover opacity-50 group-hover/card:opacity-80 transition-opacity mix-blend-luminosity group-hover/card:mix-blend-normal"
                     referrerPolicy="no-referrer"
                     alt={cat.name}
                   />
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/80 group-hover/card:to-transparent transition-colors" />
                </div>
                <div className="flex-1 pr-3 flex items-center justify-between">
                   <h4 className="text-white font-black uppercase text-[10px] md:text-xs tracking-tighter italic whitespace-nowrap">
                     {cat.name}
                   </h4>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {profile && continueWatching.length > 0 && (
          <Suspense fallback={null}>
            <ContinueWatchingRow
              title={`Continuar Assistindo como ${profile.name}`}
              movies={continueWatching}
              onSelectMovie={handleSelectMovie}
              onPlayMovie={handlePlayMovie}
              profileName={profile.name}
            />
          </Suspense>
        )}

        {profile && personalizedMovies.length > 0 && (
          <Row
            title={`Só para Você, ${profile.name.split(' ')[0]}`}
            movies={personalizedMovies}
            onSelectMovie={handleSelectMovie}
            onToggleMyList={toggleMyList}
            onToggleFavorite={toggleFavorite}
            myListIds={myListIds}
            favoriteIds={favoriteIds}
            isLargeRow
          />
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
                <div className="flex items-center justify-center gap-4 -mt-2 mb-2 ml-2 md:ml-12">
                  <button
                    onClick={() => setRecentlyAddedExpanded(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full font-black uppercase text-[10px] tracking-widest text-gray-300 hover:bg-white/10 hover:text-white hover:border-red-600/40 transition-all"
                  >
                    Ver mais <ChevronRight size={13} className="text-red-500" />
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
                  <span className="text-gray-600 font-black uppercase tracking-widest text-xs">
                    {recentlyAddedSorted.length} títulos
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5">
                  {recentlyAddedSorted.slice(0, recentlyAddedCount).map((m: any, idx: number) =>
                    <RecentlyAddedCard key={m.id} m={m} idx={idx} />
                  )}
                </div>
                {recentlyAddedCount < recentlyAddedSorted.length && (
                  <div className="flex justify-center mt-10">
                    <button
                      onClick={() => setRecentlyAddedCount(c => c + 30)}
                      className="px-10 py-3 bg-white/5 border border-white/10 rounded-full font-black uppercase text-[10px] tracking-widest text-gray-300 hover:bg-white/10 hover:text-white hover:border-red-600/40 transition-all"
                    >
                      Carregar mais 30
                    </button>
                  </div>
                )}
              </div>
            )}

            {newMovies.length > 0 && (
              <Suspense fallback={null}>
                <NewReleasesRow
                  title="Lançamentos Exclusivos"
                  movies={newMovies}
                  onSelectMovie={handleSelectMovie}
                />
              </Suspense>
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
