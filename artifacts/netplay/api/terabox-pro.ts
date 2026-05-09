export const config = {
  maxDuration: 60,
};

const teraboxCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const SAFETY_MS = 5 * 60 * 1000;

function deriveTtlMs(url: string): number {
  try {
    const u = new URL(url);
    const exp = u.searchParams.get("expires");
    if (exp && /^\d+$/.test(exp)) {
      const expMs = parseInt(exp, 10) * 1000;
      const remaining = expMs - Date.now() - SAFETY_MS;
      if (remaining > 0) return Math.min(remaining, CACHE_TTL_MS);
      return 0;
    }
  } catch {}
  return CACHE_TTL_MS;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const url = req.query?.url;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url query param required" });
      return;
    }

    const apiKey = process.env.TERABOX_PRO_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "TERABOX_PRO_API_KEY not configured" });
      return;
    }

    const cached = teraboxCache.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      const remainingSec = Math.max(1, Math.floor((cached.expiresAt - Date.now()) / 1000));
      res.setHeader("Cache-Control", `public, s-maxage=${remainingSec}, stale-while-revalidate=60`);
      res.setHeader("X-Cache", "HIT-MEMORY");
      res.status(200).json(cached.data);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    let upstream: Response;
    try {
      upstream = await fetch("https://xapiverse.com/api/terabox-pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xAPIverse-Key": apiKey,
        },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr?.name === "AbortError";
      console.error(`[terabox-pro] upstream fetch error: ${fetchErr?.message}`);
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? "Terabox API timed out" : "Terabox API unreachable",
        details: fetchErr?.message ?? "fetch failed",
      });
      return;
    }
    clearTimeout(timeoutId);

    const text = await upstream.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[terabox-pro] non-JSON response (${upstream.status}): ${text.slice(0, 200)}`);
      res.status(502).json({
        error: "Terabox API returned non-JSON",
        status: upstream.status,
        details: text.slice(0, 300),
      });
      return;
    }

    if (data?.status !== "error") {
      const ttl = deriveTtlMs(url);
      if (ttl > 0) {
        teraboxCache.set(url, { data, expiresAt: Date.now() + ttl });
        const sMaxAge = Math.max(1, Math.floor(ttl / 1000));
        res.setHeader("Cache-Control", `public, s-maxage=${sMaxAge}, stale-while-revalidate=60`);
        res.setHeader("X-Cache", "MISS-STORED");
      } else {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Cache", "BYPASS-EXPIRED");
      }
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error(`[terabox-pro] handler crashed: ${error?.message}`, error?.stack);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to fetch from Terabox API",
        details: error?.message ?? "unknown error",
      });
    }
  }
}
