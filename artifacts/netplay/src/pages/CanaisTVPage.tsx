import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio, Search, X, RefreshCcw, Tv2, ChevronLeft, ChevronRight,
  Play, List, ArrowLeft, Info, Zap, Grid3X3, ChevronDown, ChevronUp,
  Clock, SkipBack, SkipForward, CalendarDays, Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { getBetterFlixKey } from '../components/admin/AdminFlixAPITab';

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

const CATEGORY_META: Record<string, { gradient: string; accent: string; border: string; icon: string }> = {
  Esportes:           { gradient: 'from-green-900/30',  accent: 'text-green-400',  border: 'border-green-500/30', icon: '⚽' },
  Noticias:           { gradient: 'from-blue-900/30',   accent: 'text-blue-400',   border: 'border-blue-500/30',  icon: '📰' },
  Notícias:           { gradient: 'from-blue-900/30',   accent: 'text-blue-400',   border: 'border-blue-500/30',  icon: '📰' },
  'Filmes e Séries':  { gradient: 'from-red-900/30',    accent: 'text-red-400',    border: 'border-red-500/30',   icon: '🎬' },
  Infantil:           { gradient: 'from-yellow-900/30', accent: 'text-yellow-400', border: 'border-yellow-500/30',icon: '🧒' },
  Documentarios:      { gradient: 'from-teal-900/30',   accent: 'text-teal-400',   border: 'border-teal-500/30',  icon: '🔭' },
  Variedades:         { gradient: 'from-indigo-900/30', accent: 'text-indigo-400', border: 'border-indigo-500/30',icon: '🎭' },
  Abertos:            { gradient: 'from-orange-900/30', accent: 'text-orange-400', border: 'border-orange-500/30',icon: '📡' },
  Portugal:           { gradient: 'from-rose-900/30',   accent: 'text-rose-400',   border: 'border-rose-500/30',  icon: '🇵🇹' },
  'A Casa do Patrão': { gradient: 'from-purple-900/30', accent: 'text-purple-400', border: 'border-purple-500/30',icon: '🏠' },
  Música:             { gradient: 'from-pink-900/30',   accent: 'text-pink-400',   border: 'border-pink-500/30',  icon: '🎵' },
  Entretenimento:     { gradient: 'from-violet-900/30', accent: 'text-violet-400', border: 'border-violet-500/30',icon: '🎬' },
};

function getCatMeta(cat?: string) {
  if (!cat) return { gradient: 'from-gray-900/30', accent: 'text-gray-400', border: 'border-gray-500/30', icon: '📡' };
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { gradient: 'from-gray-900/30', accent: 'text-gray-400', border: 'border-gray-500/30', icon: '📡' };
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

// ─── Hook EPG ─────────────────────────────────────────────────────────────────
interface EpgProgram {
  title: string;
  description?: string | null;
  startMs: number;
  stopMs: number;
  progress: number;
}
interface EpgData {
  current: EpgProgram | null;
  next: { title: string; startMs: number } | null;
}

function useEpg(channelId: string): { data: EpgData | null; loading: boolean } {
  const [data, setData] = useState<EpgData | null>(null);
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

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Painel EPG no sidebar ─────────────────────────────────────────────────────
function EpgPanel({ channelId }: { channelId: string }) {
  const { data, loading } = useEpg(channelId);

  if (loading) {
    return (
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-gray-600 text-[10px]">
          <Loader2 size={11} className="animate-spin" />
          <span>Carregando programação...</span>
        </div>
      </div>
    );
  }

  if (!data || (!data.current && !data.next)) return null;

  const { current, next } = data;

  return (
    <div className="px-3 py-3 border-b border-white/5 space-y-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 flex items-center gap-1.5">
        <CalendarDays size={9} /> Programação
      </p>

      {current && (
        <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-widest text-red-400">Agora</span>
            <span className="ml-auto text-[8px] text-gray-500 font-mono">
              {fmtTime(current.startMs)} – {fmtTime(current.stopMs)}
            </span>
          </div>
          <p className="text-white text-[11px] font-bold leading-tight line-clamp-2">{current.title}</p>
          {/* Barra de progresso */}
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, current.progress)}%` }}
            />
          </div>
        </div>
      )}

      {next && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-xl border border-white/5">
          <Clock size={10} className="text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-[10px] font-semibold truncate">{next.title}</p>
          </div>
          <span className="text-[8px] text-gray-600 font-mono shrink-0">{fmtTime(next.startMs)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Item individual no strip (precisa de estado próprio para erro de img) ─────
function StripItem({
  ch,
  offset,
  onSwitch,
}: {
  ch: Channel;
  offset: number;
  onSwitch: (ch: Channel) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const isCurrent = offset === 0;
  const meta = getCatMeta(getCat(ch));

  return (
    <motion.button
      onClick={() => !isCurrent && onSwitch(ch)}
      whileHover={!isCurrent ? { scale: 1.08 } : {}}
      whileTap={!isCurrent ? { scale: 0.95 } : {}}
      className={`flex flex-col items-center gap-1.5 transition-all ${
        isCurrent ? 'opacity-100 scale-110 cursor-default' : 'opacity-50 hover:opacity-90 cursor-pointer'
      } ${Math.abs(offset) === 2 ? 'hidden sm:flex' : ''}`}
    >
      <div className={`relative w-14 h-14 rounded-xl border-2 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm transition-all ${
        isCurrent
          ? 'border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.5)]'
          : `border-white/10 ${meta.border}`
      }`}>
        {img && !imgErr ? (
          <img src={img} alt={getName(ch)} className="w-10 h-10 object-contain" onError={() => setImgErr(true)} />
        ) : (
          <Radio size={18} className="text-gray-600" />
        )}
        {isCurrent && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-0.5 bg-red-600/80">
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

// ─── Strip de canais na parte inferior do player ───────────────────────────────
function BottomChannelStrip({
  channels,
  currentIdx,
  onSwitch,
  visible,
}: {
  channels: Channel[];
  currentIdx: number;
  onSwitch: (ch: Channel) => void;
  visible: boolean;
}) {
  const len = channels.length;
  const strip = useMemo(() => {
    return [-2, -1, 0, 1, 2].map(offset => {
      const idx = ((currentIdx + offset) % len + len) % len;
      return { ch: channels[idx], offset };
    });
  }, [channels, currentIdx, len]);

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

// ─── Logo card pequeño (para sidebar do player) ───────────────────────────────
function MiniChannelCard({
  ch,
  active,
  onClick,
}: {
  ch: Channel;
  active?: boolean;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const meta = getCatMeta(getCat(ch));
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${
        active
          ? 'bg-red-600/20 border border-red-600/40'
          : 'hover:bg-white/5 border border-transparent'
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
          <p className={`text-[9px] font-bold uppercase tracking-widest truncate ${meta.accent} opacity-70`}>
            {getCat(ch)}
          </p>
        )}
      </div>
      {active && (
        <div className="shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[7px] font-black text-red-400 uppercase">Ao Vivo</span>
        </div>
      )}
    </button>
  );
}

// ─── Card principal (grid/carrossel) ─────────────────────────────────────────
function ChannelCard({
  ch,
  onPlay,
  onInfo,
}: {
  ch: Channel;
  onPlay: () => void;
  onInfo: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const meta = getCatMeta(getCat(ch));

  return (
    <div
      className="group relative bg-[#111] border border-white/5 rounded-2xl overflow-hidden hover:border-white/15 transition-all shadow-lg shrink-0"
      style={{ width: 152 }}
    >
      {/* Thumbnail — click = info */}
      <button
        onClick={onInfo}
        className="block w-full"
      >
        <div className="w-full aspect-[16/9] bg-black/50 flex items-center justify-center relative overflow-hidden">
          {img && !imgErr ? (
            <img
              src={img}
              alt={getName(ch)}
              className="w-full h-full object-contain p-2.5 group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgErr(true)}
            />
          ) : (
            <Radio size={26} className="text-gray-700" />
          )}
          {/* LIVE badge */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md pointer-events-none">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
            <span className="text-[7px] font-black text-white uppercase tracking-widest">Live</span>
          </div>
          {/* Info hint */}
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Info size={10} className="text-white/70" />
            </div>
          </div>
        </div>
      </button>

      {/* Footer */}
      <div className="px-2.5 pt-2 pb-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-[11px] font-bold truncate leading-tight">{getName(ch)}</p>
          {getCat(ch) && (
            <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${meta.accent} opacity-70 truncate`}>
              {getCat(ch)}
            </p>
          )}
        </div>
        {/* Play button */}
        <button
          onClick={e => { e.stopPropagation(); onPlay(); }}
          className="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-red-600 border border-white/10 hover:border-red-600 flex items-center justify-center transition-all group/play"
        >
          <Play size={11} fill="currentColor" className="text-white ml-0.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Modal de detalhes do canal ───────────────────────────────────────────────
function ChannelDetailModal({
  ch,
  onClose,
  onPlay,
}: {
  ch: Channel;
  onClose: () => void;
  onPlay: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const meta = getCatMeta(getCat(ch));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#141414] rounded-[2rem] border border-white/10 shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner */}
        <div className={`relative bg-gradient-to-br ${meta.gradient} to-[#141414] p-6 flex flex-col items-center gap-4`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <X size={14} />
          </button>

          {/* Logo grande */}
          <div className="w-24 h-24 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl">
            {img && !imgErr ? (
              <img src={img} alt={getName(ch)} className="w-20 h-20 object-contain" onError={() => setImgErr(true)} />
            ) : (
              <Radio size={36} className="text-gray-600" />
            )}
          </div>

          {/* Nome */}
          <div className="text-center">
            <h2 className="text-white text-xl font-black italic uppercase tracking-tighter leading-none">
              {getName(ch)}
            </h2>
            {getCat(ch) && (
              <p className={`text-[11px] font-black uppercase tracking-widest mt-1 ${meta.accent}`}>
                {meta.icon} {getCat(ch)}
              </p>
            )}
          </div>
        </div>

        {/* Informações */}
        <div className="p-5 space-y-4">
          {/* Status ao vivo */}
          <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-white text-xs font-black">Transmissão ao Vivo</p>
              <p className="text-gray-500 text-[10px]">Canal transmitindo agora 24 horas</p>
            </div>
            <div className="ml-auto bg-red-600/20 border border-red-600/30 text-red-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
              LIVE
            </div>
          </div>

          {/* ID do canal */}
          <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
              <Tv2 size={14} className="text-gray-400" />
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">ID do Canal</p>
              <p className="text-white text-xs font-mono font-bold">{ch.id}</p>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all"
            >
              Fechar
            </button>
            <button
              onClick={() => { onPlay(); onClose(); }}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Play size={13} fill="currentColor" />
              Assistir
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Carrossel por categoria ──────────────────────────────────────────────────
function CategoryRow({
  category,
  channels,
  onPlay,
  onInfo,
}: {
  category: string;
  channels: Channel[];
  onPlay: (ch: Channel) => void;
  onInfo: (ch: Channel) => void;
}) {
  const meta = getCatMeta(category);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  return (
    <div className="mb-10">
      {/* Header da categoria */}
      <div className="flex items-center gap-3 px-4 md:px-10 mb-4">
        <span className="text-xl">{meta.icon}</span>
        <h2 className={`text-base font-black uppercase tracking-tighter italic ${meta.accent}`}>{category}</h2>
        <div className="flex-1 h-px bg-white/5 ml-1" />
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-700 mr-1">{channels.length} canais</span>

        {/* Ver mais */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
            expanded
              ? `bg-white/10 border-white/20 text-white`
              : `bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20`
          }`}
        >
          {expanded ? (
            <><ChevronUp size={10} /> Menos</>
          ) : (
            <><Grid3X3 size={10} /> Ver mais</>
          )}
        </button>

        {/* Setas (só no carrossel) */}
        {!expanded && (
          <>
            <button
              onClick={() => scroll('left')}
              className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <ChevronRight size={12} />
            </button>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {expanded ? (
          // Grade expandida
          <motion.div
            key="grid"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-4 md:px-10 pb-2">
              {channels.map(ch => (
                <ChannelCard key={ch.id} ch={ch} onPlay={() => onPlay(ch)} onInfo={() => onInfo(ch)} />
              ))}
            </div>
          </motion.div>
        ) : (
          // Carrossel
          <motion.div
            key="carousel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto scrollbar-none px-4 md:px-10 pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {channels.map(ch => (
                <ChannelCard key={ch.id} ch={ch} onPlay={() => onPlay(ch)} onInfo={() => onInfo(ch)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Player com sidebar para troca de canais ──────────────────────────────────
function ChannelPlayerView({
  channel,
  allChannels,
  onClose,
  onSwitch,
}: {
  channel: Channel;
  allChannels: Channel[];
  onClose: () => void;
  onSwitch: (ch: Channel) => void;
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

  // Mostrar strip temporariamente ao trocar canal
  const triggerStrip = useCallback(() => {
    setShowStrip(true);
    if (stripTimerRef.current) clearTimeout(stripTimerRef.current);
    stripTimerRef.current = setTimeout(() => setShowStrip(false), 3500);
  }, []);

  const handleNext = useCallback(() => { goNext(); triggerStrip(); }, [goNext, triggerStrip]);
  const handlePrev = useCallback(() => { goPrev(); triggerStrip(); }, [goPrev, triggerStrip]);

  // Atalhos de teclado
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
  const filteredChannels = useMemo(() => {
    return allChannels.filter(ch => {
      const matchSearch = !sidebarSearch || getName(ch).toLowerCase().includes(searchLower);
      const matchCat = !sidebarCategory || getCat(ch) === sidebarCategory;
      return matchSearch && matchCat;
    });
  }, [allChannels, sidebarSearch, sidebarCategory, searchLower]);

  const sidebarCategories = useMemo(() => {
    return Array.from(new Set(allChannels.map(getCat).filter(Boolean))).sort();
  }, [allChannels]);

  return (
    <>
      {/* Player ocupa toda a tela (fixed inset-0 z-[3000] internamente) */}
      <VideoPlayer
        key={String(channel.id)}
        movie={fakeMovie}
        onClose={onClose}
        initialPlayerStyle="betterflix"
      />

      {/* ── Overlay de controles: fixed acima do player (z-[3100]) ── */}
      <div className={`fixed inset-0 z-[3100] pointer-events-none transition-all duration-300 ${showSidebar ? 'right-[320px]' : ''}`}>

        {/* Botão Prev — lateral esquerda */}
        <button
          onClick={handlePrev}
          title="Canal anterior (← ↓)"
          className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 hover:border-white/30 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm shadow-xl"
        >
          <SkipBack size={16} />
        </button>

        {/* Botão Next — lateral direita */}
        <button
          onClick={handleNext}
          title="Próximo canal (→ ↑)"
          className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 hover:border-white/30 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm shadow-xl"
        >
          <SkipForward size={16} />
        </button>

        {/* ── Barra de controles superior ── */}
        <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={handlePrev}
            title="Canal anterior"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all shadow-xl"
          >
            <SkipBack size={13} />
          </button>
          <button
            onClick={handleNext}
            title="Próximo canal"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all shadow-xl"
          >
            <SkipForward size={13} />
          </button>

          <button
            onClick={() => { setShowStrip(v => !v); if (stripTimerRef.current) clearTimeout(stripTimerRef.current); }}
            title="Canais próximos"
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl backdrop-blur-xl border transition-all shadow-xl ${
              showStrip
                ? 'bg-orange-600/40 border-orange-500/60 text-orange-300'
                : 'bg-black/70 border-white/20 text-white hover:bg-white/10'
            }`}
          >
            <Tv2 size={13} />
          </button>

          <button
            onClick={() => setShowSidebar(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl border transition-all shadow-xl ${
              showSidebar
                ? 'bg-red-600/40 border-red-600/60 text-red-300'
                : 'bg-black/70 border-white/20 text-white hover:bg-white/10'
            }`}
          >
            <List size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
              {showSidebar ? 'Fechar' : 'Canais'}
            </span>
          </button>
        </div>

        {/* ── Indicador do canal atual ── */}
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
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-red-400 uppercase">Ao Vivo</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Strip inferior de canais ── */}
        <BottomChannelStrip
          channels={allChannels}
          currentIdx={currentIdx}
          onSwitch={ch => { onSwitch(ch); triggerStrip(); }}
          visible={showStrip}
        />

        {/* Dica de atalhos */}
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <p className="text-[9px] text-white/25 font-mono select-none">← → trocar canal • L lista</p>
        </div>
      </div>

      {/* ── Sidebar de canais + programação (z-[3200]) ── */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[320px] bg-[#0d0d0d] border-l border-white/10 flex flex-col z-[3200] shadow-2xl"
          >
            {/* Header sidebar */}
            <div className="flex-none p-4 border-b border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white text-sm font-black italic uppercase tracking-tighter flex-1">
                  Canais ao Vivo
                </span>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Tabs: Canais / Programação */}
              <div className="flex gap-1 mb-3 bg-white/5 rounded-xl p-1">
                {(['canais', 'programacao'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSidebarTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      sidebarTab === tab
                        ? 'bg-white/15 text-white'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {tab === 'canais' ? '📺 Canais' : '📅 Programação'}
                  </button>
                ))}
              </div>

              {/* Busca na sidebar (só na aba canais) */}
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
                      <button
                        onClick={() => setSidebarSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Filtro de categoria */}
                  {!sidebarSearch && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      <button
                        onClick={() => setSidebarCategory(null)}
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                          !sidebarCategory ? 'bg-white/15 text-white' : 'text-gray-600 hover:text-gray-400'
                        }`}
                      >
                        Todos
                      </button>
                      {sidebarCategories.map(cat => {
                        const m = getCatMeta(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => setSidebarCategory(sidebarCategory === cat ? null : cat)}
                            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                              sidebarCategory === cat ? `bg-white/10 ${m.accent}` : 'text-gray-600 hover:text-gray-400'
                            }`}
                          >
                            <span>{m.icon}</span>
                            <span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Canal atual */}
            <div className="flex-none px-3 py-2 border-b border-white/5 bg-red-950/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-red-500/70 mb-1">Assistindo agora</p>
              <div className="flex items-center gap-2">
                {getImage(channel) && (
                  <img src={getImage(channel)} alt="" className="w-8 h-8 object-contain rounded-lg bg-black/40 p-1" />
                )}
                <span className="text-white text-xs font-bold truncate flex-1">{getName(channel)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-red-400 uppercase">Live</span>
                </div>
              </div>
            </div>

            {/* EPG do canal atual */}
            {sidebarTab === 'programacao' ? (
              <div className="flex-1 overflow-y-auto">
                <EpgPanel channelId={String(channel.id)} />
                <div className="px-4 py-4 text-center">
                  <p className="text-gray-700 text-[10px]">
                    Programação em tempo real via EPG. Pode variar conforme o canal.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* EPG compacto no topo da lista de canais */}
                <EpgPanel channelId={String(channel.id)} />

                {/* Lista de canais */}
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
                    <p className="text-gray-700 text-[9px] font-mono">
                      {filteredChannels.length} canal{filteredChannels.length !== 1 ? 'is' : ''}
                    </p>
                    <div className="flex items-center gap-1 text-gray-700 text-[9px]">
                      <span>← →</span>
                      <span>trocar canal</span>
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
const CATEGORY_ORDER = [
  'Esportes', 'Abertos', 'Noticias', 'Notícias', 'Filmes e Séries', 'Variedades',
  'Documentarios', 'Infantil', 'Portugal', 'A Casa do Patrão',
  'Música', 'Entretenimento',
];

const CanaisTVPage: React.FC = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/betterflix/canais');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();

      // Nova API EmbedTV: { categories: [{id, name}], channels: [{id, name, image, categories, url}] }
      const rawChannels: any[] = data.channels || (Array.isArray(data) ? data : []);
      const rawCategories: { id: number; name: string }[] = data.categories || [];

      const catMap: Record<number, string> = {};
      for (const c of rawCategories) catMap[c.id] = c.name;

      const normalized: Channel[] = rawChannels.map((ch: any) => ({
        ...ch,
        id: String(ch.id),
        nome: ch.nome || ch.name || '',
        imagem: ch.imagem || ch.image || '',
        // Resolve primeiro categoria não-"Todos" (id=0) para string
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

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(channels.map(c => c.categoria || c.category).filter(Boolean) as string[])
    );
  }, [channels]);

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
    }),
    [channels, search, searchLower]
  );

  const channelsByCategory = useCallback((cat: string) =>
    channels.filter(ch => {
      const c = getCat(ch);
      const n = getName(ch).toLowerCase();
      const matchCat = c === cat;
      const matchSearch = !search || n.includes(searchLower);
      return matchCat && matchSearch;
    }),
    [channels, search, searchLower]
  );

  // Player view
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
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/15 via-black to-black pointer-events-none" />
        <div className="relative px-4 md:px-10 pt-6 pb-5">
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500/30 to-red-600/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Tv2 size={18} className="text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
                  Canais de TV
                </h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                  {loading ? 'Carregando...' : `${channels.length} canais ao vivo`}
                </p>
              </div>
            </div>
            <button
              onClick={fetchChannels}
              disabled={loading}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
            >
              <RefreshCcw size={15} className={loading ? 'animate-spin text-orange-400' : 'text-gray-400'} />
            </button>
          </div>

          {/* Barra de busca */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar canal por nome ou categoria..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-9 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 focus:bg-white/8 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por categoria — oculto durante busca */}
          {!search && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  !activeCategory
                    ? 'bg-orange-500/25 border-orange-500/40 text-orange-300'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
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
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                      isActive
                        ? `bg-white/10 border-white/20 ${m.accent}`
                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
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
      </div>

      {/* Conteúdo */}
      <div className="pt-2">
        {/* Erro */}
        {error && (
          <div className="mx-4 md:mx-10 bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 mb-8">
            <Radio size={22} className="text-red-500 shrink-0" />
            <div className="flex-1 text-red-400 text-sm">{error}</div>
            <button
              onClick={fetchChannels}
              className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="px-4 md:px-10">
            {[1, 2, 3].map(r => (
              <div key={r} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="flex gap-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="shrink-0 w-[152px] aspect-[16/9] bg-white/5 rounded-2xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sem canais */}
        {!loading && !error && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center px-4">
            <Radio size={60} className="text-gray-800 mb-4" />
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">
              Nenhum canal disponível
            </h3>
            <p className="text-gray-600 text-sm">Verifique sua conexão e tente novamente.</p>
          </div>
        )}

        {/* Resultados da busca */}
        {!loading && !error && search && (
          <div className="px-4 md:px-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4">
              {filteredAll.length} resultado{filteredAll.length !== 1 ? 's' : ''} para "{search}"
            </p>
            {filteredAll.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search size={40} className="text-gray-800 mb-4" />
                <p className="text-gray-600 text-sm">Nenhum canal encontrado para "{search}".</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              >
                {filteredAll.map(ch => (
                  <ChannelCard
                    key={ch.id}
                    ch={ch}
                    onPlay={() => setPlayingChannel(ch)}
                    onInfo={() => setDetailChannel(ch)}
                  />
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Carrosséis por categoria */}
        {!loading && !error && !search && channels.length > 0 && (
          <AnimatePresence mode="wait">
            {activeCategory ? (
              <motion.div key={activeCategory} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CategoryRow
                  category={activeCategory}
                  channels={channelsByCategory(activeCategory)}
                  onPlay={setPlayingChannel}
                  onInfo={setDetailChannel}
                />
              </motion.div>
            ) : (
              <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sortedCategories.map(cat => {
                  const chs = channelsByCategory(cat);
                  if (chs.length === 0) return null;
                  return (
                    <CategoryRow
                      key={cat}
                      category={cat}
                      channels={chs}
                      onPlay={setPlayingChannel}
                      onInfo={setDetailChannel}
                    />
                  );
                })}
                {/* Sem categoria */}
                {(() => {
                  const uncat = channels.filter(ch => !getCat(ch));
                  if (uncat.length === 0) return null;
                  return (
                    <CategoryRow
                      key="outros"
                      category="Outros"
                      channels={uncat}
                      onPlay={setPlayingChannel}
                      onInfo={setDetailChannel}
                    />
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modal de detalhes do canal */}
      <AnimatePresence>
        {detailChannel && (
          <ChannelDetailModal
            ch={detailChannel}
            onClose={() => setDetailChannel(null)}
            onPlay={() => {
              setPlayingChannel(detailChannel);
              setDetailChannel(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CanaisTVPage;
