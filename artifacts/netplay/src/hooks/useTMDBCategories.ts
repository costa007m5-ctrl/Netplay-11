import { useState, useEffect, useCallback } from 'react';
import tmdb from '../services/tmdb';

const CACHE_KEY = 'netplay_tmdb_cats_v1';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas

export interface TMDBCategory {
  id: string;
  title: string;
  movies: any[];
}

const CATEGORY_DEFS = [
  { id: 'trending',    title: 'Em Alta Agora',      url: '/trending/all/day' },
  { id: 'action',      title: 'Ação',               url: '/discover/movie?with_genres=28&sort_by=popularity.desc' },
  { id: 'drama',       title: 'Drama',              url: '/discover/movie?with_genres=18&sort_by=popularity.desc' },
  { id: 'comedy',      title: 'Comédia',            url: '/discover/movie?with_genres=35&sort_by=popularity.desc' },
  { id: 'horror',      title: 'Terror',             url: '/discover/movie?with_genres=27&sort_by=popularity.desc' },
  { id: 'scifi',       title: 'Ficção Científica',  url: '/discover/movie?with_genres=878&sort_by=popularity.desc' },
  { id: 'animation',   title: 'Animação',           url: '/discover/movie?with_genres=16&sort_by=popularity.desc' },
  { id: 'romance',     title: 'Romance',            url: '/discover/movie?with_genres=10749&sort_by=popularity.desc' },
  { id: 'toprated',    title: 'Mais Avaliados',     url: '/movie/top_rated' },
  { id: 'documentary', title: 'Documentários',      url: '/discover/movie?with_genres=99&sort_by=popularity.desc' },
];

export function useTMDBCategories() {
  const [categories, setCategories] = useState<TMDBCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    if (!force) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { data, fetchedAt } = JSON.parse(raw);
          if (Date.now() - fetchedAt < CACHE_TTL && data?.length > 0) {
            setCategories(data);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    const results = await Promise.allSettled(
      CATEGORY_DEFS.map(async (def) => {
        const res = await tmdb.get(def.url);
        return {
          id: def.id,
          title: def.title,
          movies: (res.data.results || []).slice(0, 10),
        } as TMDBCategory;
      })
    );

    const valid = results
      .filter((r): r is PromiseFulfilledResult<TMDBCategory> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(c => c.movies.length > 0);

    setCategories(valid);
    setLoading(false);

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: valid, fetchedAt: Date.now() }));
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return { categories, loading, refresh: () => load(true) };
}
