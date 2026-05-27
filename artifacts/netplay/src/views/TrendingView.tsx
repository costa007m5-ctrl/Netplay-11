import React, { useState, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Plus, Check, Zap, Trophy } from 'lucide-react';
import QuizModal from './QuizModal';

const CollectionsCarousel = React.lazy(() => import('../components/CollectionsCarousel'));

const TrendingView = React.memo(({ top10Movies, top10Series, handleSelectMovie, toggleMyList, toggleFavorite, myListIds, favoriteIds, continueWatching, myMovies, franchises }: any) => {
  const [activeRange, setActiveRange] = useState<'daily' | 'weekly' | 'vital'>('daily');
  const [filter, setFilter] = useState('Todos os Gêneros');
  const [activeGenre, setActiveGenre] = useState('Anime');
  const [showQuiz, setShowQuiz] = useState(false);
  const navigate = useNavigate();

  const filteredMovies = useMemo(() => {
    let list = [...top10Movies];
    if (activeRange === 'vital') {
      list = [...continueWatching].slice(0, 15);
      if (list.length < 5) list = [...myMovies].sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 15);
    } else if (activeRange === 'weekly') {
      const now = new Date().getTime();
      list = [...myMovies].filter((m: any) => m.created_at && (now - new Date(m.created_at).getTime()) < (7*24*60*60*1000)).sort((a: any, b: any) => (b.vote_average||0)-(a.vote_average||0)).slice(0,15);
    } else {
      const now = new Date().getTime();
      const daily = [...myMovies].filter((m: any) => m.created_at && (now - new Date(m.created_at).getTime()) < (24*60*60*1000));
      list = daily.length >= 5 ? daily.slice(0,15) : [...top10Movies];
    }
    if (filter !== 'Todos os Gêneros') list = list.filter((m: any) => m.genres?.toLowerCase().includes(filter.toLowerCase()));
    return list;
  }, [activeRange, top10Movies, myMovies, continueWatching, filter]);

  const featured = filteredMovies[0] || top10Movies[0];
  const editorialCards = top10Movies.slice(1, 3);
  const fanArtPosters = myMovies.slice(0, 4);
  const rangeTabs = [
    { id: 'daily', label: 'Hoje' },
    { id: 'weekly', label: 'Semanal' },
    { id: 'vital', label: 'Vital' },
  ];
  const genreTabs = [
    { id: 'Todos os Gêneros', label: 'Todos os Gêneros' },
    { id: 'Ação', label: 'Ação' },
    { id: 'Drama', label: 'Drama' },
    { id: 'Comédia', label: 'Comédia' },
  ];
  const subGenreTabs = ['Anime', 'Infantil', 'Clássicos'];
  const quizCards = [
    { label: 'QUIZ', bg: '#c53030', type: 'text' },
    { label: '🤔', bg: '#2d3748', type: 'emoji' },
    { label: 'STAGE 4', bg: '#553c9a', type: 'text' },
  ];

  return (
    <motion.div
      key="trending"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#0d0d0d] pb-24 overflow-x-hidden"
    >
      {/* ── HERO BANNER ── */}
      {featured && (
        <div className="relative w-full overflow-hidden" style={{ height: 'clamp(280px, 45vw, 420px)' }}>
          <motion.img
            key={featured.id}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.72 }}
            transition={{ duration: 1.2 }}
            src={featured.backdrop_path?.startsWith('http') ? featured.backdrop_path : `https://image.tmdb.org/t/p/original/${featured.backdrop_path}`}
            className="absolute inset-0 w-full h-full object-cover"
            alt="Featured"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0d0d0d 0%, rgba(13,13,13,0.55) 55%, rgba(13,13,13,0.25) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(13,13,13,0.9) 0%, transparent 65%)' }} />

          <div className="relative h-full flex flex-col justify-end px-4 md:px-10 pb-5 md:pb-8 z-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-sm" style={{ background: '#e53e3e', borderLeft: '3px solid #fc8181' }}>
                  Lançamento Quente
                </span>
                <span className="text-white/40 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                  : {featured.genres?.split(',')[0] || 'Em Destaque'}
                </span>
              </div>
              <h2 className="font-black text-white uppercase tracking-tighter leading-none mb-3 md:mb-4" style={{ fontSize: 'clamp(26px, 7vw, 56px)', borderLeft: '4px solid #e53e3e', paddingLeft: '10px' }}>
                {featured.title || featured.name}
              </h2>
              <div className="flex items-center gap-3 md:gap-5">
                <span className="flex items-center gap-1 text-[11px] md:text-sm font-bold text-white/80">
                  🎯 <span>{featured.vote_average?.toFixed(1) || '—'}/10</span>
                </span>
                <span className="text-white/20 text-xs">|</span>
                <span className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest">
                  Duration ⏱ <span className="text-white/80">{featured.runtime || '—'}m</span>
                </span>
                <span className="text-white/20 text-xs">|</span>
                <span className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest">
                  Year 💎 <span className="text-white/80">{featured.release_date?.split('-')[0] || '—'}</span>
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── CURADORIA EXCLUSIVA ── */}
      {editorialCards.length > 0 && (
        <div className="px-4 md:px-10 mt-4">
          <h3 className="text-[11px] md:text-xs font-black uppercase tracking-widest text-white/90 mb-3">Curadoria Exclusiva</h3>
          <div className="flex gap-2 md:gap-3">
            {editorialCards.map((card: any, i: number) => (
              <div
                key={card.id}
                className="flex-1 relative rounded-xl overflow-hidden cursor-pointer group"
                style={{ height: 'clamp(100px, 25vw, 140px)', border: '1px solid rgba(255,255,255,0.06)' }}
                onClick={() => handleSelectMovie(card)}
              >
                <img
                  src={card.backdrop_path?.startsWith('http') ? card.backdrop_path : `https://image.tmdb.org/t/p/w500/${card.backdrop_path || card.poster_path}`}
                  alt={card.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ opacity: 0.58 }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 55%)' }} />
                <div className="absolute inset-0 p-2.5 md:p-3 flex flex-col justify-end">
                  {i === 0 && <span className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#e53e3e' }}>Em Alta</span>}
                  <p className="text-white text-[10px] md:text-xs font-bold leading-tight line-clamp-2">{card.title || card.name}</p>
                  {card.overview && <p className="text-white/40 text-[8px] mt-0.5 leading-tight line-clamp-1 hidden md:block">{card.overview}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}
      {featured && (
        <div className="px-4 md:px-10 mt-4 flex gap-2">
          <button
            onClick={() => handleSelectMovie(featured)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest py-2.5 md:py-3 transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <Zap size={11} fill="currentColor" /> Imersão Imediata
          </button>
          <button
            onClick={() => toggleMyList(featured)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest py-2.5 md:py-3 transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
          >
            {myListIds?.has(featured.id) ? <Check size={11} /> : <Plus size={11} />} Minha Lista
          </button>
        </div>
      )}

      {/* ── FEATURE CARDS (biblioteca + quiz) ── */}
      <div className="px-4 md:px-10 mt-4 flex gap-2 md:gap-3">
        <div
          className="flex-1 relative rounded-xl overflow-hidden cursor-pointer"
          style={{ height: 'clamp(80px, 20vw, 110px)', background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => navigate('/search')}
        >
          <div className="absolute top-2.5 left-2.5 flex -space-x-2">
            {(fanArtPosters.length > 0 ? fanArtPosters : editorialCards).slice(0, 4).map((m: any, i: number) => (
              <div key={m.id} className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden" style={{ border: '1.5px solid #0d0d0d', zIndex: 4 - i }}>
                <img src={m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w92/${m.poster_path}`} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-white text-[9px] md:text-[10px] font-black uppercase leading-tight">
              Biblioteca de Saber<br />
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Galeria de Fan-Art</span>
            </p>
          </div>
        </div>

        <div
          className="flex-1 relative rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
          style={{ height: 'clamp(80px, 20vw, 110px)', background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => setShowQuiz(true)}
        >
          <div className="absolute top-2.5 right-2.5">
            <Trophy size={16} style={{ color: '#e53e3e' }} />
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#e53e3e' }}>Quiz</p>
            <p className="text-white text-[9px] md:text-[10px] font-black uppercase leading-tight">Desafios de<br/>Quem Sabe</p>
          </div>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="mt-5 px-4 md:px-10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {rangeTabs.map(tab => {
            const isActive = activeRange === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveRange(tab.id as any)}
                className="flex-none flex items-center gap-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{ background: isActive ? 'rgba(229,62,62,0.18)' : 'rgba(255,255,255,0.05)', color: isActive ? '#fc8181' : 'rgba(255,255,255,0.45)', border: isActive ? '1px solid rgba(229,62,62,0.35)' : '1px solid rgba(255,255,255,0.07)' }}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                {tab.label}
              </button>
            );
          })}
          <div className="w-px h-5 bg-white/10 self-center mx-0.5 flex-shrink-0" />
          {genreTabs.map(tab => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className="flex-none rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{ background: isActive ? '#fff' : 'rgba(255,255,255,0.05)', color: isActive ? '#000' : 'rgba(255,255,255,0.45)', border: isActive ? 'none' : '1px solid rgba(255,255,255,0.07)' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* sub-genre pills */}
        <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
          {subGenreTabs.map(g => {
            const isActive = activeGenre === g;
            return (
              <button
                key={g}
                onClick={() => setActiveGenre(g)}
                className="flex-none rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{ background: isActive ? 'rgba(229,62,62,0.14)' : 'rgba(255,255,255,0.04)', color: isActive ? '#e53e3e' : 'rgba(255,255,255,0.35)', border: isActive ? '1px solid rgba(229,62,62,0.28)' : '1px solid rgba(255,255,255,0.05)' }}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT LIST ── */}
      {filteredMovies.length > 0 && (
        <div className="px-4 md:px-10 mt-5">
          <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2">
            {filteredMovies.slice(0, 10).map((movie: any, idx: number) => (
              <motion.div
                key={movie.id}
                whileHover={{ scale: 1.04 }}
                className="flex-none cursor-pointer relative group"
                style={{ width: 'clamp(110px, 28vw, 160px)' }}
                onClick={() => handleSelectMovie(movie)}
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <img
                    src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt={movie.title}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <span className="text-white font-black text-[8px]">{idx + 1}</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play size={12} fill="#000" className="text-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-white/70 text-[9px] font-bold mt-1.5 line-clamp-1 uppercase tracking-tight">{movie.title || movie.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── DESAFIOS DE QUEM SABE ── */}
      <div className="px-4 md:px-10 mt-6">
        <div className="flex items-center justify-between mb-3">
          <button className="flex items-center gap-2" onClick={() => setShowQuiz(true)}>
            <Trophy size={14} style={{ color: '#e53e3e' }} />
            <div className="text-left">
              <p className="text-white text-[11px] md:text-xs font-black uppercase tracking-widest">Desafios de Quem Sabe</p>
              <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Toque para jogar</p>
            </div>
          </button>
          <button
            onClick={() => setShowQuiz(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Play size={10} fill="currentColor" className="text-white/60 ml-0.5" />
          </button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {quizCards.map((card, i) => (
            <div
              key={i}
              onClick={() => setShowQuiz(true)}
              className="flex-none rounded-xl overflow-hidden cursor-pointer flex items-center justify-center active:scale-95 transition-transform"
              style={{ width: 'clamp(90px, 24vw, 120px)', height: 'clamp(90px, 24vw, 120px)', background: card.bg, border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="font-black text-white text-center px-2" style={{ fontSize: card.type === 'emoji' ? 'clamp(24px,8vw,36px)' : 'clamp(12px,3.5vw,16px)', lineHeight: 1.1 }}>
                {card.label}
              </span>
            </div>
          ))}
          {top10Movies.slice(3, 5).map((m: any) => (
            <div
              key={m.id}
              className="flex-none rounded-xl overflow-hidden cursor-pointer relative"
              style={{ width: 'clamp(90px, 24vw, 120px)', height: 'clamp(90px, 24vw, 120px)' }}
              onClick={() => handleSelectMovie(m)}
            >
              <img src={m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185/${m.poster_path}`} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── SÉRIE EM DESTAQUE ── */}
      {top10Series.length > 0 && (
        <div className="px-4 md:px-10 mt-6">
          <h3 className="text-[11px] md:text-xs font-black uppercase tracking-widest text-white/70 mb-3">Séries em Alta</h3>
          <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2">
            {top10Series.slice(0, 8).map((s: any) => (
              <div
                key={s.id}
                className="flex-none cursor-pointer group"
                style={{ width: 'clamp(110px, 28vw, 150px)' }}
                onClick={() => handleSelectMovie(s)}
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <img src={s.poster_path?.startsWith('http') ? s.poster_path : `https://image.tmdb.org/t/p/w342/${s.poster_path}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={s.name} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)' }} />
                  <div className="absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                      <Play size={10} fill="#000" className="ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-white/60 text-[9px] font-bold mt-1 line-clamp-1 uppercase tracking-tight">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COLEÇÕES ── */}
      <Suspense fallback={null}>
        <CollectionsCarousel franchises={franchises} />
      </Suspense>

      {/* ── COMENTÁRIOS SOCIAIS ── */}
      <div className="px-4 md:px-10 mt-6 space-y-3">
        {[
          { user: 'Espectador_A', text: 'O melhor episódio! 🔥', color: '#e53e3e' },
          { user: 'Espectador_B', text: 'Mestre incrível ❤️', color: '#a78bfa' },
          { user: 'Espectador_C', text: 'Top 10 confirmado 🏆', color: '#34d399' },
        ].map((c, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex-none flex items-center justify-center font-black text-[10px]" style={{ background: c.color + '22', border: `1.5px solid ${c.color}44`, color: c.color }}>
              {c.user[0]}
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>@{c.user}</span>
              <span className="text-[10px] font-medium ml-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{c.text}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── QUIZ MODAL ── */}
      <AnimatePresence>
        {showQuiz && (
          <QuizModal movies={[...top10Movies, ...top10Series]} onClose={() => setShowQuiz(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default TrendingView;
