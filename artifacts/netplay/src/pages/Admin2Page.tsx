import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Image, Tv2, CheckCircle2, Loader2, RotateCcw, Zap, Pause, Play, X, RefreshCcw, ToggleLeft, ToggleRight, Clock, Database, Server, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Wifi, WifiOff, Brain, Film, CloudLightning } from 'lucide-react';
import { useSyncContext, SyncJob } from '../contexts/SyncContext';
import AdminFlix3Tab from '../components/admin/AdminFlix3Tab';
import { AdminPlayerAPIsTab } from '../components/admin/AdminPlayerAPIsTab';
import { AdminFlixAPITab } from '../components/admin/AdminFlixAPITab';
import AdminMysqlMigrationTab from '../components/admin/AdminMysqlMigrationTab';

// ─── API Diagnostics ────────────────────────────────────────────────────────

interface ApiCheckResult {
  name: string;
  group: 'terabox' | 'metadata' | 'flix' | 'ai' | 'database';
  status: 'ok' | 'error' | 'warning';
  latencyMs: number | null;
  reason: string;
  detail?: string;
}

interface DiagnosticsData {
  checks: ApiCheckResult[];
  summary: { ok: number; errors: number; warnings: number; total: number };
}

const GROUP_INFO: Record<string, { label: string; accent: string; bar: string }> = {
  terabox:  { label: 'Terabox',               accent: 'text-blue-400',    bar: 'bg-blue-600/30' },
  metadata: { label: 'Metadados (TMDB)',       accent: 'text-purple-400',  bar: 'bg-purple-600/30' },
  flix:     { label: 'APIs Flix',              accent: 'text-orange-400',  bar: 'bg-orange-600/30' },
  ai:       { label: 'Inteligência Artificial', accent: 'text-emerald-400', bar: 'bg-emerald-600/30' },
  database: { label: 'Banco de Dados',         accent: 'text-yellow-400',  bar: 'bg-yellow-600/30' },
};

function getFixSuggestion(check: ApiCheckResult): string {
  const n = check.name.toLowerCase();
  if (n.includes('tmdb'))                    return 'Verifique VITE_TMDB_API_KEY nos Secrets. Acesse themoviedb.org para gerar uma nova chave.';
  if (n.includes('v1') || n.includes('pro')) return 'Verifique TERABOX_PRO_API_KEY nos Secrets. O servidor teraboxapp.xyz pode estar temporariamente fora do ar.';
  if (n.includes('v2') || n.includes('xapi'))return 'Verifique TERABOX_V2_API_KEY nos Secrets. Acesse xapiverse.com para checar o plano ativo.';
  if (n.includes('v3') || n.includes('prem'))return 'Verifique TERABOX_V3_API_KEY e TERABOX_V3_API_SECRET nos Secrets. Acesse teraboxdl.site.';
  if (n.includes('betterflix'))              return 'betterflix.click pode estar instável. Aguarde alguns minutos e tente novamente.';
  if (n.includes('vidsrc'))                  return 'Todos os domínios VidSrc estão inacessíveis. O serviço pode estar com bloqueio de IP.';
  if (n.includes('flix3'))                   return 'redeflixapi.store pode estar fora do ar. Tente novamente em alguns minutos.';
  if (n.includes('gemini'))                  return 'Verifique VITE_GEMINI_API_KEY nos Secrets. Acesse aistudio.google.com para gerar nova chave.';
  if (n.includes('mysql'))                   return 'Verifique MYSQL_PASSWORD, MYSQL_USER e MYSQL_DATABASE nos Secrets. O Railway pode estar offline.';
  if (n.includes('supabase'))                return 'Verifique VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY nos Secrets.';
  return 'Verifique os Secrets do projeto e tente novamente.';
}

function ApiRow({ check }: { check: ApiCheckResult }) {
  const [open, setOpen] = useState(false);
  const isOk   = check.status === 'ok';
  const isWarn = check.status === 'warning';

  const rowBg  = isOk ? 'bg-green-500/5 border-green-500/15' : isWarn ? 'bg-yellow-500/5 border-yellow-500/15' : 'bg-red-500/5 border-red-500/15';
  const icon   = isOk
    ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
    : isWarn
    ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />;

  const badge  = isOk
    ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : isWarn
    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';

  const label  = isOk ? 'ONLINE' : isWarn ? 'ATENÇÃO' : 'FALHA';

  return (
    <div className={`rounded-xl border ${rowBg} overflow-hidden`}>
      <button
        onClick={() => !isOk && setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {icon}
        <span className="flex-1 text-white font-bold text-sm truncate">{check.name}</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${badge}`}>{label}</span>
        {check.latencyMs !== null && (
          <span className="text-gray-600 text-[10px] font-bold shrink-0 ml-1">{check.latencyMs}ms</span>
        )}
        {!isOk && (
          open
            ? <ChevronUp className="w-3 h-3 text-gray-600 shrink-0 ml-1" />
            : <ChevronDown className="w-3 h-3 text-gray-600 shrink-0 ml-1" />
        )}
      </button>

      {!isOk && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                <p className="text-xs text-gray-300">
                  <span className="font-bold text-white">Motivo:</span> {check.reason}
                </p>
                {check.detail && (
                  <p className="text-[10px] text-gray-600 font-mono break-all bg-black/30 rounded-lg px-3 py-2">{check.detail}</p>
                )}
                <p className="text-[10px] text-gray-500">
                  <span className="font-bold text-gray-400">Como corrigir:</span> {getFixSuggestion(check)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function ApiDiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/api-diagnostics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastRun(new Date());
    } catch (e: any) {
      setError(e.message || 'Falha ao executar diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  const grouped = data
    ? (['terabox', 'metadata', 'flix', 'ai', 'database'] as const).map(group => ({
        group,
        checks: data.checks.filter(c => c.group === group),
      })).filter(g => g.checks.length > 0)
    : [];

  const pct = data ? Math.round((data.summary.ok / data.summary.total) * 100) : 0;
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-5">
      {/* Header + button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
            Testa cada API com uma chamada real ao servidor externo
          </p>
          {lastRun && (
            <p className="text-gray-700 text-[10px] mt-0.5">
              Último teste: {lastRun.toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-teal-600/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Testando...' : 'Testar Todas Agora'}
        </button>
      </div>

      {/* Estado vazio */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center bg-white/3 rounded-2xl border border-white/5">
          <WifiOff className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 font-bold text-sm">Nenhum diagnóstico ainda</p>
          <p className="text-gray-700 text-xs max-w-xs">Clique em <span className="text-teal-400 font-bold">Testar Todas Agora</span> para verificar cada API em tempo real</p>
        </div>
      )}

      {/* Carregando */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-gray-400 font-bold text-sm">Testando todas as APIs...</p>
          <p className="text-gray-600 text-xs">Pode levar até 10 segundos</p>
        </div>
      )}

      {/* Erro */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
          <XCircle className="w-7 h-7 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-bold text-sm">Erro ao executar diagnóstico</p>
          <p className="text-gray-600 text-xs mt-1">{error}</p>
        </div>
      )}

      {/* Resultados */}
      {data && !loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Barra de saúde geral */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs uppercase tracking-widest">Saúde Geral</span>
              <span className={`text-base font-black ${pct === 100 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor}`}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
              <span className="text-green-400">{data.summary.ok} online</span>
              {data.summary.warnings > 0 && <span className="text-yellow-400">{data.summary.warnings} atenção</span>}
              {data.summary.errors > 0 && <span className="text-red-400">{data.summary.errors} com falha</span>}
            </div>
          </div>

          {/* Grupos */}
          {grouped.map(({ group, checks }) => {
            const info = GROUP_INFO[group];
            const ok = checks.filter(c => c.status === 'ok').length;
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-1.5 h-5 rounded-full ${info.bar}`} />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${info.accent}`}>{info.label}</h3>
                  <span className="text-gray-700 text-[9px] font-bold ml-auto">{ok}/{checks.length} online</span>
                </div>
                <div className="space-y-1.5">
                  {checks.map(c => <ApiRow key={c.name} check={c} />)}
                </div>
              </div>
            );
          })}

          {/* Explicação erros 500 */}
          {data.summary.errors > 0 && (
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5">
              <p className="text-red-400 font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5" /> Por que aparecem erros 500?
              </p>
              <ul className="space-y-1.5 text-[11px] text-gray-500 list-disc list-inside">
                <li>Servidor externo fora do ar (Terabox, BetterFlix, VidSrc)</li>
                <li>Chave de API inválida, expirada ou sem créditos</li>
                <li>Link do Terabox expirado — use o keepwarm para manter ativo</li>
                <li>IP do servidor bloqueado pelo serviço externo</li>
                <li>Limite de requisições atingido no plano atual</li>
              </ul>
              <p className="text-[10px] text-gray-700 mt-3">Clique nas linhas com <span className="text-red-400 font-bold">FALHA</span> acima para ver o motivo exato e como corrigir.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

const AUTO_SYNC_KEY = 'netplay_admin2_autosync';
const LAST_FLIX3_SYNC_KEY = 'netplay_last_flix3_sync';

export default function Admin2Page({ navigate }: { navigate: (to: any) => void }) {
  const { logoJob, providerJob, startLogos, startProviders, pauseLogos, pauseProviders, cancelLogos, cancelProviders, resetLogos, resetProviders } = useSyncContext();
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem(AUTO_SYNC_KEY) === 'true');
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const raw = localStorage.getItem(LAST_FLIX3_SYNC_KEY);
    return raw ? new Date(raw) : null;
  });
  const [showFlix3, setShowFlix3] = useState(true);
  const flix3Ref = useRef<{ syncAll: () => void } | null>(null);

  const triggerFlix3SyncAll = () => {
    const event = new CustomEvent('flix3-sync-all');
    window.dispatchEvent(event);
    const now = new Date();
    localStorage.setItem(LAST_FLIX3_SYNC_KEY, now.toISOString());
    setLastSync(now);
  };

  useEffect(() => {
    if (!autoSync) return;
    const stored = localStorage.getItem(LAST_FLIX3_SYNC_KEY);
    if (stored) {
      const last = new Date(stored);
      const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }
    triggerFlix3SyncAll();
  }, [autoSync]);

  const toggleAutoSync = () => {
    const next = !autoSync;
    setAutoSync(next);
    localStorage.setItem(AUTO_SYNC_KEY, String(next));
    if (next) triggerFlix3SyncAll();
  };

  const hoursAgo = lastSync
    ? Math.round((Date.now() - lastSync.getTime()) / (1000 * 60 * 60))
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-20 pb-32 px-4 md:px-12">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-black uppercase tracking-widest text-xs"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-red-600 rounded-full" />
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
              Admin <span className="text-red-600">2.0</span>
            </h1>
          </div>
        </div>

        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-10 pl-5 border-l-2 border-red-600/30">
          Ferramentas de sincronização em massa para todo o catálogo
        </p>

        {/* ── Diagnóstico de APIs ── */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-6 bg-teal-500 rounded-full" />
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-teal-400 flex items-center gap-2">
                <Server size={20} /> Diagnóstico de APIs
              </h2>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mt-1">
                TMDB · Terabox V1/V2/V3 · BetterFlix · VidSrc · Flix3 · Gemini AI · Supabase
              </p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
            <ApiDiagnosticsPanel />
          </div>
        </section>

        {/* ── Flix API 3.0 ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-emerald-500 rounded-full" />
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-emerald-400">
                Flix API 3.0 — Sincronização de Catálogo
              </h2>
            </div>
            <button
              onClick={() => setShowFlix3(v => !v)}
              className="text-gray-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              {showFlix3 ? 'Recolher' : 'Expandir'}
            </button>
          </div>

          {/* Auto-sync + Sync-all bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <button
              onClick={triggerFlix3SyncAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20"
            >
              <RefreshCcw size={13} /> Sincronizar Tudo Agora
            </button>

            <button
              onClick={toggleAutoSync}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border ${
                autoSync
                  ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {autoSync ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              Automático
            </button>

            {autoSync && (
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                <Clock size={10} className="text-emerald-600" />
                {lastSync
                  ? hoursAgo === 0 ? 'Sincronizado há pouco' : `Última sync: ${hoursAgo}h atrás`
                  : 'Aguardando primeira sync...'}
              </div>
            )}

            {autoSync && (
              <span className="ml-auto text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                Verifica novos conteúdos a cada 24h ao abrir o painel
              </span>
            )}
          </div>

          {showFlix3 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8"
            >
              <AdminFlix3Tab onRefresh={() => {
                const now = new Date();
                localStorage.setItem(LAST_FLIX3_SYNC_KEY, now.toISOString());
                setLastSync(now);
              }} />
            </motion.div>
          )}
        </section>

        {/* ── Configurações BetterFlix API ── */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-6 bg-red-500 rounded-full" />
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-red-400">
              BetterFlix — API &amp; Chave B2B
            </h2>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
            <AdminFlixAPITab />
          </div>
        </section>

        {/* ── Players Ativos ── */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-6 bg-indigo-500 rounded-full" />
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-indigo-400">
              Players Ativos
            </h2>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
            <AdminPlayerAPIsTab />
          </div>
        </section>

        {/* ── MySQL Railway ── */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-6 bg-purple-500 rounded-full" />
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-purple-400 flex items-center gap-2">
                <Database size={20} /> MySQL Railway — Banco Secundário
              </h2>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mt-1">
                Migração automática de todo o conteúdo · zephyr.proxy.rlwy.net:47257
              </p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
            <AdminMysqlMigrationTab />
          </div>
        </section>

        {/* ── Ferramentas de Metadados ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-6 bg-red-600 rounded-full" />
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
            Sincronização de Metadados
          </h2>
        </div>

        <div className="space-y-6">
          <SyncCard
            icon={<Image size={28} />}
            title="Sincronizar Logos"
            description="Busca e salva a logo oficial (PNG transparente) no TMDB para todos os filmes e séries que ainda não têm logo. Ideal para rodar após importações em massa."
            job={logoJob}
            onStart={() => startLogos(0)}
            onResume={() => startLogos(logoJob.resumeFrom)}
            onPause={pauseLogos}
            onCancel={cancelLogos}
            onReset={resetLogos}
            color="blue"
          />

          <SyncCard
            icon={<Tv2 size={28} />}
            title="Sincronizar Streamings"
            description='Busca no TMDB onde cada filme/série está disponível para assistir no Brasil (Netflix, Max, Prime, etc.) e salva o campo "Onde Assistir" de cada conteúdo.'
            job={providerJob}
            onStart={() => startProviders(0)}
            onResume={() => startProviders(providerJob.resumeFrom)}
            onPause={pauseProviders}
            onCancel={cancelProviders}
            onReset={resetProviders}
            color="orange"
          />
        </div>

      </div>
    </div>
  );
}

function SyncCard({
  icon, title, description, job, onStart, onResume, onPause, onCancel, onReset, color
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  job: SyncJob;
  onStart: () => void;
  onResume: () => void;
  onPause: () => void;
  onCancel: () => void;
  onReset: () => void;
  color: 'blue' | 'orange';
}) {
  const accent = color === 'blue' ? 'text-blue-400 border-blue-600/30 bg-blue-600/10' : 'text-orange-400 border-orange-600/30 bg-orange-600/10';
  const bar = color === 'blue' ? 'bg-blue-500' : 'bg-orange-500';
  const btn = color === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500';
  const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;

  const isIdle = job.status === 'idle';
  const isRunning = job.status === 'running' || job.status === 'loading';
  const isPaused = job.status === 'paused';
  const isDone = job.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8"
    >
      <div className="flex items-start gap-5 mb-6">
        <div className={`p-4 rounded-2xl border ${accent}`}>{icon}</div>
        <div className="flex-1">
          <h2 className="text-xl font-black uppercase tracking-tight text-white mb-1">{title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
        </div>
      </div>

      {!isIdle && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 size={14} className="animate-spin text-gray-400" />}
            {isDone && <CheckCircle2 size={14} className="text-green-400" />}
            {isPaused && <Pause size={14} className="text-yellow-400" />}
            <span className="text-gray-300 text-xs font-bold truncate">{job.message}</span>
          </div>

          {job.total > 0 && (
            <>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${bar}`}
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                <span>{job.current} / {job.total}</span>
                <div className="flex gap-4">
                  <span className="text-green-400">{job.updated} atualizados</span>
                  <span className="text-gray-600">{job.skipped} sem dados</span>
                  {job.errors > 0 && <span className="text-red-400">{job.errors} erros</span>}
                </div>
                <span>{pct}%</span>
              </div>
            </>
          )}

          {isPaused && job.total > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={onResume}
              className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-green-600/20 border border-green-600/30 rounded-2xl text-green-400 font-black uppercase text-[10px] tracking-widest hover:bg-green-600/30 transition-colors"
            >
              <Play size={12} /> Continuar de onde parou ({pct}%)
            </motion.button>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {isIdle && (
          <button
            onClick={onStart}
            className={`flex items-center gap-2 px-6 py-3 ${btn} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl`}
          >
            <Zap size={14} /> Iniciar Sincronização
          </button>
        )}

        {isRunning && (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-6 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-yellow-600/30"
          >
            <Pause size={14} /> Pausar
          </button>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className={`flex items-center gap-2 px-6 py-3 ${btn} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl`}
            >
              <Play size={14} /> Continuar
            </button>
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-white/10"
            >
              <Zap size={12} /> Reiniciar do zero
            </button>
          </>
        )}

        {(isRunning || isPaused) && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-3 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-red-900/30"
          >
            <X size={14} /> Cancelar
          </button>
        )}

        {isDone && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-white/10"
          >
            <RotateCcw size={14} /> Reiniciar
          </button>
        )}
      </div>
    </motion.div>
  );
}
