import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio, Search, X, RefreshCcw, Tv2, ArrowLeft,
  Play, List, SkipBack, SkipForward, Lock,
  Maximize2, Minimize2, ShieldCheck, ShieldOff, CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Channel {
  id: string;
  name?: string; nome?: string;
  image?: string; imagem?: string;
  preview?: string;
  url?: string;
  categories?: number[];
  categoria?: string; category?: string;
}

interface JogoTeam { name: string; image: string; }
interface Jogo {
  title: string; image: string;
  data: {
    league: string;
    timer: { day: string; start: number; end: number };
    teams: { home: JogoTeam; away: JogoTeam };
  };
  players: string[];
}

interface EpgProgram {
  title: string;
  description?: string | null;
  startMs: number;
  stopMs: number;
  progress: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  'Esportes', 'Abertos', 'Noticias', 'Notícias', 'Filmes e Séries',
  'Variedades', 'Documentarios', 'Infantil', 'Portugal', 'A Casa do Patrão',
  'Música', 'Entretenimento',
];

const CATEGORY_META: Record<string, { accent: string; icon: string }> = {
  Esportes:           { accent: 'text-green-400',  icon: '⚽' },
  Noticias:           { accent: 'text-blue-400',   icon: '📰' },
  Notícias:           { accent: 'text-blue-400',   icon: '📰' },
  'Filmes e Séries':  { accent: 'text-red-400',    icon: '🎬' },
  Infantil:           { accent: 'text-yellow-400', icon: '🧒' },
  Documentarios:      { accent: 'text-teal-400',   icon: '🔭' },
  Variedades:         { accent: 'text-indigo-400', icon: '🎭' },
  Abertos:            { accent: 'text-orange-400', icon: '📡' },
  Portugal:           { accent: 'text-rose-400',   icon: '🇵🇹' },
  'A Casa do Patrão': { accent: 'text-purple-400', icon: '🏠' },
  Música:             { accent: 'text-pink-400',   icon: '🎵' },
  Entretenimento:     { accent: 'text-violet-400', icon: '🎬' },
};

function getCatMeta(cat?: string) {
  if (!cat) return { accent: 'text-gray-400', icon: '📡' };
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { accent: 'text-gray-400', icon: '📡' };
}

const getName  = (ch: Channel) => ch.nome  || ch.name  || 'Canal';
const getImage = (ch: Channel) => ch.imagem || ch.image || '';
const getCat   = (ch: Channel) => ch.categoria || ch.category || '';
const normStr  = (s: string)   => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function buildChannelUrl(ch: Channel): string {
  if (ch.url) {
    let u = ch.url;
    if (!u.includes('autoplay=')) u += (u.includes('?') ? '&' : '?') + 'autoplay=1';
    return u;
  }
  return `https://ww2.embedtv.lat/${ch.id}?autoplay=1`;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtTimeLeft(stopMs: number): string {
  const mins = Math.max(0, Math.round((stopMs - Date.now()) / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60); const m = mins % 60;
    return m > 0 ? `${h}h ${m}min restantes` : `${h}h restantes`;
  }
  return `${mins}min restantes`;
}

// ─── EPG fuzzy matching ─────────────────────────────────────────────────────────
function findEpg(ch: Channel, epgMap: Record<string, EpgProgram>): EpgProgram | null {
  if (epgMap[ch.id]) return epgMap[ch.id];
  // Try normalized name match
  const chNorm = normStr(getName(ch));
  if (chNorm.length < 3) return null;
  for (const key of Object.keys(epgMap)) {
    const k = normStr(key);
    if (k.length < 3) continue;
    const minLen = Math.min(chNorm.length, k.length, 6);
    if (k.startsWith(chNorm.slice(0, minLen)) || chNorm.startsWith(k.slice(0, minLen))) {
      return epgMap[key];
    }
  }
  return null;
}

// ─── EPG hooks ─────────────────────────────────────────────────────────────────
function useEpg(channelId: string) {
  const [data, setData] = useState<{ current: EpgProgram | null } | null>(null);
  useEffect(() => {
    if (!channelId) return;
    const ctrl = new AbortController();
    fetch(`/api/epg/channel?id=${encodeURIComponent(channelId)}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [channelId]);
  return data?.current || null;
}

function useEpgSchedule(channelId: string, enabled: boolean) {
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!channelId || !enabled) return;
    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/epg/schedule?id=${encodeURIComponent(channelId)}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { programs: [] })
      .then(d => { setPrograms(Array.isArray(d.programs) ? d.programs : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [channelId, enabled]);
  return { programs, loading };
}

// ─── NetPlay logo SVG ───────────────────────────────────────────────────────────
function NetPlayLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: size * 0.2 }}>
      <rect width="180" height="180" rx="36" fill="#FF3C00"/>
      <text x="90" y="130" textAnchor="middle" fill="white" fontSize="100" fontWeight="900" fontFamily="Arial,sans-serif">N</text>
    </svg>
  );
}

// ─── EPG info modal with full schedule ────────────────────────────────────────
function EpgInfoModal({
  channel, epg, onClose, onPlay,
}: {
  channel: Channel; epg: EpgProgram | null; onClose: () => void; onPlay: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(channel);
  const pct = epg ? Math.min(100, Math.max(0, epg.progress)) : 0;
  const { programs, loading: schedLoading } = useEpgSchedule(channel.id, true);
  const now = Date.now();

  const upcoming = programs.filter(p => p.stopMs > now).slice(0, 20);
  const passed   = programs.filter(p => p.stopMs <= now).slice(-5);
  const allShown = [...passed, ...upcoming];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[8000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#141414] rounded-[2rem] border border-white/10 shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#141414] px-5 pt-5 pb-4 flex flex-col items-center gap-3 shrink-0">
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X size={14} />
          </button>
          {/* App logo + channel logo */}
          <div className="flex items-center gap-3">
            <NetPlayLogo size={32} />
            <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
              {img && !imgErr ? (
                <img src={img} alt={getName(channel)} className="w-12 h-12 object-contain" onError={() => setImgErr(true)} />
              ) : (
                <Radio size={24} className="text-gray-600" />
              )}
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
              {getCat(channel) || 'Canal de TV'}
            </p>
            <h2 className="text-white text-lg font-black italic uppercase tracking-tighter">{getName(channel)}</h2>
          </div>
          <div className="flex items-center gap-2 bg-[#e8172c]/10 border border-[#e8172c]/20 rounded-xl px-3 py-1.5 w-full justify-center">
            <span className="w-2 h-2 bg-[#e8172c] rounded-full animate-pulse shrink-0" />
            <span className="text-[10px] font-black text-[#e8172c] uppercase tracking-widest">Ao Vivo • 24 horas</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* Current program */}
          {epg ? (
            <div className="space-y-2 bg-white/4 rounded-xl p-3 border border-[#e8172c]/20">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#e8172c] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />Agora
                </span>
                <span className="text-[9px] text-gray-600 font-mono">{fmtTime(epg.startMs)} – {fmtTime(epg.stopMs)}</span>
              </div>
              <p className="text-white text-sm font-bold">{epg.title}</p>
              {epg.description && (
                <p className="text-gray-400 text-xs leading-relaxed">{epg.description}</p>
              )}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#e8172c] rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-gray-600">{fmtTimeLeft(epg.stopMs)}</span>
                <span className="text-[8px] text-gray-600 font-mono">{fmtTime(epg.startMs)} → {fmtTime(epg.stopMs)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-gray-600 text-xs">Programação não disponível no momento</div>
          )}

          {/* Full schedule */}
          {(schedLoading || allShown.length > 0) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={12} className="text-gray-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {schedLoading ? 'Carregando programação...' : 'Programação do dia'}
                </span>
              </div>
              {schedLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
                ))
              ) : allShown.map((p, i) => {
                const isCurrent = now >= p.startMs && now < p.stopMs;
                const isPast    = now >= p.stopMs;
                return (
                  <div key={i}
                    className={`flex items-start gap-3 px-3 py-2 rounded-xl border ${
                      isCurrent
                        ? 'bg-[#e8172c]/10 border-[#e8172c]/30'
                        : isPast
                          ? 'bg-white/2 border-white/4 opacity-50'
                          : 'bg-white/4 border-white/6'
                    }`}
                  >
                    <div className="shrink-0 pt-0.5">
                      <p className={`text-[9px] font-mono font-black ${isCurrent ? 'text-[#e8172c]' : isPast ? 'text-gray-700' : 'text-gray-500'}`}>
                        {p.startMs > 0 ? fmtTime(p.startMs) : '--:--'}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-white' : isPast ? 'text-gray-700' : 'text-gray-300'}`}>
                        {p.title}
                      </p>
                      {isCurrent && p.description && (
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="shrink-0 w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 p-5 pt-0 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest">
            Fechar
          </button>
          <button
            onClick={() => { onPlay(); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-[#e8172c] hover:bg-[#c01020] text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Play size={13} fill="currentColor" />
            Assistir
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Channel row with horizontal program scroll ────────────────────────────────
function ChannelRow({
  ch, epg, onPlay, onInfo,
}: {
  ch: Channel; epg?: EpgProgram | null; onPlay: () => void; onInfo: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const pct = epg ? Math.min(100, Math.max(0, epg.progress)) : 0;

  return (
    <div className="flex items-center gap-0 pr-2 hover:bg-white/3 transition-colors group">
      <div className="w-5 flex-none flex items-center justify-center">
        <Lock size={7} className="text-amber-500/40" />
      </div>

      {/* Logo — tapping plays */}
      <button
        onClick={onPlay}
        className="shrink-0 w-[72px] h-[52px] flex items-center justify-center rounded-lg bg-[#1c1c28] border border-white/6 overflow-hidden mx-1.5 my-1"
      >
        {img && !imgErr ? (
          <img src={img} alt={getName(ch)} className="w-12 h-12 object-contain" onError={() => setImgErr(true)} />
        ) : (
          <Radio size={16} className="text-gray-700" />
        )}
      </button>

      {/* Program info — tapping opens info modal */}
      <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none flex items-center gap-2 py-2">
        <button onClick={onInfo} className="shrink-0 flex-1 min-w-[140px] max-w-[220px] text-left">
          {epg ? (
            <>
              <p className="text-[10px] font-black text-white mb-0.5">{fmtTimeLeft(epg.stopMs)}</p>
              <p className="text-[12px] font-semibold text-gray-200 truncate leading-tight">{epg.title}</p>
              <div className="mt-1.5 w-full h-[3px] bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#e8172c] rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <p className="text-[11px] text-gray-600 truncate">{getName(ch)}</p>
          )}
        </button>

        {epg && <div className="shrink-0 w-px h-8 bg-white/8" />}

        {/* Next time slot placeholder */}
        {epg && (
          <button onClick={onInfo} className="shrink-0 text-left min-w-[70px]">
            <p className="text-[11px] font-bold text-gray-400">{fmtTime(epg.stopMs)}</p>
            <p className="text-[9px] text-gray-600 truncate max-w-[80px]">{getName(ch)}</p>
          </button>
        )}
      </div>

      <button
        onClick={onPlay}
        className="shrink-0 w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-1"
      >
        <Play size={11} className="text-white" fill="currentColor" />
      </button>
    </div>
  );
}

// ─── Jogo card ─────────────────────────────────────────────────────────────────
function JogoCard({ jogo, onPlay }: { jogo: Jogo; onPlay: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const [homeErr, setHomeErr] = useState(false);
  const [awayErr, setAwayErr] = useState(false);
  const isLive = Date.now() >= jogo.data.timer.start * 1000 && Date.now() <= jogo.data.timer.end * 1000;

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onPlay}
      className="relative shrink-0 w-44 cursor-pointer group">
      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#1a1a2e] relative">
        {jogo.image && !imgErr ? (
          <img src={jogo.image} alt={jogo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center gap-3 p-3">
            {!homeErr && jogo.data.teams.home.image
              ? <img src={jogo.data.teams.home.image} alt="" className="w-12 h-12 object-contain" onError={() => setHomeErr(true)} />
              : <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">{jogo.data.teams.home.name.slice(0, 2).toUpperCase()}</div>}
            <span className="text-white font-black">×</span>
            {!awayErr && jogo.data.teams.away.image
              ? <img src={jogo.data.teams.away.image} alt="" className="w-12 h-12 object-contain" onError={() => setAwayErr(true)} />
              : <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">{jogo.data.teams.away.name.slice(0, 2).toUpperCase()}</div>}
          </div>
        )}
        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#0f79af] px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />AO VIVO
          </div>
        )}
        {!isLive && (
          <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-gray-300 uppercase">
            {fmtTime(jogo.data.timer.start * 1000)}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <p className="text-white text-[10px] font-bold truncate">{jogo.title}</p>
          <p className="text-gray-400 text-[8px] truncate">{jogo.data.league}</p>
        </div>
        <div className="absolute bottom-1 left-2 w-3.5 h-3.5 rounded-full bg-amber-500/80 flex items-center justify-center">
          <Lock size={7} className="text-black" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sidebar channel item ──────────────────────────────────────────────────────
function SidebarChannelItem({ ch, active, onSelect }: { ch: Channel; active: boolean; onSelect: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const cat = getCat(ch);
  return (
    <button onClick={onSelect}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all ${active ? 'bg-[#e8172c]/20 border border-[#e8172c]/30' : 'hover:bg-white/5 border border-transparent'}`}>
      <div className="w-9 h-9 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {img && !imgErr
          ? <img src={img} alt="" className="w-7 h-7 object-contain" onError={() => setImgErr(true)} />
          : <Radio size={13} className="text-gray-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-gray-300'}`}>{getName(ch)}</p>
        {cat && <p className={`text-[9px] uppercase tracking-widest truncate ${getCatMeta(cat).accent} opacity-60`}>{cat}</p>}
      </div>
      {active && <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse shrink-0" />}
    </button>
  );
}

// ─── Channel player (iframe + controls in same container = controls visible in landscape) ─
function ChannelPlayerView({
  channel, allChannels, onPiP, onSwitch,
}: {
  channel: Channel;
  allChannels: Channel[];
  onPiP: (ch: Channel) => void;
  onSwitch: (ch: Channel) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);       // bottom info panel
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAdBlockOff, setShowAdBlockOff] = useState(false); // ad-block toggle
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarCategory, setSidebarCategory] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFS, setIsFS] = useState(false);

  const current = useEpg(channel.id);
  const pct = current ? Math.min(100, Math.max(0, current.progress)) : 0;

  // Ad blocker: sandbox without allow-popups blocks ads/redirects.
  // User can toggle this off for channels that need popups to load.
  const iframeSandbox = showAdBlockOff
    ? undefined
    : 'allow-scripts allow-same-origin allow-presentation allow-forms';

  const currentIdx = useMemo(
    () => allChannels.findIndex(ch => ch.id === channel.id),
    [allChannels, channel.id]
  );

  const goNext = useCallback(() => {
    const idx = (currentIdx + 1) % allChannels.length;
    onSwitch(allChannels[idx]);
  }, [currentIdx, allChannels, onSwitch]);

  const goPrev = useCallback(() => {
    const idx = (currentIdx - 1 + allChannels.length) % allChannels.length;
    onSwitch(allChannels[idx]);
  }, [currentIdx, allChannels, onSwitch]);

  const flashControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setShowControls(false); setShowInfo(false); }, 5000);
  }, []);

  // Handle tap on the transparent overlay above the iframe
  const handleTap = useCallback(() => {
    if (!showControls) {
      // First tap: show controls + info
      setShowControls(true);
      setShowInfo(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => { setShowControls(false); setShowInfo(false); }, 5000);
    } else {
      // Second tap: hide everything
      setShowControls(false);
      setShowInfo(false);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    }
  }, [showControls]);

  useEffect(() => {
    flashControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [channel.id]);

  // Fullscreen on the container so controls survive landscape
  const requestFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
    } catch {}
    try {
      if (screen.orientation && (screen.orientation as any).lock)
        await (screen.orientation as any).lock('landscape').catch(() => {});
    } catch {}
  }, []);

  const exitFullscreen = useCallback(() => {
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
  }, []);

  useEffect(() => {
    const onChange = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Hardware back → PiP
  useEffect(() => {
    window.history.pushState({ channelPlayer: true }, '');
    const onPop = () => onPiP(channel);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [channel, onPiP]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') { e.preventDefault(); goPrev(); }
      if (e.key === 'l' || e.key === 'L') setShowSidebar(v => !v);
      if (e.key === 'Escape') { if (showSidebar) setShowSidebar(false); else onPiP(channel); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, showSidebar, channel, onPiP]);

  const searchLower = sidebarSearch.toLowerCase();
  const filteredChannels = useMemo(() =>
    allChannels.filter(ch => {
      const matchSearch = !sidebarSearch || getName(ch).toLowerCase().includes(searchLower);
      const matchCat = !sidebarCategory || getCat(ch) === sidebarCategory;
      return matchSearch && matchCat;
    })
  , [allChannels, sidebarSearch, sidebarCategory, searchLower]);

  const sidebarCategories = useMemo(() =>
    Array.from(new Set(allChannels.map(getCat).filter(Boolean))).sort()
  , [allChannels]);

  const src = buildChannelUrl(channel);

  return (
    <div ref={containerRef} className="fixed inset-0 z-[3000] bg-black">

      {/* Iframe — fills container */}
      <iframe
        key={src}
        src={src}
        className="absolute inset-0 w-full h-full border-0"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        {...(iframeSandbox ? { sandbox: iframeSandbox } : {})}
      />

      {/*
        ★ TAP CAPTURE OVERLAY — sits above the iframe at z-5.
        This intercepts ALL taps so they don't pass through to the iframe
        (which would pause the native player). When tapped, shows info panel.
        While controls are visible this overlay is interactive;
        when controls hide we restore pointer-events so iframe is fully interactive.
      */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 5, cursor: showControls ? 'default' : 'pointer' }}
        onClick={handleTap}
        // Only block pointer events when controls are NOT shown — when controls
        // are shown the buttons on top (z-10) handle their own clicks.
        // We keep pointer-events active always so the user CAN tap to show info.
      />

      {/* Controls — z-10 above the tap overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 10 }}
          >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/75 to-transparent pt-2 pb-10 px-3 flex items-center gap-2 pointer-events-auto">
              {/* Back → PiP */}
              <button onClick={() => onPiP(channel)}
                className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all">
                <ArrowLeft size={16} />
              </button>

              {/* NetPlay logo + channel logo + name */}
              <div className="flex-1 flex items-center gap-2 min-w-0 ml-1">
                <NetPlayLogo size={22} />
                {getImage(channel) && (
                  <img src={getImage(channel)} alt="" className="w-6 h-6 rounded-md object-contain bg-black/40 p-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-white text-sm font-black truncate leading-none">{getName(channel)}</p>
                  {current && <p className="text-gray-400 text-[10px] truncate">{current.title}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-[#e8172c] uppercase">Ao Vivo</span>
                </div>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Ad blocker toggle */}
                <button
                  onClick={() => setShowAdBlockOff(v => !v)}
                  title={showAdBlockOff ? 'Bloqueio de anúncios DESATIVADO' : 'Bloqueio de anúncios ATIVO'}
                  className={`w-9 h-9 rounded-xl backdrop-blur-xl border flex items-center justify-center transition-all ${
                    showAdBlockOff ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-black/60 border-white/20 text-green-400 hover:bg-white/10'
                  }`}
                >
                  {showAdBlockOff ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                </button>

                <button onClick={isFS ? exitFullscreen : requestFullscreen}
                  className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all">
                  {isFS ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>

                <button
                  onClick={() => setShowSidebar(v => !v)}
                  className={`w-9 h-9 rounded-xl backdrop-blur-xl border flex items-center justify-center transition-all ${showSidebar ? 'bg-[#e8172c]/40 border-[#e8172c]/60 text-white' : 'bg-black/60 border-white/20 text-white hover:bg-white/10'}`}>
                  <List size={15} />
                </button>
              </div>
            </div>

            {/* Prev/Next channel buttons */}
            <button onClick={e => { e.stopPropagation(); goPrev(); }}
              className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <SkipBack size={16} />
            </button>
            <button onClick={e => { e.stopPropagation(); goNext(); }}
              className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <SkipForward size={16} />
            </button>

            {/* Bottom EPG info panel (shows on tap) */}
            <AnimatePresence>
              {showInfo && current && (
                <motion.div
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-12 pb-3 px-4"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="bg-[#111]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-3 shadow-2xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse shrink-0" />
                      <span className="text-[9px] font-black text-[#e8172c] uppercase tracking-widest">Agora</span>
                      <span className="text-[9px] text-gray-600 font-mono ml-auto">{fmtTime(current.startMs)} – {fmtTime(current.stopMs)}</span>
                    </div>
                    <p className="text-white text-sm font-bold mb-1">{current.title}</p>
                    {current.description && (
                      <p className="text-gray-400 text-[11px] leading-relaxed line-clamp-2 mb-2">{current.description}</p>
                    )}
                    <div className="w-full h-[3px] bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-[#e8172c] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-600 mt-1">{fmtTimeLeft(current.stopMs)}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact EPG bar (always at bottom even when no showInfo) */}
            {!showInfo && current && (
              <div className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-2 px-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{current.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-[3px] bg-white/15 rounded-full overflow-hidden">
                        <div className="h-full bg-[#e8172c] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-400 shrink-0 font-mono">{fmtTime(current.startMs)} – {fmtTime(current.stopMs)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[8px] text-white/15 font-mono mt-1 select-none">toque para info • ← → canal • L lista</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar channel list */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-[300px] bg-[#0d0d0d]/95 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl"
            style={{ zIndex: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-none p-3 border-b border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <NetPlayLogo size={18} />
                <span className="text-white text-sm font-black italic uppercase tracking-tighter flex-1">Canais</span>
                <button onClick={() => setShowSidebar(false)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-500 hover:text-white">
                  <X size={13} />
                </button>
              </div>
              <div className="relative mb-2">
                <input type="text" value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)}
                  placeholder="Pesquisar canal..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/20" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                <button onClick={() => setSidebarCategory(null)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${!sidebarCategory ? 'bg-white/15 text-white' : 'text-gray-600 hover:text-gray-300'}`}>
                  Todos
                </button>
                {sidebarCategories.map(cat => {
                  const m = getCatMeta(cat);
                  return (
                    <button key={cat} onClick={() => setSidebarCategory(sidebarCategory === cat ? null : cat)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${sidebarCategory === cat ? `bg-white/10 ${m.accent}` : 'text-gray-600 hover:text-gray-300'}`}>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current channel */}
            <div className="flex-none px-3 py-2 border-b border-white/5 bg-red-950/20 flex items-center gap-2">
              {getImage(channel) && <img src={getImage(channel)} alt="" className="w-7 h-7 object-contain rounded-lg bg-black/40 p-0.5 shrink-0" />}
              <span className="text-white text-xs font-bold flex-1 truncate">{getName(channel)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-[#e8172c] uppercase">Live</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1 px-1">
              {filteredChannels.map(ch => (
                <SidebarChannelItem key={ch.id} ch={ch} active={ch.id === channel.id}
                  onSelect={() => { if (ch.id !== channel.id) { onSwitch(ch); setShowSidebar(false); } }} />
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PiP mini player — continues playing, never pauses ────────────────────────
function PiPPlayer({
  channel, onRestore, onClose,
}: {
  channel: Channel; onRestore: () => void; onClose: () => void;
}) {
  const src = buildChannelUrl(channel);
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(channel);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      drag dragConstraints={{ left: -300, right: 0, top: -400, bottom: 0 }}
      className="fixed bottom-20 right-3 z-[7000] w-52 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black cursor-grab active:cursor-grabbing"
    >
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        {/* Actual iframe — keeps playing, never paused */}
        <iframe
          src={src}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        />
        {/* Click overlay to restore without interacting with iframe */}
        <div className="absolute inset-0 cursor-pointer" onClick={onRestore} style={{ zIndex: 2 }} />
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 border border-white/30 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          style={{ zIndex: 3 }}
        >
          <X size={9} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#141414]">
        <NetPlayLogo size={14} />
        {img && !imgErr ? (
          <img src={img} alt="" className="w-4 h-4 object-contain" onError={() => setImgErr(true)} />
        ) : null}
        <span className="text-white text-[9px] font-black truncate flex-1">{getName(channel)}</span>
        <button onClick={onRestore} className="shrink-0">
          <Maximize2 size={10} className="text-gray-400" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const CanaisTVPage: React.FC = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [pipChannel, setPipChannel] = useState<Channel | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [rawEpgMap, setRawEpgMap] = useState<Record<string, EpgProgram>>({});
  const [infoTarget, setInfoTarget] = useState<Channel | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/betterflix/canais');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      const rawChannels: any[] = data.channels || (Array.isArray(data) ? data : []);
      const rawCategories: { id: number; name: string }[] = data.categories || [];
      const catMap: Record<number, string> = {};
      for (const c of rawCategories) catMap[c.id] = c.name;
      const normalized: Channel[] = rawChannels.map((ch: any) => ({
        ...ch,
        id: String(ch.id),
        nome: ch.nome || ch.name || '',
        imagem: ch.imagem || ch.image || '',
        categoria: (ch.categories || []).filter((cid: number) => cid !== 0)
          .map((cid: number) => catMap[cid]).filter(Boolean)[0]
          || ch.categoria || ch.category || '',
      }));
      setChannels(normalized);
    } catch (e: any) {
      setError(e.message || 'Não foi possível carregar os canais.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJogos = useCallback(async () => {
    try {
      const res = await fetch('/api/betterflix/jogos');
      if (!res.ok) return;
      const data = await res.json();
      setJogos(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchChannels(); fetchJogos(); }, [fetchChannels, fetchJogos]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/epg/all')
        .then(r => r.ok ? r.json() : {})
        .then(d => { if (!cancelled) setRawEpgMap(d || {}); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Build a richer EPG lookup: channel ID → EPG, using fuzzy name matching
  const epgMap = useMemo(() => {
    const result: Record<string, EpgProgram> = { ...rawEpgMap };
    for (const ch of channels) {
      if (result[ch.id]) continue;
      const found = findEpg(ch, rawEpgMap);
      if (found) result[ch.id] = found;
    }
    return result;
  }, [channels, rawEpgMap]);

  const categories = useMemo(() =>
    Array.from(new Set(channels.map(c => c.categoria || c.category).filter(Boolean) as string[]))
  , [channels]);

  const sortedCategories = useMemo(() => [
    ...CATEGORY_ORDER.filter(c => categories.includes(c)),
    ...categories.filter(c => !CATEGORY_ORDER.includes(c)),
  ], [categories]);

  const searchLower = search.toLowerCase();

  const filteredChannels = useMemo(() =>
    channels.filter(ch => {
      const n = getName(ch).toLowerCase();
      const c = getCat(ch).toLowerCase();
      const matchSearch = !search || n.includes(searchLower) || c.includes(searchLower);
      const matchCat = !activeCategory || getCat(ch) === activeCategory;
      return matchSearch && matchCat;
    })
  , [channels, search, searchLower, activeCategory]);

  const channelsByCategory = useCallback((cat: string) =>
    channels.filter(ch => getCat(ch) === cat && (!search || getName(ch).toLowerCase().includes(searchLower)))
  , [channels, search, searchLower]);

  const findChannelForJogo = useCallback((jogo: Jogo): Channel | null => {
    if (!jogo.players?.length) return null;
    const channelId = jogo.players[0].split('/').pop() || '';
    return channels.find(ch => ch.id === channelId || ch.url === jogo.players[0]) || null;
  }, [channels]);

  const handlePiP = useCallback((ch: Channel) => {
    setPlayingChannel(null);
    setPipChannel(ch);
  }, []);

  const handleRestore = useCallback(() => {
    if (pipChannel) { setPlayingChannel(pipChannel); setPipChannel(null); }
  }, [pipChannel]);

  // Full player view
  if (playingChannel) {
    return (
      <ChannelPlayerView
        channel={playingChannel}
        allChannels={channels}
        onPiP={handlePiP}
        onSwitch={ch => setPlayingChannel(ch)}
      />
    );
  }

  const visibleCategories = activeCategory ? [activeCategory] : sortedCategories;

  return (
    <div className="min-h-screen bg-[#111] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#111]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <NetPlayLogo size={36} />
            <div>
              <h1 className="text-base font-black text-white leading-none">Canais ao Vivo</h1>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {loading ? 'Carregando...' : `${channels.length} canais disponíveis`}
              </p>
            </div>
          </div>
          <button onClick={() => { fetchChannels(); fetchJogos(); }} disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center shrink-0 disabled:opacity-40">
            <RefreshCcw size={15} className={loading ? 'animate-spin text-[#e8172c]' : 'text-gray-400'} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar canal..."
              className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {!search && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            <button onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                !activeCategory ? 'bg-white/15 border-white/20 text-white' : 'bg-white/5 border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300'
              }`}>Todos</button>
            {sortedCategories.map(cat => {
              const m = getCatMeta(cat);
              const isActive = activeCategory === cat;
              return (
                <button key={cat} onClick={() => setActiveCategory(isActive ? null : cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    isActive ? `bg-white/10 border-white/20 ${m.accent}` : 'bg-white/5 border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300'
                  }`}>
                  <span>{m.icon}</span><span>{cat}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
          <Radio size={20} className="text-red-500 shrink-0" />
          <div className="flex-1 text-red-400 text-sm">{error}</div>
          <button onClick={fetchChannels} className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300">Tentar novamente</button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="px-4 pt-5 space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-2">
              <div className="w-[72px] h-[52px] bg-white/5 rounded-lg animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-20 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-40 bg-white/5 rounded animate-pulse" />
                <div className="h-[3px] w-full bg-white/5 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Live sports section */}
          {jogos.length > 0 && !search && !activeCategory && (
            <div className="pt-5 pb-3">
              <h2 className="text-sm font-black text-white px-4 mb-3 flex items-center gap-2">
                <NetPlayLogo size={16} />
                Assista com uma assinatura
              </h2>
              <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                {jogos.map((jogo, i) => {
                  const ch = findChannelForJogo(jogo);
                  return (
                    <JogoCard key={i} jogo={jogo} onPlay={() => {
                      const target = ch || {
                        id: jogo.players?.[0]?.split('/').pop() || String(i),
                        name: jogo.title,
                        url: jogo.players?.[0],
                        image: jogo.data.teams.home.image,
                        categoria: 'Esportes',
                      };
                      setPlayingChannel(target);
                    }} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Channel list — flat, all visible, no collapsible folders */}
          {search ? (
            <div className="px-2 pt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-2 mb-2">
                {filteredChannels.length} resultado{filteredChannels.length !== 1 ? 's' : ''} para "{search}"
              </p>
              {filteredChannels.map(ch => (
                <ChannelRow key={ch.id} ch={ch} epg={epgMap[ch.id] || null}
                  onPlay={() => setPlayingChannel(ch)} onInfo={() => setInfoTarget(ch)} />
              ))}
            </div>
          ) : (
            <div className="pt-2">
              {visibleCategories.map(cat => {
                const chs = channelsByCategory(cat);
                if (chs.length === 0) return null;
                const meta = getCatMeta(cat);
                return (
                  <div key={cat}>
                    {/* Category divider — NOT collapsible */}
                    <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
                      <span className="text-base">{meta.icon}</span>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${meta.accent}`}>{cat}</span>
                      <span className="text-[9px] text-gray-700 ml-1">({chs.length})</span>
                      <div className="flex-1 h-px bg-white/5 ml-2" />
                    </div>
                    {chs.map(ch => (
                      <ChannelRow key={ch.id} ch={ch} epg={epgMap[ch.id] || null}
                        onPlay={() => setPlayingChannel(ch)} onInfo={() => setInfoTarget(ch)} />
                    ))}
                  </div>
                );
              })}

              {/* Uncategorized */}
              {!activeCategory && (() => {
                const uncat = channels.filter(ch => !getCat(ch) && (!search || getName(ch).toLowerCase().includes(searchLower)));
                if (uncat.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
                      <span className="text-base">📡</span>
                      <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Outros</span>
                      <div className="flex-1 h-px bg-white/5 ml-2" />
                    </div>
                    {uncat.map(ch => (
                      <ChannelRow key={ch.id} ch={ch} epg={epgMap[ch.id] || null}
                        onPlay={() => setPlayingChannel(ch)} onInfo={() => setInfoTarget(ch)} />
                    ))}
                  </div>
                );
              })()}

              {channels.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                  <Radio size={60} className="text-gray-800 mb-4" />
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Nenhum canal disponível</h3>
                  <p className="text-gray-600 text-sm">Verifique sua conexão e tente novamente.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* EPG info modal */}
      <AnimatePresence>
        {infoTarget && (
          <EpgInfoModal
            channel={infoTarget}
            epg={epgMap[infoTarget.id] || null}
            onClose={() => setInfoTarget(null)}
            onPlay={() => { setPlayingChannel(infoTarget); setInfoTarget(null); }}
          />
        )}
      </AnimatePresence>

      {/* PiP mini player — always rendering so video keeps playing */}
      <AnimatePresence>
        {pipChannel && (
          <PiPPlayer
            channel={pipChannel}
            onRestore={handleRestore}
            onClose={() => setPipChannel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CanaisTVPage;
