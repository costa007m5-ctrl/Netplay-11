import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, X } from 'lucide-react';

const QuizModal = ({ movies, onClose }: { movies: any[]; onClose: () => void }) => {
  const questions = useMemo(() => {
    const pool = movies.filter(m => m.title || m.name).slice(0, 8);
    if (pool.length < 3) return [];
    const q: { question: string; options: string[]; correct: number; poster: string }[] = [];

    if (pool[0]) {
      const target = pool[0];
      const wrongRatings = [
        ((target.vote_average || 7) - 1.3).toFixed(1),
        ((target.vote_average || 7) + 0.8).toFixed(1),
        ((target.vote_average || 7) - 0.5).toFixed(1),
      ];
      const opts = [target.vote_average?.toFixed(1) || '7.0', ...wrongRatings].sort(() => Math.random() - 0.5);
      q.push({ question: `Qual é a nota de "${target.title || target.name}" no TMDB?`, options: opts, correct: opts.indexOf(target.vote_average?.toFixed(1) || '7.0'), poster: target.poster_path });
    }

    if (pool[1]) {
      const target = pool[1];
      const year = target.release_date?.split('-')[0] || target.first_air_date?.split('-')[0] || '2023';
      const wrongYears = [String(parseInt(year) - 1), String(parseInt(year) + 1), String(parseInt(year) - 2)];
      const opts = [year, ...wrongYears].sort(() => Math.random() - 0.5);
      q.push({ question: `Em que ano foi lançado "${target.title || target.name}"?`, options: opts, correct: opts.indexOf(year), poster: target.poster_path });
    }

    if (pool[2] && pool[3]) {
      const a = pool[2]; const b = pool[3];
      const aTitle = a.title || a.name; const bTitle = b.title || b.name;
      const aRating = a.vote_average || 0; const bRating = b.vote_average || 0;
      const correctIdx = aRating >= bRating ? 0 : 1;
      q.push({ question: `Qual filme tem MAIOR nota?`, options: [aTitle, bTitle, 'São iguais', 'Nenhum dos dois'], correct: correctIdx, poster: a.poster_path });
    }

    if (pool[4]) {
      const target = pool[4];
      const genre = target.genres?.split(',')[0]?.trim() || 'Ação';
      const wrongGenres = ['Terror', 'Comédia', 'Documentário', 'Animação', 'Drama', 'Ficção'].filter(g => g !== genre).slice(0, 3);
      const opts = [genre, ...wrongGenres].sort(() => Math.random() - 0.5);
      q.push({ question: `Qual é o gênero principal de "${target.title || target.name}"?`, options: opts, correct: opts.indexOf(genre), poster: target.poster_path });
    }

    if (pool[5] && pool[5].overview) {
      const target = pool[5];
      const decoys = pool.filter(m => m.id !== target.id).slice(0, 3).map((m: any) => m.title || m.name);
      const targetTitle = target.title || target.name;
      const opts = [targetTitle, ...decoys].sort(() => Math.random() - 0.5);
      const snippet = target.overview.slice(0, 80) + (target.overview.length > 80 ? '…' : '');
      q.push({ question: `"${snippet}" — Que filme é esse?`, options: opts, correct: opts.indexOf(targetTitle), poster: target.poster_path });
    }

    return q;
  }, [movies]);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === questions[current].correct) setScore(s => s + 1);
    setTimeout(() => {
      if (current + 1 >= questions.length) { setFinished(true); }
      else { setCurrent(c => c + 1); setSelected(null); }
    }, 900);
  };

  if (questions.length === 0) return null;

  const q = questions[current];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden"
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Trophy size={15} style={{ color: '#e53e3e' }} />
            <span className="text-white font-black text-xs uppercase tracking-widest">Desafios de Quem Sabe</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <X size={13} className="text-white/60" />
          </button>
        </div>

        {finished ? (
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: score >= questions.length / 2 ? 'rgba(229,62,62,0.2)' : 'rgba(255,255,255,0.05)', border: `2px solid ${score >= questions.length / 2 ? '#e53e3e' : 'rgba(255,255,255,0.12)'}` }}>
              <Trophy size={32} style={{ color: score >= questions.length / 2 ? '#e53e3e' : '#555' }} />
            </div>
            <div>
              <p className="text-white font-black text-2xl mb-1">{score}/{questions.length}</p>
              <p className="font-black uppercase tracking-widest text-xs" style={{ color: score >= questions.length / 2 ? '#fc8181' : 'rgba(255,255,255,0.4)' }}>
                {score === questions.length ? 'Perfeito! 🏆' : score >= questions.length / 2 ? 'Bom trabalho!' : 'Continue praticando!'}
              </p>
            </div>
            <button
              onClick={() => { setCurrent(0); setSelected(null); setScore(0); setFinished(false); }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-xs transition-all"
              style={{ background: '#e53e3e', color: '#fff' }}
            >
              <RotateCcw size={12} /> Tentar Novamente
            </button>
            <button onClick={onClose} className="text-white/30 font-bold text-xs uppercase tracking-widest">Fechar</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((current + 1) / questions.length) * 100}%`, background: '#e53e3e' }} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{current + 1}/{questions.length}</span>
            </div>

            {q.poster && (
              <div className="w-full h-28 rounded-xl overflow-hidden relative">
                <img
                  src={q.poster?.startsWith('http') ? q.poster : `https://image.tmdb.org/t/p/w500/${q.poster}`}
                  className="w-full h-full object-cover object-top"
                  style={{ opacity: 0.5 }}
                  alt=""
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #111 0%, transparent 60%)' }} />
              </div>
            )}

            <p className="text-white font-bold text-sm leading-snug">{q.question}</p>

            <div className="space-y-2">
              {q.options.map((opt, i) => {
                let bg = 'rgba(255,255,255,0.05)';
                let border = 'rgba(255,255,255,0.08)';
                let color = 'rgba(255,255,255,0.8)';
                if (selected !== null) {
                  if (i === q.correct) { bg = 'rgba(52,211,153,0.15)'; border = '#34d399'; color = '#34d399'; }
                  else if (i === selected && selected !== q.correct) { bg = 'rgba(229,62,62,0.15)'; border = '#e53e3e'; color = '#fc8181'; }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className="w-full text-left rounded-xl px-4 py-3 text-xs font-bold transition-all"
                    style={{ background: bg, border: `1px solid ${border}`, color }}
                  >
                    <span className="font-black mr-2 opacity-50">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default QuizModal;
