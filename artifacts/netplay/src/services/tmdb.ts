import axios, { AxiosInstance } from 'axios';

// Client-side session cache — avoids repeated round-trips when switching tabs
const sessionCache = new Map<string, { data: any; ts: number }>();
const SESSION_TTL = 5 * 60 * 1000; // 5 minutes

function makeCachedAxios(): AxiosInstance {
  const instance = axios.create({
    baseURL: '/api/tmdb',
    params: { language: 'pt-BR' },
  });

  // Wrap get() to check cache before making a real request
  const originalGet = instance.get.bind(instance);
  (instance as any).get = async (url: string, config?: any) => {
    const key = url + '|' + JSON.stringify(config?.params || {});
    const hit = sessionCache.get(key);
    if (hit && Date.now() - hit.ts < SESSION_TTL) {
      return { data: hit.data, status: 200, statusText: 'OK', headers: {}, config };
    }
    try {
      const response = await originalGet(url, config);
      sessionCache.set(key, { data: response.data, ts: Date.now() });
      return response;
    } catch (error: any) {
      // Return stale cache on error rather than throwing
      if (hit) return { data: hit.data, status: 200, statusText: 'OK (stale)', headers: {}, config };
      console.warn('TMDB fetch falhou:', error?.message);
      return { data: { results: [], cast: [], logos: [], flatrate: [], buy: [] }, status: 200 };
    }
  };

  return instance;
}

const tmdb = makeCachedAxios();

export const requests = {
  fetchTrending: `/trending/all/week`,
  fetchNetflixOriginals: `/discover/tv?with_networks=213`,
  fetchTopRated: `/movie/top_rated`,
  fetchActionMovies: `/discover/movie?with_genres=28`,
  fetchComedyMovies: `/discover/movie?with_genres=35`,
  fetchHorrorMovies: `/discover/movie?with_genres=27`,
  fetchRomanceMovies: `/discover/movie?with_genres=10749`,
  fetchDocumentaries: `/discover/movie?with_genres=99`,
  searchMovie: `/search/movie`,
  searchTv: `/search/tv`,
  searchMulti: `/search/multi`,
  movieDetails: (id: number) => `/movie/${id}`,
  tvDetails: (id: number) => `/tv/${id}`,
  movieCredits: (id: number) => `/movie/${id}/credits`,
  tvCredits: (id: number) => `/tv/${id}/credits`,
  movieWatchProviders: (id: number) => `/movie/${id}/watch/providers`,
  tvWatchProviders: (id: number) => `/tv/${id}/watch/providers`,
  tvSeasonDetails: (tvId: number, seasonNumber: number) => `/tv/${tvId}/season/${seasonNumber}`,
  movieImages: (id: number) => `/movie/${id}/images`,
  tvImages: (id: number) => `/tv/${id}/images`,
  fetchCollection: (id: number) => `/collection/${id}`,
  searchCollection: `/search/collection`,
  fetchMoviesByGenre: (genreId: number) => `/discover/movie?with_genres=${genreId}`,
};

// Logo cache — avoids re-fetching logos on banner rotation
const logoCache = new Map<string, string | null>();

export const getMovieLogo = async (id: number, type: 'movie' | 'tv' = 'movie'): Promise<string | null> => {
  const cacheKey = `${type}-${id}`;
  if (logoCache.has(cacheKey)) return logoCache.get(cacheKey)!;

  try {
    const endpoint = type === 'movie' ? requests.movieImages(id) : requests.tvImages(id);
    const { data } = await tmdb.get(endpoint, {
      params: { include_image_language: 'pt,en,null' }
    });
    const logos = data.logos || [];
    if (logos.length === 0) { logoCache.set(cacheKey, null); return null; }

    const logo = logos.find((l: any) => l.iso_639_1 === 'en') ||
                 logos.find((l: any) => l.iso_639_1 === 'pt') ||
                 logos[0];

    const url = logo ? `https://image.tmdb.org/t/p/w300${logo.file_path}` : null;
    logoCache.set(cacheKey, url);
    return url;
  } catch {
    logoCache.set(cacheKey, null);
    return null;
  }
};

export const fetchSeasonDetailsWithFallback = async (tvId: number, seasonNumber: number) => {
  const res = await tmdb.get(requests.tvSeasonDetails(tvId, seasonNumber), { params: { language: 'pt-BR' } });
  let episodes = res.data.episodes || [];

  try {
    const enRes = await tmdb.get(requests.tvSeasonDetails(tvId, seasonNumber), { params: { language: 'en-US' } });
    const enEpisodes = enRes.data.episodes || [];
    const { translateToPortuguese } = await import('./ai');

    episodes = await Promise.all(episodes.map(async (ep: any, idx: number) => {
      let finalOverview = ep.overview;
      let finalName = ep.name;
      const fallbackEnOverview = enEpisodes[idx]?.overview || '';
      const fallbackEnTitle = enEpisodes[idx]?.name || '';

      if (!finalOverview || finalOverview === '' || (finalOverview === fallbackEnOverview && fallbackEnOverview !== '')) {
        if (fallbackEnOverview) finalOverview = await translateToPortuguese(fallbackEnOverview);
      }
      if (!finalName || finalName.startsWith('Episódio') || finalName === `Episode ${ep.episode_number}` || (finalName === fallbackEnTitle && fallbackEnTitle !== '')) {
        if (fallbackEnTitle && !fallbackEnTitle.startsWith('Episode ') && !fallbackEnTitle.startsWith('Episódio')) {
          try { finalName = await translateToPortuguese(fallbackEnTitle); } catch { finalName = fallbackEnTitle; }
        }
      }
      return { ...ep, overview: finalOverview, name: finalName };
    }));
  } catch (e) {
    console.warn('Failed to fetch/translate fallback English overviews for season', seasonNumber);
  }

  return { ...res, data: { ...res.data, episodes } };
};

export default tmdb;
