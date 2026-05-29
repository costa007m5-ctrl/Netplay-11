import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronRight, Shield, ChevronLeft, Zap, Globe, Users, ShieldCheck, Sparkles, Download, Crown, Tv2, Star } from 'lucide-react';
import { Movie } from '../types';

interface AppInfoProps {
  onContinue: (mode?: 'login' | 'signup') => void;
  movies?: Movie[];
}

const DEFAULT_POSTERS = [
  'https://image.tmdb.org/t/p/w342/8Gxv8ZiiQjLTVq9hlqU1Mv2U0qO.jpg',
  'https://image.tmdb.org/t/p/w342/q719jsmZvqb6tUFiBbqB8p6mw1m.jpg',
  'https://image.tmdb.org/t/p/w342/6oom5QYdwZ71TCWbkvMvS0n0Dby.jpg',
  'https://image.tmdb.org/t/p/w342/r2J0VzYnUEsIbiSSTSksvUo7mo1.jpg',
  'https://image.tmdb.org/t/p/w342/uY7URv89yS6Om9j32oOM4STU68B.jpg',
  'https://image.tmdb.org/t/p/w342/h8mzmDcYmCcy1ar9Mdh9ofjH7s8.jpg',
  'https://image.tmdb.org/t/p/w342/6WpY9i9at6L89lR7p5vA7Dq0S2p.jpg',
  'https://image.tmdb.org/t/p/w342/A7uByuyGKE69uYv7SFF9vI9Ym96.jpg',
  'https://image.tmdb.org/t/p/w342/hZkgoQYus5vegHoetLkCJzVAzcn.jpg',
  'https://image.tmdb.org/t/p/w342/9n2tJBplPbgR2ca05hS5CKXwP2c.jpg',
  'https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
];

const SLIDES = [
  {
    id: 1,
    headline: 'STREAMING PREMIUM',
    sub: 'Entretenimento sem limites',
    accentColor: '#ff1a1a',
    features: [
      {
        icon: Tv2, label: '4K ULTRA HD', desc: 'Qualidade máxima em todos os títulos', accent: '#3b82f6',
        visual: (
          <div className="flex flex-col items-end gap-1">
            {['4K','FHD','HD'].map((q,i) => (
              <div key={q} className="flex items-center gap-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${52 - i*14}px`, background: i===0 ? '#3b82f6' : 'rgba(255,255,255,0.15)' }} />
                <span className="text-[9px] font-black" style={{ color: i===0 ? '#3b82f6' : 'rgba(255,255,255,0.3)' }}>{q}</span>
              </div>
            ))}
          </div>
        ),
      },
      {
        icon: Tv2, label: 'CANAIS AO VIVO', desc: 'Esportes e notícias em tempo real', accent: '#ff1a1a',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:0.9, repeat:Infinity }} className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[8px] font-black text-red-400 tracking-widest">AO VIVO</span>
            <span className="text-[8px] text-white/40">24/7</span>
          </div>
        ),
      },
      {
        icon: Download, label: 'MODO OFFLINE', desc: 'Baixe e assista sem internet', accent: '#a855f7',
        visual: (
          <motion.div animate={{ y:[0,4,0] }} transition={{ duration:1.5, repeat:Infinity }} className="flex flex-col items-center gap-1">
            <Download size={18} style={{ color:'#a855f7' }} />
            <span className="text-[8px] font-black text-purple-400">SALVO</span>
          </motion.div>
        ),
      },
      {
        icon: Shield, label: 'ZERO ANÚNCIOS', desc: 'Experiência sem interrupções', accent: '#22c55e',
        visual: (
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full border-2 border-green-500/50 flex items-center justify-center">
              <ShieldCheck size={14} style={{ color:'#22c55e' }} />
            </div>
            <span className="text-[8px] font-black text-green-400">LIVRE</span>
          </div>
        ),
      },
    ],
  },
  {
    id: 2,
    headline: 'TECNOLOGIA',
    sub: 'Inovação que você sente',
    accentColor: '#22d3ee',
    features: [
      {
        icon: Zap, label: 'ULTRA RÁPIDO', desc: 'Zero buffering mesmo em conexões lentas', accent: '#f59e0b',
        visual: (
          <div className="flex flex-col items-end gap-1">
            {[100,75,50].map((w,i) => (
              <motion.div key={i} animate={{ scaleX:[0.7,1,0.7] }} transition={{ duration:1.2, delay:i*0.2, repeat:Infinity }} className="h-1.5 rounded-full origin-right" style={{ width:`${w*0.44}px`, background: i===0 ? '#f59e0b' : i===1 ? '#f59e0b80' : '#f59e0b30' }} />
            ))}
            <span className="text-[9px] font-black text-amber-400 mt-0.5">BUFFERING ZERO</span>
          </div>
        ),
      },
      {
        icon: Sparkles, label: 'IA INTELIGENTE', desc: 'Recomendações que aprendem com você', accent: '#22d3ee',
        visual: (
          <div className="relative w-10 h-10">
            {[0,1,2].map(i => (
              <motion.div key={i} animate={{ scale:[1,1.4,1], opacity:[0.7,0.2,0.7] }} transition={{ duration:1.5, delay:i*0.4, repeat:Infinity }}
                className="absolute rounded-full border border-cyan-400/40"
                style={{ inset: `${i*5}px` }} />
            ))}
            <Sparkles size={14} style={{ color:'#22d3ee', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
          </div>
        ),
      },
      {
        icon: () => (
          <svg width="16" height="16" viewBox="0 0 20 20"><rect x="1" y="3" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/><text x="10" y="13" textAnchor="middle" fontSize="7" fontWeight="900" fill="currentColor" fontFamily="sans-serif">DOLBY</text></svg>
        ),
        label: 'DOLBY DIGITAL', desc: 'Som surround imersivo 5.1', accent: '#8b5cf6',
        visual: (
          <div className="flex items-end gap-0.5 h-8">
            {[3,5,7,5,4,6,3].map((h,i) => (
              <motion.div key={i} animate={{ height:[`${h*3}px`,`${h*5}px`,`${h*3}px`] }} transition={{ duration:0.6, delay:i*0.08, repeat:Infinity }}
                className="w-1 rounded-full" style={{ background:'#8b5cf6', opacity: 0.6+i*0.04 }} />
            ))}
          </div>
        ),
      },
      {
        icon: Crown, label: 'MULTI-TELAS', desc: 'Assista em até 4 dispositivos', accent: '#f97316',
        visual: (
          <div className="grid grid-cols-2 gap-1">
            {['📱','💻','📺','🖥️'].map((e,i) => (
              <div key={i} className="w-4 h-4 rounded flex items-center justify-center text-[9px]" style={{ background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)' }}>{e}</div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    id: 3,
    headline: 'FAMÍLIA COMPLETA',
    sub: 'Para cada membro da sua família',
    accentColor: '#4ade80',
    features: [
      {
        icon: Users, label: 'PERFIS MÚLTIPLOS', desc: 'Até 5 perfis por conta, cada um único', accent: '#4ade80',
        visual: (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex -space-x-2">
              {['A','B','C'].map((l,i) => (
                <div key={l} className="w-6 h-6 rounded-full border-2 border-[#050505] flex items-center justify-center text-[8px] font-black text-white"
                  style={{ background: ['#4ade80','#3b82f6','#f59e0b'][i], zIndex:3-i }}>
                  {l}
                </div>
              ))}
              <div className="w-6 h-6 rounded-full border-2 border-[#050505] flex items-center justify-center text-[8px] font-black text-white bg-white/10">+</div>
            </div>
            <span className="text-[8px] font-black text-green-400">5 PERFIS</span>
          </div>
        ),
      },
      {
        icon: ShieldCheck, label: 'CONTROLE PARENTAL', desc: 'Proteção total para crianças', accent: '#fb923c',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <ShieldCheck size={20} style={{ color:'#fb923c' }} />
              <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity }}
                className="absolute inset-0 rounded-full"
                style={{ boxShadow:'0 0 12px #fb923c60' }} />
            </div>
            <div className="flex gap-1">
              {['✓','✓','✗','✗'].map((s,i) => (
                <span key={i} className="text-[9px] font-black" style={{ color: s==='✓' ? '#fb923c' : 'rgba(255,255,255,0.2)' }}>{s}</span>
              ))}
            </div>
            <span className="text-[8px] font-black text-orange-400">PROTEÇÃO ATIVA</span>
          </div>
        ),
      },
      {
        icon: Globe, label: 'LEGENDAS PT-BR', desc: 'Legendas e dublagem em português', accent: '#38bdf8',
        visual: (
          <div className="flex flex-col gap-1">
            {[{l:'• Português',a:true},{l:'○ English',a:false},{l:'○ Español',a:false}].map((it,i) => (
              <div key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: it.a ? '#38bdf8' : 'rgba(255,255,255,0.25)', background: it.a ? 'rgba(56,189,248,0.12)' : 'transparent' }}>{it.l}</div>
            ))}
          </div>
        ),
      },
      {
        icon: Star, label: 'PERFIL KIDS', desc: 'Conteúdo seguro para os pequenos', accent: '#facc15',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="text-xl">🧒</div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_,i) => <Star key={i} size={8} style={{ color:'#facc15', fill:'#facc15' }} />)}
            </div>
            <span className="text-[8px] font-black text-yellow-400">KIDS SAFE</span>
          </div>
        ),
      },
    ],
  },
  {
    id: 4,
    headline: 'PLANOS FLEXÍVEIS',
    sub: 'O melhor custo-benefício do mercado',
    accentColor: '#f59e0b',
    features: [
      {
        icon: Crown, label: 'A PARTIR DE R$19,90', desc: 'Planos para todos os bolsos', accent: '#f59e0b',
        visual: (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] text-white/40 line-through">R$49,90</span>
            <span className="text-[13px] font-black text-amber-400">R$19,90</span>
            <span className="text-[8px] text-white/40">/mês</span>
          </div>
        ),
      },
      {
        icon: Star, label: '7 DIAS GRÁTIS', desc: 'Experimente sem compromisso', accent: '#4ade80',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="text-lg">🎁</div>
            <span className="text-[8px] font-black text-green-400 tracking-wider">GRÁTIS</span>
            <span className="text-[8px] text-white/40">7 dias</span>
          </div>
        ),
      },
      {
        icon: Shield, label: 'SEM FIDELIDADE', desc: 'Cancele quando e como quiser', accent: '#a855f7',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full border border-purple-500/40 flex items-center justify-center">
              <span className="text-[16px]">🔓</span>
            </div>
            <span className="text-[8px] font-black text-purple-400">LIVRE</span>
          </div>
        ),
      },
      {
        icon: Sparkles, label: 'PLANO MAX', desc: 'Acesso total sem nenhuma restrição', accent: '#ff1a1a',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <motion.div animate={{ filter:['drop-shadow(0 0 6px #ff1a1a)', 'drop-shadow(0 0 14px #ff1a1a)', 'drop-shadow(0 0 6px #ff1a1a)'] }} transition={{ duration:2, repeat:Infinity }}>
              <Crown size={18} style={{ color:'#ff1a1a' }} />
            </motion.div>
            <span className="text-[8px] font-black text-red-400 tracking-wider">MAX</span>
          </div>
        ),
      },
    ],
  },
  {
    id: 5,
    headline: 'CONFIANÇA TOTAL',
    sub: 'Mais de 250 mil usuários confiam',
    accentColor: '#22d3ee',
    features: [
      {
        icon: ShieldCheck, label: '100% SEGURO', desc: 'Dados criptografados de ponta a ponta', accent: '#22c55e',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <motion.div animate={{ rotate:[0,360] }} transition={{ duration:8, repeat:Infinity, ease:'linear' }}
              className="w-8 h-8 rounded-full border-2 border-dashed border-green-500/40 flex items-center justify-center">
              <ShieldCheck size={14} style={{ color:'#22c55e' }} />
            </motion.div>
            <span className="text-[8px] font-black text-green-400">CRIPTOGRAFADO</span>
          </div>
        ),
      },
      {
        icon: Sparkles, label: 'SUPORTE 24/7', desc: 'Sempre disponível para ajudar', accent: '#38bdf8',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="text-lg">💬</div>
            <div className="flex gap-0.5 flex-col items-end">
              {['Ol...','...','✓'].map((t,i) => (
                <div key={i} className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background:i===2?'rgba(56,189,248,0.15)':'rgba(255,255,255,0.05)', color:i===2?'#38bdf8':'rgba(255,255,255,0.4)' }}>{t}</div>
              ))}
            </div>
          </div>
        ),
      },
      {
        icon: Zap, label: 'SEMPRE NOVO', desc: 'Novos títulos adicionados toda semana', accent: '#f59e0b',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="text-[9px] font-black text-amber-400">+50 TÍTULOS</div>
            <div className="text-[8px] text-white/40">toda semana</div>
            <motion.div className="w-10 h-0.5 rounded-full bg-amber-500/30" animate={{}}>
              <motion.div className="h-full rounded-full bg-amber-400" animate={{ width:['0%','100%'] }} transition={{ duration:2, repeat:Infinity, repeatDelay:1 }} />
            </motion.div>
          </div>
        ),
      },
      {
        icon: Users, label: '+250K USUÁRIOS', desc: 'Comunidade ativa e crescente', accent: '#4ade80',
        visual: (
          <div className="flex flex-col items-center gap-1">
            <div className="flex -space-x-1.5">
              {['😊','😎','🤩','😄','🥳'].map((e,i) => (
                <div key={i} className="w-5 h-5 rounded-full border border-[#050505] flex items-center justify-center text-[9px] bg-white/5">{e}</div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} size={7} style={{ color:'#facc15', fill:'#facc15' }} />)}
            </div>
          </div>
        ),
      },
    ],
  },
];

const SLIDE_DURATION = 5000;

const AppInfo: React.FC<AppInfoProps> = ({ onContinue, movies = [] }) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [displayMovies, setDisplayMovies] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/tmdb/trending/all/day?language=pt-BR');
        const data = await res.json();
        if (data?.results?.length > 0) {
          const list = data.results.filter((m: any) => m.poster_path);
          let ext = [...list];
          while (ext.length < 50) ext = [...ext, ...list];
          setDisplayMovies(ext.sort(() => 0.5 - Math.random()).slice(0, 50));
          return;
        }
      } catch {}
      const fallback = movies.length > 5 ? [...movies].sort(() => 0.5 - Math.random()).slice(0, 50) : DEFAULT_POSTERS.map(url => ({ poster_path: url }));
      setDisplayMovies(fallback);
    };
    fetchTrending();
  }, [movies]);

  const goTo = useCallback((idx: number, dir?: number) => {
    setDirection(dir ?? (idx > current ? 1 : -1));
    setCurrent(idx);
    setProgress(0);
  }, [current]);

  const next = useCallback(() => goTo((current + 1) % SLIDES.length, 1), [current, goTo]);
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length, -1), [current, goTo]);

  useEffect(() => {
    setProgress(0);
    const interval = 50;
    const steps = SLIDE_DURATION / interval;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setProgress(step / steps);
      if (step >= steps) {
        clearInterval(timer);
        next();
      }
    }, interval);
    return () => clearInterval(timer);
  }, [current]);

  const getPosterUrl = (m: any) => {
    if (!m?.poster_path) return null;
    return m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w342${m.poster_path}`;
  };

  const getRowPosters = (rowIdx: number) => {
    if (!displayMovies.length) return DEFAULT_POSTERS.map(url => ({ poster_path: url }));
    const pool = [...displayMovies, ...displayMovies, ...displayMovies];
    const offset = rowIdx * Math.max(6, Math.floor(displayMovies.length / 4));
    return pool.slice(offset, offset + 30);
  };

  const slide = SLIDES[current];

  return (
    <div className="fixed inset-0 bg-[#050505] overflow-hidden flex flex-col font-sans select-none">
      {/* Fundo — mosaico de posters */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-[0.07] grayscale blur-[1px]">
        <div className="-rotate-3 scale-125 origin-center flex flex-col gap-3 -mt-8">
          {[0,1,2,3].map(row => (
            <motion.div key={row}
              animate={{ x: row % 2 === 0 ? [0, -1600] : [-1600, 0] }}
              transition={{ duration: 60 + row * 15, repeat: Infinity, ease: 'linear' }}
              className="flex gap-3 shrink-0"
            >
              {[...getRowPosters(row), ...getRowPosters(row)].map((m, i) => {
                const url = getPosterUrl(m);
                if (!url) return null;
                return (
                  <div key={i} className="w-28 aspect-[2/3] rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                    <img src={url} className="w-full h-full object-cover" alt="" loading="lazy" />
                  </div>
                );
              })}
            </motion.div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/50 to-[#050505]" />
      </div>

      {/* Glows */}
      <motion.div
        key={slide.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.25 }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] blur-[120px] rounded-full pointer-events-none z-0"
        style={{ background: slide.accentColor }}
      />

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-10 pb-4">
        <div className="flex items-center gap-2.5">
          <motion.div animate={{ filter:['drop-shadow(0 0 8px #ff1a1a)','drop-shadow(0 0 20px #ff1a1a)','drop-shadow(0 0 8px #ff1a1a)'] }} transition={{ duration:2.5, repeat:Infinity }}>
            <svg width="32" height="32" viewBox="0 0 40 40"><polygon points="6,4 36,20 6,36" fill="#ff1a1a" /></svg>
          </motion.div>
          <span className="text-[32px] font-black italic tracking-tighter leading-none">
            <span className="text-white">NET</span><span style={{ color:'#ff1a1a' }}>PLAY</span>
          </span>
        </div>
        <button onClick={() => onContinue('login')} className="text-white/60 text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl hover:text-white transition-colors">
          Entrar
        </button>
      </div>

      {/* ── Título do slide ── */}
      <div className="relative z-10 px-5 pb-2">
        <AnimatePresence mode="wait">
          <motion.div key={slide.id}
            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }}
            transition={{ duration:0.4 }}
          >
            <p className="text-[10px] font-black tracking-[0.3em] mb-0.5" style={{ color: slide.accentColor }}>
              {String(current + 1).padStart(2, '0')} / {SLIDES.length}
            </p>
            <h2 className="text-[22px] font-black text-white uppercase tracking-tight leading-tight">{slide.headline}</h2>
            <p className="text-gray-400 text-[12px] mt-0.5">{slide.sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Grid de 4 cards ── */}
      <div className="relative z-10 flex-1 px-4 pb-2 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            variants={{
              enter: (d) => ({ x: d > 0 ? '80%' : '-80%', opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d) => ({ x: d > 0 ? '-80%' : '80%', opacity: 0 }),
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 gap-2.5 h-full"
          >
            {slide.features.map((feat, i) => {
              const Icon = feat.icon as any;
              return (
                <motion.div
                  key={feat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="rounded-2xl p-3 flex flex-col justify-between overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${feat.accent}20`,
                    backdropFilter: 'blur(12px)',
                    minHeight: '120px',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${feat.accent}15` }}>
                        <Icon size={13} style={{ color: feat.accent }} />
                      </div>
                      <div className="flex-shrink-0">{feat.visual}</div>
                    </div>
                    <div className="font-black text-white text-[11px] uppercase tracking-tight leading-tight">{feat.label}</div>
                  </div>
                  <p className="text-gray-500 text-[10px] leading-snug mt-1">{feat.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Progresso + Indicadores ── */}
      <div className="relative z-10 px-5 pb-3">
        {/* Barra de progresso */}
        <div className="w-full h-0.5 bg-white/10 rounded-full mb-3">
          <motion.div
            className="h-full rounded-full"
            style={{ width: `${progress * 100}%`, background: slide.accentColor }}
            transition={{ duration: 0.05 }}
          />
        </div>

        {/* Dots + setas */}
        <div className="flex items-center justify-between">
          <button onClick={prev} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,0.07)' }}>
            <ChevronLeft size={16} className="text-white/60" />
          </button>

          <div className="flex items-center gap-2">
            {SLIDES.map((s, i) => (
              <motion.button
                key={s.id}
                onClick={() => goTo(i)}
                animate={i === current
                  ? { width: 20, opacity: 1, boxShadow: `0 0 8px ${slide.accentColor}` }
                  : { width: 6, opacity: 0.3, boxShadow: 'none' }
                }
                transition={{ duration: 0.3 }}
                className="h-1.5 rounded-full"
                style={{ background: i === current ? slide.accentColor : 'rgba(255,255,255,0.5)' }}
              />
            ))}
          </div>

          <button onClick={next} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,0.07)' }}>
            <ChevronRight size={16} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="relative z-10 px-5 pb-10 flex flex-col gap-2.5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onContinue('signup')}
          className="w-full py-[17px] rounded-2xl font-black text-white text-[14px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #c50000 0%, #ff1a1a 50%, #cc0000 100%)',
            boxShadow: '0 0 30px rgba(255,26,26,0.5), 0 8px 32px rgba(255,26,26,0.3)',
          }}
        >
          <motion.div
            animate={{ x: ['-120%', '220%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
          />
          COMEÇAR AGORA
          <ChevronRight size={18} strokeWidth={2.5} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onContinue('login')}
          className="w-full py-[17px] rounded-2xl font-black text-white text-[14px] uppercase tracking-[0.15em] flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.15)' }}
        >
          JÁ TENHO CONTA
        </motion.button>

        <div className="flex items-center justify-center gap-2 mt-1">
          <Shield size={11} style={{ color: '#ff1a1a' }} />
          <span className="text-gray-600 text-[10px]">Seus dados protegidos com criptografia</span>
        </div>
      </div>
    </div>
  );
};

export default AppInfo;
