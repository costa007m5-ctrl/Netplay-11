import { Router, type IRouter } from "express";
import axios from "axios";

const router: IRouter = Router();

const TMDB_BASE = "https://api.themoviedb.org/3";

const tmdbCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = tmdbCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tmdbCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: any) {
  tmdbCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

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
    res.json(cached);
    return;
  }

  try {
    const response = await axios.get(`${TMDB_BASE}/${tmdbPath}`, {
      params: query,
      timeout: 10000,
    });
    setCached(cacheKey, response.data);
    res.json(response.data);
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const message = error?.response?.data ?? { error: "TMDB request failed" };
    res.status(status).json(message);
  }
});

export default router;
