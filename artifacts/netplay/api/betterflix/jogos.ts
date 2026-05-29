export const config = {
  maxDuration: 30,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let jogosCache: any[] | null = null;
let jogosCachedAt = 0;
const JOGOS_CACHE_TTL = 2 * 60 * 1000;

export default async function handler(_req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (_req.method === "OPTIONS") { res.status(204).end(); return; }

  if (jogosCache && Date.now() - jogosCachedAt < JOGOS_CACHE_TTL) {
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json(jogosCache);
    return;
  }

  try {
    const response = await fetch("http://embedtv.lat/api/jogos", {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": USER_AGENT },
    });
    const data = await response.json();
    jogosCache = Array.isArray(data) ? data : [];
    jogosCachedAt = Date.now();
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json(jogosCache);
  } catch {
    res.json(jogosCache || []);
  }
}
