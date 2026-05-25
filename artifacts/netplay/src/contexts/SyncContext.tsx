import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import tmdb, { requests, getMovieLogo } from '../services/tmdb';

export type SyncStatus = 'idle' | 'loading' | 'running' | 'paused' | 'done' | 'cancelled';

export interface SyncJob {
  status: SyncStatus;
  current: number;
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  message: string;
  resumeFrom: number;
}

const emptyJob = (): SyncJob => ({
  status: 'idle', current: 0, total: 0, updated: 0, skipped: 0, errors: 0, message: '', resumeFrom: 0,
});

interface SyncContextType {
  logoJob: SyncJob;
  providerJob: SyncJob;
  startLogos: (resumeFrom?: number) => void;
  startProviders: (resumeFrom?: number) => void;
  pauseLogos: () => void;
  pauseProviders: () => void;
  cancelLogos: () => void;
  cancelProviders: () => void;
  resetLogos: () => void;
  resetProviders: () => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider');
  return ctx;
}

const LOGO_KEY = 'netplay_logo_sync';
const PROVIDER_KEY = 'netplay_provider_sync';
const PAGE = 1000;

async function fetchAllMovies(fields = 'id,title,type,logo_path,watch_providers'): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('movies')
      .select(fields)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function saveJob(key: string, job: SyncJob) {
  try { localStorage.setItem(key, JSON.stringify(job)); } catch {}
}

function loadJob(key: string): SyncJob | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SyncJob;
  } catch { return null; }
}

function clearJob(key: string) {
  try { localStorage.removeItem(key); } catch {}
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [logoJob, setLogoJob] = useState<SyncJob>(emptyJob);
  const [providerJob, setProviderJob] = useState<SyncJob>(emptyJob);
  const logoAbort = useRef(false);
  const providerAbort = useRef(false);

  useEffect(() => {
    const logo = loadJob(LOGO_KEY);
    if (logo && (logo.status === 'running' || logo.status === 'paused')) {
      setLogoJob({ ...logo, status: 'paused', message: `Pausado em ${logo.current}/${logo.total}` });
    }
    const provider = loadJob(PROVIDER_KEY);
    if (provider && (provider.status === 'running' || provider.status === 'paused')) {
      setProviderJob({ ...provider, status: 'paused', message: `Pausado em ${provider.current}/${provider.total}` });
    }
  }, []);

  const startLogos = useCallback(async (resumeFrom = 0) => {
    logoAbort.current = false;

    const loading: SyncJob = { status: 'loading', current: resumeFrom, total: 0, updated: 0, skipped: 0, errors: 0, message: 'Carregando catálogo...', resumeFrom };
    setLogoJob(loading);
    saveJob(LOGO_KEY, loading);

    const all = await fetchAllMovies('id,title,type,logo_path');
    const toSync = all.filter(m => !m.logo_path || m.logo_path === '');

    const startAt = Math.min(resumeFrom, toSync.length);
    const slice = toSync.slice(startAt);

    const withTotal: SyncJob = { ...loading, status: 'running', total: toSync.length, current: startAt, message: `${slice.length} conteúdos para processar` };
    setLogoJob(withTotal);
    saveJob(LOGO_KEY, withTotal);

    let updated = 0, skipped = 0, errors = 0;

    for (let i = 0; i < slice.length; i++) {
      if (logoAbort.current) break;
      const movie = slice[i];
      const absIdx = startAt + i + 1;

      const running: SyncJob = { status: 'running', current: absIdx, total: toSync.length, updated, skipped, errors, message: `Buscando logo: ${movie.title}`, resumeFrom: absIdx };
      setLogoJob(running);
      if (i % 5 === 0) saveJob(LOGO_KEY, running);

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
      setLogoJob(s => ({ ...s, updated, skipped, errors }));
    }

    const finalStatus: SyncStatus = logoAbort.current ? 'paused' : 'done';
    setLogoJob(s => {
      const final: SyncJob = { ...s, status: finalStatus, updated, skipped, errors, message: logoAbort.current ? 'Pausado pelo usuário' : 'Sincronização de logos concluída!', resumeFrom: s.current };
      saveJob(LOGO_KEY, final);
      return final;
    });
  }, []);

  const startProviders = useCallback(async (resumeFrom = 0) => {
    providerAbort.current = false;

    const loading: SyncJob = { status: 'loading', current: resumeFrom, total: 0, updated: 0, skipped: 0, errors: 0, message: 'Carregando catálogo...', resumeFrom };
    setProviderJob(loading);
    saveJob(PROVIDER_KEY, loading);

    const all = await fetchAllMovies('id,title,type,watch_providers');

    const startAt = Math.min(resumeFrom, all.length);
    const slice = all.slice(startAt);

    const withTotal: SyncJob = { ...loading, status: 'running', total: all.length, current: startAt, message: `${slice.length} conteúdos para processar` };
    setProviderJob(withTotal);
    saveJob(PROVIDER_KEY, withTotal);

    let updated = 0, skipped = 0, errors = 0;

    for (let i = 0; i < slice.length; i++) {
      if (providerAbort.current) break;
      const movie = slice[i];
      const absIdx = startAt + i + 1;

      const running: SyncJob = { status: 'running', current: absIdx, total: all.length, updated, skipped, errors, message: `Buscando streaming: ${movie.title}`, resumeFrom: absIdx };
      setProviderJob(running);
      if (i % 5 === 0) saveJob(PROVIDER_KEY, running);

      try {
        const searchRes = await tmdb.get(requests.searchMulti, { params: { query: movie.title } });
        const result = searchRes.data.results?.[0];
        if (!result) { skipped++; setProviderJob(s => ({ ...s, skipped })); continue; }
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
      setProviderJob(s => ({ ...s, updated, skipped, errors }));
    }

    const finalStatus: SyncStatus = providerAbort.current ? 'paused' : 'done';
    setProviderJob(s => {
      const final: SyncJob = { ...s, status: finalStatus, updated, skipped, errors, message: providerAbort.current ? 'Pausado pelo usuário' : 'Sincronização de streamings concluída!', resumeFrom: s.current };
      saveJob(PROVIDER_KEY, final);
      return final;
    });
  }, []);

  const pauseLogos = useCallback(() => { logoAbort.current = true; }, []);
  const pauseProviders = useCallback(() => { providerAbort.current = true; }, []);

  const cancelLogos = useCallback(() => {
    logoAbort.current = true;
    clearJob(LOGO_KEY);
    setLogoJob(emptyJob());
  }, []);

  const cancelProviders = useCallback(() => {
    providerAbort.current = true;
    clearJob(PROVIDER_KEY);
    setProviderJob(emptyJob());
  }, []);

  const resetLogos = useCallback(() => {
    clearJob(LOGO_KEY);
    setLogoJob(emptyJob());
  }, []);

  const resetProviders = useCallback(() => {
    clearJob(PROVIDER_KEY);
    setProviderJob(emptyJob());
  }, []);

  return (
    <SyncContext.Provider value={{ logoJob, providerJob, startLogos, startProviders, pauseLogos, pauseProviders, cancelLogos, cancelProviders, resetLogos, resetProviders }}>
      {children}
    </SyncContext.Provider>
  );
}
