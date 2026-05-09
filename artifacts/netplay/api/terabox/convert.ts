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

function pickBestUrl(file: any): string | null {
  return (
    file?.fast_stream_url?.["1080p"] ||
    file?.fast_stream_url?.["720p"] ||
    file?.fast_stream_url?.["480p"] ||
    file?.fast_stream_url?.["360p"] ||
    file?.normal_dlink ||
    file?.stream_url ||
    file?.url ||
    file?.dlink ||
    null
  );
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const url = body?.url;
    if (!url || typeof url !== "string") {
      res.status(400).json({ success: false, error: "url body param required" });
      return;
    }

    const apiKey = process.env.TERABOX_PRO_API_KEY;
    if (!apiKey) {
      res.status(503).json({ success: false, error: "TERABOX_PRO_API_KEY not configured" });
      return;
    }

    let data: any;
    let cacheStatus = "MISS";
    const cached = teraboxCache.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      data = cached.data;
      cacheStatus = "HIT-MEMORY";
    } else {
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
        res.status(isTimeout ? 504 : 502).json({
          success: false,
          error: isTimeout ? "Terabox API timed out" : "Terabox API unreachable",
          details: fetchErr?.message ?? "fetch failed",
        });
        return;
      }
      clearTimeout(timeoutId);

      const text = await upstream.text();
      try {
        data = JSON.parse(text);
      } catch {
        res.status(502).json({
          success: false,
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
        }
      }
    }

    const list: any[] = Array.isArray(data.list)
      ? data.list
      : data.list
        ? [data.list]
        : data.filename || data.fast_stream_url || data.dlink
          ? [data]
          : [];

    const file = list[0];
    if (!file) {
      res.status(404).json({ success: false, error: "Nenhum arquivo encontrado no link do TeraBox." });
      return;
    }

    const videoUrl = pickBestUrl(file);
    if (!videoUrl) {
      res.status(404).json({ success: false, error: "Nenhum link de vídeo encontrado para esse arquivo." });
      return;
    }

    const ttlSec = Math.max(1, Math.floor(deriveTtlMs(url) / 1000));
    res.setHeader("Cache-Control", ttlSec > 1 ? `public, s-maxage=${ttlSec}, stale-while-revalidate=60` : "no-store");
    res.setHeader("X-Cache", cacheStatus);
    res.status(200).json({ success: true, videoUrl, directUrl: videoUrl });
  } catch (error: any) {
    console.error(`[terabox/convert] handler crashed: ${error?.message}`, error?.stack);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Falha ao converter link do TeraBox",
        details: error?.message ?? "unknown error",
      });
    }
  }
}
