import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Plus, Star, RotateCcw, LayoutGrid, List, Trophy } from 'lucide-react';
import { FRANCHISES } from '../lib/franchiseConstants';
import { getMovieLogo } from '../services/tmdb';
import QuizModal from './QuizModal';

const UniverseView = React.lazy(() => import('../components/UniverseView'));
const FranchiseCarousels = React.lazy(() => import('../components/FranchiseCarousels'));

const UniverseTabView = React.memo(({
  franchises,
  handleSelectMovie,
  toggleMyList,
  toggleFavorite,
  myListIds,
  favoriteIds
}: any) => {
  const { franchiseId } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activePeriod, setActivePeriod] = useState<'hoje'|'semanal'|'vital'>('hoje');
  const [activeGenreFilter, setActiveGenreFilter] = useState('Todos os Gêneros');
  const [activeSubGenre, setActiveSubGenre] = useState('Anime');
  const [showQuizDiscover, setShowQuizDiscover] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const displayFranchises = useMemo(() => {
    if (franchises.length >= 3) return franchises;
    const dynamicIds = new Set(franchises.map((f: any) => String(f.id)));
    const extras = FRANCHISES
      .filter(f => !dynamicIds.has(f.id))
      .map(f => ({ ...f, movies: [] as any[] }));
    return [...franchises, ...extras];
  }, [franchises]);

  const activeFranchise = useMemo(() => {
    if (!franchiseId) return null;
    return displayFranchises.find((f: any) => String(f.id) === franchiseId)
      || franchises.find((f: any) => String(f.id) === franchiseId);
  }, [franchiseId, displayFranchises, franchises]);

  const safeIdx = displayFranchises.length > 0 ? selectedIdx % displayFranchises.length : 0;
  const selectedFranchise: any = displayFranchises[safeIdx] || null;
  const prevFranchise: any = displayFranchises.length > 1
    ? displayFranchises[(safeIdx - 1 + displayFranchises.length) % displayFranchises.length]
    : null;
  const nextFranchise: any = displayFranchises.length > 1
    ? displayFranchises[(safeIdx + 1) % displayFranchises.length]
    : null;

  const allFranchiseMovies = useMemo(() =>
    franchises.flatMap((f: any) => f.movies || []),
    [franchises]
  );

  const timelineMovies = useMemo(() =>
    [...(selectedFranchise?.movies || [])].sort((a: any, b: any) =>
      (a.release_date || '').localeCompare(b.release_date || '')
    ).slice(0, 6),
    [selectedFranchise]
  );

  const filteredFranchises = useMemo(() =>
    searchTerm
      ? displayFranchises.filter((f: any) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : displayFranchises,
    [displayFranchises, searchTerm]
  );

  const imgUrl = (path: string | undefined, size = 'original') => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  const [franchiseLogos, setFranchiseLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    displayFranchises.forEach(async (f: any) => {
      const key = String(f.id);
      if (franchiseLogos[key]) return;
      const movieId = f.logoMovieId ?? f.movies?.[0]?.id;
      if (!movieId) return;
      const mediaType = f.movies?.[0]?.type === 'series' ? 'tv' : 'movie';
      const url = await getMovieLogo(movieId, mediaType);
      if (url) setFranchiseLogos(prev => ({ ...prev, [key]: url }));
    });
  }, [displayFranchises]);

  const getLogoForFranchise = (f: any): string | null => {
    const fetched = franchiseLogos[String(f.id)];
    if (fetched) return fetched;
    if (f.logo) return imgUrl(f.logo);
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-24 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!activeFranchise ? (
          <motion.div key="universe-catalog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* HERO BANNER */}
            <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
              {[selectedFranchise, prevFranchise, nextFranchise].filter(Boolean).map((f: any, i: number) => (
                <div key={f.id + i} className="absolute inset-0" style={{ zIndex: i === 0 ? 2 : 1, opacity: i === 0 ? 1 : 0.35 }}>
                  <img
                    src={imgUrl(f.backdrop || f.poster)}
                    className="w-full h-full object-cover"
                    style={{ filter: i > 0 ? 'blur(2px)' : 'none' }}
                    referrerPolicy="no-referrer"
                    alt=""
                  />
                </div>
              ))}
              <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(135deg, rgba(14,14,14,0.88) 0%, rgba(14,14,14,0.3) 60%, rgba(14,14,14,0.6) 100%)' }} />
              <div className="absolute inset-x-0 bottom-0 z-10" style={{ height: 80, background: 'linear-gradient(to top, #0e0e0e 0%, transparent 100%)' }} />
              <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 pb-4">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] leading-none mb-1" style={{ color: '#e53e3e' }}>Nexus Multiverso</p>
                <h1 className="font-black text-white uppercase leading-none" style={{ fontSize: 36, letterSpacing: '-0.03em' }}>Universos</h1>
              </div>
            </div>

            {/* SEARCH BAR */}
            <div className="px-4 mt-3">
              <div className="flex items-center gap-2 rounded-full px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Search size={12} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); }}
                  placeholder="Buscar"
                  className="bg-transparent text-white text-xs font-bold placeholder-white/30 outline-none flex-1 uppercase tracking-widest"
                />
                {searchTerm
                  ? <button onClick={() => setSearchTerm('')}><X size={11} style={{ color: 'rgba(255,255,255,0.3)' }} /></button>
                  : <div className="flex gap-0.5"><span style={{ width: 2, height: 8, borderRadius: 1, background: 'rgba(255,255,255,0.25)' }} /><span style={{ width: 2, height: 11, borderRadius: 1, background: 'rgba(255,255,255,0.25)' }} /><span style={{ width: 2, height: 6, borderRadius: 1, background: 'rgba(255,255,255,0.25)' }} /></div>
                }
              </div>
            </div>

            {/* MAIN FRANCHISE CAROUSEL */}
            {!searchTerm && displayFranchises.length > 0 && (
              <div className="mt-3 px-4">
                <div className="flex items-end gap-2">
                  {prevFranchise && (
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      className="flex-none cursor-pointer relative rounded-2xl overflow-hidden"
                      style={{ width: '27vw', maxWidth: 108, height: '21vw', maxHeight: 84, border: '1px solid rgba(255,255,255,0.08)', background: prevFranchise.color ? `${prevFranchise.color}22` : '#111' }}
                      onClick={() => setSelectedIdx((safeIdx - 1 + displayFranchises.length) % displayFranchises.length)}
                    >
                      <img src={imgUrl(prevFranchise.backdrop || prevFranchise.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                        {getLogoForFranchise(prevFranchise)
                          ? <img src={getLogoForFranchise(prevFranchise)!} alt={prevFranchise.name} className="h-4 object-contain mx-auto drop-shadow-2xl" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black text-[9px] uppercase leading-none">{prevFranchise.name}</p>
                        }
                        <p className="font-bold mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>Saga Completa</p>
                        <p className="font-black" style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{prevFranchise.movies?.length || 0} títulos</p>
                      </div>
                    </motion.div>
                  )}

                  {selectedFranchise && (
                    <motion.div
                      whileTap={{ scale: 0.97 }}
                      className="relative rounded-2xl overflow-hidden cursor-pointer flex-1"
                      style={{ height: '29vw', maxHeight: 118, border: '2px solid #e53e3e', boxShadow: '0 0 24px rgba(229,62,62,0.3)', background: selectedFranchise.color ? `${selectedFranchise.color}22` : '#111' }}
                      onClick={() => navigate(`/universe/${selectedFranchise.id}`)}
                    >
                      <img src={imgUrl(selectedFranchise.backdrop || selectedFranchise.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.72 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
                      <div className="absolute inset-0" style={{ background: 'rgba(229,62,62,0.06)' }} />
                      <div className="absolute inset-x-0 bottom-0 p-2.5 text-center">
                        {getLogoForFranchise(selectedFranchise)
                          ? <img src={getLogoForFranchise(selectedFranchise)!} alt={selectedFranchise.name} className="h-6 object-contain mx-auto drop-shadow-2xl mb-1" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black uppercase leading-none mb-1" style={{ fontSize: 14, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{selectedFranchise.name}</p>
                        }
                        <p className="font-bold" style={{ fontSize: 7, color: '#fc8181' }}>Saga Completa</p>
                        <p className="font-black" style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>{selectedFranchise.movies?.length || 0} títulos</p>
                      </div>
                    </motion.div>
                  )}

                  {nextFranchise && (
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      className="flex-none cursor-pointer relative rounded-2xl overflow-hidden"
                      style={{ width: '27vw', maxWidth: 108, height: '21vw', maxHeight: 84, border: '1px solid rgba(255,255,255,0.08)', background: nextFranchise.color ? `${nextFranchise.color}22` : '#111' }}
                      onClick={() => setSelectedIdx((safeIdx + 1) % displayFranchises.length)}
                    >
                      <img src={imgUrl(nextFranchise.backdrop || nextFranchise.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                        {getLogoForFranchise(nextFranchise)
                          ? <img src={getLogoForFranchise(nextFranchise)!} alt={nextFranchise.name} className="h-4 object-contain mx-auto drop-shadow-2xl" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black text-[9px] uppercase leading-none">{nextFranchise.name}</p>
                        }
                        <p className="font-bold mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>Saga Completa</p>
                        <p className="font-black" style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{nextFranchise.movies?.length || 0} títulos</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex justify-center gap-1 mt-2">
                  {displayFranchises.slice(0, Math.min(displayFranchises.length, 8)).map((_: any, i: number) => (
                    <button key={i} onClick={() => setSelectedIdx(i)}
                      className="rounded-full transition-all"
                      style={{ width: i === safeIdx ? 12 : 4, height: 4, background: i === safeIdx ? '#e53e3e' : 'rgba(255,255,255,0.2)' }}
                    />
                  ))}
                </div>

                {selectedFranchise && (
                  <p className="mt-1.5 text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span className="font-black" style={{ color: 'rgba(255,255,255,0.75)' }}>{selectedFranchise.movies?.length || 0} Títulos</span>
                    {selectedFranchise.movies?.length > 0 && (
                      <> | Explore de {selectedFranchise.movies[0]?.title || selectedFranchise.name} a {selectedFranchise.movies[selectedFranchise.movies.length - 1]?.title || ''}</>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* SECOND ROW */}
            {!searchTerm && displayFranchises.length > 1 && (
              <div className="mt-2.5 px-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {displayFranchises.filter((_: any, i: number) => i !== safeIdx).slice(0, 4).map((f: any) => (
                    <motion.div
                      key={`row2-${f.id}`}
                      whileTap={{ scale: 0.96 }}
                      className="flex-none cursor-pointer relative rounded-xl overflow-hidden"
                      style={{ width: '28vw', maxWidth: 112, height: '15vw', maxHeight: 60, border: '1px solid rgba(255,255,255,0.07)' }}
                      onClick={() => {
                        const idx = displayFranchises.findIndex((d: any) => d.id === f.id);
                        if (idx >= 0) setSelectedIdx(idx);
                        navigate(`/universe/${f.id}`);
                      }}
                    >
                      <img src={imgUrl(f.backdrop || f.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)' }} />
                      <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1.5">
                        {getLogoForFranchise(f)
                          ? <img src={getLogoForFranchise(f)!} alt={f.name} className="h-3.5 object-contain drop-shadow-2xl mb-0.5" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black uppercase leading-none mb-0.5" style={{ fontSize: 8 }}>{f.name}</p>
                        }
                        <p className="font-black uppercase" style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>{f.movies?.length || 0} Títulos</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Search results grid */}
            {searchTerm && (
              <div className="mt-3 px-4">
                {filteredFranchises.length === 0
                  ? <p className="text-center font-bold uppercase text-xs mt-8" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum universo encontrado</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {filteredFranchises.map((f: any) => (
                        <motion.div key={f.id} whileTap={{ scale: 0.96 }}
                          className="cursor-pointer relative rounded-xl overflow-hidden"
                          style={{ width: '28vw', maxWidth: 108, aspectRatio: '2/3', border: '1px solid rgba(255,255,255,0.08)' }}
                          onClick={() => navigate(`/universe/${f.id}`)}
                        >
                          <img src={imgUrl(f.poster || f.backdrop)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.6 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)' }} />
                          <div className="absolute inset-x-0 bottom-0 p-1.5 text-center">
                            {getLogoForFranchise(f)
                              ? <img src={getLogoForFranchise(f)!} className="h-4 object-contain mx-auto mb-0.5" referrerPolicy="no-referrer" alt={f.name} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <p className="text-white font-black text-[8px] uppercase">{f.name}</p>
                            }
                            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{f.movies?.length || 0} Títulos</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="mt-4 px-4 flex gap-2">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-widest py-2.5 active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff' }}
                onClick={() => selectedFranchise?.movies?.[0] && handleSelectMovie(selectedFranchise.movies[0])}
              >
                <Plus size={11} /> Imersão Imediata
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-widest py-2.5 active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                onClick={() => selectedFranchise?.movies?.[0] && toggleMyList(selectedFranchise.movies[0])}
              >
                <Plus size={11} /> Minha Lista
              </button>
            </div>

            {/* FEATURE CARDS */}
            <div className="mt-3 px-4 flex gap-2">
              <div className="flex-1 relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                style={{ height: 88, background: '#151515', border: '1px solid rgba(255,255,255,0.07)' }}
                onClick={() => navigate('/search')}
              >
                <div className="absolute top-2.5 left-2.5 flex -space-x-2.5">
                  {(allFranchiseMovies.length > 0 ? allFranchiseMovies : displayFranchises).slice(0, 4).map((m: any, i: number) => {
                    const src = m.poster_path ? imgUrl(m.poster_path, 'w92') : imgUrl(m.poster || m.backdrop);
                    return (
                      <div key={i} className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: '2px solid #151515', zIndex: 4 - i, background: '#222' }}>
                        {src && <img src={src} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-9 left-2.5 flex gap-1">
                  {(allFranchiseMovies.length > 0 ? allFranchiseMovies : displayFranchises).slice(0, 3).map((m: any, i: number) => {
                    const src = m.backdrop_path ? imgUrl(m.backdrop_path, 'w92') : imgUrl(m.backdrop || m.poster);
                    return (
                      <div key={i} className="rounded-md overflow-hidden" style={{ width: 30, height: 20, background: '#222' }}>
                        {src && <img src={src} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
                      </div>
                    );
                  })}
                </div>
                <div className="absolute bottom-2.5 left-2.5 right-2">
                  <p className="text-white font-black uppercase leading-tight" style={{ fontSize: 9 }}>Biblioteca de Saber</p>
                  <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)' }}>Galeria de Fan-Art</p>
                </div>
              </div>

              <div className="flex-1 relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                style={{ height: 88, background: '#151515', border: '1px solid rgba(255,255,255,0.07)' }}
                onClick={() => setShowQuizDiscover(true)}
              >
                <Trophy size={14} className="absolute top-2.5 right-2.5" style={{ color: '#e53e3e' }} />
                <div className="absolute top-8 left-2.5 flex gap-1">
                  {[...Array(4)].map((_: any, i: number) => (
                    <div key={i} className="rounded-md flex items-center justify-center text-sm" style={{ width: 28, height: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>?</div>
                  ))}
                </div>
                <p className="absolute top-2.5 left-2.5 font-black uppercase tracking-widest" style={{ fontSize: 7, color: '#e53e3e' }}>Quiz</p>
                <div className="absolute bottom-2.5 left-2.5 right-2">
                  <p className="text-white font-black uppercase leading-tight" style={{ fontSize: 9 }}>Desafios de<br />Quem Sai</p>
                </div>
              </div>
            </div>

            {/* FILTER TABS */}
            <div className="mt-4 px-4">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {(['hoje','semanal','vital'] as const).map((id, i) => {
                  const labels = ['Hoje', 'Semanal', 'Vital'];
                  const isA = activePeriod === id;
                  return (
                    <button key={id} onClick={() => setActivePeriod(id)}
                      className="flex-none flex items-center gap-1 rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap"
                      style={{ background: isA ? 'rgba(229,62,62,0.18)' : 'rgba(255,255,255,0.05)', color: isA ? '#fc8181' : 'rgba(255,255,255,0.45)', border: isA ? '1px solid rgba(229,62,62,0.35)' : '1px solid rgba(255,255,255,0.07)' }}
                    >
                      {isA && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e53e3e', flexShrink: 0, display: 'inline-block' }} />}
                      {labels[i]}
                    </button>
                  );
                })}
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 2px', flexShrink: 0 }} />
                {['Todos os Gêneros', 'Ação'].map(g => {
                  const isA = activeGenreFilter === g;
                  return (
                    <button key={g} onClick={() => setActiveGenreFilter(g)}
                      className="flex-none rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap"
                      style={{ background: isA ? '#fff' : 'rgba(255,255,255,0.05)', color: isA ? '#000' : 'rgba(255,255,255,0.45)', border: isA ? 'none' : '1px solid rgba(255,255,255,0.07)' }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                {[['Anime', '⚡'], ['Infantil', '🎠'], ['Clássicos', '🏛️']].map(([g, emoji]) => {
                  const isA = activeSubGenre === g;
                  return (
                    <button key={g} onClick={() => setActiveSubGenre(g)}
                      className="flex-none flex items-center gap-1 rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap"
                      style={{ background: isA ? 'rgba(229,62,62,0.14)' : 'rgba(255,255,255,0.04)', color: isA ? '#e53e3e' : 'rgba(255,255,255,0.35)', border: isA ? '1px solid rgba(229,62,62,0.28)' : '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <span>{emoji}</span> {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DESCUBRA O PRÓXIMO NÍVEL */}
            <div className="mt-5 px-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={13} style={{ color: '#f6c90e' }} />
                  <div>
                    <p className="text-white font-black uppercase leading-none" style={{ fontSize: 11, letterSpacing: '0.06em' }}>Descubra o Próximo Nível</p>
                    <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Inforafpicos Exclusivos</p>
                  </div>
                </div>
                <button className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <RotateCcw size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              </div>

              <div className="flex gap-2.5">
                <div className="flex-1 rounded-2xl p-3" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)', minHeight: 160 }}>
                  <p className="text-white font-black uppercase leading-tight mb-1" style={{ fontSize: 10 }}>Easter Eggs &amp; Segredos</p>
                  <p className="font-bold uppercase mb-2.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>secretos para:</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    {(selectedFranchise?.movies?.slice(0, 4).length > 0
                      ? selectedFranchise.movies.slice(0, 4)
                      : [{}, {}, {}, {}]
                    ).map((m: any, i: number) => {
                      const src = m.poster_path ? imgUrl(m.poster_path, 'w92') : null;
                      return (
                        <div key={i} className="relative rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {src && <img src={src} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="" referrerPolicy="no-referrer" />}
                          <span className="relative z-10 text-xl" style={{ filter: 'grayscale(0.4)' }}>❓</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Dynamico detônicos séries para:</p>
                    {selectedFranchise?.movies?.slice(0, 2).map((m: any, i: number) => (
                      <p key={i} className="font-bold leading-tight" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                        {i + 1}. {(m.overview || m.title || '').split('.')[0]?.slice(0, 36)}
                      </p>
                    )) || (
                      <>
                        <p className="font-bold" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>1. O mistério de Bulma (Ep 5)</p>
                        <p className="font-bold" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>2. A origem de Shenron</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 rounded-2xl p-3" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)', minHeight: 160 }}>
                  <p className="text-white font-black uppercase leading-tight mb-0.5" style={{ fontSize: 10 }}>Conecte a Franquia</p>
                  <p className="font-bold uppercase mb-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>(Timeline)</p>
                  <div className="flex justify-center mb-2">
                    <span className="font-black uppercase px-2.5 py-0.5 rounded-full" style={{ fontSize: 7, background: '#e53e3e', color: '#fff' }}>You are Here</span>
                  </div>
                  <div className="overflow-x-auto no-scrollbar mb-2">
                    <div className="flex items-center" style={{ minWidth: 'max-content', gap: 0 }}>
                      {(timelineMovies.length > 0
                        ? timelineMovies
                        : [{ title: 'Dragon Ball' }, { title: 'Z' }, { title: 'Super' }, { title: 'Pré' }, { title: 'Movie' }]
                      ).map((m: any, i: number, arr: any[]) => {
                        const isMiddle = i === Math.floor(arr.length / 2);
                        const dotColor = isMiddle ? '#e53e3e' : i % 3 === 0 ? '#63b3ed' : i % 3 === 1 ? '#a78bfa' : '#38b2ac';
                        return (
                          <React.Fragment key={i}>
                            <div className="flex flex-col items-center" style={{ minWidth: 30 }}>
                              <p className="text-center font-bold leading-none mb-1" style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', maxWidth: 28, wordBreak: 'break-word' }}>
                                {(m.title || '').slice(0, 8)}
                              </p>
                              <div className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: dotColor, border: `1.5px solid ${isMiddle ? '#fc8181' : 'rgba(255,255,255,0.2)'}` }} />
                              <p className="text-center font-bold mt-0.5" style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', maxWidth: 28 }}>
                                {m.release_date?.split('-')[0] || ''}
                              </p>
                            </div>
                            {i < arr.length - 1 && (
                              <div style={{ height: 1.5, width: 10, background: 'rgba(255,255,255,0.15)', flexShrink: 0, marginBottom: 8 }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                  <p className="font-bold uppercase mb-0.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{selectedFranchise?.name || 'Dragon Ball'}</p>
                  <p className="font-bold leading-tight mb-0.5" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                    Inferanos Curatoriais séries: {selectedFranchise?.name || 'Dragon Ball'} + {displayFranchises[(safeIdx + 1) % Math.max(displayFranchises.length, 1)]?.name || 'Super Z'}
                  </p>
                  <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>+ {Math.max(0, (selectedFranchise?.movies?.length || 3) - 2)} Super movies</p>
                </div>
              </div>
            </div>

            {/* COLEÇÕES COM BANNER */}
            {!searchTerm && franchises && franchises.length > 0 && (
              <div className="mt-6">
                <div className="px-4 flex items-center gap-2 mb-3">
                  <LayoutGrid size={13} style={{ color: '#e53e3e' }} />
                  <div>
                    <p className="text-white font-black uppercase leading-none" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>Coleções</p>
                    <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Clique para explorar a coleção</p>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                  {franchises.filter((f: any) => (f.movies?.length || 0) >= 2).map((f: any) => (
                    <motion.div
                      key={`col-${f.id}`}
                      whileTap={{ scale: 0.96 }}
                      className="flex-none relative rounded-2xl overflow-hidden cursor-pointer"
                      style={{ width: '72vw', maxWidth: 280, height: '42vw', maxHeight: 165, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                      onClick={() => navigate(`/universe/${f.id}`)}
                    >
                      <img
                        src={f.backdrop?.startsWith('http') ? f.backdrop : f.backdrop ? `https://image.tmdb.org/t/p/w780${f.backdrop}` : (f.poster?.startsWith('http') ? f.poster : f.poster ? `https://image.tmdb.org/t/p/w342${f.poster}` : '')}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ opacity: 0.75 }}
                        referrerPolicy="no-referrer"
                        alt={f.name}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                      />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)' }} />
                      {f.color && <div className="absolute inset-0" style={{ background: `${f.color}18` }} />}
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        {getLogoForFranchise(f) ? (
                          <img src={getLogoForFranchise(f)!} alt={f.name} className="h-7 object-contain drop-shadow-2xl mb-1.5" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <p className="text-white font-black uppercase leading-none mb-1.5" style={{ fontSize: 16, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>{f.name}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase text-white/70" style={{ fontSize: 9 }}>{f.movies?.length || 0} títulos</span>
                          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.2)' }} />
                          <span className="font-black uppercase" style={{ fontSize: 9, color: '#fc8181' }}>Ver Saga →</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* SAGAS & COLEÇÕES */}
            {!searchTerm && franchises && franchises.length > 0 && (
              <div className="mt-5">
                <div className="px-4 flex items-center gap-2 mb-3">
                  <List size={13} style={{ color: '#e53e3e' }} />
                  <div>
                    <p className="text-white font-black uppercase leading-none" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>Sagas & Coleções</p>
                    <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Sua biblioteca organizada por franquias</p>
                  </div>
                </div>
                <Suspense fallback={null}>
                  <FranchiseCarousels franchises={franchises} onSelectMovie={handleSelectMovie} />
                </Suspense>
              </div>
            )}

            <AnimatePresence>
              {showQuizDiscover && (
                <QuizModal movies={allFranchiseMovies.length > 0 ? allFranchiseMovies.slice(0, 12) : []} onClose={() => setShowQuizDiscover(false)} />
              )}
            </AnimatePresence>

          </motion.div>
        ) : (
          <Suspense fallback={null}>
            <UniverseView
              franchise={activeFranchise}
              onSelectMovie={handleSelectMovie}
              onClose={() => navigate('/universe')}
              onToggleMyList={toggleMyList}
              onToggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
});

export default UniverseTabView;
