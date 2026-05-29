import { Router } from "express";
import axios from "axios";

const router = Router();

const TMDB_BASE = "https://api.themoviedb.org/3";

// Cache em memória — TTL de 1 hora (dados de filmes mudam raramente)
const tmdbCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// Endpoints que mudam com frequência (trending, novidades) têm TTL menor
const SHORT_TTL_PATTERNS = ['/trending/', '/now_playing', '/upcoming', '/on_the_air', '/airing_today'];
const SHORT_CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = tmdbCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tmdbCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, path: string, data: any) {
  const isShortTtl = SHORT_TTL_PATTERNS.some(p => path.includes(p));
  const ttl = isShortTtl ? SHORT_CACHE_TTL_MS : CACHE_TTL_MS;
  tmdbCache.set(key, { data, expiresAt: Date.now() + ttl });
}

// Limpeza periódica do cache para evitar vazamento de memória
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tmdbCache.entries()) {
    if (now > entry.expiresAt) tmdbCache.delete(key);
  }
}, 10 * 60 * 1000);

router.get("/tmdb/*path", async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TMDB_API_KEY not configured" });
    return;
  }

  const tmdbPath = Array.isArray((req.params as any).path)
    ? (req.params as any).path.join('/')
    : (req.params as any).path || (req.params as any)[0] || '';
  const query = { ...req.query, api_key: apiKey };
  const cacheKey = `${tmdbPath}?${new URLSearchParams(query as Record<string, string>).toString()}`;

  const cached = getCached(cacheKey);
  if (cached) {
    // Header informando que veio do cache + instruindo o browser a cachear também
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=300');
    res.json(cached);
    return;
  }

  try {
    const response = await axios.get(`${TMDB_BASE}/${tmdbPath}`, {
      params: query,
      timeout: 10000,
    });
    setCached(cacheKey, tmdbPath, response.data);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=300');
    res.json(response.data);
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const message = error?.response?.data ?? { error: "TMDB request failed" };
    res.status(status).json(message);
  }
});

export default router;
