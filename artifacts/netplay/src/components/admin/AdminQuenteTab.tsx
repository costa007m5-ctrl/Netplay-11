import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Flame, Play, RefreshCw, Power, Clock, Activity, Database, CheckCircle2, XCircle, AlertCircle, Zap } from 'lucide-react';
import type { Movie } from '../../types';
import { registerKeepwarmSW, pushUrls, pushConfig, triggerRunNow, getSWStatus, registerPeriodicSync, unregisterPeriodicSync, type SWStatus } from '../../lib/keepwarmSW';

interface UrlState {
  url: string;
  source: string;
  lastWarmed: number | null;
  lastStatus: 'ok' | 'fail' | 'pending';
  failures: number;
  warmCount: number;
  lastDurationMs: number | null;
}

interface PersistedState {
  enabled: boolean;
  intervalMs: number;
  expiresAt: number | null; // null = ilimitado, 0 = desativado
  urls: Record<string, UrlState>;
}

const STORAGE_KEY = 'netplay_keepwarm_state_v1';
const BATCH_SIZE = 30;
const BATCH_CONCURRENCY = 4;

function detectSource(url: string): string {
  if (!url) return 'unknown';
  if (url.startsWith('teraboxv2-folder://')) return 'v2';
  if (url.startsWith('terabox-folder://')) return 'v1';
  if (/terabox|1024tera|teraboxapp|dubox|momerybox|4funbox|mirrobox|nephobox|freeterabox|teraboxlink|terafileshare/i.test(url)) return 'v1';
  if (url.includes('player.kingx.dev') || url.includes('teradl.kingx.dev')) return 'kingx';
  if (url.includes('drive.google.com')) return 'drive';
  if (/^https?:\/\//i.test(url) && /\.(m3u8|mp4|webm|mkv|mov)(\?|$)/i.test(url)) return 'direct';
  return 'unknown';
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: false, intervalMs: 3 * 60_000, expiresAt: null, urls: {} };
}

function saveState(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function formatMs(ms: number): string {
  if (ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function collectAllUrls(movies: Movie[]): string[] {
  const set = new Set<string>();
  for (const m of movies) {
    if (m.videoUrl) set.add(m.videoUrl);
    if (m.videoUrl2) set.add(m.videoUrl2);
    if (Array.isArray(m.episodes)) {
      for (const ep of m.episodes) {
        if (ep.videoUrl) set.add(ep.videoUrl);
        if (ep.videoUrl2) set.add(ep.videoUrl2);
      }
    }
  }
  // Filtra apenas URLs aquecíveis
  return Array.from(set).filter((u) => detectSource(u) !== 'unknown');
}

const DURATION_OPTIONS: Array<{ label: string; value: number | 'unlimited' }> = [
  { label: 'Ilimitado', value: 'unlimited' },
  { label: '30 minutos', value: 30 * 60 * 1000 },
  { label: '1 hora', value: 60 * 60 * 1000 },
  { label: '3 horas', value: 3 * 60 * 60 * 1000 },
  { label: '6 horas', value: 6 * 60 * 60 * 1000 },
  { label: '12 horas', value: 12 * 60 * 60 * 1000 },
  { label: '24 horas', value: 24 * 60 * 60 * 1000 },
];

const INTERVAL_OPTIONS = [
  { label: '1 min', value: 60_000 },
  { label: '3 min', value: 3 * 60_000 },
  { label: '5 min', value: 5 * 60_000 },
  { label: '10 min', value: 10 * 60_000 },
  { label: '15 min', value: 15 * 60_000 },
];

interface Props {
  movies: Movie[];
}

export default function AdminQuenteTab({ movies }: Props) {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [duration, setDuration] = useState<number | 'unlimited'>('unlimited');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; ok: number; fail: number; etaMs: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'fail' | 'pending'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [swStatus, setSwStatus] = useState<SWStatus | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const runningRef = useRef(false);
  runningRef.current = running;

  const allUrls = useMemo(() => collectAllUrls(movies), [movies]);

  // Persiste estado quando mudar
  useEffect(() => { saveState(state); }, [state]);

  // Registra Service Worker (segundo plano)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await registerKeepwarmSW();
      if (cancelled) return;
      const s = await getSWStatus();
      if (!cancelled) setSwStatus(s);
    })();
    const refresh = setInterval(async () => {
      const s = await getSWStatus();
      if (!cancelled) setSwStatus(s);
    }, 15_000);

    // Escuta ciclos completados pelo SW
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'keepwarm-cycle-complete' && e.data?.summary) {
        const s = e.data.summary;
        setMsg(`SW concluiu ciclo em ${formatMs(s.durationMs)} — ${s.ok} ok / ${s.fail} falha de ${s.total}`);
        getSWStatus().then((st) => !cancelled && setSwStatus(st));
      }
    };
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', onMsg);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', onMsg);
    };
  }, []);

  // Sincroniza URLs e config com o Service Worker
  const trackedKeys = useMemo(() => Object.keys(state.urls), [state.urls]);
  useEffect(() => {
    pushUrls(trackedKeys).catch(() => {});
  }, [trackedKeys]);
  useEffect(() => {
    pushConfig({ intervalMs: state.intervalMs, expiresAt: state.expiresAt, enabled: state.enabled }).catch(() => {});
  }, [state.intervalMs, state.expiresAt, state.enabled]);

  // Tick para atualizar tempos relativos
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const tracked = useMemo(() => Object.values(state.urls), [state.urls]);

  const stats = useMemo(() => {
    const bySource: Record<string, number> = {};
    let ok = 0, pending = 0, failed = 0;
    for (const u of tracked) {
      bySource[u.source] = (bySource[u.source] || 0) + 1;
      if (u.lastStatus === 'ok') ok++;
      else if (u.lastStatus === 'fail') failed++;
      else pending++;
    }
    // ETA: estimativa baseada em tempo médio
    const withDuration = tracked.filter((u) => u.lastDurationMs !== null);
    const avgMs = withDuration.length > 0
      ? withDuration.reduce((s, u) => s + (u.lastDurationMs || 0), 0) / withDuration.length
      : 1500;
    const etaMs = Math.ceil(tracked.length / BATCH_CONCURRENCY) * avgMs;
    return { total: tracked.length, bySource, ok, pending, failed, etaMs };
  }, [tracked]);

  const remainingMs = state.expiresAt && state.expiresAt > 0 ? state.expiresAt - now : null;

  // Sincroniza biblioteca (adiciona URLs novas, remove as que sumiram)
  const handleSync = () => {
    setState((prev) => {
      const next = { ...prev, urls: { ...prev.urls } };
      const set = new Set(allUrls);
      // Adiciona novas
      let added = 0;
      for (const url of allUrls) {
        if (!next.urls[url]) {
          next.urls[url] = {
            url,
            source: detectSource(url),
            lastWarmed: null,
            lastStatus: 'pending',
            failures: 0,
            warmCount: 0,
            lastDurationMs: null,
          };
          added++;
        }
      }
      // Remove URLs que não existem mais na biblioteca
      let removed = 0;
      for (const k of Object.keys(next.urls)) {
        if (!set.has(k)) {
          delete next.urls[k];
          removed++;
        }
      }
      setMsg(`Sincronizado: ${added} novos, ${removed} removidos. Total: ${Object.keys(next.urls).length}`);
      return next;
    });
  };

  // Aquecer um conjunto específico de URLs (em lotes serverless)
  const warmUrls = useCallback(async (urls: string[]): Promise<{ ok: number; fail: number; total: number; durationMs: number }> => {
    const start = Date.now();
    let totalOk = 0, totalFail = 0;
    setProgress({ done: 0, total: urls.length, ok: 0, fail: 0, etaMs: 0 });

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      if (!runningRef.current) break;
      const batch = urls.slice(i, i + BATCH_SIZE);
      try {
        const r = await fetch('/api/keepwarm-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch, concurrency: BATCH_CONCURRENCY }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        totalOk += data.ok || 0;
        totalFail += data.fail || 0;

        // Atualiza estado com resultados
        setState((prev) => {
          const next = { ...prev, urls: { ...prev.urls } };
          const ts = Date.now();
          for (const res of data.results || []) {
            const cur = next.urls[res.url];
            if (!cur) continue;
            next.urls[res.url] = {
              ...cur,
              source: res.source || cur.source,
              lastWarmed: ts,
              lastStatus: res.ok ? 'ok' : 'fail',
              failures: res.ok ? 0 : cur.failures + 1,
              warmCount: cur.warmCount + (res.ok ? 1 : 0),
              lastDurationMs: res.durationMs ?? cur.lastDurationMs,
            };
          }
          return next;
        });
      } catch (e: any) {
        // Marca todas as URLs do lote como falha
        totalFail += batch.length;
        setState((prev) => {
          const next = { ...prev, urls: { ...prev.urls } };
          const ts = Date.now();
          for (const u of batch) {
            const cur = next.urls[u];
            if (!cur) continue;
            next.urls[u] = { ...cur, lastWarmed: ts, lastStatus: 'fail', failures: cur.failures + 1 };
          }
          return next;
        });
        setMsg(`Erro no lote: ${e?.message || e}`);
      }

      const done = Math.min(i + BATCH_SIZE, urls.length);
      const elapsed = Date.now() - start;
      const avgPerUrl = done > 0 ? elapsed / done : 0;
      const etaMs = Math.max(0, (urls.length - done) * avgPerUrl);
      setProgress({ done, total: urls.length, ok: totalOk, fail: totalFail, etaMs });
    }

    return { ok: totalOk, fail: totalFail, total: urls.length, durationMs: Date.now() - start };
  }, []);

  const handleRunNow = async () => {
    if (running) return;
    const urls = Object.keys(stateRef.current.urls);
    if (urls.length === 0) {
      setMsg('Nenhum link rastreado. Sincronize a biblioteca primeiro.');
      return;
    }
    setRunning(true);
    runningRef.current = true;
    setMsg(`Aquecendo ${urls.length} links...`);
    try {
      const result = await warmUrls(urls);
      setMsg(`Concluído em ${formatMs(result.durationMs)} — ${result.ok} ok / ${result.fail} falha`);
    } finally {
      setRunning(false);
      runningRef.current = false;
      setProgress(null);
    }
  };

  // Loop automático quando ativado
  useEffect(() => {
    if (!state.enabled) return;
    if (state.expiresAt && state.expiresAt > 0 && Date.now() > state.expiresAt) {
      setState((p) => ({ ...p, enabled: false }));
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled || !stateRef.current.enabled) return;
      if (stateRef.current.expiresAt && stateRef.current.expiresAt > 0 && Date.now() > stateRef.current.expiresAt) {
        setState((p) => ({ ...p, enabled: false }));
        return;
      }
      const urls = Object.keys(stateRef.current.urls);
      if (urls.length === 0 || runningRef.current) return;
      setRunning(true);
      runningRef.current = true;
      try { await warmUrls(urls); } finally {
        setRunning(false);
        runningRef.current = false;
        setProgress(null);
      }
    };

    // Primeiro tick rápido (5s) e depois no intervalo configurado
    const initial = setTimeout(tick, 5000);
    const id = setInterval(tick, state.intervalMs);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(id); };
  }, [state.enabled, state.intervalMs, state.expiresAt, warmUrls]);

  const handleToggleEnabled = () => {
    setState((p) => ({ ...p, enabled: !p.enabled }));
  };

  const handleApplyDuration = () => {
    const expiresAt = duration === 'unlimited' ? null : Date.now() + (duration as number);
    setState((p) => ({ ...p, expiresAt, enabled: true }));
    setMsg(duration === 'unlimited' ? 'Modo ilimitado ativado.' : `Vai aquecer pelos próximos ${formatMs(duration as number)}.`);
  };

  const handleSetInterval = (ms: number) => {
    setState((p) => ({ ...p, intervalMs: ms }));
  };

  const filteredItems = useMemo(() => {
    return tracked.filter((it) => {
      if (filter !== 'all' && it.lastStatus !== filter) return false;
      if (sourceFilter !== 'all' && it.source !== sourceFilter) return false;
      return true;
    });
  }, [tracked, filter, sourceFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header / Stats */}
      <section className="bg-gradient-to-br from-orange-600/20 via-red-600/10 to-transparent p-6 md:p-10 rounded-3xl border border-orange-500/20 backdrop-blur-3xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-600/30">
            <Flame size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black italic text-white">Quente</h2>
            <p className="text-sm text-gray-400">Mantém todos os links da biblioteca sempre prontos pra tocar.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Database} label="Total rastreado" value={String(stats.total)} color="text-white" />
          <StatCard icon={CheckCircle2} label="Quentes" value={String(stats.ok)} color="text-emerald-400" />
          <StatCard icon={AlertCircle} label="Aguardando" value={String(stats.pending)} color="text-yellow-400" />
          <StatCard icon={XCircle} label="Com falha" value={String(stats.failed)} color="text-red-400" />
          <StatCard icon={Clock} label="ETA por ciclo" value={formatMs(stats.etaMs)} color="text-orange-400" />
        </div>
      </section>

      {/* Controls */}
      <section className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-3xl">
        <h3 className="text-lg font-black italic text-white mb-4 flex items-center gap-2">
          <Activity size={18} /> Controle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Status</label>
            <button
              onClick={handleToggleEnabled}
              className={`w-full px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${state.enabled ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30' : 'bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-gray-700/60'}`}
            >
              <Power size={16} /> {state.enabled ? 'ATIVADO' : 'DESATIVADO'}
              {state.enabled && remainingMs !== null && remainingMs > 0 && <span className="opacity-75 text-xs">· {formatMs(remainingMs)} restantes</span>}
              {state.enabled && state.expiresAt === null && <span className="opacity-75 text-xs">· ilimitado</span>}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Duração total</label>
            <div className="flex gap-2">
              <select
                value={String(duration)}
                onChange={(e) => setDuration(e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value) as any)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-bold focus:outline-none focus:border-orange-500"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
              <button onClick={handleApplyDuration} className="px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all">Aplicar</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Intervalo entre ciclos</label>
            <select
              value={state.intervalMs}
              onChange={(e) => handleSetInterval(Number(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-bold focus:outline-none focus:border-orange-500"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Aquecer todos agora</label>
            <button
              onClick={handleRunNow}
              disabled={running || tracked.length === 0}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-orange-600/20"
            >
              <Play size={16} /> {running ? 'Aquecendo...' : 'Aquecer agora'}
              {!running && tracked.length > 0 && <span className="opacity-75 text-xs">(~{formatMs(stats.etaMs)})</span>}
            </button>
          </div>
        </div>

        {/* Progresso */}
        {progress && (
          <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-orange-500/20">
            <div className="flex justify-between text-xs text-gray-300 mb-2">
              <span className="font-bold">Progresso: {progress.done}/{progress.total}</span>
              <span>ETA restante: {formatMs(progress.etaMs)}</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-emerald-400">{progress.ok} ok</span>
              <span className="text-red-400">{progress.fail} falha</span>
            </div>
          </div>
        )}

        {/* Sync biblioteca */}
        <div className="mt-6 p-4 bg-black/30 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-white">Sincronizar biblioteca</p>
              <p className="text-xs text-gray-400">Atualiza a fila de aquecimento com TODOS os {allUrls.length} links da biblioteca (mesmo os que nunca foram clicados).</p>
            </div>
            <button onClick={handleSync} className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center gap-2 transition-all">
              <RefreshCw size={14} /> Sincronizar {allUrls.length} links
            </button>
          </div>
          {msg && <p className="mt-3 text-xs text-orange-300">{msg}</p>}
        </div>

        {/* Segundo plano (Service Worker) */}
        <div className="mt-4 p-4 bg-purple-600/10 rounded-2xl border border-purple-500/20">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Zap size={14} className="text-purple-400" /> Segundo plano (Service Worker)
              </p>
              {swStatus ? (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <p>
                    Status:{' '}
                    {swStatus.active ? (
                      <span className="text-emerald-400 font-bold">ATIVO</span>
                    ) : swStatus.registered ? (
                      <span className="text-yellow-400 font-bold">REGISTRADO (instalando…)</span>
                    ) : (
                      <span className="text-red-400 font-bold">NÃO REGISTRADO</span>
                    )}
                    {swStatus.urlCount > 0 && <span className="opacity-70"> · {swStatus.urlCount} URLs sincronizadas</span>}
                  </p>
                  <p>
                    Sync periódico:{' '}
                    {swStatus.periodicSyncSupported ? (
                      swStatus.periodicSyncRegistered ? (
                        <span className="text-emerald-400 font-bold">REGISTRADO</span>
                      ) : (
                        <span className="text-gray-400">disponível, não registrado</span>
                      )
                    ) : (
                      <span className="text-gray-500">não suportado neste navegador</span>
                    )}
                    <span className="opacity-60"> · permissão: {swStatus.permission}</span>
                  </p>
                  {swStatus.lastCycle && (
                    <p>
                      Último ciclo do SW:{' '}
                      <span className="text-gray-300">
                        {formatMs(now - swStatus.lastCycle.at)} atrás · {swStatus.lastCycle.ok} ok / {swStatus.lastCycle.fail} falha
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Carregando status…</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  if (swStatus?.periodicSyncRegistered) {
                    await unregisterPeriodicSync();
                    setMsg('Sync periódico desregistrado.');
                  } else {
                    const r = await registerPeriodicSync(state.intervalMs);
                    setMsg(r.ok ? 'Sync periódico registrado!' : `Não registrado: ${r.reason}`);
                  }
                  setSwStatus(await getSWStatus());
                }}
                disabled={!swStatus?.periodicSyncSupported}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700/40 disabled:text-gray-500 text-white font-bold text-xs transition-all whitespace-nowrap"
              >
                {swStatus?.periodicSyncRegistered ? 'Desativar sync periódico' : 'Ativar sync periódico'}
              </button>
              <button
                onClick={async () => {
                  await triggerRunNow();
                  setMsg('Disparado no Service Worker.');
                  setTimeout(async () => setSwStatus(await getSWStatus()), 1500);
                }}
                disabled={!swStatus?.active}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all whitespace-nowrap"
              >
                Aquecer via SW
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 italic mt-3">
            O Service Worker continua aquecendo mesmo com a aba minimizada ou em outra guia. Pra <b>sync periódico</b> (rodar com o navegador fechado), use Chrome/Edge e instale o site como PWA.
          </p>
        </div>
      </section>

      {/* Lista */}
      <section className="bg-white/5 p-4 md:p-6 rounded-3xl border border-white/10 backdrop-blur-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-black italic text-white">Links rastreados ({filteredItems.length})</h3>
          <div className="flex flex-wrap gap-2">
            {(['all', 'ok', 'pending', 'fail'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filter === f ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {f === 'all' ? 'Todos' : f === 'ok' ? 'Quentes' : f === 'pending' ? 'Aguardando' : 'Falha'}
              </button>
            ))}
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-bold focus:outline-none">
              <option value="all">Todos os tipos</option>
              {Object.keys(stats.bySource).map((s) => (
                <option key={s} value={s}>{s} ({stats.bySource[s]})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 font-black tracking-widest">
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Tipo</th>
                <th className="py-2 px-2">URL</th>
                <th className="py-2 px-2">Aquecido há</th>
                <th className="py-2 px-2">Ciclos</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">Nenhum link rastreado. Sincronize a biblioteca acima.</td></tr>
              )}
              {filteredItems.slice(0, 200).map((it) => (
                <tr key={it.url} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2">
                    {it.lastStatus === 'ok' ? <span className="text-emerald-400 text-xs font-black">● QUENTE</span>
                      : it.lastStatus === 'fail' ? <span className="text-red-400 text-xs font-black">● FALHA ({it.failures})</span>
                      : <span className="text-yellow-400 text-xs font-black">● AGUARDANDO</span>}
                  </td>
                  <td className="py-2 px-2 text-xs text-gray-400 uppercase">{it.source}</td>
                  <td className="py-2 px-2 text-xs text-gray-300 font-mono truncate max-w-md">{it.url.length > 100 ? it.url.slice(0, 100) + '…' : it.url}</td>
                  <td className="py-2 px-2 text-xs text-gray-400">{it.lastWarmed ? formatMs(now - it.lastWarmed) : '—'}</td>
                  <td className="py-2 px-2 text-xs text-gray-400">{it.warmCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length > 200 && (
            <p className="mt-3 text-xs text-gray-500 text-center">Mostrando 200 de {filteredItems.length}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon size={14} />
        <span className="text-[10px] uppercase font-black tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-black italic ${color}`}>{value}</p>
    </div>
  );
}
