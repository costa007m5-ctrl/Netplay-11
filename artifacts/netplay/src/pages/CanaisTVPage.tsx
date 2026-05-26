import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio, Search, X, RefreshCcw, Tv2, ChevronLeft, ChevronRight,
  Play, List, ArrowLeft, Info, Zap, Grid3X3, ChevronDown, ChevronUp,
  Clock, SkipBack, SkipForward, CalendarDays, Loader2, Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';

interface Channel {
  id: string;
  name?: string;
  nome?: string;
  image?: string;
  imagem?: string;
  preview?: string;
  url?: string;
  categories?: number[];
  categoria?: string;
  category?: string;
}

interface JogoTeam { name: string; image: string; }
interface Jogo {
  title: string;
  image: string;
  data: {
    league: string;
    timer: { day: string; start: number; end: number };
    teams: { home: JogoTeam; away: JogoTeam };
  };
  players: string[];
}

const CATEGORY_ORDER = [
  'Esportes', 'Abertos', 'Noticias', 'Notícias', 'Filmes e Séries', 'Variedades',
  'Documentarios', 'Infantil', 'Portugal', 'A Casa do Patrão',
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

const getName  = (ch: Channel) => ch.nome  || ch.name     || 'Canal';
const getImage = (ch: Channel) => ch.imagem || ch.image   || '';
const getCat   = (ch: Channel) => ch.categoria || ch.category || '';

function buildChannelUrl(ch: Channel): string {
  if (ch.url) {
    let u = ch.url;
    if (!u.includes('autoplay=')) u += (u.includes('?') ? '&' : '?') + 'autoplay=1';
    return u;
  }
  return `https://ww2.embedtv.lat/${ch.id}`;
}

interface EpgProgram {
  title: string;
  description?: string | null;
  startMs: number;
  stopMs: number;
  progress: number;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtTimeLeft(stopMs: number): string {
  const minsLeft = Math.max(0, Math.round((stopMs - Date.now()) / 60000));
  if (minsLeft >= 60) {
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return m > 0 ? `${h}h ${m}min restantes` : `${h}h restantes`;
  }
  return `${minsLeft}min restantes`;
}

// ── Live sports card (Prime Video style) ──────────────────────────────────────
function JogoCard({ jogo, onPlay }: { jogo: Jogo; onPlay: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const [homeErr, setHomeErr] = useState(false);
  const [awayErr, setAwayErr] = useState(false);
  const isLive = Date.now() >= jogo.data.timer.start * 1000 && Date.now() <= jogo.data.timer.end * 1000;

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onPlay}
      className="relative shrink-0 w-44 cursor-pointer group"
    >
      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#1a1a2e] relative">
        {jogo.image && !imgErr ? (
          <img
            src={jogo.image}
            alt={jogo.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center gap-3 p-2">
            {!homeErr && jogo.data.teams.home.image ? (
              <img src={jogo.data.teams.home.image} alt="" className="w-12 h-12 object-contain" onError={() => setHomeErr(true)} />
            ) : <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white">{jogo.data.teams.home.name.slice(0,2).toUpperCase()}</div>}
            <span className="text-white font-black text-sm">×</span>
            {!awayErr && jogo.data.teams.away.image ? (
              <img src={jogo.data.teams.away.image} alt="" className="w-12 h-12 object-contain" onError={() => setAwayErr(true)} />
            ) : <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white">{jogo.data.teams.away.name.slice(0,2).toUpperCase()}</div>}
          </div>
        )}
        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#0f79af] px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
            AO VIVO
          </div>
        )}
        {!isLive && (
          <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-black text-gray-300 uppercase tracking-widest">
            {fmtTime(jogo.data.timer.start * 1000)}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <p className="text-white text-[10px] font-bold truncate">{jogo.title}</p>
          <p className="text-gray-400 text-[8px] truncate">{jogo.data.league}</p>
        </div>
        <div className="absolute bottom-0 left-2 w-4 h-4 rounded-full bg-amber-500/80 flex items-center justify-center">
          <Lock size={8} className="text-black" />
        </div>
      </div>
    </motion.div>
  );
}

// ── Channel row — Prime Video style ──────────────────────────────────────────
function ChannelRow({
  ch,
  epg,
  onPlay,
}: {
  ch: Channel;
  epg?: EpgProgram | null;
  onPlay: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const pct = epg ? Math.min(100, Math.max(0, epg.progress)) : 0;

  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
      onClick={onPlay}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-xl transition-all group relative"
    >
      {/* Lock icon (subscription) */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-40">
        <Lock size={8} className="text-amber-400" />
      </div>

      {/* Channel logo */}
      <div className="shrink-0 w-[72px] h-[50px] rounded-lg bg-[#1a1a2e] border border-white/8 flex items-center justify-center overflow-hidden">
        {img && !imgErr ? (
          <img
            src={img}
            alt={getName(ch)}
            className="w-12 h-12 object-contain"
            onError={() => setImgErr(true)}
          />
        ) : (
          <Radio size={18} className="text-gray-700" />
        )}
      </div>

      {/* Program info */}
      <div className="flex-1 min-w-0">
        {epg ? (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-white text-[11px] font-black">{fmtTimeLeft(epg.stopMs)}</span>
            </div>
            <p className="text-[13px] font-semibold text-gray-200 truncate leading-tight mb-1.5">{epg.title}</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#e8172c] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] font-semibold text-gray-400 truncate mb-1">{getName(ch)}</p>
            <div className="w-full h-1 bg-white/8 rounded-full" />
          </>
        )}
      </div>

      {/* Next program time + title */}
      {epg && (
        <div className="shrink-0 text-right min-w-[70px] max-w-[90px]">
          <p className="text-[12px] font-bold text-gray-300">{fmtTime(epg.stopMs)}</p>
          <p className="text-[9px] text-gray-600 truncate">{getName(ch)}</p>
        </div>
      )}

      {/* Play button on hover */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <Play size={12} className="text-white" fill="currentColor" />
      </div>
    </motion.div>
  );
}

// ── Category section — Prime Video style ─────────────────────────────────────
function CategorySection({
  category,
  channels,
  epgMap,
  onPlay,
  defaultExpanded,
}: {
  category: string;
  channels: Channel[];
  epgMap: Record<string, EpgProgram>;
  onPlay: (ch: Channel) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
  const meta = getCatMeta(category);
  const visible = expanded ? channels : channels.slice(0, 4);

  return (
    <div className="mb-2">
      {/* Category header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/3 transition-all group"
      >
        <span className="text-base">{meta.icon}</span>
        <span className={`text-sm font-black uppercase tracking-tighter ${meta.accent}`}>{category}</span>
        <span className="text-[9px] text-gray-700 ml-1">({channels.length})</span>
        <div className="flex-1" />
        <ChevronDown
          size={14}
          className={`text-gray-600 group-hover:text-gray-400 transition-all ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Channel list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {channels.map(ch => (
              <ChannelRow
                key={ch.id}
                ch={ch}
                epg={epgMap[ch.id] || null}
                onPlay={() => onPlay(ch)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── EPG Panel (sidebar) ───────────────────────────────────────────────────────
function useEpg(channelId: string) {
  const [data, setData] = useState<{ current: EpgProgram | null; next: { title: string; startMs: number } | null } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    setData(null);
    const ctrl = new AbortController();
    fetch(`/api/epg/channel?id=${encodeURIComponent(channelId)}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [channelId]);

  return { data, loading };
}

// ── Strip inferior ─────────────────────────────────────────────────────────────
function StripItem({ ch, offset, onSwitch }: { ch: Channel; offset: number; onSwitch: (ch: Channel) => void }) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const isCurrent = offset === 0;

  return (
    <motion.button
      onClick={() => !isCurrent && onSwitch(ch)}
      whileHover={!isCurrent ? { scale: 1.08 } : {}}
      whileTap={!isCurrent ? { scale: 0.95 } : {}}
      className={`flex flex-col items-center gap-1.5 transition-all ${
        isCurrent ? 'opacity-100 scale-110 cursor-default' : 'opacity-50 hover:opacity-90 cursor-pointer'
      } ${Math.abs(offset) === 2 ? 'hidden sm:flex' : ''}`}
    >
      <div className={`relative w-14 h-14 rounded-xl border-2 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm ${
        isCurrent ? 'border-[#e8172c] shadow-[0_0_16px_rgba(232,23,44,0.5)]' : 'border-white/10'
      }`}>
        {img && !imgErr ? (
          <img src={img} alt={getName(ch)} className="w-10 h-10 object-contain" onError={() => setImgErr(true)} />
        ) : (
          <Radio size={18} className="text-gray-600" />
        )}
        {isCurrent && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-0.5 bg-[#e8172c]/80">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
          </div>
        )}
      </div>
      <span className={`text-[8px] font-bold max-w-[56px] truncate ${isCurrent ? 'text-white' : 'text-gray-500'}`}>
        {getName(ch)}
      </span>
    </motion.button>
  );
}

function BottomChannelStrip({
  channels, currentIdx, onSwitch, visible,
}: {
  channels: Channel[]; currentIdx: number; onSwitch: (ch: Channel) => void; visible: boolean;
}) {
  const len = channels.length;
  const strip = useMemo(() => [-2, -1, 0, 1, 2].map(offset => {
    const idx = ((currentIdx + offset) % len + len) % len;
    return { ch: channels[idx], offset };
  }), [channels, currentIdx, len]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="absolute bottom-0 left-0 right-0 z-[165] pointer-events-none"
        >
          <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-10 pb-4 px-4 pointer-events-auto">
            <div className="flex items-center justify-center gap-3">
              {strip.map(({ ch, offset }) => (
                <StripItem key={`${ch.id}-${offset}`} ch={ch} offset={offset} onSwitch={onSwitch} />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Now playing bar ───────────────────────────────────────────────────────────
function NowPlayingBar({ channelId, channelName, channelImg }: { channelId: string; channelName: string; channelImg: string }) {
  const { data } = useEpg(channelId);
  const current = data?.current;
  if (!current?.title) return null;

  const pct = Math.min(100, Math.max(0, current.progress));
  const minsLeft = Math.max(0, Math.round((current.stopMs - Date.now()) / 60000));

  return (
    <div className="pointer-events-none absolute bottom-20 left-4 right-4 sm:right-auto sm:w-[340px] z-[3150]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/75 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5 border-b border-white/5">
          {channelImg ? (
            <img src={channelImg} alt="" className="w-6 h-6 object-contain rounded-md bg-black/40 p-0.5 shrink-0" />
          ) : (
            <Radio size={12} className="text-gray-500 shrink-0" />
          )}
          <span className="text-white text-[10px] font-black truncate flex-1">{channelName}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-1 h-1 bg-[#e8172c] rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-[#e8172c] uppercase">Ao Vivo</span>
          </div>
        </div>
        <div className="px-3 pt-2 pb-2.5 space-y-2">
          <p className="text-white text-xs font-bold leading-snug line-clamp-1">{current.title}</p>
          <div className="space-y-1">
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#e8172c] rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-gray-600 font-mono tabular-nums">{fmtTime(current.startMs)}</span>
              <span className="text-[8px] text-gray-500">{minsLeft > 0 ? `${minsLeft} min restantes` : 'Encerrando'}</span>
              <span className="text-[8px] text-gray-600 font-mono tabular-nums">{fmtTime(current.stopMs)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Mini channel card for sidebar ────────────────────────────────────────────
function MiniChannelCard({ ch, active, onClick }: { ch: Channel; active?: boolean; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${
        active ? 'bg-[#e8172c]/20 border border-[#e8172c]/40' : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {img && !imgErr ? (
          <img src={img} alt={getName(ch)} className="w-8 h-8 object-contain" onError={() => setImgErr(true)} />
        ) : (
          <Radio size={14} className="text-gray-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
          {getName(ch)}
        </p>
        {getCat(ch) && (
          <p className={`text-[9px] font-bold uppercase tracking-widest truncate ${getCatMeta(getCat(ch)).accent} opacity-70`}>
            {getCat(ch)}
          </p>
        )}
      </div>
      {active && (
        <div className="shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
          <span className="text-[7px] font-black text-[#e8172c] uppercase">Ao Vivo</span>
        </div>
      )}
    </button>
  );
}

// ── EPG Panel sidebar ─────────────────────────────────────────────────────────
function EpgPanel({ channelId }: { channelId: string }) {
  const { data, loading } = useEpg(channelId);

  if (loading) {
    return (
      <div className="mx-3 my-3 bg-white/3 rounded-2xl p-3 border border-white/5 animate-pulse">
        <div className="h-2.5 w-24 bg-white/10 rounded mb-2" />
        <div className="h-4 w-40 bg-white/10 rounded mb-3" />
        <div className="h-1 w-full bg-white/10 rounded-full" />
      </div>
    );
  }

  if (!data?.current) return null;

  const { current } = data;
  const pct = Math.min(100, Math.max(0, current.progress));

  return (
    <div className="mx-3 my-3 bg-gradient-to-br from-[#1a1a2e]/80 to-[#12122a]/80 border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-white/5">
        <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse shrink-0" />
        <span className="text-[9px] font-black uppercase tracking-widest text-[#e8172c]">Ao Vivo Agora</span>
        <span className="ml-auto text-[8px] text-gray-500 font-mono">{fmtTime(current.startMs)} – {fmtTime(current.stopMs)}</span>
      </div>
      <div className="px-3 pt-2.5 pb-3 space-y-2.5">
        <p className="text-white text-[13px] font-bold leading-snug line-clamp-2">{current.title}</p>
        {current.description && (
          <p className="text-gray-500 text-[10px] leading-relaxed line-clamp-2">{current.description}</p>
        )}
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#e8172c] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-gray-600 font-mono">{pct}% assistido</span>
            <span className="text-[8px] text-gray-600">
              {Math.max(0, Math.round((current.stopMs - Date.now()) / 60000))} min restantes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Channel player view ───────────────────────────────────────────────────────
function ChannelPlayerView({
  channel, allChannels, onClose, onSwitch,
}: {
  channel: Channel; allChannels: Channel[]; onClose: () => void; onSwitch: (ch: Channel) => void;
}) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showStrip, setShowStrip] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarCategory, setSidebarCategory] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'canais' | 'programacao'>('canais');
  const stripTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIdx = useMemo(
    () => allChannels.findIndex(ch => String(ch.id) === String(channel.id)),
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

  const triggerStrip = useCallback(() => {
    setShowStrip(true);
    if (stripTimerRef.current) clearTimeout(stripTimerRef.current);
    stripTimerRef.current = setTimeout(() => setShowStrip(false), 3500);
  }, []);

  const handleNext = useCallback(() => { goNext(); triggerStrip(); }, [goNext, triggerStrip]);
  const handlePrev = useCallback(() => { goPrev(); triggerStrip(); }, [goPrev, triggerStrip]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); handleNext(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') { e.preventDefault(); handlePrev(); }
      if (e.key === 'l' || e.key === 'L') setShowSidebar(v => !v);
      if (e.key === 'Escape') { if (showSidebar) setShowSidebar(false); else onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNext, handlePrev, showSidebar, onClose]);

  useEffect(() => () => { if (stripTimerRef.current) clearTimeout(stripTimerRef.current); }, []);

  const fakeMovie = {
    id: Number(channel.id) || 0,
    title: getName(channel),
    backdrop_path: getImage(channel),
    poster_path: getImage(channel),
    overview: '',
    vote_average: 0,
    videoUrl: buildChannelUrl(channel),
    type: 'movie' as const,
  };

  const searchLower = sidebarSearch.toLowerCase();
  const filteredChannels = useMemo(() => allChannels.filter(ch => {
    const matchSearch = !sidebarSearch || getName(ch).toLowerCase().includes(searchLower);
    const matchCat = !sidebarCategory || getCat(ch) === sidebarCategory;
    return matchSearch && matchCat;
  }), [allChannels, sidebarSearch, sidebarCategory, searchLower]);

  const sidebarCategories = useMemo(() =>
    Array.from(new Set(allChannels.map(getCat).filter(Boolean))).sort()
  , [allChannels]);

  return (
    <>
      <VideoPlayer
        key={String(channel.id)}
        movie={fakeMovie}
        onClose={onClose}
        initialPlayerStyle="betterflix"
      />

      <div className={`fixed inset-0 z-[3100] pointer-events-none transition-all duration-300 ${showSidebar ? 'right-[320px]' : ''}`}>
        <button onClick={handlePrev} title="Canal anterior (←)" className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 hover:border-white/30 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm shadow-xl">
          <SkipBack size={16} />
        </button>
        <button onClick={handleNext} title="Próximo canal (→)" className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 hover:border-white/30 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm shadow-xl">
          <SkipForward size={16} />
        </button>

        <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2">
          <button onClick={handlePrev} className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all shadow-xl">
            <SkipBack size={13} />
          </button>
          <button onClick={handleNext} className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all shadow-xl">
            <SkipForward size={13} />
          </button>
          <button
            onClick={() => { setShowStrip(v => !v); if (stripTimerRef.current) clearTimeout(stripTimerRef.current); }}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl backdrop-blur-xl border transition-all shadow-xl ${showStrip ? 'bg-orange-600/40 border-orange-500/60 text-orange-300' : 'bg-black/70 border-white/20 text-white hover:bg-white/10'}`}
          >
            <Tv2 size={13} />
          </button>
          <button
            onClick={() => setShowSidebar(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl border transition-all shadow-xl ${showSidebar ? 'bg-[#e8172c]/40 border-[#e8172c]/60 text-red-300' : 'bg-black/70 border-white/20 text-white hover:bg-white/10'}`}
          >
            <List size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
              {showSidebar ? 'Fechar' : 'Canais'}
            </span>
          </button>
        </div>

        <AnimatePresence>
          {showStrip && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/75 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-2 pointer-events-none"
            >
              {getImage(channel) && (
                <img src={getImage(channel)} alt="" className="w-7 h-7 object-contain rounded-lg bg-black/40 p-0.5" />
              )}
              <div>
                <p className="text-white text-sm font-black leading-none">{getName(channel)}</p>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                  Canal {currentIdx + 1} de {allChannels.length}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-[#e8172c] uppercase">Ao Vivo</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <NowPlayingBar channelId={String(channel.id)} channelName={getName(channel)} channelImg={getImage(channel)} />

        <BottomChannelStrip
          channels={allChannels}
          currentIdx={currentIdx}
          onSwitch={ch => { onSwitch(ch); triggerStrip(); }}
          visible={showStrip}
        />

        <div className="absolute bottom-4 left-4 pointer-events-none">
          <p className="text-[9px] text-white/25 font-mono select-none">← → trocar canal • L lista</p>
        </div>
      </div>

      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[320px] bg-[#0d0d0d] border-l border-white/10 flex flex-col z-[3200] shadow-2xl"
          >
            <div className="flex-none p-4 border-b border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-[#e8172c] rounded-full animate-pulse" />
                <span className="text-white text-sm font-black italic uppercase tracking-tighter flex-1">Canais ao Vivo</span>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex gap-1 mb-3 bg-white/5 rounded-xl p-1">
                {(['canais', 'programacao'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSidebarTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      sidebarTab === tab ? 'bg-white/15 text-white' : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {tab === 'canais' ? '📺 Canais' : '📅 Programação'}
                  </button>
                ))}
              </div>
              {sidebarTab === 'canais' && (
                <>
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                    <input
                      type="text"
                      value={sidebarSearch}
                      onChange={e => setSidebarSearch(e.target.value)}
                      placeholder="Pesquisar canal..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-7 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                    />
                    {sidebarSearch && (
                      <button onClick={() => setSidebarSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  {!sidebarSearch && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      <button
                        onClick={() => setSidebarCategory(null)}
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${!sidebarCategory ? 'bg-white/15 text-white' : 'text-gray-600 hover:text-gray-400'}`}
                      >Todos</button>
                      {sidebarCategories.map(cat => {
                        const m = getCatMeta(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => setSidebarCategory(sidebarCategory === cat ? null : cat)}
                            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${sidebarCategory === cat ? `bg-white/10 ${m.accent}` : 'text-gray-600 hover:text-gray-400'}`}
                          >
                            <span>{m.icon}</span><span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex-none px-3 py-2 border-b border-white/5 bg-red-950/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#e8172c]/70 mb-1">Assistindo agora</p>
              <div className="flex items-center gap-2">
                {getImage(channel) && (
                  <img src={getImage(channel)} alt="" className="w-8 h-8 object-contain rounded-lg bg-black/40 p-1" />
                )}
                <span className="text-white text-xs font-bold truncate flex-1">{getName(channel)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-[#e8172c] uppercase">Live</span>
                </div>
              </div>
            </div>

            {sidebarTab === 'programacao' ? (
              <div className="flex-1 overflow-y-auto">
                <EpgPanel channelId={String(channel.id)} />
                <div className="px-4 py-4 text-center">
                  <p className="text-gray-700 text-[10px]">Programação em tempo real via EPG.</p>
                </div>
              </div>
            ) : (
              <>
                <EpgPanel channelId={String(channel.id)} />
                <div className="flex-1 overflow-y-auto py-2 px-1">
                  {filteredChannels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                      <Search size={20} className="text-gray-700" />
                      <p className="text-gray-600 text-xs">Nenhum canal encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredChannels.map(ch => (
                        <MiniChannelCard
                          key={ch.id}
                          ch={ch}
                          active={String(ch.id) === String(channel.id)}
                          onClick={() => {
                            if (String(ch.id) !== String(channel.id)) {
                              onSwitch(ch);
                              setShowSidebar(false);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-none px-4 py-3 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-700 text-[9px] font-mono">{filteredChannels.length} canal{filteredChannels.length !== 1 ? 'is' : ''}</p>
                    <div className="flex gap-2 text-[9px] text-gray-700">
                      <span>← →</span><span>trocar canal</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
const CanaisTVPage: React.FC = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [epgMap, setEpgMap] = useState<Record<string, EpgProgram>>({});

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError('');
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
        categoria: (ch.categories || [])
          .filter((cid: number) => cid !== 0)
          .map((cid: number) => catMap[cid])
          .filter(Boolean)[0] || ch.categoria || ch.category || '',
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
        .then(d => { if (!cancelled) setEpgMap(d || {}); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const categories = useMemo(() =>
    Array.from(new Set(channels.map(c => c.categoria || c.category).filter(Boolean) as string[]))
  , [channels]);

  const sortedCategories = useMemo(() => [
    ...CATEGORY_ORDER.filter(c => categories.includes(c)),
    ...categories.filter(c => !CATEGORY_ORDER.includes(c)),
  ], [categories]);

  const searchLower = search.toLowerCase();

  const filteredAll = useMemo(() =>
    channels.filter(ch => {
      const n = getName(ch).toLowerCase();
      const c = getCat(ch).toLowerCase();
      return !search || n.includes(searchLower) || c.includes(searchLower);
    })
  , [channels, search, searchLower]);

  const channelsByCategory = useCallback((cat: string) =>
    channels.filter(ch => {
      const c = getCat(ch);
      const n = getName(ch).toLowerCase();
      return c === cat && (!search || n.includes(searchLower));
    })
  , [channels, search, searchLower]);

  const findChannelForJogo = useCallback((jogo: Jogo): Channel | null => {
    if (!jogo.players?.length) return null;
    const playerUrl = jogo.players[0];
    const channelId = playerUrl.split('/').pop() || '';
    return channels.find(ch => ch.id === channelId || ch.url === playerUrl) || null;
  }, [channels]);

  if (playingChannel) {
    return (
      <ChannelPlayerView
        channel={playingChannel}
        allChannels={channels}
        onClose={() => setPlayingChannel(null)}
        onSwitch={setPlayingChannel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#111]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e8172c]/30 to-[#e8172c]/10 border border-[#e8172c]/30 flex items-center justify-center shrink-0">
              <Tv2 size={16} className="text-[#e8172c]" />
            </div>
            <div>
              <h1 className="text-base font-black text-white leading-none">Canais ao Vivo</h1>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {loading ? 'Carregando...' : `${channels.length} canais disponíveis`}
              </p>
            </div>
          </div>
          <button
            onClick={() => { fetchChannels(); fetchJogos(); }}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin text-[#e8172c]' : 'text-gray-400'} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar canal..."
              className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category filters */}
        {!search && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                !activeCategory ? 'bg-white/15 border-white/20 text-white' : 'bg-white/5 border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300'
              }`}
            >
              Todos
            </button>
            {sortedCategories.map(cat => {
              const m = getCatMeta(cat);
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    isActive ? `bg-white/10 border-white/20 ${m.accent}` : 'bg-white/5 border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        {error && (
          <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
            <Radio size={20} className="text-red-500 shrink-0" />
            <div className="flex-1 text-red-400 text-sm">{error}</div>
            <button onClick={fetchChannels} className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300">
              Tentar novamente
            </button>
          </div>
        )}

        {loading && (
          <div className="px-4 pt-6">
            <div className="h-4 w-40 bg-white/5 rounded animate-pulse mb-4" />
            <div className="flex gap-3 mb-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="shrink-0 w-44 aspect-[4/3] bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
            {[1, 2].map(r => (
              <div key={r} className="mb-6">
                <div className="h-4 w-28 bg-white/5 rounded animate-pulse mb-3" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 px-4">
                    <div className="w-[72px] h-[50px] bg-white/5 rounded-lg animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 w-24 bg-white/5 rounded animate-pulse" />
                      <div className="h-3.5 w-40 bg-white/5 rounded animate-pulse" />
                      <div className="h-1 w-full bg-white/5 rounded-full animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Jogos ao vivo section */}
            {jogos.length > 0 && !search && !activeCategory && (
              <div className="pt-5 pb-2">
                <h2 className="text-sm font-black text-white px-4 mb-3">Assista com uma assinatura</h2>
                <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                  {jogos.map((jogo, i) => {
                    const ch = findChannelForJogo(jogo);
                    return (
                      <JogoCard
                        key={i}
                        jogo={jogo}
                        onPlay={() => {
                          if (ch) {
                            setPlayingChannel(ch);
                          } else if (jogo.players?.[0]) {
                            const fakeChannel: Channel = {
                              id: jogo.players[0].split('/').pop() || String(i),
                              name: jogo.title,
                              url: jogo.players[0],
                              image: jogo.data.teams.home.image,
                              categoria: 'Esportes',
                            };
                            setPlayingChannel(fakeChannel);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search results */}
            {search && (
              <div className="px-4 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-3">
                  {filteredAll.length} resultado{filteredAll.length !== 1 ? 's' : ''} para "{search}"
                </p>
                {filteredAll.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search size={40} className="text-gray-800 mb-4" />
                    <p className="text-gray-600 text-sm">Nenhum canal encontrado.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/4">
                    {filteredAll.map(ch => (
                      <ChannelRow
                        key={ch.id}
                        ch={ch}
                        epg={epgMap[ch.id] || null}
                        onPlay={() => setPlayingChannel(ch)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Category sections — Prime Video style */}
            {!search && channels.length > 0 && (
              <div className="pt-2">
                {activeCategory ? (
                  <CategorySection
                    key={activeCategory}
                    category={activeCategory}
                    channels={channelsByCategory(activeCategory)}
                    epgMap={epgMap}
                    onPlay={setPlayingChannel}
                    defaultExpanded={true}
                  />
                ) : (
                  sortedCategories.map((cat, idx) => {
                    const chs = channelsByCategory(cat);
                    if (chs.length === 0) return null;
                    return (
                      <CategorySection
                        key={cat}
                        category={cat}
                        channels={chs}
                        epgMap={epgMap}
                        onPlay={setPlayingChannel}
                        defaultExpanded={idx < 3}
                      />
                    );
                  })
                )}

                {/* Sem categoria */}
                {!activeCategory && (() => {
                  const uncat = channels.filter(ch => !getCat(ch));
                  if (uncat.length === 0) return null;
                  return (
                    <CategorySection
                      key="outros"
                      category="Outros"
                      channels={uncat}
                      epgMap={epgMap}
                      onPlay={setPlayingChannel}
                      defaultExpanded={false}
                    />
                  );
                })()}
              </div>
            )}

            {!loading && !error && channels.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                <Radio size={60} className="text-gray-800 mb-4" />
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">
                  Nenhum canal disponível
                </h3>
                <p className="text-gray-600 text-sm">Verifique sua conexão e tente novamente.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CanaisTVPage;
