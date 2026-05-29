export const config = {
  maxDuration: 30,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let canaisCache: any = null;
let canaisCachedAt = 0;
const CANAIS_CACHE_TTL = 10 * 60 * 1000;

export default async function handler(_req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (_req.method === "OPTIONS") { res.status(204).end(); return; }

  if (canaisCache && Date.now() - canaisCachedAt < CANAIS_CACHE_TTL) {
    res.setHeader("Cache-Control", "public, max-age=600");
    res.json(canaisCache);
    return;
  }

  try {
    const response = await fetch("http://embedtv.lat/api/channels", {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": USER_AGENT },
    });
    const data = await response.json();
    canaisCache = data;
    canaisCachedAt = Date.now();
    res.setHeader("Cache-Control", "public, max-age=600");
    res.json(data);
  } catch {
    res.json(canaisCache || { categories: [], channels: [] });
  }
}
