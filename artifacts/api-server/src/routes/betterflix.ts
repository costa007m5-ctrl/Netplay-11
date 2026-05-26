import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/betterflix/stream", async (req, res) => {
  const { id, type, season, episode } = req.query;
  const key = process.env.VITE_BETTERFLIX_API_KEY || process.env.BETTERFLIX_API_KEY || '';

  if (!id || !type) {
    res.status(400).json({ error: 'id e type são obrigatórios' });
    return;
  }

  const params = new URLSearchParams({ id: String(id), type: String(type) });
  if (type === 'tv') {
    params.set('season', String(season || 1));
    params.set('episode', String(episode || 1));
  }
  if (key) params.set('key', key);

  const playerUrl = `https://betterflix.click/api/player?${params}`;
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://betterflix.click/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  };

  try {
    // 1) Tenta endpoint JSON dedicado /api/stream
    try {
      const { data: jsonData } = await axios.get(`https://betterflix.click/api/stream?${params}`, {
        timeout: 8000,
        headers: { ...baseHeaders, Accept: 'application/json' },
      });
      if (jsonData?.url) {
        res.json({ streamUrl: jsonData.url, type: jsonData.type || 'm3u8', embedUrl: playerUrl });
        return;
      }
      if (Array.isArray(jsonData?.sources) && jsonData.sources.length > 0) {
        const best = jsonData.sources.find((s: any) => s.quality === '1080p') || jsonData.sources[0];
        res.json({ streamUrl: best.url || best.file, type: 'm3u8', embedUrl: playerUrl });
        return;
      }
    } catch {}

    // 2) Busca a página do player e extrai URL de stream do HTML/JS embutido
    const { data: html } = await axios.get(playerUrl, {
      timeout: 15000,
      headers: baseHeaders,
    });

    const patterns: RegExp[] = [
      /["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /file\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /src\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /source\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /["'`](https?:\/\/[^"'`\s]+\.mp4(?:[?#][^"'`\s]*)?)[`"']/,
    ];

    for (const pattern of patterns) {
      const match = String(html).match(pattern);
      if (match?.[1]) {
        const streamUrl = match[1];
        const streamType = streamUrl.includes('.m3u8') ? 'm3u8' : 'mp4';
        res.json({ streamUrl, type: streamType, embedUrl: playerUrl });
        return;
      }
    }

    // 3) Sem stream extraível — devolve embedUrl para o frontend usar no NetflixPlayer como iframe
    res.json({ streamUrl: null, embedUrl: playerUrl });
  } catch (err: any) {
    res.status(502).json({ error: 'Falha ao resolver stream BetterFlix', detail: err.message });
  }
});

const VIDSRC_LATEST_DOMAINS = [
  "vidsrc-embed.ru",
  "vidsrc-embed.su",
  "vidsrcme.su",
  "vsrc.su",
];

async function fetchVidsrcLatest(
  type: "movies" | "tvshows",
  page: number
): Promise<any[]> {
  for (const domain of VIDSRC_LATEST_DOMAINS) {
    try {
      const { data } = await axios.get(
        `https://${domain}/${type}/latest/page-${page}.json`,
        {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
        }
      );
      const results = Array.isArray(data) ? data : data?.result || [];
      return results
        .filter((i: any) => i.tmdb_id)
        .map((i: any) => ({
          tmdb_id: i.tmdb_id,
          contentType: type === "movies" ? "movie" : "series",
        }));
    } catch {
      // tenta próximo domínio
    }
  }
  return [];
}

// Verifica se o item TMDB tem dublagem PT-BR disponível
function hasPtBrDubbing(tmdbData: any): boolean {
  const spoken = (tmdbData.spoken_languages || []) as any[];
  const hasPt = spoken.some(
    (l: any) => l.iso_639_1 === "pt" || l.iso_639_1 === "pt-BR"
  );
  const originalPt = tmdbData.original_language === "pt";
  return hasPt || originalPt;
}

router.get("/betterflix/latest", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const typeFilter = (req.query.type as string) || "all";

  const TMDB_KEY = process.env.VITE_TMDB_API_KEY;
  if (!TMDB_KEY) {
    res.status(503).json({ error: "TMDB key não configurada" });
    return;
  }

  try {
    // ── Fonte primária: API Flix (conteúdo recente via TMDB) ──────────────────
    const tmdbMoviePromise =
      typeFilter !== "tvshows"
        ? axios
            .get(
              `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=pt-BR&page=${page}&region=BR`,
              { timeout: 8000 }
            )
            .then((r) =>
              (r.data.results || []).map((m: any) => ({
                tmdb_id: m.id,
                type: "movie" as const,
                title: m.title || m.name,
                poster_path: m.poster_path || null,
                backdrop_path: m.backdrop_path || null,
                vote_average: m.vote_average || 0,
                release_date: m.release_date || null,
                overview: m.overview || "",
                genres: "",
                source: "apiflix" as const,
              }))
            )
            .catch(() => [] as any[])
        : ([] as any[]);

    const tmdbSeriesPromise =
      typeFilter !== "movies"
        ? axios
            .get(
              `https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_KEY}&language=pt-BR&page=${page}`,
              { timeout: 8000 }
            )
            .then((r) =>
              (r.data.results || []).map((s: any) => ({
                tmdb_id: s.id,
                type: "series" as const,
                title: s.name || s.title,
                poster_path: s.poster_path || null,
                backdrop_path: s.backdrop_path || null,
                vote_average: s.vote_average || 0,
                release_date: s.first_air_date || null,
                overview: s.overview || "",
                genres: "",
                source: "apiflix" as const,
              }))
            )
            .catch(() => [] as any[])
        : ([] as any[]);

    // ── Fonte secundária: Vidsrc — somente com dublagem PT-BR ─────────────────
    const vidsrcMoviesPromise =
      typeFilter !== "tvshows"
        ? fetchVidsrcLatest("movies", page)
        : ([] as any[]);
    const vidsrcSeriesPromise =
      typeFilter !== "movies"
        ? fetchVidsrcLatest("tvshows", page)
        : ([] as any[]);

    const [tmdbMovies, tmdbSeries, vidsrcMovies, vidsrcSeries] =
      await Promise.all([
        tmdbMoviePromise,
        tmdbSeriesPromise,
        vidsrcMoviesPromise,
        vidsrcSeriesPromise,
      ]);

    // Enriquece itens do Vidsrc e filtra apenas os com dubagem PT-BR
    const vidsrcItems = [...vidsrcMovies, ...vidsrcSeries];
    const vidsrcEnriched = (
      await Promise.all(
        vidsrcItems.slice(0, 30).map(async (item: any) => {
          try {
            const mediaType = item.contentType === "series" ? "tv" : "movie";
            const { data } = await axios.get(
              `https://api.themoviedb.org/3/${mediaType}/${item.tmdb_id}?api_key=${TMDB_KEY}&language=pt-BR`,
              { timeout: 6000 }
            );
            if (!hasPtBrDubbing(data)) return null; // Descarta sem PT-BR
            return {
              tmdb_id: item.tmdb_id,
              type: item.contentType,
              title: data.title || data.name,
              poster_path: data.poster_path || null,
              backdrop_path: data.backdrop_path || null,
              vote_average: data.vote_average || 0,
              release_date: data.release_date || data.first_air_date || null,
              overview: data.overview || "",
              genres: data.genres?.map((g: any) => g.name).join(", ") || "",
              source: "vidsrc" as const,
            };
          } catch {
            return null;
          }
        })
      )
    ).filter(Boolean);

    // Combina: API Flix primeiro, Vidsrc PT-BR depois — sem duplicatas
    const apiFlixItems = [...tmdbMovies, ...tmdbSeries];
    const seenIds = new Set<number>(apiFlixItems.map((i) => i.tmdb_id));
    const vidsrcFiltered = vidsrcEnriched.filter(
      (i) => !seenIds.has(i!.tmdb_id)
    );

    const results = [...apiFlixItems, ...vidsrcFiltered].slice(0, 24);
    res.json({ results });
  } catch (err: any) {
    res.status(502).json({
      error: "Falha ao buscar novidades da API Flix",
      detail: err.message,
    });
  }
});

router.get("/betterflix/canais", async (_req, res) => {
  try {
    const { data } = await axios.get("http://embedtv.lat/api/channels", {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    res.json(data);
  } catch {
    res.json({ categories: [], channels: [] });
  }
});

router.get("/betterflix/jogos", async (_req, res) => {
  try {
    const { data } = await axios.get("http://embedtv.lat/api/jogos", {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    res.json(Array.isArray(data) ? data : []);
  } catch {
    res.json([]);
  }
});

let epgFullCache: any[] | null = null;
let epgFullCachedAt = 0;
const EPG_FULL_CACHE_TTL = 5 * 60 * 1000;

async function getEpgFull(): Promise<any[]> {
  if (epgFullCache && Date.now() - epgFullCachedAt < EPG_FULL_CACHE_TTL) {
    return epgFullCache;
  }
  try {
    const { data } = await axios.get("http://embedtv.lat/api/epgs_full", { timeout: 10000 });
    epgFullCache = Array.isArray(data) ? data : [];
    epgFullCachedAt = Date.now();
    return epgFullCache;
  } catch {
    return epgFullCache || [];
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

router.get("/epg/channel", async (req, res) => {
  const id = String(req.query.id || req.query.name || "").trim();
  if (!id) { res.json({ current: null, next: null }); return; }

  try {
    const epgList = await getEpgFull();
    const normId = normalize(id);

    const entry =
      epgList.find((e: any) => e.id === id) ||
      epgList.find((e: any) => normalize(e.id) === normId) ||
      epgList.find((e: any) => normalize(e.id).includes(normId.slice(0, 5))) ||
      epgList.find((e: any) => normId.includes(normalize(e.id).slice(0, 5)));

    if (!entry?.epg) { res.json({ current: null, next: null }); return; }

    const epg = entry.epg;
    const startMs = epg.start_date ? new Date(epg.start_date).getTime() : Date.now() - 1800000;
    const stopMs  = startMs + 3_600_000;
    const now = Date.now();
    const progress = Math.min(100, Math.max(0, Math.round(((now - startMs) / (stopMs - startMs)) * 100)));

    res.json({
      current: {
        title: epg.title || '',
        description: epg.desc || null,
        startMs,
        stopMs,
        progress,
      },
      next: null,
    });
  } catch {
    res.json({ current: null, next: null });
  }
});

// ── EPG de todos os canais de uma vez (mapa id → programa atual) ──────────────
router.get("/epg/all", async (_req, res) => {
  try {
    const epgList = await getEpgFull();
    const result: Record<string, any> = {};
    const now = Date.now();
    for (const entry of epgList) {
      if (!entry?.epg) continue;
      const epg = entry.epg;
      const startMs = epg.start_date ? new Date(epg.start_date).getTime() : now - 1_800_000;
      const stopMs  = startMs + 3_600_000;
      const progress = Math.min(100, Math.max(0, Math.round(((now - startMs) / (stopMs - startMs)) * 100)));
      result[entry.id] = { title: epg.title || '', description: epg.desc || null, startMs, stopMs, progress };
    }
    res.json(result);
  } catch {
    res.json({});
  }
});

// ── Proxy /betterflix/recents/* → betterflix.click/api/recents/* ──────────────
async function proxyBetterFlixRecents(subpath: string, query: Record<string, any>, res: any) {
  const qs = new URLSearchParams(query).toString();
  const targetUrl = `https://betterflix.click/api/recents${subpath}${qs ? '?' + qs : ''}`;
  try {
    const { data } = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://betterflix.click/',
        'Accept': 'application/json',
      },
    });
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'Falha ao buscar recentes BetterFlix', detail: err.message });
  }
}

router.get("/betterflix/recents", async (req, res) => {
  await proxyBetterFlixRecents('', req.query as any, res);
});

router.get("/betterflix/recents/:subpath", async (req, res) => {
  await proxyBetterFlixRecents(`/${req.params.subpath}`, req.query as any, res);
});

export default router;
