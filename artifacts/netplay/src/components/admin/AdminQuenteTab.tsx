import { useEffect, useState, useMemo, useCallback } from 'react';
import { Flame, Play, RefreshCw, Power, Clock, Activity, Database, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { Movie } from '../../types';

interface KeepwarmStatus {
  config: {
    enabled: boolean;
    intervalMs: number;
    expiresAt: number | null;
    remainingMs: number | null;
  };
  stats: {
    total: number;
    bySource: Record<string, number>;
    ok: number;
    pending: number;
    failed: number;
  };
  lastCycle: { startedAt: number; durationMs: number; success: number; failed: number; total: number } | null;
  etaMs: number;
  cycleInProgress: boolean;
  items: Array<{
    url: string;
    source: string;
    origin: string;
    lastSeenSec: number;
    lastWarmedSec: number | null;
    lastStatus: 'ok' | 'fail' | 'pending';
    failures: number;
    warmCount: number;
  }>;
}

interface Props {
  movies: Movie[];
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
  return Array.from(set);
}

export default function AdminQuenteTab({ movies }: Props) {
  const [status, setStatus] = useState<KeepwarmStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState<number | 'unlimited'>('unlimited');
  const [intervalMs, setIntervalMs] = useState(3 * 60_000);
  const [filter, setFilter] = useState<'all' | 'ok' | 'fail' | 'pending'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [msg, setMsg] = useState<string | null>(null);

  const allUrls = useMemo(() => collectAllUrls(movies), [movies]);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/keepwarm/status');
      if (!r.ok) return;
      const data: KeepwarmStatus = await r.json();
      setStatus(data);
      setIntervalMs(data.config.intervalMs);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 10_000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await fetch('/api/keepwarm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: allUrls }),
      });
      const data = await r.json();
      setMsg(`Sincronizado: ${data.added || 0} novos, ${data.updated || 0} já existiam (total: ${data.totalTracked})`);
      await fetchStatus();
    } catch (e: any) {
      setMsg(`Erro ao sincronizar: ${e?.message || e}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetConfig = async (opts: { enabled?: boolean; intervalMs?: number; durationMs?: number | 'unlimited' }) => {
    setLoading(true);
    try {
      const body: any = {};
      if (typeof opts.enabled === 'boolean') body.enabled = opts.enabled;
      if (typeof opts.intervalMs === 'number') body.intervalMs = opts.intervalMs;
      if (opts.durationMs !== undefined) body.durationMs = opts.durationMs === 'unlimited' ? 'unlimited' : opts.durationMs;
      const r = await fetch('/api/keepwarm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: KeepwarmStatus = await r.json();
      setStatus(data);
    } finally {
      setLoading(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setMsg('Aquecendo todos os links agora...');
    try {
      await fetch('/api/keepwarm/run-now', { method: 'POST' });
      setMsg('Ciclo disparado. Atualizando...');
      // Atualiza repetidamente enquanto o ciclo roda
      const startedAt = Date.now();
      const poll = async () => {
        await fetchStatus();
        const cur = await fetch('/api/keepwarm/status').then(r => r.json()).catch(() => null);
        if (cur && !cur.cycleInProgress) {
          setMsg(`Concluído em ${formatMs(Date.now() - startedAt)} — ${cur.lastCycle?.success || 0} ok / ${cur.lastCycle?.failed || 0} falha de ${cur.lastCycle?.total || 0}`);
          setRunning(false);
          return;
        }
        setTimeout(poll, 3000);
      };
      setTimeout(poll, 2000);
    } catch (e: any) {
      setMsg(`Erro: ${e?.message || e}`);
      setRunning(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!status) return [];
    return status.items.filter(it => {
      if (filter !== 'all' && it.lastStatus !== filter) return false;
      if (sourceFilter !== 'all' && it.source !== sourceFilter) return false;
      return true;
    });
  }, [status, filter, sourceFilter]);

  const enabled = status?.config.enabled ?? true;
  const remaining = status?.config.remainingMs;

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
          <StatCard icon={Database} label="Total rastreado" value={String(status?.stats.total ?? '—')} color="text-white" />
          <StatCard icon={CheckCircle2} label="Quentes" value={String(status?.stats.ok ?? '—')} color="text-emerald-400" />
          <StatCard icon={AlertCircle} label="Aguardando" value={String(status?.stats.pending ?? '—')} color="text-yellow-400" />
          <StatCard icon={XCircle} label="Com falha" value={String(status?.stats.failed ?? '—')} color="text-red-400" />
          <StatCard icon={Clock} label="ETA por ciclo" value={status ? formatMs(status.etaMs) : '—'} color="text-orange-400" />
        </div>
      </section>

      {/* Controls */}
      <section className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-3xl">
        <h3 className="text-lg font-black italic text-white mb-4 flex items-center gap-2">
          <Activity size={18} /> Controle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Liga/Desliga */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Status</label>
            <button
              onClick={() => handleSetConfig({ enabled: !enabled })}
              disabled={loading}
              className={`w-full px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${enabled ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30' : 'bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-gray-700/60'}`}
            >
              <Power size={16} /> {enabled ? 'ATIVADO' : 'DESATIVADO'} {remaining !== null && remaining !== undefined && remaining > 0 && enabled ? ` · ${formatMs(remaining)} restantes` : ''}
            </button>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Duração total</label>
            <div className="flex gap-2">
              <select
                value={String(duration)}
                onChange={(e) => {
                  const v = e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value);
                  setDuration(v as any);
                }}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-bold focus:outline-none focus:border-orange-500"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => handleSetConfig({ durationMs: duration, enabled: true })}
                disabled={loading}
                className="px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Intervalo entre ciclos */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Intervalo entre ciclos</label>
            <div className="flex gap-2">
              <select
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-bold focus:outline-none focus:border-orange-500"
              >
                {INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => handleSetConfig({ intervalMs })}
                disabled={loading}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all"
              >
                Salvar
              </button>
            </div>
          </div>

          {/* Aquecer agora */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-black text-gray-400 tracking-widest">Aquecer todos agora</label>
            <button
              onClick={handleRunNow}
              disabled={running || (status?.cycleInProgress ?? false)}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-orange-600/20"
            >
              <Play size={16} /> {running || status?.cycleInProgress ? 'Aquecendo...' : 'Aquecer agora'}
              {status && <span className="opacity-75 text-xs">(~{formatMs(status.etaMs)})</span>}
            </button>
          </div>
        </div>

        {/* Sync biblioteca */}
        <div className="mt-6 p-4 bg-black/30 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-white">Sincronizar biblioteca</p>
              <p className="text-xs text-gray-400">Adiciona TODOS os {allUrls.length} links da biblioteca à fila de aquecimento (mesmo os que nunca foram clicados).</p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || allUrls.length === 0}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sincronizar {allUrls.length} links
            </button>
          </div>
          {msg && <p className="mt-3 text-xs text-orange-300">{msg}</p>}
        </div>

        {status?.lastCycle && (
          <div className="mt-4 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>Último ciclo: {formatMs(Date.now() - status.lastCycle.startedAt)} atrás</span>
            <span>Duração: {formatMs(status.lastCycle.durationMs)}</span>
            <span className="text-emerald-400">{status.lastCycle.success} ok</span>
            <span className="text-red-400">{status.lastCycle.failed} falha</span>
          </div>
        )}
      </section>

      {/* Lista */}
      <section className="bg-white/5 p-4 md:p-6 rounded-3xl border border-white/10 backdrop-blur-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-black italic text-white">Links rastreados ({filteredItems.length})</h3>
          <div className="flex flex-wrap gap-2">
            {(['all', 'ok', 'pending', 'fail'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filter === f ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {f === 'all' ? 'Todos' : f === 'ok' ? 'Quentes' : f === 'pending' ? 'Aguardando' : 'Falha'}
              </button>
            ))}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-bold focus:outline-none"
            >
              <option value="all">Todos os tipos</option>
              {status && Object.keys(status.stats.bySource).map(s => (
                <option key={s} value={s}>{s} ({status.stats.bySource[s]})</option>
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
              {filteredItems.slice(0, 200).map((it, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2">
                    {it.lastStatus === 'ok' ? <span className="text-emerald-400 text-xs font-black">● QUENTE</span>
                      : it.lastStatus === 'fail' ? <span className="text-red-400 text-xs font-black">● FALHA ({it.failures})</span>
                      : <span className="text-yellow-400 text-xs font-black">● AGUARDANDO</span>}
                  </td>
                  <td className="py-2 px-2 text-xs text-gray-400 uppercase">{it.source}{it.origin === 'sync' ? ' · sync' : ''}</td>
                  <td className="py-2 px-2 text-xs text-gray-300 font-mono truncate max-w-md">{it.url}</td>
                  <td className="py-2 px-2 text-xs text-gray-400">{it.lastWarmedSec !== null ? `${formatMs(it.lastWarmedSec * 1000)}` : '—'}</td>
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
