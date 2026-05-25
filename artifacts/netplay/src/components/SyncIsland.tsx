import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { useSyncContext, SyncJob } from '../contexts/SyncContext';
import { Image, Tv2, Loader2, Pause, Play, X, CheckCircle2, ChevronDown, ChevronUp, Zap } from 'lucide-react';

function pct(job: SyncJob) {
  return job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;
}

function isActive(job: SyncJob) {
  return job.status === 'running' || job.status === 'paused' || job.status === 'loading';
}

function isDone(job: SyncJob) {
  return job.status === 'done';
}

interface JobRowProps {
  job: SyncJob;
  label: string;
  icon: React.ReactNode;
  barColor: string;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function JobRow({ job, label, icon, barColor, onPause, onResume, onCancel }: JobRowProps) {
  const p = pct(job);
  const isRunning = job.status === 'running' || job.status === 'loading';
  const isPaused = job.status === 'paused';
  const isFinished = job.status === 'done';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-none">{icon}</div>
          <span className="text-white font-black uppercase tracking-widest text-[10px]">{label}</span>
          {isRunning && <Loader2 size={10} className="animate-spin text-gray-400 flex-none" />}
          {isFinished && <CheckCircle2 size={10} className="text-green-400 flex-none" />}
        </div>
        <div className="flex items-center gap-1 flex-none">
          {isRunning && (
            <button
              onClick={onPause}
              className="p-1 rounded-full hover:bg-white/10 text-yellow-400 hover:text-yellow-300 transition-colors"
              title="Pausar"
            >
              <Pause size={13} />
            </button>
          )}
          {isPaused && (
            <button
              onClick={onResume}
              className="p-1 rounded-full hover:bg-white/10 text-green-400 hover:text-green-300 transition-colors"
              title="Continuar"
            >
              <Play size={13} />
            </button>
          )}
          {!isFinished && (
            <button
              onClick={onCancel}
              className="p-1 rounded-full hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
              title="Cancelar"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {job.total > 0 && (
        <div className="space-y-1">
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              animate={{ width: `${p}%` }}
              transition={{ ease: 'easeOut', duration: 0.4 }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-gray-500">
            <span className="truncate max-w-[160px] text-gray-400">{job.message}</span>
            <span className="flex-none ml-2">{p}%</span>
          </div>
          <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-widest">
            <span className="text-green-400">{job.updated} ok</span>
            <span className="text-gray-600">{job.skipped} sem dados</span>
            {job.errors > 0 && <span className="text-red-400">{job.errors} err</span>}
            <span className="text-gray-600 ml-auto">{job.current}/{job.total}</span>
          </div>
        </div>
      )}

      {isPaused && job.total > 0 && (
        <button
          onClick={onResume}
          className="w-full flex items-center justify-center gap-2 py-2 bg-green-600/20 border border-green-600/30 rounded-xl text-green-400 font-black uppercase text-[9px] tracking-widest hover:bg-green-600/30 transition-colors"
        >
          <Play size={10} /> Continuar de onde parou ({p}%)
        </button>
      )}
    </div>
  );
}

export default function SyncIsland() {
  const location = useLocation();
  const { logoJob, providerJob, startLogos, startProviders, pauseLogos, pauseProviders, cancelLogos, cancelProviders } = useSyncContext();
  const [expanded, setExpanded] = useState(false);

  const isOnAdminPage = location.pathname === '/admin2';
  const hasLogo = isActive(logoJob) || isDone(logoJob);
  const hasProvider = isActive(providerJob) || isDone(providerJob);
  const hasAny = hasLogo || hasProvider;

  if (!hasAny || isOnAdminPage) return null;

  const logoRunning = logoJob.status === 'running' || logoJob.status === 'loading';
  const provRunning = providerJob.status === 'running' || providerJob.status === 'loading';
  const anyRunning = logoRunning || provRunning;
  const anyPaused = logoJob.status === 'paused' || providerJob.status === 'paused';

  const totalPct = (() => {
    const jobs = [hasLogo ? logoJob : null, hasProvider ? providerJob : null].filter(Boolean) as SyncJob[];
    if (!jobs.length) return 0;
    const sum = jobs.reduce((acc, j) => acc + pct(j), 0);
    return Math.round(sum / jobs.length);
  })();

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] w-[calc(100vw-2rem)] max-w-sm"
    >
      <motion.div
        layout
        className="bg-[#1a1a1a] border border-white/15 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Pill header - always visible */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-3 px-4 py-3"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-none w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              {anyRunning ? (
                <Loader2 size={13} className="animate-spin text-blue-400" />
              ) : anyPaused ? (
                <Pause size={11} className="text-yellow-400" />
              ) : (
                <CheckCircle2 size={13} className="text-green-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white font-black uppercase tracking-widest text-[9px] leading-none">
                {anyRunning ? 'Sincronizando...' : anyPaused ? 'Sincronização pausada' : 'Sincronização concluída'}
              </p>
              {anyRunning && (
                <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest mt-0.5">{totalPct}% completo</p>
              )}
            </div>

            {/* Mini progress for running */}
            {anyRunning && (
              <div className="flex-none w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  animate={{ width: `${totalPct}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
            )}
          </div>

          <div className="flex-none text-gray-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </button>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3">
                {hasLogo && (
                  <JobRow
                    job={logoJob}
                    label="Logos"
                    icon={<Image size={12} className="text-blue-400" />}
                    barColor="bg-blue-500"
                    onPause={pauseLogos}
                    onResume={() => startLogos(logoJob.resumeFrom)}
                    onCancel={cancelLogos}
                  />
                )}

                {hasLogo && hasProvider && (
                  <div className="border-t border-white/5" />
                )}

                {hasProvider && (
                  <JobRow
                    job={providerJob}
                    label="Streamings"
                    icon={<Tv2 size={12} className="text-orange-400" />}
                    barColor="bg-orange-500"
                    onPause={pauseProviders}
                    onResume={() => startProviders(providerJob.resumeFrom)}
                    onCancel={cancelProviders}
                  />
                )}

                {!anyRunning && !anyPaused && (
                  <p className="text-center text-gray-600 text-[9px] font-bold uppercase tracking-widest py-1">
                    Toque em qualquer botão abaixo para fechar
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
