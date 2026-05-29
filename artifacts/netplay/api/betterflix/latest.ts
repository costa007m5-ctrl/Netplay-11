export const config = {
  maxDuration: 30,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const VIDSRC_DOMAINS = [
  "vidsrc-embed.ru",
  "vidsrc-embed.su",
  "vidsrcme.su",
  "vsrc.su",
];

async function fetchVidsrcLatest(type: "movies" | "tvshows", page: number): Promise<any[]> {
  for (const domain of VIDSRC_DOMAINS) {
    try {
      const res = await fetch(
        `https://${domain}/${type}/latest/page-${page}.json`,
        { signal: AbortSignal.timeout(10000), headers: { "User-Agent": USER_AGENT } }
      );
      if (!res.ok) continue;
      const data: any = await res.json();
      const results = Array.isArray(data) ? data : (data?.result || []);
      return results
        .filter((i: any) => i.tmdb_id)
        .map((i: any) => ({ tmdb_id: i.tmdb_id, contentType: type === "movies" ? "movie" : "series" }));
    } catch {}
  }
  return [];
}

function hasPtBrDubbing(tmdbData: any): boolean {
  const spoken = (tmdbData.spoken_languages || []) as any[];
  return spoken.some((l: any) => l.iso_639_1 === "pt" || l.iso_639_1 === "pt-BR") ||
    tmdbData.original_language === "pt";
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!TMDB_KEY) { res.status(503).json({ error: "TMDB key não configurada" }); return; }

  const page = Number(req.query.page) || 1;
  const typeFilter = String(req.query.type || "all");

  try {
    const tmdbBase = `https://api.themoviedb.org/3`;

    const [moviesRaw, seriesRaw, vidsrcMovies, vidsrcSeries] = await Promise.all([
      typeFilter !== "tvshows"
        ? fetch(`${tmdbBase}/movie/now_playing?api_key=${TMDB_KEY}&language=pt-BR&page=${page}&region=BR`, { signal: AbortSignal.timeout(8000) })
            .then(r => r.json()).then((d: any) => (d.results || []).map((m: any) => ({
              tmdb_id: m.id, type: "movie", title: m.title || m.name,
              poster_path: m.poster_path || null, backdrop_path: m.backdrop_path || null,
              vote_average: m.vote_average || 0, release_date: m.release_date || null,
              overview: m.overview || "", genres: "", source: "apiflix",
            }))).catch(() => [] as any[])
        : Promise.resolve([] as any[]),

      typeFilter !== "movies"
        ? fetch(`${tmdbBase}/tv/on_the_air?api_key=${TMDB_KEY}&language=pt-BR&page=${page}`, { signal: AbortSignal.timeout(8000) })
            .then(r => r.json()).then((d: any) => (d.results || []).map((s: any) => ({
              tmdb_id: s.id, type: "series", title: s.name || s.title,
              poster_path: s.poster_path || null, backdrop_path: s.backdrop_path || null,
              vote_average: s.vote_average || 0, release_date: s.first_air_date || null,
              overview: s.overview || "", genres: "", source: "apiflix",
            }))).catch(() => [] as any[])
        : Promise.resolve([] as any[]),

      typeFilter !== "tvshows" ? fetchVidsrcLatest("movies", page) : Promise.resolve([] as any[]),
      typeFilter !== "movies" ? fetchVidsrcLatest("tvshows", page) : Promise.resolve([] as any[]),
    ]);

    const apiFlixItems = [...moviesRaw, ...seriesRaw];
    const seenIds = new Set<number>(apiFlixItems.map((i: any) => i.tmdb_id));

    const vidsrcEnriched = (await Promise.all(
      [...vidsrcMovies, ...vidsrcSeries].slice(0, 30).map(async (item: any) => {
        try {
          const mediaType = item.contentType === "series" ? "tv" : "movie";
          const r = await fetch(`${tmdbBase}/${mediaType}/${item.tmdb_id}?api_key=${TMDB_KEY}&language=pt-BR`, { signal: AbortSignal.timeout(6000) });
          const data: any = await r.json();
          if (!hasPtBrDubbing(data)) return null;
          return {
            tmdb_id: item.tmdb_id, type: item.contentType,
            title: data.title || data.name, poster_path: data.poster_path || null,
            backdrop_path: data.backdrop_path || null, vote_average: data.vote_average || 0,
            release_date: data.release_date || data.first_air_date || null,
            overview: data.overview || "", genres: data.genres?.map((g: any) => g.name).join(", ") || "",
            source: "vidsrc",
          };
        } catch { return null; }
      })
    )).filter((i): i is NonNullable<typeof i> => i !== null && !seenIds.has(i.tmdb_id));

    const results = [...apiFlixItems, ...vidsrcEnriched].slice(0, 24);
    res.json({ results });
  } catch (err: any) {
    res.status(502).json({ error: "Falha ao buscar novidades", detail: err?.message });
  }
}
