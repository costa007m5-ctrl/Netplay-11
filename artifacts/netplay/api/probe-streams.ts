export const config = {
  maxDuration: 30,
};

type ProbeInput = { quality: string; url: string; label?: string };
type ProbeResult = {
  quality: string;
  url: string;
  label?: string;
  ok: boolean;
  reason?: string;
  ms?: number;
};

// SSRF protection: only allow http/https URLs to public hostnames.
function isUrlSafe(rawUrl: string): boolean {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  // Block localhost / private / link-local / cloud metadata ranges
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) return false;
  // Block IPv4 private/loopback/link-local/metadata
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false; // link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 0) return false;
    if (a >= 224) return false; // multicast/reserved
  }
  // Block IPv6 private/loopback (basic check)
  if (host.includes(":")) {
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
  }
  return true;
}

// Concurrency limiter: process items in chunks of `limit`.
async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function probeOne(
  item: ProbeInput,
  refererStr: string,
): Promise<ProbeResult> {
  const start = Date.now();

  if (!isUrlSafe(item.url)) {
    return { ...item, ok: false, reason: "blocked_url", ms: 0 };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let originStr = "https://player.kingx.dev";
  try {
    originStr = new URL(refererStr).origin;
  } catch {}

  try {
    const upstream = await fetch(item.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: refererStr,
        Origin: originStr,
        Accept: "*/*",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      clearTimeout(timeoutId);
      return {
        ...item,
        ok: false,
        reason: `HTTP ${upstream.status}`,
        ms: Date.now() - start,
      };
    }

    // For m3u8: validate manifest content ONLY.
    // Não validamos segmentos: tokens de segmento da workers.dev são single-use/short-lived,
    // então buscar o segmento aqui consome o token e ainda dá falso negativo (403). O player
    // gera tokens novos a cada fetch do m3u8, então m3u8 válido = qualidade funcional.
    if (item.url.toLowerCase().includes(".m3u8")) {
      const text = await upstream.text();
      clearTimeout(timeoutId);
      const trimmed = text.trim();
      if (!trimmed.startsWith("#EXTM3U")) {
        return {
          ...item,
          ok: false,
          reason: trimmed.startsWith("{")
            ? "verification_required"
            : "invalid_manifest",
          ms: Date.now() - start,
        };
      }
      // Sanity check: manifest must contain at least one segment line
      const hasSegment = trimmed.split(/\r?\n/).some(l => {
        const t = l.trim();
        return t && !t.startsWith("#");
      });
      if (!hasSegment) {
        return { ...item, ok: false, reason: "empty_manifest", ms: Date.now() - start };
      }
    }

    clearTimeout(timeoutId);
    return { ...item, ok: true, ms: Date.now() - start };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      ...item,
      ok: false,
      reason: err?.name === "AbortError" ? "timeout" : "fetch_failed",
      ms: Date.now() - start,
    };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const urls: ProbeInput[] = Array.isArray(body?.urls) ? body.urls : [];
    const refererStr =
      typeof body?.referer === "string" && body.referer
        ? body.referer
        : "https://player.kingx.dev/";

    if (urls.length === 0) {
      res.status(400).json({ error: "urls array required" });
      return;
    }
    if (urls.length > 10) {
      res.status(400).json({ error: "max 10 urls per probe" });
      return;
    }

    // Server-side concurrency cap: max 6 simultaneous probes regardless of input size.
    const results = await withConcurrency(urls, 6, (u) => probeOne(u, refererStr));

    const working = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    // Cache probe results for 2 minutes — they're relatively expensive to compute
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=60");
    res.status(200).json({ working, failed, total: results.length });
  } catch (error: any) {
    console.error(`[probe-streams] crashed: ${error?.message}`, error?.stack);
    if (!res.headersSent) {
      res.status(500).json({
        error: "probe failed",
        details: error?.message ?? "unknown",
      });
    }
  }
}
