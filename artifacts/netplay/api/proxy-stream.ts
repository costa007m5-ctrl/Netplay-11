export const config = {
  maxDuration: 60,
};

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

  const refererStr =
    typeof referer === "string" && referer ? referer : "https://player.kingx.dev/";

  let originStr = "https://player.kingx.dev";
  try {
    originStr = new URL(refererStr).origin;
  } catch {}

  const upstreamHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: refererStr,
    Origin: originStr,
    Accept: "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  };

  // Forward Range header from client (essential for video seeking)
  const range = req.headers["range"];
  if (range) upstreamHeaders["Range"] = String(range);

  const looksLikeM3u8 = url.includes(".m3u8");

  const controller = new AbortController();
  const timeoutMs = looksLikeM3u8 ? 10000 : 45000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      headers: upstreamHeaders,
      redirect: "follow",
      signal: controller.signal,
    });

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

    // Binary segment / key — buffer and send (Vercel serverless doesn't support
    // streaming response bodies reliably in Node runtime, but segments are small)
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
