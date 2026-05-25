import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Image, Tv2, CheckCircle2, Loader2, RotateCcw, Zap, Pause, Play, X } from 'lucide-react';
import { useSyncContext, SyncJob } from '../contexts/SyncContext';

export default function Admin2Page({ navigate }: { navigate: (to: any) => void }) {
  const { logoJob, providerJob, startLogos, startProviders, pauseLogos, pauseProviders, cancelLogos, cancelProviders, resetLogos, resetProviders } = useSyncContext();

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
