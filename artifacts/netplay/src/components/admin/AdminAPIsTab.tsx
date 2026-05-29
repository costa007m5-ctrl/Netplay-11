import React, { useState, useCallback } from 'react';
import {
  Server, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Zap,
  Clock, Wifi, WifiOff, Database, Brain, Film, CloudLightning
} from 'lucide-react';
import { getNativeTeraboxApi, setNativeTeraboxApi } from '../SmartPlayerSelector';

interface ApiCheckResult {
  name: string;
  group: 'terabox' | 'metadata' | 'flix' | 'ai' | 'database';
  status: 'ok' | 'error' | 'warning';
  latencyMs: number | null;
  reason: string;
  detail?: string;
}

interface DiagnosticsResponse {
  checks: ApiCheckResult[];
  summary: { ok: number; errors: number; warnings: number; total: number };
}

const GROUP_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  terabox: {
    label: 'Terabox',
    icon: <CloudLightning className="w-4 h-4" />,
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  },
  metadata: {
    label: 'Metadados',
    icon: <Film className="w-4 h-4" />,
    color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30',
  },
  flix: {
    label: 'APIs Flix',
    icon: <Wifi className="w-4 h-4" />,
    color: 'from-orange-500/20 to-red-500/10 border-orange-500/30',
  },
  ai: {
    label: 'Inteligência Artificial',
    icon: <Brain className="w-4 h-4" />,
    color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
  },
  database: {
    label: 'Banco de Dados',
    icon: <Database className="w-4 h-4" />,
    color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30',
  },
};

function StatusIcon({ status }: { status: ApiCheckResult['status'] }) {
  if (status === 'ok') return <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />;
  if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />;
  return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
}

function StatusBadge({ status }: { status: ApiCheckResult['status'] }) {
  const map = {
    ok: 'bg-green-500/15 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const label = { ok: 'ONLINE', warning: 'ATENÇÃO', error: 'FALHA' };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function ApiCard({ check }: { check: ApiCheckResult }) {
  const [expanded, setExpanded] = useState(false);
  const borderColor =
    check.status === 'ok'
      ? 'border-green-500/20 bg-green-500/5'
      : check.status === 'warning'
      ? 'border-yellow-500/20 bg-yellow-500/5'
      : 'border-red-500/20 bg-red-500/5';

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer hover:brightness-110 ${borderColor}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm truncate">{check.name}</span>
            <StatusBadge status={check.status} />
          </div>
          <p className="text-gray-400 text-xs mt-0.5 truncate">{check.reason}</p>
        </div>
        {check.latencyMs !== null && (
          <div className="flex items-center gap-1 text-gray-500 text-xs shrink-0">
            <Clock className="w-3 h-3" />
            <span>{check.latencyMs}ms</span>
          </div>
        )}
      </div>

      {expanded && check.detail && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-gray-500 font-mono break-all">{check.detail}</p>
        </div>
      )}

      {expanded && check.status !== 'ok' && !check.detail && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-gray-500">{getFixSuggestion(check)}</p>
        </div>
      )}
    </div>
  );
}

function getFixSuggestion(check: ApiCheckResult): string {
  const name = check.name.toLowerCase();
  if (name.includes('tmdb')) return 'Verifique se VITE_TMDB_API_KEY está correto em Secrets. Acesse themoviedb.org para gerar uma nova chave.';
  if (name.includes('v1') || name.includes('pro')) return 'Verifique TERABOX_PRO_API_KEY em Secrets. O servidor teraboxapp.xyz pode estar temporariamente fora do ar.';
  if (name.includes('v2') || name.includes('xapiverse')) return 'Verifique TERABOX_V2_API_KEY em Secrets. Acesse xapiverse.com para verificar o plano ativo.';
  if (name.includes('v3') || name.includes('premium')) return 'Verifique TERABOX_V3_API_KEY e TERABOX_V3_API_SECRET em Secrets. Acesse teraboxdl.site para verificar o plano.';
  if (name.includes('betterflix')) return 'betterflix.click pode estar fora do ar ou com bloqueio de IP. Tente novamente em alguns minutos.';
  if (name.includes('vidsrc')) return 'Todos os domínios VidSrc estão inacessíveis. O serviço pode estar bloqueado ou fora do ar.';
  if (name.includes('flix3')) return 'redeflixapi.store pode estar fora do ar. Aguarde ou tente novamente.';
  if (name.includes('gemini')) return 'Verifique VITE_GEMINI_API_KEY em Secrets. Acesse aistudio.google.com para gerar uma nova chave.';
  if (name.includes('mysql')) return 'Verifique MYSQL_PASSWORD, MYSQL_USER e MYSQL_DATABASE em Secrets. O servidor Railway pode estar offline.';
  if (name.includes('supabase')) return 'Verifique VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY em Secrets.';
  return 'Verifique os Secrets do projeto e tente novamente.';
}

function GroupSection({ group, checks }: { group: string; checks: ApiCheckResult[] }) {
  const meta = GROUP_META[group];
  const ok = checks.filter(c => c.status === 'ok').length;
  const total = checks.length;
  const allOk = ok === total;
  const allBad = ok === 0;

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${meta.color} p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest">
          {meta.icon}
          {meta.label}
        </div>
        <span className={`text-xs font-black ${allOk ? 'text-green-400' : allBad ? 'text-red-400' : 'text-yellow-400'}`}>
          {ok}/{total} online
        </span>
      </div>
      <div className="space-y-2">
        {checks.map(c => (
          <ApiCard key={c.name} check={c} />
        ))}
      </div>
    </div>
  );
}

function SummaryBar({ summary }: { summary: DiagnosticsResponse['summary'] }) {
  const pct = Math.round((summary.ok / summary.total) * 100);
  const color = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-sm">Saúde geral das APIs</span>
        <span className={`text-lg font-black ${pct === 100 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-green-400 font-bold">{summary.ok} online</span>
        <span className="text-yellow-400 font-bold">{summary.warnings} atenção</span>
        <span className="text-red-400 font-bold">{summary.errors} falha</span>
      </div>
    </div>
  );
}

export function AdminAPIsTab() {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [nativeApi, setNativeApiState] = useState<'v1' | 'v3'>(getNativeTeraboxApi());

  const handleNativeApiChange = (api: 'v1' | 'v3') => {
    setNativeTeraboxApi(api);
    setNativeApiState(api);
  };

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/api-diagnostics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DiagnosticsResponse = await res.json();
      setData(json);
      setLastRun(new Date());
    } catch (err: any) {
      setError(err.message || 'Falha ao executar diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  const grouped = data
    ? (['terabox', 'metadata', 'flix', 'ai', 'database'] as const).reduce(
        (acc, group) => {
          acc[group] = data.checks.filter(c => c.group === group);
          return acc;
        },
        {} as Record<string, ApiCheckResult[]>
      )
    : null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500 tracking-tighter uppercase font-mono flex items-center gap-4">
            <Server className="inline-block w-10 h-10 text-teal-400 shrink-0" />
            Diagnóstico de APIs
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl">
            Teste todas as APIs em tempo real — Terabox, TMDB, BetterFlix, VidSrc, Flix3, Gemini AI e bancos de dados.
            Clique em cada card para ver o motivo da falha.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all duration-200 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Testando...' : 'Testar Todas'}
        </button>
      </div>

      <section className="bg-white/5 p-5 rounded-2xl border border-white/10">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-red-400" />
          API Nativa do TeraBox (Player)
        </h3>
        <p className="text-gray-500 text-xs mb-4">
          Define qual API é usada como padrão no Seletor de Player.
        </p>
        <div className="flex gap-3">
          {(['v1', 'v3'] as const).map(api => {
            const active = nativeApi === api;
            const label = api === 'v3' ? 'API 03 (V3 Premium)' : 'API 01 (Pro)';
            const desc = api === 'v3' ? 'Recomendado — Alta velocidade e qualidade' : 'Servidor alternativo confiável';
            return (
              <button
                key={api}
                onClick={() => handleNativeApiChange(api)}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition-all duration-200 ${active ? 'bg-red-600/20 border-red-500/60' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {active && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                  <span className={`text-xs font-black uppercase tracking-widest ${active ? 'text-red-400' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{desc}</p>
                {active && <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1 italic">ATIVO</p>}
              </button>
            );
          })}
        </div>
      </section>

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <WifiOff className="w-14 h-14 text-gray-600" />
          <p className="text-gray-400 text-lg font-bold">Nenhum diagnóstico rodado ainda</p>
          <p className="text-gray-600 text-sm max-w-sm">
            Clique em <span className="text-teal-400 font-bold">Testar Todas</span> para verificar o status de cada API em tempo real.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-10 h-10 text-teal-400 animate-spin" />
          <p className="text-gray-400 font-bold">Testando APIs... isso pode levar até 10 segundos</p>
          <p className="text-gray-600 text-sm">Cada API é testada com uma chamada real ao servidor externo</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-bold">Erro ao executar diagnóstico</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
          <p className="text-gray-600 text-xs mt-2">O servidor da API pode estar reiniciando. Tente novamente em alguns segundos.</p>
        </div>
      )}

      {data && !loading && (
        <>
          <SummaryBar summary={data.summary} />

          {lastRun && (
            <p className="text-gray-600 text-xs text-right">
              Último teste: {lastRun.toLocaleTimeString('pt-BR')}
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(['terabox', 'metadata', 'flix', 'ai', 'database'] as const).map(group => {
              const checks = grouped?.[group] ?? [];
              if (checks.length === 0) return null;
              return <GroupSection key={group} group={group} checks={checks} />;
            })}
          </div>

          {data.summary.errors > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-3">
              <h3 className="text-red-400 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Por que os erros 500 acontecem?
              </h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p>
                  <span className="text-white font-bold">Erro 500</span> significa que o servidor da NetPlay recebeu
                  sua requisição, mas ao tentar chamar a API externa (Terabox, BetterFlix etc.), algo falhou.
                </p>
                <p>As causas mais comuns são:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
                  <li>Servidor externo fora do ar (Terabox, BetterFlix, VidSrc) — aguarde e tente novamente</li>
                  <li>Chave de API inválida ou expirada — atualize nos Secrets do Replit</li>
                  <li>URL do Terabox expirada — links têm validade curta, use o keepwarm</li>
                  <li>Bloqueio de IP — o servidor externo bloqueou o IP do Replit</li>
                  <li>Limite de créditos atingido na API paga — verifique o plano ativo</li>
                </ul>
                <p className="text-xs text-gray-600">
                  Clique em cada card com falha acima para ver o motivo específico e como corrigir.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusCard({ name, active, desc }: { name: string; active: boolean; desc: string }) {
  return (
    <div className={`p-5 rounded-2xl border flex items-start gap-4 transition-all duration-300 ${active ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
      <div className="mt-1">
        {active ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : <XCircle className="w-6 h-6 text-red-500" />}
      </div>
      <div>
        <h4 className={`text-lg font-bold mb-1 ${active ? 'text-green-300' : 'text-red-400'}`}>{name}</h4>
        <p className="text-sm text-gray-400">{desc}</p>
        <p className={`text-xs mt-2 font-bold ${active ? 'text-green-500' : 'text-red-500'}`}>
          {active ? 'CONFIGURADO' : 'FALTANDO'}
        </p>
      </div>
    </div>
  );
}
