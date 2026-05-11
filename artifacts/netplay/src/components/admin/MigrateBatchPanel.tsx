import React, { useState, useMemo } from 'react';
import {
  ArrowRight, CheckSquare, Square, Shuffle, ChevronDown,
  CheckCheck, Minus,
} from 'lucide-react';
import { Movie, Episode, PreferredQuality } from '../../types';

// ─── URL helpers ──────────────────────────────────────────────────────────────

type TApi = 1 | 2 | 3;

const PREFIX: Record<TApi, string> = {
  1: 'terabox-folder://',
  2: 'terabox-folder-v2://',
  3: 'terabox-folder-v3://',
};

const API_LABEL: Record<TApi, string> = { 1: 'API 1 — Pro', 2: 'API 2', 3: 'API 3' };
const API_SHORT: Record<TApi, string> = { 1: 'Pro', 2: 'V2', 3: 'V3' };
const API_COLOR: Record<TApi, string> = {
  1: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  2: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  3: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};
const API_BTN: Record<TApi, string> = {
  1: 'bg-yellow-500/15 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/40',
  2: 'bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border-blue-500/40',
  3: 'bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border-purple-500/40',
};

const QUALITY_OPTIONS: { value: PreferredQuality; label: string }[] = [
  { value: 'auto',   label: 'Auto (Stream)' },
  { value: '1080p',  label: '1080p — Full HD' },
  { value: '720p',   label: '720p — HD' },
  { value: '480p',   label: '480p — SD' },
  { value: '360p',   label: '360p' },
  { value: 'direct', label: 'Link Direto' },
];

function detectApi(url: string): TApi | null {
  if (!url) return null;
  if (url.startsWith(PREFIX[3])) return 3;
  if (url.startsWith(PREFIX[2])) return 2;
  if (url.startsWith(PREFIX[1])) return 1;
  return null;
}

function migrateUrl(url: string, to: TApi): string {
  const from = detectApi(url);
  if (!from || from === to) return url;
  return PREFIX[to] + url.slice(PREFIX[from].length);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  editingMovie: Movie;
  setEditingMovie: React.Dispatch<React.SetStateAction<Movie | null>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MigrateBatchPanel: React.FC<Props> = ({ editingMovie, setEditingMovie }) => {
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState<'api' | 'quality'>('api');
  const [targetApi, setTargetApi]     = useState<TApi>(3);
  const [targetQuality, setTargetQuality] = useState<PreferredQuality>('auto');
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [done, setDone]               = useState<string | null>(null);

  const isSeries = editingMovie.type === 'series';
  const episodes: Episode[] = editingMovie.episodes || [];

  // For series: only episodes with dynamic-ref URLs can be migrated
  const eligible = useMemo(() =>
    isSeries ? episodes.filter(ep =>
      detectApi(ep.videoUrl) !== null || detectApi(ep.videoUrl2 || '') !== null
    ) : [],
    [episodes, isSeries],
  );

  // Movie URL detection
  const movieApi = detectApi(editingMovie.videoUrl || '') || detectApi(editingMovie.videoUrl2 || '');

  // Don't render if there's nothing terabox-related
  if (!isSeries && !movieApi) return null;

  const allSelected = eligible.length > 0 && eligible.every(ep => selected.has(ep.id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(eligible.map(ep => ep.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const flash = (msg: string) => {
    setDone(msg);
    setTimeout(() => setDone(null), 2500);
  };

  // ── Movie actions ──────────────────────────────────────────────────────────
  const applyMovieApi = (api: TApi) => {
    setEditingMovie(prev => {
      if (!prev) return null;
      return {
        ...prev,
        videoUrl: prev.videoUrl ? migrateUrl(prev.videoUrl, api) : prev.videoUrl,
        videoUrl2: prev.videoUrl2 ? migrateUrl(prev.videoUrl2, api) : prev.videoUrl2,
      };
    });
    flash(`Migrado para ${API_SHORT[api]}`);
  };

  // ── Series actions ─────────────────────────────────────────────────────────
  const applySeriesApi = () => {
    const ids = selected;
    setEditingMovie(prev => {
      if (!prev) return null;
      return {
        ...prev,
        episodes: (prev.episodes || []).map(ep => {
          if (!ids.has(ep.id)) return ep;
          return {
            ...ep,
            videoUrl: migrateUrl(ep.videoUrl, targetApi),
            videoUrl2: ep.videoUrl2 ? migrateUrl(ep.videoUrl2, targetApi) : ep.videoUrl2,
          };
        }),
      };
    });
    flash(`${ids.size} ep(s) → ${API_SHORT[targetApi]}`);
    setSelected(new Set());
  };

  const applySeriesQuality = () => {
    const ids = selected;
    setEditingMovie(prev => {
      if (!prev) return null;
      return {
        ...prev,
        episodes: (prev.episodes || []).map(ep => {
          if (!ids.has(ep.id)) return ep;
          return { ...ep, preferredQuality: targetQuality };
        }),
      };
    });
    flash(`Qualidade "${targetQuality}" em ${ids.size} ep(s)`);
    setSelected(new Set());
  };

  const applyAllApi = () => {
    setSelected(new Set(eligible.map(ep => ep.id)));
    setTimeout(applySeriesApi, 0);
  };

  const applyAllQuality = () => {
    const ids = new Set(eligible.map(ep => ep.id));
    setEditingMovie(prev => {
      if (!prev) return null;
      return {
        ...prev,
        episodes: (prev.episodes || []).map(ep => {
          if (!ids.has(ep.id)) return ep;
          return { ...ep, preferredQuality: targetQuality };
        }),
      };
    });
    flash(`Qualidade "${targetQuality}" em todos (${eligible.length})`);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-orange-500/20 bg-gradient-to-br from-orange-950/30 to-transparent">
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shuffle size={13} className="text-orange-400" />
          <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
            Migrar API / Qualidade em Massa
          </span>
          {done && (
            <span className="text-[9px] font-bold text-green-400 bg-green-500/20 border border-green-500/30 px-2 py-0.5 rounded-full animate-pulse">
              ✓ {done}
            </span>
          )}
        </div>
        <ChevronDown
          size={13}
          className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Body ── */}
      {open && (
        <div className="px-4 pb-4 space-y-4">

          {/* Tabs */}
          <div className="flex gap-1 bg-black/40 rounded-xl p-1">
            {(['api', 'quality'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t
                    ? 'bg-orange-600/50 text-orange-200'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'api' ? '🔀 Migrar API' : '🎯 Qualidade'}
              </button>
            ))}
          </div>

          {/* ══════════════════ MOVIE ══════════════════ */}
          {!isSeries && movieApi && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider">API atual:</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${API_COLOR[movieApi]}`}>
                  {API_LABEL[movieApi]}
                </span>
              </div>

              {tab === 'api' ? (
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as TApi[]).map(api => (
                    <button
                      key={api}
                      type="button"
                      disabled={api === movieApi}
                      onClick={() => applyMovieApi(api)}
                      className={`py-2.5 rounded-xl text-[10px] font-black border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${API_BTN[api]}`}
                    >
                      {api === movieApi ? `✓ ${API_SHORT[api]}` : `→ ${API_SHORT[api]}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-gray-500 bg-black/20 rounded-xl p-3">
                  Para filmes, use o campo "Qualidade Forçada" acima — aplica diretamente ao vídeo sem precisar selecionar.
                </p>
              )}
            </div>
          )}

          {/* ══════════════════ SERIES ══════════════════ */}
          {isSeries && (
            <div className="space-y-3">

              {/* Target selector row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider shrink-0">
                  {tab === 'api' ? 'Destino:' : 'Qualidade:'}
                </span>

                {tab === 'api' ? (
                  <div className="flex gap-1.5">
                    {([1, 2, 3] as TApi[]).map(api => (
                      <button
                        key={api}
                        type="button"
                        onClick={() => setTargetApi(api)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${
                          targetApi === api
                            ? API_COLOR[api] + ' ring-1 ring-current ring-offset-1 ring-offset-black'
                            : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                        }`}
                      >
                        {API_SHORT[api]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    value={targetQuality}
                    onChange={e => setTargetQuality(e.target.value as PreferredQuality)}
                    className="bg-black/40 border border-white/10 rounded-lg py-1 px-3 text-[10px] font-bold text-white"
                  >
                    {QUALITY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quick-apply all + select all row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Apply ALL without selecting */}
                <button
                  type="button"
                  onClick={tab === 'api' ? applyAllApi : applyAllQuality}
                  disabled={eligible.length === 0}
                  className="flex items-center gap-1.5 bg-orange-600/70 hover:bg-orange-600 disabled:opacity-30 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border border-orange-500/50"
                >
                  <CheckCheck size={11} />
                  Todos ({eligible.length})
                </button>

                {/* Divider */}
                <span className="text-[9px] text-gray-600 font-bold">ou selecione:</span>

                {/* Toggle all */}
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 hover:text-white transition-colors border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-xl"
                >
                  {allSelected
                    ? <><CheckSquare size={11} className="text-red-400" /> Desmarcar</>
                    : someSelected
                      ? <><Minus size={11} className="text-yellow-400" /> Marcar Todos</>
                      : <><Square size={11} /> Marcar Todos</>
                  }
                </button>

                {/* Apply selected */}
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={tab === 'api' ? applySeriesApi : applySeriesQuality}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border border-white/10"
                  >
                    <ArrowRight size={11} />
                    Aplicar ({selected.size})
                  </button>
                )}
              </div>

              {/* Episode list */}
              {eligible.length === 0 ? (
                <p className="text-[9px] text-gray-600 text-center py-3 bg-black/20 rounded-xl">
                  Nenhum episódio com URL Terabox dinâmica.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 scrollbar-hide">
                  {eligible.map(ep => {
                    const api = detectApi(ep.videoUrl) || detectApi(ep.videoUrl2 || '');
                    const isSelected = selected.has(ep.id);
                    const quality = (ep as any).preferredQuality as string | undefined;

                    return (
                      <div
                        key={ep.id}
                        onClick={() => toggleOne(ep.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all select-none border ${
                          isSelected
                            ? 'bg-orange-500/15 border-orange-500/40'
                            : 'bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`shrink-0 transition-colors ${isSelected ? 'text-orange-400' : 'text-gray-600'}`}>
                          {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                        </div>

                        {/* Episode code */}
                        <span className="text-[9px] font-black text-gray-500 w-12 shrink-0 font-mono">
                          {String(ep.season).padStart(2,'0')}×{String(ep.episode).padStart(2,'0')}
                        </span>

                        {/* Title */}
                        <span className="flex-1 text-[9px] text-gray-300 truncate leading-tight">
                          {ep.title || `Episódio ${ep.episode}`}
                        </span>

                        {/* API badge */}
                        {api && (
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border shrink-0 ${API_COLOR[api]}`}>
                            {API_SHORT[api]}
                          </span>
                        )}

                        {/* Quality badge */}
                        <span className={`text-[8px] font-bold w-12 text-right shrink-0 ${
                          quality && quality !== 'auto' ? 'text-green-400' : 'text-gray-600'
                        }`}>
                          {quality || 'auto'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MigrateBatchPanel;
