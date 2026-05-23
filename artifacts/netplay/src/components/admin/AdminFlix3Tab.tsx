import React, { useState, useRef } from 'react';
import { Tv2, ExternalLink, Film, PlayCircle, List, CheckCircle2, AlertCircle, RefreshCcw, Download, Loader2, X, ChevronDown, ChevronUp, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import tmdb, { requests } from '../../services/tmdb';

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

interface SyncState {
  status: 'idle' | 'fetching-list' | 'checking-db' | 'syncing' | 'done' | 'error';
  total: number;
  existing: number;
  inserted: number;
  skipped: number;
  errors: number;
  log: string[];
  errorMsg?: string;
}

const CONTENT_TYPES: { key: ContentType; label: string; color: string; bg: string; border: string; tmdbType: 'movie' | 'tv' }[] = [
  { key: 'movie',  label: 'Filmes',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', tmdbType: 'movie' },
  { key: 'tv',     label: 'Séries',  color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    tmdbType: 'tv' },
  { key: 'anime',  label: 'Animes',  color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  tmdbType: 'tv' },
  { key: 'dorama', label: 'Doramas', color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    tmdbType: 'tv' },
];

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

async function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function AdminFlix3Tab() {
  const [testMovieId, setTestMovieId] = useState('19995');
  const [testSerieId, setTestSerieId] = useState('387');
  const [testSeason, setTestSeason] = useState('1');
  const [testEpisode, setTestEpisode] = useState('1');

  const [syncStates, setSyncStates] = useState<Record<ContentType, SyncState>>(() =>
    Object.fromEntries(
      CONTENT_TYPES.map(t => [t.key, { status: 'idle', total: 0, existing: 0, inserted: 0, skipped: 0, errors: 0, log: [] }])
    ) as Record<ContentType, SyncState>
  );
  const [showLog, setShowLog] = useState<Record<ContentType, boolean>>({
    movie: false, tv: false, anime: false, dorama: false,
  });
  const abortRefs = useRef<Record<ContentType, boolean>>({ movie: false, tv: false, anime: false, dorama: false });

  const updateSync = (type: ContentType, patch: Partial<SyncState>) => {
    setSyncStates(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  };

  const appendLog = (type: ContentType, msg: string) => {
    setSyncStates(prev => ({
      ...prev,
      [type]: { ...prev[type], log: [...prev[type].log.slice(-200), msg] },
    }));
  };

  const syncType = async (type: ContentType) => {
    const cfg = CONTENT_TYPES.find(t => t.key === type)!;
    abortRefs.current[type] = false;
    updateSync(type, { status: 'fetching-list', total: 0, existing: 0, inserted: 0, skipped: 0, errors: 0, log: [], errorMsg: undefined });

    try {
      const res = await fetch(`/api/flix3/ids/${type}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { ids, total } = await res.json() as { ids: number[]; total: number };
      updateSync(type, { status: 'checking-db', total });
      appendLog(type, `✅ Lista obtida: ${total} IDs`);

      const CHUNK = 500;
      const existingIds = new Set<number>();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data } = await supabase.from('movies').select('id').in('id', chunk);
        (data || []).forEach((r: any) => existingIds.add(Number(r.id)));
      }

      const newIds = ids.filter(id => !existingIds.has(id));
      updateSync(type, {
        status: 'syncing',
        existing: existingIds.size,
        total,
      });
      appendLog(type, `📦 Já cadastrados: ${existingIds.size} | Novos: ${newIds.length}`);

      let inserted = 0;
      let skipped = 0;
      let errors = 0;

      for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
        if (abortRefs.current[type]) {
          appendLog(type, '⛔ Sincronização cancelada pelo usuário.');
          break;
        }

        const batch = newIds.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (tmdbId) => {
            try {
              const endpoint = cfg.tmdbType === 'movie'
                ? requests.movieDetails(tmdbId)
                : requests.tvDetails(tmdbId);

              const { data: details } = await tmdb.get(endpoint, { params: { language: 'pt-BR' } });
              if (!details || (!details.title && !details.name)) {
                skipped++;
                return;
              }

              const isMovie = cfg.tmdbType === 'movie';
              const genreNames = (details.genres || []).map((g: any) => g.name).join(', ');
              const primaryGenre = (details.genres || [])[0]?.name || null;

              const movieData = {
                id: tmdbId,
                title: isMovie ? details.title : (details.name || details.original_name),
                type: isMovie ? 'movie' : 'series',
                overview: details.overview || null,
                poster_path: details.poster_path || null,
                backdrop_path: details.backdrop_path || null,
                release_date: isMovie ? (details.release_date || null) : null,
                first_air_date: !isMovie ? (details.first_air_date || null) : null,
                release_year: isMovie
                  ? (details.release_date ? new Date(details.release_date).getFullYear() : null)
                  : (!isMovie && details.first_air_date ? new Date(details.first_air_date).getFullYear() : null),
                rating: details.vote_average || null,
                runtime: isMovie
                  ? (details.runtime || null)
                  : (details.episode_run_time?.[0] || null),
                genres: genreNames || null,
                genre: primaryGenre,
                video_url: '',
                created_at: new Date().toISOString(),
              };

              const { error } = await supabase.from('movies').insert([movieData]);
              if (error) {
                if (error.code === '23505') {
                  skipped++;
                } else {
                  errors++;
                  appendLog(type, `⚠️ ID ${tmdbId}: ${error.message}`);
                }
              } else {
                inserted++;
              }
            } catch (err: any) {
              errors++;
              appendLog(type, `❌ ID ${tmdbId}: ${err?.message || 'erro'}`);
            }
          })
        );

        updateSync(type, { inserted, skipped, errors });
        if (i % 50 === 0 && i > 0) {
          appendLog(type, `⏳ Progresso: ${i}/${newIds.length} — inseridos: ${inserted}, erros: ${errors}`);
        }
        await sleep(BATCH_DELAY_MS);
      }

      updateSync(type, { status: 'done', inserted, skipped, errors });
      appendLog(type, `🎉 Concluído! Inseridos: ${inserted} | Pulados: ${skipped} | Erros: ${errors}`);
    } catch (err: any) {
      updateSync(type, { status: 'error', errorMsg: err?.message || 'Erro desconhecido' });
      appendLog(type, `💥 Erro fatal: ${err?.message}`);
    }
  };

  const syncAll = async () => {
    for (const ct of CONTENT_TYPES) {
      await syncType(ct.key);
    }
  };

  const cancelSync = (type: ContentType) => {
    abortRefs.current[type] = true;
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                Listas de IDs — Sincronizar com o App
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                Cada lista contém IDs TMDB. O sync busca os metadados e cadastra apenas os conteúdos ainda não existentes.
              </p>
            </div>
            <button
              onClick={syncAll}
              disabled={CONTENT_TYPES.some(t => ['fetching-list','checking-db','syncing'].includes(syncStates[t.key].status))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest transition-all shrink-0"
            >
              <RefreshCcw size={13} />
              Sinc. Tudo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONTENT_TYPES.map(ct => {
              const s = syncStates[ct.key];
              const isRunning = ['fetching-list','checking-db','syncing'].includes(s.status);
              const progress = s.total > 0 && s.status === 'syncing'
                ? Math.round(((s.inserted + s.skipped + s.errors) / Math.max(s.total - s.existing, 1)) * 100)
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

                  {s.status !== 'idle' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                        <span className="text-gray-400">Total: <span className="text-white font-black">{s.total}</span></span>
                        <span className="text-gray-400">Já existentes: <span className="text-yellow-400 font-black">{s.existing}</span></span>
                        <span className="text-gray-400">Inseridos: <span className="text-green-400 font-black">{s.inserted}</span></span>
                        {s.errors > 0 && <span className="text-gray-400">Erros: <span className="text-red-400 font-black">{s.errors}</span></span>}
                      </div>

                      {s.status === 'syncing' && s.total > 0 && (
                        <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${ct.key === 'movie' ? 'from-emerald-500 to-cyan-500' : ct.key === 'tv' ? 'from-cyan-500 to-blue-500' : ct.key === 'anime' ? 'from-violet-500 to-purple-500' : 'from-pink-500 to-rose-500'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      )}

                      {s.status === 'done' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-black">
                          <CheckCircle2 size={11} /> Concluído
                        </div>
                      )}
                      {s.status === 'error' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-black">
                          <AlertCircle size={11} /> {s.errorMsg}
                        </div>
                      )}
                      {s.status === 'fetching-list' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 animate-pulse">
                          <Loader2 size={11} className="animate-spin" /> Obtendo lista da API...
                        </div>
                      )}
                      {s.status === 'checking-db' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 animate-pulse">
                          <Loader2 size={11} className="animate-spin" /> Verificando banco de dados...
                        </div>
                      )}

                      {s.log.length > 0 && (
                        <div>
                          <button
                            onClick={() => setShowLog(prev => ({ ...prev, [ct.key]: !prev[ct.key] }))}
                            className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest font-black"
                          >
                            {showLog[ct.key] ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                            Log ({s.log.length})
                          </button>
                          {showLog[ct.key] && (
                            <div className="mt-2 bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto scrollbar-hide space-y-0.5">
                              {s.log.map((entry, i) => (
                                <p key={i} className="text-[9px] font-mono text-gray-400 leading-relaxed">{entry}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <a
                    href={`https://redeflixapi.store/list-${ct.key === 'tv' ? 'tv' : ct.key}-ids.txt`}
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
            { ok: true, text: 'Sync de listas: importa filmes/séries/animes/doramas diretamente do catálogo da API' },
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
