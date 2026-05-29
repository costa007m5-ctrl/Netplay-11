export const config = {
  maxDuration: 15,
};

const TMDB_BASE = "https://api.themoviedb.org/3";
const SHORT_TTL_PATTERNS = ["/trending/", "/now_playing", "/upcoming", "/on_the_air", "/airing_today"];
const CACHE_TTL_MS = 60 * 60 * 1000;
const SHORT_CACHE_TTL_MS = 15 * 60 * 1000;

const tmdbCache = new Map<string, { data: any; expiresAt: number }>();

function getCached(key: string): any | null {
  const entry = tmdbCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tmdbCache.delete(key); return null; }
  return entry.data;
}

function setCached(key: string, tmdbPath: string, data: any) {
  const isShortTtl = SHORT_TTL_PATTERNS.some(p => tmdbPath.includes(p));
  const ttl = isShortTtl ? SHORT_CACHE_TTL_MS : CACHE_TTL_MS;
  tmdbCache.set(key, { data, expiresAt: Date.now() + ttl });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }

  const pathSegments: string[] = req.query.path
    ? (Array.isArray(req.query.path) ? req.query.path : [req.query.path])
    : [];
  const tmdbPath = pathSegments.join("/");

  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== "path") query[k] = String(v);
  }
  query.api_key = apiKey;

  const qs = new URLSearchParams(query).toString();
  const cacheKey = `${tmdbPath}?${qs}`;

  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=300");
    res.json(cached);
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(`${TMDB_BASE}/${tmdbPath}?${qs}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);

    const data = await upstream.json();

    if (upstream.ok) {
      setCached(cacheKey, tmdbPath, data);
      res.setHeader("X-Cache", "MISS");
      res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=300");
      res.status(200).json(data);
    } else {
      res.status(upstream.status).json(data);
    }
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    console.error(`[tmdb] error: ${error?.message}`);
    res.status(isTimeout ? 504 : 502).json({ error: "TMDB request failed", details: error?.message });
  }
}
