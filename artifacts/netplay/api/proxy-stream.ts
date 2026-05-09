export const config = {
  maxDuration: 60,
};

// Strict allowlists: only these hosts may be proxied / used as referer/warmup
// origins. Prevents SSRF and cookie-exfiltration via attacker-controlled url/referer.
const UPSTREAM_HOST_ALLOWLIST = new Set<string>([
  "teradl.kingx.dev",
  "player.kingx.dev",
  "teradl-proxy.relieved7885.workers.dev",
  "data.terabox.com",
  "d.terabox.com",
  "dm.terabox.app",
  "d.1024tera.com",
]);
const REFERER_ORIGIN_ALLOWLIST = new Set<string>([
  "https://player.kingx.dev",
  "https://teradl.kingx.dev",
  "https://www.terabox.com",
]);

// Hosts that share session with a given referer origin: only forward warmed
// cookies when the upstream host belongs to the same trust group.
const COOKIE_TRUST_GROUPS: Record<string, Set<string>> = {
  "https://player.kingx.dev": new Set([
    "teradl.kingx.dev",
    "player.kingx.dev",
    "teradl-proxy.relieved7885.workers.dev",
  ]),
};

function isHostAllowed(host: string): boolean {
  return UPSTREAM_HOST_ALLOWLIST.has(host);
}

// Module-level cookie cache per origin. Survives across invocations on warm
// serverless instances. Refreshed when expired or when upstream rejects.
type CookieCache = { cookie: string; ts: number };
const COOKIE_TTL_MS = 5 * 60 * 1000; // 5 min
const cookieCache = new Map<string, CookieCache>();
// Single-flight: dedupe concurrent warmup calls per origin.
const inflightWarmup = new Map<string, Promise<string>>();

function parseSetCookieHeaders(res: Response): string {
  // Prefer the standard getSetCookie() (Node 20+, undici, Vercel runtime).
  const anyHeaders = res.headers as any;
  let list: string[] = [];
  if (typeof anyHeaders.getSetCookie === "function") {
    list = anyHeaders.getSetCookie();
  } else if (typeof anyHeaders.raw === "function") {
    list = anyHeaders.raw()["set-cookie"] || [];
  }
  // Avoid regex-splitting a joined Set-Cookie string — commas in Expires=...
  // dates produce malformed cookies. If we can't get the array form, skip.
  return list
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.length > 0)
    .join("; ");
}

async function warmupCookies(refererOrigin: string): Promise<string> {
  if (!REFERER_ORIGIN_ALLOWLIST.has(refererOrigin)) return "";
  const cached = cookieCache.get(refererOrigin);
  if (cached && Date.now() - cached.ts < COOKIE_TTL_MS) {
    return cached.cookie;
  }
  const existing = inflightWarmup.get(refererOrigin);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const warmupRes = await fetch(refererOrigin + "/", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      const cookieStr = parseSetCookieHeaders(warmupRes);
      cookieCache.set(refererOrigin, { cookie: cookieStr, ts: Date.now() });
      return cookieStr;
    } catch (e) {
      console.warn(`[proxy-stream] warmup failed for ${refererOrigin}:`, e);
      return "";
    } finally {
      inflightWarmup.delete(refererOrigin);
    }
  })();
  inflightWarmup.set(refererOrigin, promise);
  return promise;
}

function buildBrowserHeaders(
  refererStr: string,
  originStr: string,
  cookie: string,
  range?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: refererStr,
    Origin: originStr,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
    "sec-ch-ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  };
  if (cookie) h["Cookie"] = cookie;
  if (range) h["Range"] = range;
  return h;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { url, referer } = req.query;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  // Validate target URL: must be http(s) and host must be allowlisted.
  let targetHost = "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      res.status(400).json({ error: "invalid url protocol" });
      return;
    }
    targetHost = parsed.hostname;
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  if (!isHostAllowed(targetHost)) {
    res.status(403).json({ error: "host not allowed", host: targetHost });
    return;
  }

  // Validate referer: only allowlisted origins; default safely to player.kingx.dev.
  let refererStr = "https://player.kingx.dev/";
  let originStr = "https://player.kingx.dev";
  if (typeof referer === "string" && referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (REFERER_ORIGIN_ALLOWLIST.has(refOrigin)) {
        refererStr = referer;
        originStr = refOrigin;
      }
    } catch {}
  }

  const looksLikeM3u8 = url.includes(".m3u8");
  const range = req.headers["range"] ? String(req.headers["range"]) : undefined;

  // Warm up cookies only when target host is in the same trust group as the
  // referer origin (prevents leaking cookies cross-host).
  let cookie = "";
  const trustGroup = COOKIE_TRUST_GROUPS[originStr];
  const cookiesAllowedForTarget = !!trustGroup && trustGroup.has(targetHost);
  if (looksLikeM3u8 && cookiesAllowedForTarget) {
    cookie = await warmupCookies(originStr);
  }

  const controller = new AbortController();
  const timeoutMs = looksLikeM3u8 ? 12000 : 45000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const doFetch = (cookieToUse: string) =>
    fetch(url, {
      headers: buildBrowserHeaders(refererStr, originStr, cookieToUse, range),
      redirect: "follow",
      signal: controller.signal,
    });

  try {
    let upstream = await doFetch(cookie);

    // If m3u8 came back with a verification error, refresh cookies once and retry
    // (only when cookie forwarding is allowed for this target host).
    if (looksLikeM3u8 && upstream.ok && cookiesAllowedForTarget) {
      const peek = await upstream.clone().text();
      const trimmed = peek.trim();
      if (
        !trimmed.startsWith("#EXTM3U") &&
        (trimmed.startsWith("{") || trimmed.startsWith("["))
      ) {
        cookieCache.delete(originStr);
        const fresh = await warmupCookies(originStr);
        if (fresh && fresh !== cookie) {
          upstream = await doFetch(fresh);
          cookie = fresh;
        }
      }
    }

    if (!upstream.ok && upstream.status !== 206) {
      clearTimeout(timeoutId);
      res
        .status(upstream.status)
        .json({ error: "upstream failed", status: upstream.status });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isM3u8 =
      looksLikeM3u8 ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl");

    if (isM3u8) {
      const text = await upstream.text();
      clearTimeout(timeoutId);

      const trimmed = text.trim();
      if (
        !trimmed.startsWith("#EXTM3U") &&
        (trimmed.startsWith("{") || trimmed.startsWith("["))
      ) {
        let upstreamErr: any = null;
        try { upstreamErr = JSON.parse(trimmed); } catch {}
        const msg = upstreamErr?.errmsg || upstreamErr?.error || "upstream returned non-m3u8";
        console.warn(`[proxy-stream] m3u8 verification failed even after retry: ${msg}`);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.status(451).json({
          error: "verification_required",
          message: msg,
          upstream: upstreamErr,
        });
        return;
      }

      const lastSlash = url.lastIndexOf("/");
      const baseUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : url;
      let urlOrigin = "";
      try {
        urlOrigin = new URL(url).origin;
      } catch {}

      const rewritten = text.replace(/^(?!#)(.+)$/gm, (segmentLine) => {
        const seg = segmentLine.trim();
        if (!seg) return segmentLine;
        let absoluteSeg = seg;
        if (seg.startsWith("http://") || seg.startsWith("https://")) {
          absoluteSeg = seg;
        } else if (seg.startsWith("//")) {
          absoluteSeg = "https:" + seg;
        } else if (seg.startsWith("/")) {
          absoluteSeg = urlOrigin + seg;
        } else {
          absoluteSeg = baseUrl + seg;
        }
        return `/api/proxy-stream?url=${encodeURIComponent(absoluteSeg)}&referer=${encodeURIComponent(refererStr)}`;
      });

      const rewrittenKeys = rewritten.replace(
        /URI="([^"]+)"/g,
        (_match, uri) => {
          let absoluteUri = uri;
          if (!uri.startsWith("http")) {
            absoluteUri = uri.startsWith("/") ? urlOrigin + uri : baseUrl + uri;
          }
          return `URI="/api/proxy-stream?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(refererStr)}"`;
        },
      );

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "public, max-age=10");
      res.status(200).send(rewrittenKeys);
      return;
    }

    // Binary segment / key
    const buffer = Buffer.from(await upstream.arrayBuffer());
    clearTimeout(timeoutId);

    res.setHeader(
      "Content-Type",
      contentType || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "public, max-age=3600, immutable");

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);

    res.status(upstream.status).send(buffer);
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error?.name === "AbortError";
    const status = isTimeout ? 504 : 502;
    const details = isTimeout ? `timeout after ${timeoutMs}ms` : error?.message || "unknown error";
    console.error(`[proxy-stream] ${status} for ${url}: ${details}`);
    if (!res.headersSent) {
      res.status(status).json({ error: "proxy failed", details });
    }
  }
}
