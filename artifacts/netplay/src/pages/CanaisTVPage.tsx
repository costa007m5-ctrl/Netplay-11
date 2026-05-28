import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Search, X, RefreshCcw, Radio,
  Play, SkipBack, SkipForward, ShieldCheck, ShieldOff,
  Maximize2, Eye, Bell, Share2, PlusCircle, Tv2, Clock,
  ChevronRight, Settings, Mic, Lock, Bookmark,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
const FILTER_TABS = ['Todos', 'Esportes', 'Abertos', 'Notícias', 'Filmes', 'Infantil'];

const CATEGORY_ORDER = [
  'Esportes', 'Abertos', 'Noticias', 'Notícias', 'Filmes e Séries',
  'Variedades', 'Documentarios', 'Infantil', 'Portugal', 'A Casa do Patrão',
  'Música', 'Entretenimento',
];

const CATEGORY_META: Record<string, { accent: string; bg: string; icon: string }> = {
  Esportes:           { accent: 'text-green-400',  bg: 'bg-green-500/20',   icon: '⚽' },
  Noticias:           { accent: 'text-blue-400',   bg: 'bg-blue-500/20',    icon: '📰' },
  Notícias:           { accent: 'text-blue-400',   bg: 'bg-blue-500/20',    icon: '📰' },
  'Filmes e Séries':  { accent: 'text-red-400',    bg: 'bg-red-500/20',     icon: '🎬' },
  Filmes:             { accent: 'text-red-400',    bg: 'bg-red-500/20',     icon: '🎬' },
  Infantil:           { accent: 'text-yellow-400', bg: 'bg-yellow-500/20',  icon: '🧒' },
  Documentarios:      { accent: 'text-teal-400',   bg: 'bg-teal-500/20',    icon: '🔭' },
  Variedades:         { accent: 'text-indigo-400', bg: 'bg-indigo-500/20',  icon: '🎭' },
  Abertos:            { accent: 'text-orange-400', bg: 'bg-orange-500/20',  icon: '📡' },
  Portugal:           { accent: 'text-rose-400',   bg: 'bg-rose-500/20',    icon: '🇵🇹' },
  'A Casa do Patrão': { accent: 'text-purple-400', bg: 'bg-purple-500/20',  icon: '🏠' },
  Música:             { accent: 'text-pink-400',   bg: 'bg-pink-500/20',    icon: '🎵' },
  Entretenimento:     { accent: 'text-violet-400', bg: 'bg-violet-500/20',  icon: '🎬' },
};

const EMBED_FALLBACKS = [
  (id: string) => `https://embedtv.lat/${id}?autoplay=1`,
  (id: string) => `https://ww1.embedtv.lat/${id}?autoplay=1`,
  (id: string) => `https://ww2.embedtv.lat/${id}?autoplay=1`,
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
const getName  = (ch: Channel) => ch.nome  || ch.name  || 'Canal';
const getImage = (ch: Channel) => ch.imagem || ch.image || '';
const getCat   = (ch: Channel) => ch.categoria || ch.category || '';
const normStr  = (s: string)   => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function getCatMeta(cat?: string) {
  if (!cat) return { accent: 'text-gray-400', bg: 'bg-gray-500/20', icon: '📡' };
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { accent: 'text-gray-400', bg: 'bg-gray-500/20', icon: '📡' };
}

function buildChannelUrl(ch: Channel, fallbackIdx = 0): string {
  if (ch.url) {
    let u = ch.url;
    if (!u.includes('autoplay=')) u += (u.includes('?') ? '&' : '?') + 'autoplay=1';
    return u;
  }
  const fns = EMBED_FALLBACKS;
  return fns[Math.min(fallbackIdx, fns.length - 1)](ch.id);
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtTimeLeft(stopMs: number): string {
  const mins = Math.max(0, Math.round((stopMs - Date.now()) / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60); const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${mins}min`;
}

// Pseudo-random viewer count seeded by channel ID
function fakeViewers(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const n = (h % 14000) + 800;
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')} mil` : String(n);
}

function findEpg(ch: Channel, epgMap: Record<string, EpgProgram>): EpgProgram | null {
  if (epgMap[ch.id]) return epgMap[ch.id];
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

// ─── Live Badge ─────────────────────────────────────────────────────────────────
function LiveBadge({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 bg-[#e8172c] text-white font-black uppercase tracking-widest rounded ${small ? 'text-[7px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1'}`}>
      <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
      AO VIVO
    </span>
  );
}

// ─── Channel Card (2-column grid) ───────────────────────────────────────────────
function ChannelCard({ ch, epg, onPlay, onInfo }: { ch: Channel; epg?: EpgProgram | null; onPlay: () => void; onInfo: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(ch);
  const cat = getCat(ch);
  const pct = epg ? Math.min(100, Math.max(0, epg.progress)) : 0;
  const viewers = fakeViewers(ch.id);

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="bg-[#161616] border border-white/[0.07] rounded-2xl overflow-hidden cursor-pointer"
      onClick={onPlay}
    >
      <div className="p-3 flex items-start gap-3">
        {/* Logo */}
        <div className="w-14 h-14 rounded-xl bg-[#0d0d0d] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
          {img && !imgErr ? (
            <img src={img} alt={getName(ch)} className="w-11 h-11 object-contain" onError={() => setImgErr(true)} />
          ) : (
            <Radio size={18} className="text-gray-700" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <LiveBadge small />
            <div className="flex items-center gap-1 text-gray-500">
              <Eye size={9} />
              <span className="text-[9px] font-bold">+{viewers}</span>
            </div>
          </div>
          <p className="text-white text-[11px] font-bold leading-snug truncate mb-0.5">
            {epg ? epg.title : getName(ch)}
          </p>
          {epg && (
            <p className="text-gray-600 text-[9px] uppercase tracking-widest">{fmtTimeLeft(epg.stopMs)} restantes</p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            {cat && <span className={`text-[8px] font-black uppercase tracking-wider ${getCatMeta(cat).accent}`}>{cat}</span>}
            <span className="text-[8px] text-gray-700">• HD</span>
          </div>
        </div>

        {/* Play button */}
        <button
          onClick={e => { e.stopPropagation(); onPlay(); }}
          className="w-9 h-9 rounded-full bg-[#e8172c] flex items-center justify-center shrink-0 shadow-lg shadow-red-900/40"
        >
          <Play size={14} fill="white" className="text-white ml-0.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-white/[0.06]">
        <div className="h-full bg-[#e8172c] transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </motion.div>
  );
}

// ─── Hero Banner ────────────────────────────────────────────────────────────────
function HeroBanner({
  jogos, channels, onWatch, onSynopsis,
}: {
  jogos: Jogo[];
  channels: Channel[];
  onWatch: (ch: Channel) => void;
  onSynopsis: (ch: Channel) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [imgErr, setImgErr] = useState(false);

  const items = useMemo(() => {
    const jogoItems = jogos.slice(0, 5).map(j => {
      const ch = channels.find(c =>
        c.id === (j.players?.[0]?.split('/').pop() || '') || c.url === j.players?.[0]
      ) || {
        id: j.players?.[0]?.split('/').pop() || String(Math.random()),
        name: j.title,
        url: j.players?.[0],
        image: j.data.teams.home.image,
        categoria: 'Esportes',
      };
      return { type: 'jogo' as const, jogo: j, channel: ch as Channel };
    });
    return jogoItems;
  }, [jogos, channels]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);

  useEffect(() => { setImgErr(false); }, [idx]);

  if (items.length === 0) return null;

  const item = items[idx];
  const { jogo, channel } = item;
  const isLive = Date.now() >= jogo.data.timer.start * 1000 && Date.now() <= jogo.data.timer.end * 1000;

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9', maxHeight: 260 }}>
      {/* Backdrop */}
      {jogo.image && !imgErr ? (
        <img
          src={jogo.image}
          alt={jogo.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-red-950 to-gray-950 flex items-center justify-center gap-6 p-6">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-lg font-black">
            {jogo.data.teams.home.name.slice(0, 2)}
          </div>
          <span className="text-white font-black text-2xl">×</span>
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-lg font-black">
            {jogo.data.teams.away.name.slice(0, 2)}
          </div>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/40 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive && <LiveBadge small />}
          </div>
          <span className="text-[9px] text-white/50 font-mono">{idx + 1}/{items.length}</span>
        </div>

        <div>
          {/* Title */}
          <h2 className="text-white font-black italic uppercase tracking-tighter text-2xl leading-[1] mb-1 drop-shadow-2xl" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
            {jogo.data.teams.home.name.toUpperCase()}<br />
            <span className="text-[#e8172c]">×</span> {jogo.data.teams.away.name.toUpperCase()}
          </h2>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">{jogo.data.league}</p>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
            <span className="text-white/60 text-[9px] font-bold">{fakeViewers(channel.id + 'x')} assistindo</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onWatch(channel)}
              className="flex items-center gap-2 bg-[#e8172c] hover:bg-[#c01020] text-white font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl shadow-lg shadow-red-900/40 transition-all active:scale-95"
            >
              <Play size={11} fill="currentColor" />
              Assistir Agora
            </button>
            <button
              onClick={() => onSynopsis(channel)}
              className="flex items-center gap-2 bg-black/50 backdrop-blur-xl border border-white/20 text-white font-black uppercase text-[10px] tracking-widest px-3 py-2.5 rounded-xl transition-all active:scale-95"
            >
              Sinopse
            </button>
          </div>
        </div>
      </div>

      {/* Page dots */}
      <div className="absolute bottom-16 right-4 flex gap-1">
        {items.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-4 bg-[#e8172c]' : 'w-1.5 bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Small reusable image-with-fallback components ─────────────────────────────
function RelatedChannelThumb({ ch, epgMap, onSelect }: { ch: Channel; epgMap: Record<string, EpgProgram>; onSelect: () => void }) {
  const [err, setErr] = useState(false);
  const img = getImage(ch);
  const epg = epgMap[ch.id];
  return (
    <button onClick={onSelect} className="shrink-0 w-28">
      <div className="bg-[#161616] border border-white/10 rounded-2xl p-3 flex flex-col items-center gap-2 mb-1.5">
        <div className="w-10 h-10 rounded-xl bg-[#0d0d0d] border border-white/10 flex items-center justify-center overflow-hidden">
          {img && !err ? (
            <img src={img} alt="" className="w-8 h-8 object-contain" onError={() => setErr(true)} />
          ) : <Radio size={14} className="text-gray-700" />}
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 bg-[#e8172c] rounded-full animate-pulse" />
          <span className="text-[8px] text-[#e8172c] font-black uppercase">Ao Vivo</span>
        </div>
      </div>
      <p className="text-gray-400 text-[9px] font-bold text-center truncate">{getName(ch)}</p>
      {epg && <p className="text-gray-600 text-[8px] text-center truncate">{epg.title}</p>}
    </button>
  );
}

function PlayerRelatedCard({ ch, epgMap, onSelect }: { ch: Channel; epgMap: Record<string, EpgProgram>; onSelect: () => void }) {
  const [err, setErr] = useState(false);
  const img = getImage(ch);
  const epg = epgMap[ch.id];
  return (
    <button onClick={onSelect} className="shrink-0 w-32 bg-[#161616] border border-white/[0.07] rounded-2xl p-3 text-left">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-[#0d0d0d] border border-white/10 flex items-center justify-center overflow-hidden">
          {img && !err
            ? <img src={img} alt="" className="w-6 h-6 object-contain" onError={() => setErr(true)} />
            : <Radio size={10} className="text-gray-700" />}
        </div>
        <LiveBadge small />
      </div>
      <p className="text-white text-[10px] font-bold truncate">{getName(ch)}</p>
      {epg && <p className="text-gray-600 text-[8px] truncate mt-0.5">{epg.title}</p>}
    </button>
  );
}

function ChannelListItem({ ch, active, epgMap, onSelect }: { ch: Channel; active: boolean; epgMap: Record<string, EpgProgram>; onSelect: () => void }) {
  const [err, setErr] = useState(false);
  const img = getImage(ch);
  return (
    <button onClick={onSelect}
      className={`w-full flex items-center gap-3 py-2 rounded-xl px-2 mb-1 transition-colors ${active ? 'bg-[#e8172c]/15 border border-[#e8172c]/20' : 'hover:bg-white/5'}`}>
      <div className="w-9 h-9 rounded-xl bg-[#161616] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {img && !err
          ? <img src={img} alt="" className="w-7 h-7 object-contain" onError={() => setErr(true)} />
          : <Radio size={12} className="text-gray-700" />}
      </div>
      <span className={`text-sm font-bold truncate flex-1 text-left ${active ? 'text-white' : 'text-gray-300'}`}>{getName(ch)}</span>
      {active && <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse shrink-0" />}
    </button>
  );
}

// ─── Channel Synopsis View ──────────────────────────────────────────────────────
function ChannelSynopsisView({
  channel, epg, allChannels, epgMap, onPlay, onClose, myList, onToggleList,
}: {
  channel: Channel;
  epg: EpgProgram | null;
  allChannels: Channel[];
  epgMap: Record<string, EpgProgram>;
  onPlay: () => void;
  onClose: () => void;
  myList: Set<string>;
  onToggleList: (id: string) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const img = getImage(channel);
  const cat = getCat(channel);
  const viewers = fakeViewers(channel.id);
  const pct = epg ? Math.min(100, Math.max(0, epg.progress)) : 0;
  const { programs, loading: schedLoading } = useEpgSchedule(channel.id, true);
  const inList = myList.has(channel.id);

  const now = Date.now();
  const upcoming = programs.filter(p => p.stopMs > now).slice(0, 8);

  // Related channels (same category)
  const related = useMemo(() =>
    allChannels.filter(c => c.id !== channel.id && getCat(c) === cat).slice(0, 6),
    [allChannels, channel.id, cat]
  );

  return (
    <div className="fixed inset-0 z-[2000] bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Backdrop blur */}
      <div className="absolute inset-0">
        {img && !imgErr ? (
          <img src={img} alt="" className="w-full h-full object-cover opacity-20 scale-110 blur-2xl" onError={() => setImgErr(true)} />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-[#0a0a0a]/80 to-[#0a0a0a]" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <p className="text-white text-sm font-bold truncate flex-1 mx-3">{getName(channel)}</p>
        <button className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center">
          <Share2 size={15} className="text-white" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {/* Channel hero */}
        <div className="px-4 pb-6">
          <div className="relative rounded-3xl overflow-hidden bg-[#1a1a1a] border border-white/10 mb-5" style={{ aspectRatio: '16/9' }}>
            {img && !imgErr ? (
              <img src={img} alt={getName(channel)} className="w-full h-full object-contain p-4" onError={() => setImgErr(true)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Radio size={40} className="text-gray-700" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Live + viewers */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <LiveBadge small />
              <div className="flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
                <Eye size={8} className="text-gray-400" />
                <span className="text-[9px] text-gray-300 font-bold">{viewers} assistindo</span>
              </div>
            </div>

            {/* Progress */}
            {epg && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
                <div className="h-full bg-[#e8172c]" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {/* Program title */}
          <h1 className="text-white font-black text-2xl uppercase tracking-tighter leading-tight mb-2">
            {epg ? epg.title : getName(channel)}
          </h1>

          {/* Category tags */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {cat && (
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${getCatMeta(cat).bg} ${getCatMeta(cat).accent}`}>
                {cat}
              </span>
            )}
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-[#e8172c]/20 text-[#e8172c]">Ao Vivo</span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-white/10 text-gray-300">HD</span>
          </div>

          {/* Description */}
          {epg?.description ? (
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{epg.description}</p>
          ) : (
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              Transmissão ao vivo 24 horas. Confira a programação completa do canal.
            </p>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { icon: Mic, label: 'Idioma', value: 'Português' },
              { icon: Tv2, label: 'Qualidade', value: 'HD 1080p' },
              { icon: Radio, label: 'Transmissão', value: 'Ao vivo' },
              { icon: Lock, label: 'Classificação', value: 'Livre' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl p-2.5 flex flex-col items-center gap-1 text-center border border-white/5">
                <Icon size={13} className="text-gray-400" />
                <span className="text-[7px] text-gray-600 uppercase tracking-widest font-bold">{label}</span>
                <span className="text-[9px] text-white font-bold leading-tight">{value}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={onPlay}
              className="flex-1 flex items-center justify-center gap-2 bg-[#e8172c] hover:bg-[#c01020] text-white font-black uppercase text-[11px] tracking-widest py-3.5 rounded-2xl shadow-lg shadow-red-900/30 transition-all active:scale-95"
            >
              <Play size={14} fill="currentColor" />
              Assistir Agora
            </button>
            <button
              onClick={() => onToggleList(channel.id)}
              className={`flex items-center justify-center gap-1.5 border font-black uppercase text-[10px] tracking-widest py-3.5 px-4 rounded-2xl transition-all active:scale-95 ${
                inList ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/15 text-gray-300'
              }`}
            >
              <Bookmark size={13} fill={inList ? 'currentColor' : 'none'} />
              {inList ? 'Salvo' : 'Lista'}
            </button>
            <button className="flex items-center justify-center gap-1.5 bg-white/5 border border-white/15 text-gray-300 font-black uppercase text-[10px] tracking-widest py-3.5 px-4 rounded-2xl transition-all active:scale-95">
              <Bell size={13} />
              Gravar
            </button>
          </div>

          {/* Next programs */}
          {(upcoming.length > 0 || schedLoading) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-black text-sm uppercase tracking-widest">Próximos Programas</h3>
                <button className="text-[#e8172c] text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                  Ver grade completa <ChevronRight size={10} />
                </button>
              </div>

              {schedLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl mb-2 animate-pulse" />
                ))
              ) : upcoming.map((p, i) => {
                const isCurrent = Date.now() >= p.startMs && Date.now() < p.stopMs;
                const dur = Math.round((p.stopMs - p.startMs) / 60000);
                return (
                  <div key={i} className={`flex items-center gap-3 py-3 border-b border-white/[0.05] ${isCurrent ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="w-12 shrink-0 text-right">
                      <span className={`text-[11px] font-mono font-bold ${isCurrent ? 'text-[#e8172c]' : 'text-gray-500'}`}>
                        {p.startMs > 0 ? fmtTime(p.startMs) : '--:--'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}>{p.title}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isCurrent && <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />}
                      <span className="text-[10px] text-gray-600">{dur > 0 ? `${dur} min` : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Related channels */}
          {related.length > 0 && (
            <div className="mt-6">
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-3">Canais Relacionados</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {related.map(rc => (
                  <RelatedChannelThumb key={rc.id} ch={rc} epgMap={epgMap} onSelect={() => onPlay()} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Channel Player View ────────────────────────────────────────────────────────
function ChannelPlayerView({
  channel, allChannels, epgMap, onClose, onSwitch,
}: {
  channel: Channel;
  allChannels: Channel[];
  epgMap: Record<string, EpgProgram>;
  onClose: () => void;
  onSwitch: (ch: Channel) => void;
}) {
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [antiAds, setAntiAds] = useState<boolean>(() => {
    try { return localStorage.getItem('netplay_anti_ads') !== 'off'; } catch { return true; }
  });

  const current = useEpg(channel.id);
  const { programs } = useEpgSchedule(channel.id, showSchedule);
  const pct = current ? Math.min(100, Math.max(0, current.progress)) : 0;
  const viewers = fakeViewers(channel.id);
  const cat = getCat(channel);

  useEffect(() => { setFallbackIdx(0); }, [channel.id]);

  const src = buildChannelUrl(channel, fallbackIdx);
  const hasMore = !channel.url && fallbackIdx < EMBED_FALLBACKS.length - 1;

  const currentIdx = allChannels.findIndex(c => c.id === channel.id);
  const goNext = () => { onSwitch(allChannels[(currentIdx + 1) % allChannels.length]); };
  const goPrev = () => { onSwitch(allChannels[(currentIdx - 1 + allChannels.length) % allChannels.length]); };

  // Related channels
  const related = useMemo(() =>
    allChannels.filter(c => c.id !== channel.id && getCat(c) === cat).slice(0, 8),
    [allChannels, channel.id, cat]
  );

  const now = Date.now();
  const upcoming = programs.filter(p => p.stopMs > now).slice(0, 10);

  return (
    <div className="fixed inset-0 z-[3000] bg-[#0a0a0a] flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-[#0a0a0a] shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <X size={16} className="text-white" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {getImage(channel) && (
              <img src={getImage(channel)} alt="" className="h-4 w-auto object-contain max-w-[40px]" />
            )}
            <LiveBadge small />
          </div>
          <p className="text-white text-sm font-black truncate">
            {current ? current.title : getName(channel)}
          </p>
          {current && <p className="text-gray-500 text-[10px] truncate">{getName(channel)}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasMore && (
            <button onClick={() => setFallbackIdx(i => i + 1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <RefreshCcw size={13} className="text-gray-400" />
            </button>
          )}
          <button
            onClick={() => { setAntiAds(p => { const n = !p; try { localStorage.setItem('netplay_anti_ads', n ? 'on' : 'off'); } catch {} return n; }); }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${antiAds ? 'bg-green-800/60' : 'bg-red-900/60'}`}
          >
            {antiAds ? <ShieldCheck size={13} className="text-green-400" /> : <ShieldOff size={13} className="text-red-400" />}
          </button>
          <button className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Settings size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── Video player ── */}
      <div className="relative shrink-0 bg-black" style={{ aspectRatio: '16/9' }}>
        <iframe
          key={`${src}-${antiAds}`}
          src={src}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          sandbox={antiAds ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads" : undefined}
          allowFullScreen
        />

        {/* Skip buttons */}
        <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-10">
          <SkipBack size={15} className="text-white" />
        </button>
        <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-10">
          <SkipForward size={15} className="text-white" />
        </button>
      </div>

      {/* ── Timeline + info ── */}
      <div className="px-4 pt-3 pb-2 shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-white/70 text-[10px] font-mono">{current ? fmtTime(current.startMs) : '--:--'}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#e8172c] rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
          <LiveBadge small />
        </div>
        {current && (
          <p className="text-gray-500 text-[9px] text-right">{fmtTimeLeft(current.stopMs)} restantes</p>
        )}
      </div>

      {/* ── Bottom tab actions ── */}
      <div className="flex border-t border-white/[0.06] shrink-0 bg-[#0a0a0a]">
        {[
          { icon: Tv2, label: 'Canais', action: () => setShowChannelList(v => !v) },
          { icon: Clock, label: 'Programação', action: () => setShowSchedule(v => !v) },
          { icon: PlusCircle, label: 'Adicionar', action: () => {} },
          { icon: Share2, label: 'Compartilhar', action: () => {} },
        ].map(({ icon: Icon, label, action }) => (
          <button key={label} onClick={action} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 hover:bg-white/5 transition-colors">
            <Icon size={18} className="text-gray-400" />
            <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">

        {/* Schedule panel */}
        <AnimatePresence>
          {showSchedule && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/[0.06]">
              <div className="px-4 py-3">
                <p className="text-white font-black text-xs uppercase tracking-widest mb-3">Programação de Hoje</p>
                {upcoming.map((p, i) => {
                  const isCurrent = Date.now() >= p.startMs && Date.now() < p.stopMs;
                  return (
                    <div key={i} className={`flex items-center gap-3 py-2 border-b border-white/[0.04] ${isCurrent ? '' : 'opacity-60'}`}>
                      <span className={`text-[10px] font-mono font-bold w-10 shrink-0 ${isCurrent ? 'text-[#e8172c]' : 'text-gray-600'}`}>
                        {fmtTime(p.startMs)}
                      </span>
                      <p className={`text-sm flex-1 truncate font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{p.title}</p>
                      {isCurrent && <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Channel list panel */}
        <AnimatePresence>
          {showChannelList && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/[0.06]">
              <div className="px-4 py-3 max-h-64 overflow-y-auto">
                <p className="text-white font-black text-xs uppercase tracking-widest mb-3">Todos os Canais</p>
                {allChannels.slice(0, 30).map(ch => (
                  <ChannelListItem
                    key={ch.id}
                    ch={ch}
                    active={ch.id === channel.id}
                    epgMap={epgMap}
                    onSelect={() => { onSwitch(ch); setShowChannelList(false); }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Related channels */}
        {related.length > 0 && (
          <div className="px-4 pt-4 pb-6">
            <p className="text-white font-black text-xs uppercase tracking-widest mb-3">Canais Relacionados</p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {related.map(rc => (
                <PlayerRelatedCard
                  key={rc.id}
                  ch={rc}
                  epgMap={epgMap}
                  onSelect={() => onSwitch(rc)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PiP mini player ────────────────────────────────────────────────────────────
function PiPPlayer({ channel, onRestore, onClose }: { channel: Channel; onRestore: () => void; onClose: () => void }) {
  const src = buildChannelUrl(channel);
  const [imgErr, setImgErr] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 20 }}
      drag dragConstraints={{ left: -300, right: 0, top: -400, bottom: 0 }}
      className="fixed bottom-20 right-3 z-[7000] w-52 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black cursor-grab active:cursor-grabbing"
    >
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={src}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads"
          allowFullScreen
        />
        <button onClick={e => { e.stopPropagation(); onClose(); }}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 border border-white/30 flex items-center justify-center text-white z-10">
          <X size={10} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#141414] cursor-pointer" onClick={onRestore}>
        <div className="w-4 h-4 bg-[#e8172c] rounded-md flex items-center justify-center shrink-0">
          <span className="text-white text-[7px] font-black">N</span>
        </div>
        {getImage(channel) && !imgErr ? (
          <img src={getImage(channel)} alt="" className="w-4 h-4 object-contain" onError={() => setImgErr(true)} />
        ) : null}
        <span className="text-white text-[9px] font-black truncate flex-1">{getName(channel)}</span>
        <Maximize2 size={10} className="text-gray-400 shrink-0" />
      </div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
const CanaisTVPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('Todos');
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [rawEpgMap, setRawEpgMap] = useState<Record<string, EpgProgram>>({});
  const [view, setView] = useState<'home' | 'synopsis' | 'player'>('home');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [pipChannel, setPipChannel] = useState<Channel | null>(null);
  const [autoPlayDone, setAutoPlayDone] = useState(false);
  const [myList, setMyList] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('netplay_tv_mylist') || '[]')); } catch { return new Set(); }
  });

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

  // auto-abre canal via ?channel=ID (vindo da aba Novidades)
  useEffect(() => {
    if (autoPlayDone || channels.length === 0) return;
    const targetId = searchParams.get('channel');
    if (!targetId) return;
    const ch = channels.find(c => c.id === targetId);
    if (ch) {
      setSelectedChannel(ch);
      setView('player');
    }
    setAutoPlayDone(true);
  }, [channels, searchParams, autoPlayDone]);

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

  const epgMap = useMemo(() => {
    const result: Record<string, EpgProgram> = { ...rawEpgMap };
    for (const ch of channels) {
      if (result[ch.id]) continue;
      const found = findEpg(ch, rawEpgMap);
      if (found) result[ch.id] = found;
    }
    return result;
  }, [channels, rawEpgMap]);

  const toggleMyList = useCallback((id: string) => {
    setMyList(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('netplay_tv_mylist', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Filter channels by tab and search
  const filteredChannels = useMemo(() => {
    const searchLower = search.toLowerCase();
    return channels.filter(ch => {
      const name = getName(ch).toLowerCase();
      const cat = getCat(ch).toLowerCase();
      const matchSearch = !search || name.includes(searchLower) || cat.includes(searchLower);

      let matchTab = true;
      if (filterTab !== 'Todos') {
        if (filterTab === 'Notícias') matchTab = cat.includes('notic') || cat.includes('notíc');
        else if (filterTab === 'Filmes') matchTab = cat.includes('filme') || cat.includes('série');
        else matchTab = cat.toLowerCase().includes(filterTab.toLowerCase());
      }
      return matchSearch && matchTab;
    });
  }, [channels, search, filterTab]);

  const handlePlay = useCallback((ch: Channel) => {
    setSelectedChannel(ch);
    setView('player');
  }, []);

  const handleSynopsis = useCallback((ch: Channel) => {
    setSelectedChannel(ch);
    setView('synopsis');
  }, []);

  const handleBack = useCallback(() => {
    setView('home');
    setSelectedChannel(null);
  }, []);

  const handlePiP = useCallback(() => {
    if (selectedChannel) {
      setPipChannel(selectedChannel);
      setView('home');
      setSelectedChannel(null);
    }
  }, [selectedChannel]);

  // Player view
  if (view === 'player' && selectedChannel) {
    return (
      <>
        <ChannelPlayerView
          channel={selectedChannel}
          allChannels={channels}
          epgMap={epgMap}
          onClose={handleBack}
          onSwitch={ch => setSelectedChannel(ch)}
        />
        <AnimatePresence>
          {pipChannel && (
            <PiPPlayer
              channel={pipChannel}
              onRestore={() => { setSelectedChannel(pipChannel); setView('player'); setPipChannel(null); }}
              onClose={() => setPipChannel(null)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Synopsis view
  if (view === 'synopsis' && selectedChannel) {
    return (
      <>
        <ChannelSynopsisView
          channel={selectedChannel}
          epg={epgMap[selectedChannel.id] || null}
          allChannels={channels}
          epgMap={epgMap}
          onPlay={() => { setView('player'); }}
          onClose={handleBack}
          myList={myList}
          onToggleList={toggleMyList}
        />
        <AnimatePresence>
          {pipChannel && (
            <PiPPlayer
              channel={pipChannel}
              onRestore={() => { setSelectedChannel(pipChannel); setView('player'); setPipChannel(null); }}
              onClose={() => setPipChannel(null)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Home view
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl px-4 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 border border-white/[0.07] flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar canais, programas..."
              className="w-full bg-white/6 border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
          <button onClick={() => { fetchChannels(); fetchJogos(); }} disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/[0.07] flex items-center justify-center shrink-0 disabled:opacity-40">
            <RefreshCcw size={14} className={loading ? 'animate-spin text-[#e8172c]' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* ── Hero banner ── */}
      {!search && jogos.length > 0 && !loading && (
        <HeroBanner
          jogos={jogos}
          channels={channels}
          onWatch={handlePlay}
          onSynopsis={handleSynopsis}
        />
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <Radio size={18} className="text-red-500 shrink-0" />
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button onClick={fetchChannels} className="text-xs font-black text-red-400">Tentar</button>
        </div>
      )}

      {/* ── "Canais Ao Vivo" section ── */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#e8172c] rounded-full animate-pulse" />
            <h2 className="text-white font-black text-sm uppercase tracking-widest">Canais Ao Vivo</h2>
          </div>
          <button className="text-[#e8172c] text-[9px] font-black uppercase tracking-widest flex items-center gap-0.5">
            Ver todos <ChevronRight size={10} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
          {FILTER_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${
                filterTab === tab
                  ? 'bg-[#e8172c] border-[#e8172c] text-white'
                  : 'bg-white/5 border-white/[0.08] text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#161616] border border-white/[0.06] rounded-2xl overflow-hidden animate-pulse">
                <div className="p-3 flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-2 w-12 bg-white/10 rounded" />
                    <div className="h-3 w-24 bg-white/8 rounded" />
                    <div className="h-2 w-16 bg-white/5 rounded" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/5 shrink-0" />
                </div>
                <div className="h-[3px] bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {/* 2-column grid */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 pb-32">
            {filteredChannels.length === 0 ? (
              <div className="col-span-2 flex flex-col items-center justify-center py-20">
                <Radio size={48} className="text-gray-800 mb-4" />
                <p className="text-gray-600 font-bold text-sm">Nenhum canal encontrado</p>
              </div>
            ) : filteredChannels.map(ch => (
              <ChannelCard
                key={ch.id}
                ch={ch}
                epg={epgMap[ch.id] || null}
                onPlay={() => handlePlay(ch)}
                onInfo={() => handleSynopsis(ch)}
              />
            ))}
          </div>
        )}
      </div>

      {/* PiP */}
      <AnimatePresence>
        {pipChannel && (
          <PiPPlayer
            channel={pipChannel}
            onRestore={() => { setSelectedChannel(pipChannel); setView('player'); setPipChannel(null); }}
            onClose={() => setPipChannel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CanaisTVPage;
