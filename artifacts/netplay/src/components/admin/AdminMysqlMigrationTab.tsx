import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, CheckCircle2, XCircle, Loader2, Play, RefreshCcw,
  Table2, ArrowRight, AlertTriangle, Zap, Server
} from 'lucide-react';

interface MysqlStats {
  movies: number;
  settings: number;
  streaming_providers: number;
  users: number;
  watch_history: number;
  favorites: number;
  watch_parties: number;
}

type Step = 'idle' | 'testing' | 'creating' | 'migrating' | 'done' | 'error';

export default function AdminMysqlMigrationTab() {
  const [step, setStep] = useState<Step>('idle');
  const [connOk, setConnOk] = useState<boolean | null>(null);
  const [connMsg, setConnMsg] = useState('');
  const [tablesCreated, setTablesCreated] = useState<string[]>([]);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0, offset: 0 });
  const [stats, setStats] = useState<MysqlStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);

  const fetchStats = async () => {
    try {
      const r = await fetch('/api/mysql/stats');
      const data = await r.json();
      if (data.success) setStats(data.stats);
    } catch {}
  };

  useEffect(() => { fetchStats(); }, []);

  const testConnection = async (): Promise<boolean> => {
    setStep('testing');
    addLog('Testando conexão com MySQL Railway...');
    try {
      const r = await fetch('/api/mysql/test');
      const data = await r.json();
      setConnOk(data.ok);
      setConnMsg(data.message);
      addLog(data.ok ? '✅ Conexão OK!' : `❌ Falha: ${data.message}`);
      return data.ok;
    } catch (e: any) {
      setConnOk(false);
      setConnMsg(e.message);
      addLog(`❌ Erro: ${e.message}`);
      return false;
    }
  };

  const createTables = async (): Promise<boolean> => {
    setStep('creating');
    addLog('Criando tabelas no MySQL...');
    try {
      const r = await fetch('/api/mysql/create-tables', { method: 'POST' });
      const data = await r.json();
      if (data.success) {
        setTablesCreated(data.tablesCreated);
        addLog(`✅ Tabelas criadas: ${data.tablesCreated.join(', ')}`);
        await fetchStats();
        return true;
      } else {
        setError(data.error);
        addLog(`❌ Erro: ${data.error}`);
        return false;
      }
    } catch (e: any) {
      setError(e.message);
      addLog(`❌ Erro: ${e.message}`);
      return false;
    }
  };

  const migrateAll = async () => {
    setStep('migrating');
    const BATCH = 100;
    let offset = 0;
    let totalMigrated = 0;

    addLog('Iniciando migração de conteúdo (PostgreSQL → MySQL)...');

    while (true) {
      try {
        const r = await fetch('/api/mysql/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize: BATCH, offset }),
        });
        const data = await r.json();

        if (!data.success) {
          setError(data.error);
          addLog(`❌ Erro no lote offset=${offset}: ${data.error}`);
          setStep('error');
          return;
        }

        totalMigrated += data.migrated;
        offset += BATCH;
        setMigrationProgress({ current: totalMigrated, total: data.total, offset });
        addLog(`📦 Lote migrado: +${data.migrated} registros (total MySQL: ${data.total})`);

        if (data.done) break;
        await new Promise(res => setTimeout(res, 200));
      } catch (e: any) {
        setError(e.message);
        addLog(`❌ Erro inesperado: ${e.message}`);
        setStep('error');
        return;
      }
    }

    addLog(`🎉 Migração concluída! ${totalMigrated} filmes/séries migrados.`);
    await fetchStats();
    setStep('done');
  };

  const runFullMigration = async () => {
    setError(null);
    setLog([]);
    setTablesCreated([]);
    setMigrationProgress({ current: 0, total: 0, offset: 0 });
    setStep('idle');

    const ok = await testConnection();
    if (!ok) { setStep('error'); return; }

    const created = await createTables();
    if (!created) { setStep('error'); return; }

    await migrateAll();
  };

  const TABLE_LABELS: Record<string, string> = {
    movies: 'Filmes & Séries',
    settings: 'Configurações',
    streaming_providers: 'Streamings',
    users: 'Usuários',
    watch_history: 'Histórico',
    favorites: 'Favoritos',
    watch_parties: 'Watch Parties',
  };

  const isRunning = ['testing', 'creating', 'migrating'].includes(step);
  const pct = migrationProgress.total > 0
    ? Math.round((migrationProgress.current / migrationProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-600/30 flex items-center justify-center">
          <Database size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-white font-black text-lg uppercase tracking-tight">Banco MySQL Railway</h3>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
            {process.env.NODE_ENV === 'production' ? 'zephyr.proxy.rlwy.net:47257' : 'railway.app'}
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="ml-auto text-gray-600 hover:text-white transition-colors"
          title="Atualizar estatísticas"
        >
          <RefreshCcw size={14} />
        </button>
      </div>

      {/* Stats do MySQL */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <div key={key} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-1">
              <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">{label}</span>
              <span className={`text-lg font-black ${stats[key as keyof MysqlStats] < 0 ? 'text-gray-600' : 'text-white'}`}>
                {stats[key as keyof MysqlStats] < 0 ? '—' : stats[key as keyof MysqlStats].toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status conexão */}
      <AnimatePresence>
        {connOk !== null && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold ${
              connOk
                ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400'
                : 'bg-red-600/10 border-red-600/30 text-red-400'
            }`}
          >
            {connOk ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {connMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erro */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-900/20 border border-red-900/30 text-red-300 text-sm"
          >
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
            <span className="font-bold">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabelas criadas */}
      {tablesCreated.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tablesCreated.map(t => (
            <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 border border-emerald-600/20 rounded-xl text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <Table2 size={11} /> {t}
            </span>
          ))}
        </div>
      )}

      {/* Progresso migração */}
      {step === 'migrating' && migrationProgress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
            <span>{migrationProgress.current.toLocaleString('pt-BR')} migrados</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-purple-500"
              animate={{ width: `${pct}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Etapas */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'testing', label: 'Testar Conexão' },
          { key: 'creating', label: 'Criar Tabelas' },
          { key: 'migrating', label: 'Migrar Dados' },
        ].map((s, i, arr) => {
          const stepOrder = ['idle', 'testing', 'creating', 'migrating', 'done', 'error'];
          const currentIdx = stepOrder.indexOf(step);
          const thisIdx = stepOrder.indexOf(s.key);
          const isDone = currentIdx > thisIdx;
          const isActive = step === s.key;

          return (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                isDone ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400' :
                isActive ? 'bg-purple-600/20 border-purple-600/40 text-purple-300' :
                'bg-white/5 border-white/10 text-gray-600'
              }`}>
                {isDone ? <CheckCircle2 size={11} /> : isActive ? <Loader2 size={11} className="animate-spin" /> : <Server size={11} />}
                {s.label}
              </div>
              {i < arr.length - 1 && <ArrowRight size={12} className="text-gray-700" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Botão principal */}
      <div className="flex gap-3 flex-wrap">
        {!isRunning && step !== 'done' && (
          <button
            onClick={runFullMigration}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-purple-600/20"
          >
            <Zap size={14} /> {step === 'error' ? 'Tentar Novamente' : 'Iniciar Migração Completa'}
          </button>
        )}
        {!isRunning && (
          <button
            onClick={testConnection}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
          >
            <CheckCircle2 size={13} /> Apenas Testar Conexão
          </button>
        )}
        {step === 'done' && (
          <button
            onClick={runFullMigration}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
          >
            <RefreshCcw size={13} /> Re-sincronizar
          </button>
        )}
        {isRunning && (
          <div className="flex items-center gap-2 text-purple-400 text-[11px] font-black uppercase tracking-widest">
            <Loader2 size={14} className="animate-spin" />
            {step === 'testing' ? 'Testando...' : step === 'creating' ? 'Criando tabelas...' : 'Migrando...'}
          </div>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 max-h-48 overflow-y-auto">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 flex items-center gap-1.5">
            <Play size={9} /> Log de execução
          </div>
          {log.map((line, i) => (
            <div key={i} className={`text-[11px] font-mono mb-0.5 ${
              line.includes('❌') ? 'text-red-400' :
              line.includes('✅') || line.includes('🎉') ? 'text-emerald-400' :
              line.includes('📦') ? 'text-purple-300' : 'text-gray-400'
            }`}>
              {line}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
