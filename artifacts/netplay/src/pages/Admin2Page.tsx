import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Image, Tv2, CheckCircle2, XCircle, Loader2, RotateCcw, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import tmdb, { requests, getMovieLogo } from '../services/tmdb';

interface SyncState {
  running: boolean;
  done: boolean;
  current: number;
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  status: string;
}

const emptySyncState = (): SyncState => ({
  running: false, done: false, current: 0, total: 0,
  updated: 0, skipped: 0, errors: 0, status: ''
});

const PAGE = 1000;

async function fetchAllMovies(): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('movies')
      .select('id,title,type,logo_path,watch_providers')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default function Admin2Page({ navigate }: { navigate: (to: any) => void }) {
  const [logoSync, setLogoSync] = useState<SyncState>(emptySyncState());
  const [providerSync, setProviderSync] = useState<SyncState>(emptySyncState());
  const logoAbort = useRef(false);
  const providerAbort = useRef(false);

  const startLogoSync = async () => {
    logoAbort.current = false;
    setLogoSync({ running: true, done: false, current: 0, total: 0, updated: 0, skipped: 0, errors: 0, status: 'Carregando catálogo...' });

    const all = await fetchAllMovies();
    const toSync = all.filter(m => !m.logo_path || m.logo_path === '');
    setLogoSync(s => ({ ...s, total: toSync.length, status: `${toSync.length} conteúdos sem logo encontrados` }));

    let updated = 0, skipped = 0, errors = 0;
    for (let i = 0; i < toSync.length; i++) {
      if (logoAbort.current) break;
      const movie = toSync[i];
      setLogoSync(s => ({ ...s, current: i + 1, status: `Buscando logo: ${movie.title}` }));
      try {
        const searchRes = await tmdb.get(requests.searchMulti, { params: { query: movie.title } });
        const result = searchRes.data.results?.[0];
        if (!result) { skipped++; continue; }
        const isTv = result.media_type === 'tv' || movie.type === 'series';
        const logoUrl = await getMovieLogo(result.id, isTv ? 'tv' : 'movie');
        if (logoUrl) {
          await supabase.from('movies').update({ logo_path: logoUrl }).eq('id', movie.id);
          updated++;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
      setLogoSync(s => ({ ...s, updated, skipped, errors }));
    }
    setLogoSync(s => ({ ...s, running: false, done: true, status: logoAbort.current ? 'Pausado pelo usuário' : 'Sincronização de logos concluída!' }));
  };

  const startProviderSync = async () => {
    providerAbort.current = false;
    setProviderSync({ running: true, done: false, current: 0, total: 0, updated: 0, skipped: 0, errors: 0, status: 'Carregando catálogo...' });

    const all = await fetchAllMovies();
    setProviderSync(s => ({ ...s, total: all.length, status: `${all.length} conteúdos no catálogo` }));

    let updated = 0, skipped = 0, errors = 0;
    for (let i = 0; i < all.length; i++) {
      if (providerAbort.current) break;
      const movie = all[i];
      setProviderSync(s => ({ ...s, current: i + 1, status: `Buscando streaming: ${movie.title}` }));
      try {
        const searchRes = await tmdb.get(requests.searchMulti, { params: { query: movie.title } });
        const result = searchRes.data.results?.[0];
        if (!result) { skipped++; setProviderSync(s => ({ ...s, skipped })); continue; }
        const isTv = result.media_type === 'tv' || movie.type === 'series';
        const providersPath = isTv ? requests.tvWatchProviders(result.id) : requests.movieWatchProviders(result.id);
        const providersRes = await tmdb.get(providersPath).catch(() => ({ data: { results: {} } }));
        const providersBR = providersRes.data.results?.BR?.flatrate || [];
        const watch_providers = providersBR.map((p: any) => `${p.provider_name}|https://image.tmdb.org/t/p/original${p.logo_path}`).join(';;');
        await supabase.from('movies').update({ watch_providers: watch_providers || '' }).eq('id', movie.id);
        updated++;
      } catch {
        errors++;
      }
      setProviderSync(s => ({ ...s, updated, skipped, errors }));
    }
    setProviderSync(s => ({ ...s, running: false, done: true, status: providerAbort.current ? 'Pausado pelo usuário' : 'Sincronização de streamings concluída!' }));
  };

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
            state={logoSync}
            onStart={startLogoSync}
            onStop={() => { logoAbort.current = true; }}
            onReset={() => setLogoSync(emptySyncState())}
            color="blue"
          />

          <SyncCard
            icon={<Tv2 size={28} />}
            title="Sincronizar Streamings"
            description='Busca no TMDB onde cada filme/série está disponível para assistir no Brasil (Netflix, Max, Prime, etc.) e salva o campo "Onde Assistir" de cada conteúdo.'
            state={providerSync}
            onStart={startProviderSync}
            onStop={() => { providerAbort.current = true; }}
            onReset={() => setProviderSync(emptySyncState())}
            color="orange"
          />
        </div>

      </div>
    </div>
  );
}

function SyncCard({
  icon, title, description, state, onStart, onStop, onReset, color
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: SyncState;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  color: 'blue' | 'orange';
}) {
  const accent = color === 'blue' ? 'text-blue-400 border-blue-600/30 bg-blue-600/10' : 'text-orange-400 border-orange-600/30 bg-orange-600/10';
  const bar = color === 'blue' ? 'bg-blue-500' : 'bg-orange-500';
  const btn = color === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500';
  const pct = state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

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

      {(state.running || state.done) && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            {state.running && <Loader2 size={14} className="animate-spin text-gray-400" />}
            {state.done && !state.running && <CheckCircle2 size={14} className="text-green-400" />}
            <span className="text-gray-300 text-xs font-bold truncate">{state.status}</span>
          </div>

          {state.total > 0 && (
            <>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${bar}`}
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                <span>{state.current} / {state.total}</span>
                <div className="flex gap-4">
                  <span className="text-green-400">{state.updated} atualizados</span>
                  <span className="text-gray-600">{state.skipped} sem dados</span>
                  {state.errors > 0 && <span className="text-red-400">{state.errors} erros</span>}
                </div>
                <span>{pct}%</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {!state.running && !state.done && (
          <button
            onClick={onStart}
            className={`flex items-center gap-2 px-6 py-3 ${btn} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl`}
          >
            <Zap size={14} /> Iniciar Sincronização
          </button>
        )}
        {state.running && (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-white/10"
          >
            <XCircle size={14} /> Pausar
          </button>
        )}
        {state.done && (
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
