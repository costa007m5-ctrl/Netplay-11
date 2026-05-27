import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Movie } from '../types';
import { fmtMovieRow } from '../lib/movieUtils';
import { supabase } from '../lib/supabase';

const ProviderPage = React.lazy(() => import('../components/ProviderPage'));

const PROVIDER_CACHE_VERSION = 'v3';
const PROVIDER_CACHE_TTL_MS = 20 * 24 * 60 * 60 * 1000;

function getProviderCacheKey(providerId: string) {
  return `cached_provider_${PROVIDER_CACHE_VERSION}_${providerId.toLowerCase()}`;
}

function loadProviderCache(providerId: string): Movie[] | null {
  try {
    const raw = localStorage.getItem(getProviderCacheKey(providerId));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    if (Date.now() - ts > PROVIDER_CACHE_TTL_MS) return null;
    return data as Movie[];
  } catch {
    return null;
  }
}

function saveProviderCache(providerId: string, movies: Movie[]) {
  try {
    const slim = movies.map(m => ({
      id: m.id, title: m.title, type: m.type, poster_path: m.poster_path,
      backdrop_path: m.backdrop_path, release_date: m.release_date,
      first_air_date: m.first_air_date, rating: m.rating, vote_average: m.vote_average,
      runtime: m.runtime, genres: m.genres, video_url: m.videoUrl, video_url_2: m.videoUrl2,
      logo_path: m.logo_path, watch_providers: m.watch_providers, is_hidden: m.is_hidden,
    }));
    localStorage.setItem(getProviderCacheKey(providerId), JSON.stringify({ data: slim, ts: Date.now() }));
  } catch {
    // localStorage cheio — ignora silenciosamente
  }
}

const ProviderViewWrapper = ({ myMovies, handleSelectMovie, toggleMyList, toggleFavorite, myListIds, favoriteIds }: any) => {
  const { providerId } = useParams();
  const navigate = useNavigate();

  const providerAliases: Record<string, string[]> = React.useMemo(() => ({
    'apple tv+': ['apple tv', 'apple tv plus', 'atvp'],
    'paramount+': ['paramount plus', 'pmnt'],
    'disney+': ['disney plus', 'star+', 'star plus'],
    'max': ['hbo max', 'hbo'],
    'netflix': ['nflx'],
    'prime video': ['amazon prime', 'amazon'],
    'crunchyroll': ['crunchyroll'],
  }), []);

  const filteredFromMemory = React.useMemo(() => {
    if (!providerId || myMovies.length === 0) return [];
    const pIdDirect = providerId.toLowerCase();
    const pIdNormalized = pIdDirect.replace(/\s+/g, '').replace(/[+]/g, 'plus');
    const aliases = providerAliases[pIdDirect] || [];
    return myMovies.filter((m: any) => {
      if (!m.watch_providers) return false;
      const wp = m.watch_providers.toLowerCase();
      const containsDirect = wp.includes(pIdDirect) || wp.replace(/\s+/g, '').replace(/[+]/g, 'plus').includes(pIdNormalized);
      const containsAlias = aliases.some((alias: string) => wp.includes(alias));
      return containsDirect || containsAlias;
    });
  }, [myMovies, providerId, providerAliases]);

  const [dbProviderMovies, setDbProviderMovies] = React.useState<Movie[]>(() => {
    if (!providerId) return [];
    return loadProviderCache(providerId) || [];
  });

  const [isLoadingProvider, setIsLoadingProvider] = React.useState(() => {
    if (!providerId) return false;
    const hasCached = (loadProviderCache(providerId) || []).length > 0;
    return !hasCached;
  });

  React.useEffect(() => {
    if (!providerId) return;

    const cached = loadProviderCache(providerId);
    if (cached && cached.length > 0) {
      setDbProviderMovies(cached);
      setIsLoadingProvider(false);
    } else if (filteredFromMemory.length > 0) {
      setIsLoadingProvider(false);
    } else {
      setIsLoadingProvider(true);
    }

    const pIdDirect = providerId.toLowerCase();
    const aliases = providerAliases[pIdDirect] || [];
    const searchTerms = [pIdDirect, ...aliases];

    const fetchFromDb = async () => {
      try {
        const COLS = 'id,title,type,poster_path,backdrop_path,release_date,first_air_date,rating,vote_average,runtime,genres,video_url,video_url_2,logo_path,watch_providers,is_hidden,created_at,updated_at';
        const orClause = searchTerms.map(t => `watch_providers.ilike.%${t}%`).join(',');
        const PAGE_SIZE = 1000;

        const fetchPage = async (from: number, withFilter: boolean) => {
          let q = supabase
            .from('movies')
            .select(COLS)
            .or('is_hidden.eq.false,is_hidden.is.null')
            .order('vote_average', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (withFilter) q = q.or(orClause);
          return q;
        };

        let allData: any[] = [];
        let offset = 0;

        while (true) {
          const { data, error } = await fetchPage(offset, true);
          if (error || !data || data.length === 0) break;
          allData = [...allData, ...data];
          const formatted = allData.filter((m: any) => !m.is_hidden).map(fmtMovieRow);
          setDbProviderMovies(formatted);
          if (data.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }

        if (allData.length > 0) {
          const finalMovies = allData.filter((m: any) => !m.is_hidden).map(fmtMovieRow);
          saveProviderCache(providerId!, finalMovies);
        }
      } catch (e) {
        console.warn('[ProviderViewWrapper] Erro ao buscar no DB:', e);
      } finally {
        setIsLoadingProvider(false);
      }
    };

    fetchFromDb();
  }, [providerId]);

  const providerMovies = React.useMemo(() => {
    if (dbProviderMovies.length > 0) return dbProviderMovies;
    return filteredFromMemory;
  }, [dbProviderMovies, filteredFromMemory]);

  return (
    <ProviderPage
      provider={providerId || ''}
      movies={providerMovies}
      onClose={() => navigate('/menu')}
      onSelectMovie={handleSelectMovie}
      onToggleMyList={toggleMyList}
      onToggleFavorite={toggleFavorite}
      myListIds={myListIds}
      favoriteIds={favoriteIds}
      isLoading={isLoadingProvider}
    />
  );
};

export default ProviderViewWrapper;
