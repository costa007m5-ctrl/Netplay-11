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
    const { data } = await axios.get("https://betterflix.click/api/canais.json", {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    res.json(data);
  } catch (err: any) {
    // Retorna array vazio em vez de 502 para não travar o painel admin
    res.json([]);
  }
});

router.get("/betterflix/jogos", async (_req, res) => {
  try {
    const { data } = await axios.get("https://betterflix.click/api/jogos.json", {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    res.json(data);
  } catch (err: any) {
    // Retorna array vazio em vez de 502 para não travar o painel admin
    res.json([]);
  }
});

let epgChannelsCache: any[] | null = null;
let epgChannelsCachedAt = 0;
const EPG_CACHE_TTL = 6 * 60 * 60 * 1000;

async function getEpgChannels(): Promise<any[]> {
  if (epgChannelsCache && Date.now() - epgChannelsCachedAt < EPG_CACHE_TTL) {
    return epgChannelsCache;
  }
  try {
    const { data } = await axios.get("https://epg.pw/api/channels.json", { timeout: 10000 });
    epgChannelsCache = Array.isArray(data) ? data : [];
    epgChannelsCachedAt = Date.now();
    return epgChannelsCache;
  } catch {
    return epgChannelsCache || [];
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

router.get("/epg/channel", async (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) { res.json({ current: null, next: null }); return; }

  try {
    const channels = await getEpgChannels();
    const norm = normalize(name);

    const match =
      channels.find((c: any) => normalize(c.name || "") === norm) ||
      channels.find((c: any) => normalize(c.name || "").includes(norm)) ||
      channels.find((c: any) => norm.includes(normalize(c.name || "").slice(0, 4) || "__"));

    if (!match) { res.json({ current: null, next: null }); return; }

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const { data: epgData } = await axios.get(
      `https://epg.pw/api/epg.json?channel_id=${encodeURIComponent(match.channel_id)}&date=${today}`,
      { timeout: 8000 }
    );

    const programs: any[] = epgData?.epg_data || [];
    const now = Date.now();

    let current: any = null;
    let next: any = null;

    for (let i = 0; i < programs.length; i++) {
      const startMs = new Date(programs[i].start.replace(" ", "T")).getTime();
      const stopMs  = programs[i].stop
        ? new Date(programs[i].stop.replace(" ", "T")).getTime()
        : startMs + 3_600_000;

      if (startMs <= now && now < stopMs) {
        const prog = programs[i];
        current = {
          title: prog.title,
          description: prog.description || null,
          startMs,
          stopMs,
          progress: Math.round(((now - startMs) / (stopMs - startMs)) * 100),
        };
        const n = programs[i + 1];
        if (n) {
          const nStart = new Date(n.start.replace(" ", "T")).getTime();
          next = { title: n.title, startMs: nStart };
        }
        break;
      }
    }

    res.json({ current, next });
  } catch {
    res.json({ current: null, next: null });
  }
});

export default router;
