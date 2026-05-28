import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, Shield, Play, ChevronRight, Clock, Crown,
  Trash2, Film, Tv, Edit3, LogOut,
  Download, Sparkles, Zap, Star, Radio,
  Bell, Bookmark, History, X,
  CheckCircle, RefreshCcw, LifeBuoy, Flame,
  Moon, Save, Volume2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const TMDB = (p?: string | null, s = 'w342') =>
  p ? (p.startsWith('http') ? p : `https://image.tmdb.org/t/p/${s}${p}`) : null;

// ── Mini sparkline SVG ──────────────────────────────────────────────────────
const Sparkline = ({ value, color }: { value: number; color: string }) => {
  const pts = useMemo(() => {
    const n = 7;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const seed = ((value * 9301 * (i + 3) + 49297) % 233280) / 233280;
      return Math.max(0, value * (0.25 + t * 0.75 + (seed - 0.5) * 0.25));
    });
  }, [value]);
  const max = Math.max(...pts, 1);
  const w = 64, h = 22;
  const coords = pts.map((v, i) => [
    (i / (pts.length - 1)) * w,
    h - (v / max) * h * 0.85 - 2,
  ]);
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${value}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#sg-${value})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    </svg>
  );
};

// ── Donut chart (single arc) ────────────────────────────────────────────────
const DonutArc = ({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) => {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
      <motion.circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${fill} ${circ - fill}` }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
};

// ── XP bar ──────────────────────────────────────────────────────────────────
const XPBar = ({ pct }: { pct: number }) => (
  <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
    <motion.div
      className="absolute inset-y-0 left-0 rounded-full"
      style={{ background: 'linear-gradient(90deg, #ff1a1a, #ff6b6b)', boxShadow: '0 0 10px rgba(255,26,26,0.6)' }}
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
    />
  </div>
);

// ── Glass card wrapper ───────────────────────────────────────────────────────
const GlassCard = ({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div
    className={`rounded-2xl border border-white/[0.07] ${className}`}
    style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', ...style }}
  >
    {children}
  </div>
);

// ── Dot badge (feature) ──────────────────────────────────────────────────────
const FeatureBadge = ({ label, color }: { label: string; color: string }) => (
  <div
    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border"
    style={{
      color,
      borderColor: `${color}44`,
      background: `${color}11`,
      boxShadow: `0 0 10px ${color}22`,
    }}
  >
    <div className="w-1 h-1 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
    {label}
  </div>
);

// ── GENRE COLORS ─────────────────────────────────────────────────────────────
const GENRE_COLORS = ['#ff1a1a', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7', '#ec4899'];

export default function ProfileDashboard({
  profile,
  favorites,
  myList,
  handleSwitchProfile,
  handleLogout,
  handleLogoutAll,
  navigate,
  continueWatching,
  myMovies,
  appSettings,
  setIsSettingsOpen,
  isAdmin,
  updateAppSettings,
}: any) {

  const [showSettings, setShowSettings] = useState(false);
  const [autoplay, setAutoplay] = useState(appSettings?.autoplay_next ?? true);
  const [videoQuality, setVideoQuality] = useState('Auto');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appSettings) setAutoplay(appSettings.autoplay_next ?? true);
  }, [appSettings]);

  // ── Computed stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const genreMap: Record<string, number> = {};
    const movieIds = new Set<number>();
    const seriesIds = new Set<number>();
    let totalMins = 0;

    myList?.forEach((m: any) => m.type === 'series' ? seriesIds.add(m.id) : movieIds.add(m.id));
    favorites?.forEach((m: any) => {
      const id = m.movie_id || m.id;
      const type = m.movie_data?.type || m.type;
      type === 'series' ? seriesIds.add(id) : movieIds.add(id);
    });

    new Set([...movieIds, ...seriesIds]).forEach(id => {
      const m = myMovies?.find((mv: any) => mv.id === id);
      if (!m) return;
      totalMins += m.runtime || 90;
      (m.genres || '').split(',').forEach((g: string) => {
        const k = g.trim();
        if (k) genreMap[k] = (genreMap[k] || 0) + 1;
      });
    });

    const hoursWatched = Math.floor(totalMins / 60);
    const sortedGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]);
    const totalGenreCount = sortedGenres.reduce((s, [, c]) => s + c, 0) || 1;
    const topGenres = sortedGenres.slice(0, 4).map(([name, count], i) => ({
      name,
      pct: Math.round((count / totalGenreCount) * 100),
      color: GENRE_COLORS[i] || '#fff',
    }));

    const level = Math.min(99, Math.max(1, Math.floor(hoursWatched / 3) + Math.floor(movieIds.size / 8)));
    const xpCurrent = (hoursWatched % 50) * 43 + (movieIds.size % 20) * 11;
    const xpMax = 10900;
    const xpPct = Math.min(99, Math.round((xpCurrent / xpMax) * 100));
    const vipPoints = movieIds.size * 42 + hoursWatched * 100 + seriesIds.size * 80;

    return {
      hoursWatched,
      movieCount: movieIds.size,
      seriesCount: seriesIds.size,
      topGenre: topGenres[0]?.name || 'Ação',
      topGenres,
      level,
      xpCurrent,
      xpMax,
      xpPct,
      vipPoints,
    };
  }, [myList, favorites, myMovies]);

  // ── Member since ─────────────────────────────────────────────────────────
  const memberSince = useMemo(() => {
    const d = profile?.created_at || appSettings?.created_at;
    if (!d) return 'Janeiro de 2024';
    return new Date(d).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [profile, appSettings]);

  // ── Continue watching enriched ───────────────────────────────────────────
  const cwItems = useMemo(() => {
    return (continueWatching || [])
      .slice(0, 6)
      .map((cw: any) => {
        const m = myMovies?.find((mv: any) => mv.id === cw.id) || cw;
        const prog = cw.progress || 0;
        const dur = cw.duration || (m.runtime ? m.runtime * 60 : 5400);
        const pct = Math.min(99, Math.round((prog / dur) * 100));
        const remaining = Math.max(0, Math.round((dur - prog) / 60));
        return { ...m, _progress: pct, _remaining: remaining, _cw: cw };
      });
  }, [continueWatching, myMovies]);

  // ── Backdrop images for header (from library) ────────────────────────────
  const headerPosters = useMemo(() => {
    const all = [...(continueWatching || []), ...(myList || [])].slice(0, 8);
    return all.map((m: any) => {
      const mv = myMovies?.find((x: any) => x.id === m.id) || m;
      return TMDB(mv.backdrop_path || mv.poster_path, 'w500') || TMDB(mv.poster_path, 'w342');
    }).filter(Boolean);
  }, [continueWatching, myList, myMovies]);

  // ── Clear history ────────────────────────────────────────────────────────
  const handleClearHistory = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todo o histórico de visualização?')) return;
    try {
      await supabase.from('watch_history').delete().eq('profile_id', profile.id);
      Object.keys(localStorage).filter(k => k.startsWith('netplay_progress_')).forEach(k => localStorage.removeItem(k));
      window.location.reload();
    } catch (err: any) {
      alert('Erro ao limpar histórico.');
    }
  };

  // ── Save settings ────────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSaving(true);
    if (updateAppSettings) await updateAppSettings({ autoplay_next: autoplay });
    localStorage.setItem(`profile_settings_${profile?.id}`, JSON.stringify({ videoQuality, autoplay }));
    setSaving(false);
    setShowSettings(false);
  };

  // ── Quick actions config ─────────────────────────────────────────────────
  const quickActions = [
    { icon: LifeBuoy,  label: 'Suporte VIP',       sub: 'Atendimento exclusivo', color: '#22c55e', action: () => {} },
    { icon: Download,  label: 'Downloads',          sub: `${myList?.length || 0} itens`, color: '#a855f7', action: () => navigate('/downloads') },
    { icon: Bookmark,  label: 'Minha Lista',        sub: `${myList?.length || 0} salvos`, color: '#f97316', action: () => navigate('/mylist') },
    { icon: History,   label: 'Histórico',          sub: 'Ver tudo',              color: '#0ea5e9', action: () => navigate('/history') },
    { icon: Trash2,    label: 'Limpar Histórico',   sub: 'Excluir tudo',          color: '#ff1a1a', action: handleClearHistory },
  ];

  const AVATAR_SRC = profile?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png';

  return (
    <div className="min-h-screen pb-28" style={{ background: '#050505' }}>

      {/* ━━━ CINEMATIC HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative overflow-hidden" style={{ height: 220 }}>
        {/* poster collage bg */}
        <div className="absolute inset-0 flex gap-0">
          {(headerPosters.length > 0 ? headerPosters : [null, null, null, null]).map((src, i) => (
            <div key={i} className="flex-1 h-full relative overflow-hidden">
              {src
                ? <img src={src} alt="" className="w-full h-full object-cover scale-110" style={{ filter: 'blur(6px) saturate(0.6)' }} />
                : <div className="w-full h-full" style={{ background: `hsl(${i * 60},40%,8%)` }} />
              }
            </div>
          ))}
        </div>
        {/* overlays */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(5,5,5,0.3) 0%, rgba(5,5,5,0.1) 40%, rgba(5,5,5,0.85) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(255,26,26,0.18) 0%, transparent 65%)' }} />

        {/* top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-12">
          {isAdmin && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-500/40"
              style={{ background: 'rgba(234,179,8,0.15)', backdropFilter: 'blur(10px)' }}
            >
              <Crown size={11} className="text-yellow-400" />
              <span className="text-yellow-400 text-[10px] font-black uppercase tracking-widest">Premium Ultra</span>
            </div>
          )}
          {!isAdmin && <div />}
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}
            >
              <Bell size={15} className="text-white/70" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}
            >
              <Settings size={15} className="text-white/70" />
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ PROFILE CARD (overlaps header) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="px-4 -mt-14 relative z-10">
        <GlassCard className="p-4 mb-3">
          <div className="flex items-start gap-3">
            {/* avatar */}
            <div className="relative flex-none">
              <div
                className="absolute -inset-1.5 rounded-2xl"
                style={{ background: 'conic-gradient(from 0deg, #ff1a1a, #ff6b6b, #ff1a1a)', filter: 'blur(3px)', opacity: 0.9 }}
              />
              <div
                className="absolute -inset-0.5 rounded-2xl"
                style={{ background: 'conic-gradient(from 90deg, #ff1a1a 0%, transparent 50%, #ff1a1a 100%)', opacity: 0.5 }}
              />
              <img
                src={AVATAR_SRC}
                alt="Avatar"
                className="relative w-[78px] h-[78px] rounded-2xl object-cover border-2 border-black"
                referrerPolicy="no-referrer"
              />
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center border border-black"
                style={{ background: '#ff1a1a', boxShadow: '0 0 10px rgba(255,26,26,0.7)' }}
              >
                <Edit3 size={11} className="text-white" />
              </div>
            </div>

            {/* name + role */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h1 className="text-white font-black text-[22px] tracking-tight leading-none">{profile?.name || 'USUÁRIO'}</h1>
                <CheckCircle size={15} className="text-red-500 flex-none" fill="#ff1a1a" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => navigate('/admin')}
                      className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(255,26,26,0.2)', color: '#ff6b6b', border: '1px solid rgba(255,26,26,0.3)' }}
                    >
                      MULTI-ADMIN
                    </button>
                    <button
                      onClick={() => navigate('/admin2')}
                      className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                    >
                      Admin 2.0
                    </button>
                    <button
                      onClick={() => navigate('/admin3')}
                      className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}
                    >
                      Admin 3.0
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 text-white/35 text-[10px]">
                <Sparkles size={9} className="text-white/25" />
                <span>Membro desde {memberSince}</span>
              </div>
            </div>

            {/* VIP points */}
            <div
              className="flex-none text-right flex flex-col items-end gap-1 p-2 rounded-xl border border-yellow-500/20"
              style={{ background: 'rgba(234,179,8,0.07)', minWidth: 90 }}
            >
              <div className="flex items-center gap-1">
                <span className="text-white/40 text-[8px] font-bold uppercase tracking-wide">PONTOS</span>
                <Star size={10} className="text-yellow-400" fill="currentColor" />
              </div>
              <span className="text-yellow-400 font-black text-[17px] leading-none"
                style={{ textShadow: '0 0 12px rgba(234,179,8,0.5)' }}>
                {stats.vipPoints.toLocaleString('pt-BR')}
              </span>
              <button
                className="text-[7px] font-black uppercase tracking-wide text-yellow-500/70 underline-offset-2 underline"
              >
                Ver Recompensas
              </button>
            </div>
          </div>

          {/* feature badges row */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <FeatureBadge label="4K" color="#0ea5e9" />
            <FeatureBadge label="Ultra HD" color="#a855f7" />
            <FeatureBadge label="Sem Anúncios" color="#22c55e" />
            <FeatureBadge label="Áudio Dolby" color="#f59e0b" />
          </div>
        </GlassCard>

        {/* ━━━ NÍVEL CINÉFILO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <GlassCard className="p-3.5 mb-3">
          <div className="flex items-center gap-3">
            {/* shield level badge */}
            <div className="relative flex-none">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,26,26,0.25), rgba(255,26,26,0.08))',
                  borderColor: 'rgba(255,26,26,0.35)',
                  boxShadow: '0 0 20px rgba(255,26,26,0.25)',
                }}
              >
                <Shield size={20} className="text-red-500" fill="rgba(255,26,26,0.3)" />
              </div>
              <div
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg flex items-center justify-center border border-black text-[10px] font-black"
                style={{ background: '#ff1a1a', color: '#fff', boxShadow: '0 0 8px rgba(255,26,26,0.6)' }}
              >
                {stats.level}
              </div>
            </div>

            {/* xp info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white font-black text-[12px] uppercase tracking-wide">Nível Cinéfilo</span>
                <span className="text-white/40 text-[10px] font-bold">{stats.xpCurrent.toLocaleString('pt-BR')} / {stats.xpMax.toLocaleString('pt-BR')} XP</span>
              </div>
              <XPBar pct={stats.xpPct} />
              <p className="text-white/35 text-[9px] mt-1.5">
                Faltam {(stats.xpMax - stats.xpCurrent).toLocaleString('pt-BR')} XP para o próximo nível
              </p>
            </div>

            <ChevronRight size={15} className="text-white/20 flex-none" />
          </div>
        </GlassCard>

        {/* ━━━ STATS 2×2 GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {(() => {
          const cards = [
            { icon: Clock,     label: 'Tempo Assistido', value: `${Math.max(74, stats.hoursWatched)}h`, sub: '+6h esta semana', color: '#ff1a1a',  sparkSeed: Math.max(74, stats.hoursWatched) },
            { icon: Film,      label: 'Filmes',          value: `${Math.max(301, stats.movieCount)}`,   sub: '+12 este mês',   color: '#a855f7',  sparkSeed: Math.max(301, stats.movieCount) },
            { icon: Tv,        label: 'Séries',          value: `${Math.max(70, stats.seriesCount)}`,   sub: '+4 esta semana', color: '#22d3ee',  sparkSeed: Math.max(70, stats.seriesCount) },
            { icon: Radio,     label: 'Canais Favoritos',value: `${Math.max(128, (myList?.length || 0) + 80)}`, sub: '+9 este mês', color: '#22c55e', sparkSeed: 128 },
          ];
          return (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {cards.map(card => (
                <GlassCard key={card.label} className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: `${card.color}18`, border: `1px solid ${card.color}30`, boxShadow: `0 0 12px ${card.color}20` }}
                    >
                      <card.icon size={15} style={{ color: card.color }} />
                    </div>
                  </div>
                  <div className="font-black text-white text-[26px] leading-none mb-0.5"
                    style={{ textShadow: `0 0 20px ${card.color}40` }}>
                    {card.value}
                  </div>
                  <div className="text-white/35 text-[8px] font-bold uppercase tracking-wide mb-2">{card.label}</div>
                  <div className="flex items-end justify-between">
                    <span className="text-white/25 text-[9px]">{card.sub}</span>
                    <Sparkline value={card.sparkSeed} color={card.color} />
                  </div>
                </GlassCard>
              ))}
            </div>
          );
        })()}

        {/* ━━━ CONTINUE ASSISTINDO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {cwItems.length > 0 && (
          <section className="mb-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Play size={13} className="text-red-500" fill="currentColor" />
                <h2 className="text-white font-black text-[13px] uppercase tracking-tight">Continue Assistindo</h2>
              </div>
              <button onClick={() => navigate('/history')} className="flex items-center gap-1 text-[10px] text-white/30 font-bold">
                Ver tudo <ChevronRight size={11} />
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
              {cwItems.map((item: any) => {
                const poster = TMDB(item.poster_path, 'w342');
                const title = item.title || item.name || '';
                return (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/movie/${item.id}`)}
                    className="flex-none cursor-pointer"
                    style={{ width: 130 }}
                  >
                    <div
                      className="relative rounded-2xl overflow-hidden border border-white/[0.07]"
                      style={{ aspectRatio: '2/3', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
                    >
                      {poster
                        ? <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Film size={28} className="text-white/20" /></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                      {/* play button */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center border border-white/30 backdrop-blur-sm"
                          style={{ background: 'rgba(255,26,26,0.7)', boxShadow: '0 0 20px rgba(255,26,26,0.5)' }}
                        >
                          <Play size={16} fill="white" className="text-white ml-0.5" />
                        </div>
                      </div>
                      {/* progress bar */}
                      <div className="absolute bottom-0 inset-x-0 h-0.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div
                          className="h-full"
                          style={{ width: `${item._progress}%`, background: '#ff1a1a', boxShadow: '0 0 6px rgba(255,26,26,0.8)' }}
                        />
                      </div>
                    </div>
                    <p className="text-white/70 font-black text-[10px] mt-1.5 truncate">{title}</p>
                    <p className="text-white/30 text-[9px]">{item._remaining}min restantes</p>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ━━━ ESTATÍSTICAS INTELIGENTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-purple-400" />
              <h2 className="text-white font-black text-[13px] uppercase tracking-tight">Estatísticas Inteligentes</h2>
            </div>
            <button className="flex items-center gap-1 text-[10px] text-white/30 font-bold">
              Ver relatório <ChevronRight size={11} />
            </button>
          </div>

          <GlassCard className="p-4">
            <div className="flex items-stretch gap-3">
              {/* donut + top genre */}
              <div className="flex flex-col items-center justify-center flex-none" style={{ minWidth: 110 }}>
                <div className="relative">
                  <DonutArc pct={stats.topGenres[0]?.pct || 42} color="#ff1a1a" size={88} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-white font-black text-[16px] leading-none">
                      {stats.topGenres[0]?.pct || 42}%
                    </span>
                  </div>
                </div>
                <p className="text-white font-black text-[11px] mt-1.5 text-center">{stats.topGenre}</p>
                <p className="text-white/35 text-[8px] uppercase tracking-wide">Gênero favorito</p>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                {/* genre list */}
                <div className="space-y-2">
                  {(stats.topGenres.length > 0 ? stats.topGenres : [
                    { name: 'Animação', pct: 42, color: '#ff1a1a' },
                    { name: 'Ação', pct: 28, color: '#f59e0b' },
                    { name: 'Ficção', pct: 16, color: '#0ea5e9' },
                    { name: 'Documentários', pct: 14, color: '#22c55e' },
                  ]).slice(0, 4).map(g => (
                    <div key={g.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-none" style={{ background: g.color, boxShadow: `0 0 6px ${g.color}` }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70 text-[10px] font-bold truncate">{g.name}</span>
                          <span className="text-white/40 text-[10px] font-bold ml-1">{g.pct}%</span>
                        </div>
                        <div className="h-1 rounded-full mt-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: g.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${g.pct}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* mini info cards row */}
                <div className="flex gap-2 mt-3">
                  <div
                    className="flex-1 rounded-xl p-2 border border-white/[0.06] flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <Moon size={12} className="text-blue-400 flex-none" />
                    <div>
                      <p className="text-white font-black text-[10px] leading-none">21h – 01h</p>
                      <p className="text-white/30 text-[8px] mt-0.5">Período noturno</p>
                    </div>
                  </div>
                  <div
                    className="flex-1 rounded-xl p-2 border border-white/[0.06] flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <Flame size={12} className="text-orange-400 flex-none" />
                    <div>
                      <p className="text-white font-black text-[10px] leading-none">12 dias</p>
                      <p className="text-white/30 text-[8px] mt-0.5">Mantenha o ritmo!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* ━━━ AÇÕES RÁPIDAS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Zap size={13} className="text-yellow-400" />
            <h2 className="text-white font-black text-[13px] uppercase tracking-tight">Ações Rápidas</h2>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {quickActions.map(a => (
              <motion.button
                key={a.label}
                whileTap={{ scale: 0.92 }}
                onClick={a.action}
                className="flex-none flex flex-col items-center gap-2 rounded-2xl border p-3 cursor-pointer"
                style={{
                  width: 80,
                  background: `${a.color}0d`,
                  borderColor: `${a.color}25`,
                  boxShadow: `0 4px 16px ${a.color}15`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${a.color}18`, border: `1px solid ${a.color}30` }}
                >
                  <a.icon size={17} style={{ color: a.color }} />
                </div>
                <span className="text-white/70 text-[8px] font-black uppercase tracking-wide text-center leading-tight">{a.label}</span>
                <span className="text-white/30 text-[7px] text-center leading-tight">{a.sub}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ━━━ ACCOUNT ACTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="space-y-2 mb-4">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-red-500/20"
              style={{ background: 'rgba(255,26,26,0.07)' }}
            >
              <div className="flex items-center gap-2.5">
                <Shield size={16} className="text-red-500" />
                <span className="text-white font-bold text-[13px]">Painel do Administrador</span>
              </div>
              <ChevronRight size={15} className="text-white/30" />
            </button>
          )}
          <button
            onClick={handleSwitchProfile}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/[0.07]"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div className="flex items-center gap-2.5">
              <RefreshCcw size={16} className="text-white/50" />
              <span className="text-white/70 font-bold text-[13px]">Trocar Perfil</span>
            </div>
            <ChevronRight size={15} className="text-white/30" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/[0.07]"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="flex items-center gap-2.5">
              <LogOut size={16} className="text-white/40" />
              <span className="text-white/50 font-bold text-[13px]">Sair da Conta</span>
            </div>
            <ChevronRight size={15} className="text-white/20" />
          </button>
        </div>

        {/* version tag */}
        <p className="text-center text-white/15 text-[9px] pb-2 font-bold tracking-widest uppercase">NetPlay Premium · v3.0</p>
      </div>

      {/* ━━━ SETTINGS SHEET ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 z-[200]"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl border-t border-white/[0.08]"
              style={{ background: '#0e0e0e', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-white font-black text-[17px]">Preferências</h3>
                  <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <X size={16} className="text-white/70" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* autoplay toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                        <Play size={14} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-[13px]">Autoplay</p>
                        <p className="text-white/40 text-[10px]">Próximo episódio automático</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoplay(!autoplay)}
                      className="relative w-12 h-6 rounded-full transition-colors"
                      style={{ background: autoplay ? '#ff1a1a' : 'rgba(255,255,255,0.1)', boxShadow: autoplay ? '0 0 12px rgba(255,26,26,0.4)' : 'none' }}
                    >
                      <motion.div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                        animate={{ left: autoplay ? 28 : 4 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      />
                    </button>
                  </div>

                  {/* video quality */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                        <Monitor size={14} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-[13px]">Qualidade de vídeo</p>
                        <p className="text-white/40 text-[10px]">Resolução da reprodução</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {['Auto', '4K', '1080p'].map(q => (
                        <button
                          key={q}
                          onClick={() => setVideoQuality(q)}
                          className="px-2 py-1 rounded-lg text-[9px] font-black transition-all"
                          style={{
                            background: videoQuality === q ? '#0ea5e9' : 'rgba(255,255,255,0.06)',
                            color: videoQuality === q ? '#fff' : 'rgba(255,255,255,0.4)',
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* sound */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                        <Volume2 size={14} className="text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-[13px]">Áudio Dolby Atmos</p>
                        <p className="text-white/40 text-[10px]">Som surround imersivo</p>
                      </div>
                    </div>
                    <div
                      className="text-[8px] font-black uppercase px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                    >
                      Ativo
                    </div>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="w-full mt-6 py-3.5 rounded-2xl text-white font-black text-[13px] uppercase tracking-wider flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #ff1a1a, #cc0000)', boxShadow: '0 4px 20px rgba(255,26,26,0.4)' }}
                >
                  {saving ? <Sparkles size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Salvando...' : 'Salvar Preferências'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// missing import fix
const Monitor = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);
