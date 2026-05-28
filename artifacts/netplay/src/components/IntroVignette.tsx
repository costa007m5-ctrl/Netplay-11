import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Film, Radio, Download, Crown, Shield, ChevronRight } from 'lucide-react';

interface IntroVignetteProps {
  onComplete: (mode?: 'login' | 'signup') => void;
  isLoading?: boolean;
  movies?: any[];
}

const DEFAULT_MOVIES = [
  { poster_path: 'https://image.tmdb.org/t/p/w500/8Gxv8ZiiQjLTVq9hlqU1Mv2U0qO.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/q719jsmZvqb6tUFiBbqB8p6mw1m.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/6oom5QYdwZ71TCWbkvMvS0n0Dby.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/r2J0VzYnUEsIbiSSTSksvUo7mo1.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/uY7URv89yS6Om9j32oOM4STU68B.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/h8mzmDcYmCcy1ar9Mdh9ofjH7s8.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/6WpY9i9at6L89lR7p5vA7Dq0S2p.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/A7uByuyGKE69uYv7SFF9vI9Ym96.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/hZkgoQYus5vegHoetLkCJzVAzcn.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/9n2tJBplPbgR2ca05hS5CKXwP2c.jpg' },
];

const CARDS = [
  {
    num: '01',
    icon: Film,
    title: 'FILMES & SÉRIES',
    subtitle: 'ILIMITADOS',
    subtitleColor: '#ff1a1a',
    desc: 'Milhares de títulos em 4K e Ultra HD para você maratonar.',
    image: 'https://image.tmdb.org/t/p/w500/8Gxv8ZiiQjLTVq9hlqU1Mv2U0qO.jpg',
    overlay: 'linear-gradient(135deg, rgba(160,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%)',
    live: false,
  },
  {
    num: '02',
    icon: Radio,
    title: 'CANAIS',
    subtitle: 'AO VIVO',
    subtitleColor: '#ff1a1a',
    desc: 'Esportes, notícias, filmes e muito mais em tempo real.',
    image: 'https://image.tmdb.org/t/p/w500/hZkgoQYus5vegHoetLkCJzVAzcn.jpg',
    overlay: 'linear-gradient(135deg, rgba(0,20,100,0.7) 0%, rgba(0,0,0,0.3) 100%)',
    live: true,
  },
  {
    num: '03',
    icon: Download,
    title: 'ASSISTA',
    subtitle: 'OFFLINE',
    subtitleColor: '#a855f7',
    desc: 'Baixe seus conteúdos favoritos e assista onde estiver.',
    image: 'https://image.tmdb.org/t/p/w500/A7uByuyGKE69uYv7SFF9vI9Ym96.jpg',
    overlay: 'linear-gradient(135deg, rgba(80,0,130,0.7) 0%, rgba(0,0,0,0.3) 100%)',
    live: false,
  },
  {
    num: '04',
    icon: Crown,
    title: 'EXPERIÊNCIA',
    subtitle: 'PREMIUM',
    subtitleColor: '#f97316',
    desc: 'Sem anúncios, qualidade máxima e som imersivo Dolby.',
    image: 'https://image.tmdb.org/t/p/w500/r2J0VzYnUEsIbiSSTSksvUo7mo1.jpg',
    overlay: 'linear-gradient(135deg, rgba(120,50,0,0.7) 0%, rgba(0,0,0,0.3) 100%)',
    live: false,
  },
];

function playIntroSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const note = (freq: number, start: number, end: number, peak: number, freqEnd?: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, end);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.start(start); osc.stop(end + 0.05);
    };
    note(880, now, now + 0.25, 0.25, 440, 'sawtooth');
    note(660, now, now + 0.30, 0.15, 330, 'sine');
    note(90, now + 0.18, now + 2.2, 0.6, 38, 'sine');
    note(45, now + 0.22, now + 2.8, 0.4, 20, 'sine');
    note(1320, now + 0.05, now + 0.5, 0.08, 660, 'sine');
  } catch {}
}

const IntroVignette: React.FC<IntroVignetteProps> = ({ onComplete, isLoading = false, movies = [] }) => {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [pendingMode, setPendingMode] = useState<'login' | 'signup' | null>(null);

  const displayMovies = movies.length > 8 ? movies : [...DEFAULT_MOVIES, ...movies];

  useEffect(() => {
    const t = setTimeout(() => { setMounted(true); playIntroSound(); }, 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setActiveCard(p => (p + 1) % CARDS.length), 3200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (pendingMode !== null && !isLoading) {
      setLeaving(true);
      setTimeout(() => onComplete(pendingMode), 500);
    }
  }, [pendingMode, isLoading, onComplete]);

  const handleCTA = (mode: 'login' | 'signup') => {
    if (leaving) return;
    if (!isLoading) {
      setLeaving(true);
      setTimeout(() => onComplete(mode), 500);
    } else {
      setPendingMode(mode);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : mounted ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[1000] bg-[#050505] overflow-y-auto overflow-x-hidden"
    >
      {/* ── Fundo cinematográfico ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Grade de posters em blur */}
        <div className="absolute inset-0 opacity-[0.08] grayscale blur-sm scale-110">
          {[0, 1, 2].map(row => (
            <motion.div
              key={row}
              animate={{ x: row % 2 === 0 ? [0, -1400] : [-1400, 0] }}
              transition={{ duration: 65 + row * 18, repeat: Infinity, ease: 'linear' }}
              className="flex gap-3 mb-3 shrink-0"
              style={{ marginTop: row === 0 ? 0 : 0 }}
            >
              {[...displayMovies, ...displayMovies, ...displayMovies].slice(0, 24).map((m, i) => (
                <div key={i} className="w-32 h-48 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
                  <img
                    src={m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185${m.poster_path}`}
                    className="w-full h-full object-cover"
                    alt=""
                    loading="lazy"
                  />
                </div>
              ))}
            </motion.div>
          ))}
        </div>

        {/* Gradientes */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/60 to-[#050505]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/70 via-transparent to-[#050505]/70" />

        {/* Glow vermelho central */}
        <motion.div
          animate={{ opacity: [0.18, 0.35, 0.18], scale: [1, 1.25, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#ff1a1a]/25 blur-[140px] rounded-full"
        />
        <motion.div
          animate={{ opacity: [0.08, 0.16, 0.08] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#ff1a1a]/15 blur-[100px] rounded-full"
        />

        {/* Partículas verticais */}
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: '110vh', x: `${5 + i * 9}vw`, opacity: 0 }}
            animate={{ y: '-10vh', opacity: [0, 0.6, 0] }}
            transition={{ duration: 18 + i * 2.5, repeat: Infinity, delay: i * 1.8, ease: 'linear' }}
            className="absolute w-px h-20 bg-gradient-to-b from-transparent via-[#ff1a1a]/40 to-transparent"
          />
        ))}

        {/* Scanline sutil */}
        <motion.div
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-white/[0.015] to-transparent pointer-events-none"
        />
      </div>

      {/* ── Conteúdo ── */}
      <div className="relative z-10 flex flex-col min-h-screen px-5 pb-10 max-w-sm mx-auto">

        {/* Logo NETPLAY */}
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="pt-14 pb-2 flex flex-col items-center"
        >
          <div className="flex items-center gap-2.5 mb-5">
            {/* Triângulo play neon */}
            <motion.div
              animate={{ filter: ['drop-shadow(0 0 8px #ff1a1a)', 'drop-shadow(0 0 22px #ff1a1a)', 'drop-shadow(0 0 8px #ff1a1a)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <polygon points="6,4 36,20 6,36" fill="#ff1a1a" />
                <polygon points="6,4 36,20 6,36" fill="url(#pg)" opacity="0.4" />
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#fff" />
                    <stop offset="1" stopColor="#ff1a1a" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>

            <motion.div
              animate={{ filter: ['drop-shadow(0 0 12px #ff1a1a50)', 'drop-shadow(0 0 28px #ff1a1a90)', 'drop-shadow(0 0 12px #ff1a1a50)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex items-baseline gap-0"
            >
              <span className="text-[44px] font-black text-white uppercase italic tracking-tighter leading-none">NET</span>
              <span className="text-[44px] font-black uppercase italic tracking-tighter leading-none" style={{ color: '#ff1a1a' }}>PLAY</span>
            </motion.div>
          </div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="text-white text-[22px] font-black text-center uppercase tracking-tight leading-tight"
          >
            SEU MUNDO. SUA HISTÓRIA.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="text-gray-400 text-[13px] text-center mt-2 leading-relaxed"
          >
            Entretenimento ilimitado para todos os momentos.
          </motion.p>
        </motion.div>

        {/* Cards de funcionalidades */}
        <div className="flex flex-col gap-3 mt-5">
          {CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.num}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="relative rounded-2xl overflow-hidden flex items-stretch"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Linha esquerda colorida */}
                <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: card.subtitleColor, opacity: 0.7 }} />

                {/* Texto */}
                <div className="flex-1 px-4 py-3.5">
                  <span className="text-[9px] font-black tracking-[0.3em] text-white/25">{card.num}</span>
                  <div className="flex items-center gap-2 mt-0.5 mb-1">
                    <Icon size={16} style={{ color: card.subtitleColor }} />
                    {card.live && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,26,26,0.15)', border: '1px solid rgba(255,26,26,0.35)' }}>
                        <motion.div
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.9, repeat: Infinity }}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: '#ff1a1a' }}
                        />
                        <span className="text-[8px] font-black tracking-widest" style={{ color: '#ff1a1a' }}>AO VIVO</span>
                      </div>
                    )}
                  </div>
                  <div className="font-black text-white text-[15px] uppercase tracking-tight leading-none">{card.title}</div>
                  <div className="font-black text-[13px] uppercase tracking-tight" style={{ color: card.subtitleColor }}>{card.subtitle}</div>
                  <p className="text-gray-400 text-[11px] mt-1.5 leading-relaxed">{card.desc}</p>
                </div>

                {/* Imagem cinematográfica */}
                <div className="w-28 h-[88px] relative flex-shrink-0 self-stretch overflow-hidden rounded-l-none rounded-r-2xl">
                  <img src={card.image} className="w-full h-full object-cover" alt="" loading="lazy" />
                  <div className="absolute inset-0" style={{ background: card.overlay }} />
                  {/* Brilho de borda */}
                  <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#050505]/80 to-transparent" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Indicadores */}
        <div className="flex items-center justify-center gap-2 mt-5">
          {CARDS.map((_, i) => (
            <motion.div
              key={i}
              animate={i === activeCard
                ? { width: 22, opacity: 1, boxShadow: '0 0 10px #ff1a1a' }
                : { width: 6, opacity: 0.25, boxShadow: 'none' }
              }
              transition={{ duration: 0.3 }}
              className="h-[5px] rounded-full cursor-pointer"
              style={{ background: i === activeCard ? '#ff1a1a' : 'rgba(255,255,255,0.5)' }}
              onClick={() => setActiveCard(i)}
            />
          ))}
        </div>

        {/* Botões CTA */}
        <div className="flex flex-col gap-3 mt-6">
          {/* Começar Agora */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleCTA('signup')}
            disabled={leaving}
            className="w-full py-[18px] rounded-2xl font-black text-white text-[15px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 relative overflow-hidden select-none"
            style={{
              background: 'linear-gradient(135deg, #c50000 0%, #ff1a1a 50%, #cc0000 100%)',
              boxShadow: '0 0 30px rgba(255,26,26,0.55), 0 8px 32px rgba(255,26,26,0.35)',
              border: '1px solid rgba(255,100,100,0.3)',
            }}
          >
            {/* Varredura de luz */}
            <motion.div
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12 pointer-events-none"
            />
            {isLoading && pendingMode === 'signup' ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                COMEÇAR AGORA
                <ChevronRight size={18} strokeWidth={2.5} />
              </>
            )}
          </motion.button>

          {/* Já tenho conta */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleCTA('login')}
            disabled={leaving}
            className="w-full py-[18px] rounded-2xl font-black text-white text-[15px] uppercase tracking-[0.15em] flex items-center justify-center select-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {isLoading && pendingMode === 'login' ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              'JÁ TENHO CONTA'
            )}
          </motion.button>
        </div>

        {/* Rodapé segurança */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex items-center justify-center gap-2 mt-5"
        >
          <Shield size={12} style={{ color: '#ff1a1a' }} />
          <span className="text-gray-500 text-[11px]">Seus dados protegidos com criptografia de ponta.</span>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-1 rounded-full flex-shrink-0"
            style={{ background: '#ff1a1a' }}
          />
        </motion.div>

      </div>
    </motion.div>
  );
};

export default IntroVignette;
