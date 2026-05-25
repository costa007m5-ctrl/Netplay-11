import React, { useState, useEffect, useRef } from 'react';
import { Tv2, ExternalLink, Film, PlayCircle, List, CheckCircle2, AlertCircle, RefreshCcw, Download, Loader2, X, ChevronDown, ChevronUp, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function buildRedeFlixMovieUrl(tmdbId: number | string): string {
  return `https://redeflixapi.store/filme/${tmdbId}`;
}

export function buildRedeFlixSerieUrl(
  tmdbId: number | string,
  season: number,
  episode: number
): string {
  return `https://redeflixapi.store/serie/${tmdbId}/${season}/${episode}`;
}

type ContentType = 'movie' | 'tv' | 'anime' | 'dorama';

interface JobState {
  jobId: string | null;
  status: 'idle' | 'running' | 'done' | 'error' | 'cancelled';
  total: number;
  existing: number;
  inserted: number;
  skipped: number;
  errors: number;
  log: string[];
  errorMsg?: string;
}

const CONTENT_TYPES: { key: ContentType; label: string; color: string; bg: string; border: string }[] = [
  { key: 'movie',  label: 'Filmes',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { key: 'tv',     label: 'Séries',  color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30'    },
  { key: 'anime',  label: 'Animes',  color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30'  },
  { key: 'dorama', label: 'Doramas', color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30'    },
];

const POLL_INTERVAL = 2000;

function makeIdle(): JobState {
  return { jobId: null, status: 'idle', total: 0, existing: 0, inserted: 0, skipped: 0, errors: 0, log: [] };
}

function AdminFlix3Tab({ onRefresh }: { onRefresh?: () => void }) {
  const [testMovieId, setTestMovieId] = useState('19995');
  const [testSerieId, setTestSerieId] = useState('387');
  const [testSeason, setTestSeason] = useState('1');
  const [testEpisode, setTestEpisode] = useState('1');

  const [jobs, setJobs] = useState<Record<ContentType, JobState>>(() =>
    Object.fromEntries(CONTENT_TYPES.map(t => [t.key, makeIdle()])) as Record<ContentType, JobState>
  );
  const [showLog, setShowLog] = useState<Record<ContentType, boolean>>({
    movie: false, tv: false, anime: false, dorama: false,
  });

  const pollTimers = useRef<Record<ContentType, ReturnType<typeof setInterval> | null>>({
    movie: null, tv: null, anime: null, dorama: null,
  });

  const stopPoll = (type: ContentType) => {
    if (pollTimers.current[type]) {
      clearInterval(pollTimers.current[type]!);
      pollTimers.current[type] = null;
    }
  };

  const startPoll = (type: ContentType, jobId: string) => {
    stopPoll(type);
    pollTimers.current[type] = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/flix3/status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJobs(prev => ({
          ...prev,
          [type]: {
            jobId,
            status: data.status,
            total: data.total ?? 0,
            existing: data.existing ?? 0,
            inserted: data.inserted ?? 0,
            skipped: data.skipped ?? 0,
            errors: data.errors ?? 0,
            log: data.log ?? [],
            errorMsg: data.errorMsg,
          },
        }));
        if (data.status !== 'running') {
          stopPoll(type);
          if (data.status === 'done') {
            onRefresh?.();
          }
        }
      } catch {}
    }, POLL_INTERVAL);
  };

  useEffect(() => {
    const handler = () => syncAll();
    window.addEventListener('flix3-sync-all', handler);
    return () => {
      CONTENT_TYPES.forEach(t => stopPoll(t.key));
      window.removeEventListener('flix3-sync-all', handler);
    };
  }, []);

  const syncType = async (type: ContentType) => {
    setJobs(prev => ({
      ...prev,
      [type]: { ...makeIdle(), status: 'running' },
    }));
    stopPoll(type);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token;

      const res = await fetch('/api/sync/flix3/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, userToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { jobId } = await res.json();
      setJobs(prev => ({ ...prev, [type]: { ...prev[type], jobId } }));
      startPoll(type, jobId);
    } catch (err: any) {
      setJobs(prev => ({
        ...prev,
        [type]: { ...prev[type], status: 'error', errorMsg: err?.message || 'Erro ao iniciar sync' },
      }));
    }
  };

  const cancelSync = async (type: ContentType) => {
    const jobId = jobs[type].jobId;
    stopPoll(type);
    setJobs(prev => ({ ...prev, [type]: { ...prev[type], status: 'cancelled' } }));
    if (jobId) {
      try {
        await fetch(`/api/sync/flix3/cancel/${jobId}`, { method: 'POST' });
      } catch {}
    }
  };

  const syncAll = () => {
    CONTENT_TYPES.forEach(ct => {
      if (jobs[ct.key].status !== 'running') {
        syncType(ct.key);
      }
    });
  };

  const movieUrl = buildRedeFlixMovieUrl(testMovieId || '19995');
  const serieUrl = buildRedeFlixSerieUrl(testSerieId || '387', Number(testSeason) || 1, Number(testEpisode) || 1);

  return (
    <div className="space-y-6 md:space-y-10 pb-12">

      <div className="text-center md:text-left space-y-3">
        <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 tracking-tighter uppercase font-mono">
          <Tv2 className="inline-block w-8 h-8 md:w-10 md:h-10 mr-3 -mt-2 text-emerald-400" />
          Flix 3.0
        </h2>
        <p className="text-base text-gray-400 font-medium max-w-2xl">
          Integração com a RedeFlixApi — player embedável por ID TMDB, sem chave de API.
        </p>
      </div>

      {/* Anti-Anúncios */}
      <section className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
        <h3 className="text-base font-black text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          Anti-Anúncios (Bloqueio de Pop-ups)
        </h3>
        <p className="text-gray-400 text-sm mb-5 leading-relaxed">
          Durante a reprodução de qualquer player externo (Flix 3.0, API Flix, Net 2.0), o botão{' '}
          <span className="font-black text-green-400">Anti-Ads ON/OFF</span> aparece no canto superior esquerdo do player.
          <br /><br />
          <span className="font-bold text-white">Anti-Ads ON (verde)</span> — bloqueia pop-ups do iframe, impedindo anúncios que tentam abrir novas janelas/abas.{' '}
          <span className="font-bold text-white">Anti-Ads OFF (vermelho)</span> — desativa o bloqueio, permitindo pop-ups.
          A preferência é salva automaticamente no dispositivo.
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-600/20 border border-green-500/40 text-green-300 text-xs font-black uppercase tracking-widest">
            <ShieldCheck size={13} /> Anti-Ads ON — Pop-ups bloqueados
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-black uppercase tracking-widest">
            <ShieldOff size={13} /> Anti-Ads OFF — Pop-ups liberados
          </div>
        </div>
      </section>

      {/* Sync de conteúdo */}
      <section className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                Listas de IDs — Sincronizar com o App
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                O sync roda no servidor — continua mesmo se você navegar para outra aba.
              </p>
            </div>
            <button
              onClick={syncAll}
              disabled={CONTENT_TYPES.some(t => jobs[t.key].status === 'running')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest transition-all shrink-0"
            >
              <RefreshCcw size={13} />
              Sinc. Tudo
            </button>
          </div>

          <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono flex items-center gap-2">
            <List size={11} />
            Os conteúdos sincronizados aparecem automaticamente no app. Clique em "Atualizar" na navbar para recarregar.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONTENT_TYPES.map(ct => {
              const j = jobs[ct.key];
              const isRunning = j.status === 'running';
              const newCount = Math.max(j.total - j.existing, 0);
              const progress = newCount > 0 && isRunning
                ? Math.round(((j.inserted + j.skipped + j.errors) / newCount) * 100)
                : 0;

              return (
                <div key={ct.key} className={`rounded-2xl p-4 border ${ct.bg} ${ct.border} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-black text-sm uppercase tracking-wider ${ct.color}`}>{ct.label}</span>
                    <div className="flex items-center gap-2">
                      {isRunning && (
                        <button
                          onClick={() => cancelSync(ct.key)}
                          className="p-1 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-all"
                          title="Cancelar"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => syncType(ct.key)}
                        disabled={isRunning}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 ${ct.bg} border ${ct.border} hover:opacity-80`}
                      >
                        {isRunning ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
                        {isRunning ? 'Sincronizando...' : 'Sincronizar'}
                      </button>
                    </div>
                  </div>

                  {j.status !== 'idle' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                        <span className="text-gray-400">Total: <span className="text-white font-black">{j.total}</span></span>
                        <span className="text-gray-400">Já existentes: <span className="text-yellow-400 font-black">{j.existing}</span></span>
                        <span className="text-gray-400">Inseridos: <span className="text-green-400 font-black">{j.inserted}</span></span>
                        {j.errors > 0 && <span className="text-gray-400">Erros: <span className="text-red-400 font-black">{j.errors}</span></span>}
                      </div>

                      {isRunning && newCount > 0 && (
                        <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${ct.key === 'movie' ? 'from-emerald-500 to-cyan-500' : ct.key === 'tv' ? 'from-cyan-500 to-blue-500' : ct.key === 'anime' ? 'from-violet-500 to-purple-500' : 'from-pink-500 to-rose-500'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      )}

                      {isRunning && j.total === 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 animate-pulse">
                          <Loader2 size={11} className="animate-spin" /> Iniciando no servidor...
                        </div>
                      )}
                      {isRunning && j.total > 0 && j.existing > 0 && j.inserted === 0 && j.errors === 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 animate-pulse">
                          <Loader2 size={11} className="animate-spin" /> Buscando metadados do TMDB...
                        </div>
                      )}

                      {j.status === 'done' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-black">
                          <CheckCircle2 size={11} /> Concluído — {j.inserted} inseridos
                        </div>
                      )}
                      {j.status === 'error' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-black">
                          <AlertCircle size={11} /> {j.errorMsg}
                        </div>
                      )}
                      {j.status === 'cancelled' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 font-black">
                          <X size={11} /> Cancelado
                        </div>
                      )}

                      {j.log.length > 0 && (
                        <div>
                          <button
                            onClick={() => setShowLog(prev => ({ ...prev, [ct.key]: !prev[ct.key] }))}
                            className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest font-black"
                          >
                            {showLog[ct.key] ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                            Log ({j.log.length})
                          </button>
                          {showLog[ct.key] && (
                            <div className="mt-2 bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto scrollbar-hide space-y-0.5">
                              {j.log.map((entry, i) => (
                                <p key={i} className="text-[9px] font-mono text-gray-400 leading-relaxed">{entry}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <a
                    href={`https://redeflixapi.store/list-${ct.key}-ids.txt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <ExternalLink size={9} /> Ver lista .txt
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testar Player */}
      <section className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
        <h3 className="text-base font-black text-white mb-5 uppercase tracking-wider flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-cyan-400" />
          Testar Player
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 block">
              <Film size={11} className="inline mr-1.5 text-emerald-400" />
              Filme — ID TMDB
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMovieId}
                onChange={e => setTestMovieId(e.target.value)}
                placeholder="ex: 19995"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              <a
                href={movieUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest transition-all"
              >
                <ExternalLink size={13} />
                Abrir
              </a>
            </div>
            <code className="text-gray-600 text-xs font-mono mt-2 block break-all">{movieUrl}</code>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 block">
              <Tv2 size={11} className="inline mr-1.5 text-cyan-400" />
              Série — ID / Temporada / Episódio
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={testSerieId}
                onChange={e => setTestSerieId(e.target.value)}
                placeholder="ID TMDB"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
              <input
                type="number"
                value={testSeason}
                onChange={e => setTestSeason(e.target.value)}
                placeholder="T"
                min="1"
                className="w-16 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
              <input
                type="number"
                value={testEpisode}
                onChange={e => setTestEpisode(e.target.value)}
                placeholder="Ep"
                min="1"
                className="w-16 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
              <a
                href={serieUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest transition-all"
              >
                <ExternalLink size={13} />
                Abrir
              </a>
            </div>
            <code className="text-gray-600 text-xs font-mono mt-1 block break-all">{serieUrl}</code>
          </div>
        </div>
      </section>

      {/* Integração no App */}
      <section className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
        <h3 className="text-base font-black text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-yellow-400" />
          Integração no App
        </h3>
        <div className="space-y-2.5">
          {[
            { ok: true, text: 'Opção "Flix 3.0" disponível no seletor de servidor ao reproduzir qualquer título' },
            { ok: true, text: 'Funciona com filmes e séries (temporada + episódio automáticos)' },
            { ok: true, text: 'Usa o ID TMDB do título já cadastrado — sem configuração extra' },
            { ok: true, text: 'Player via iframe embutido — igual ao API Flix e Net 2.0' },
            { ok: true, text: 'Sem chave de API necessária — acesso público direto' },
            { ok: true, text: 'Botão Anti-Ads no player para bloquear pop-ups (preferência salva no dispositivo)' },
            { ok: true, text: 'Sync roda no servidor — não para ao navegar para outra aba' },
            { ok: true, text: 'Conteúdos sincronizados aparecem no app após recarregar (botão Atualizar na navbar)' },
          ].map(({ ok, text }) => (
            <div key={text} className="flex items-start gap-3">
              {ok
                ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              }
              <p className="text-gray-400 text-sm">{text}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

export default AdminFlix3Tab;
