import axios from "axios";

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

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: refererStr,
    Origin: (() => {
      try {
        return new URL(refererStr).origin;
      } catch {
        return "https://player.kingx.dev";
      }
    })(),
    Accept: "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  };

  // Detecta rapidamente se é manifest m3u8 (precisa rewrite) ou segment binário (pode streamar direto)
  const looksLikeM3u8 = url.includes(".m3u8");

  try {
    if (looksLikeM3u8) {
      // Manifest: precisamos baixar inteiro, reescrever URLs e devolver
      const response = await axios.get(url, {
        headers,
        responseType: "text",
        timeout: 8000,
        maxRedirects: 10,
        transformResponse: [(d) => d],
      });

      const text = String(response.data ?? "");
      const lastSlash = url.lastIndexOf("/");
      const baseUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : url;
      let urlOrigin = "";
      try {
        urlOrigin = new URL(url).origin;
      } catch {
        urlOrigin = "";
      }

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

    // Segment binário (.ts, .key, .mp4) — usa STREAMING pipe pra performance
    const response = await axios.get(url, {
      headers,
      responseType: "stream",
      timeout: 30000,
      maxRedirects: 10,
    });

    const ct = (response.headers["content-type"] as string) || "application/octet-stream";
    res.setHeader("Content-Type", ct);

    const contentLength = response.headers["content-length"];
    if (contentLength) res.setHeader("Content-Length", contentLength as string);

    // Cache agressivo dos segments (são imutáveis)
    res.setHeader("Cache-Control", "public, max-age=3600, immutable");

    res.status(response.status || 200);
    response.data.pipe(res);

    response.data.on("error", (err: any) => {
      console.error(`[proxy-stream stream error] ${url}: ${err?.message}`);
      try { res.end(); } catch {}
    });
  } catch (error: any) {
    const status = error?.response?.status ?? 502;
    const details = error?.message ?? "unknown error";
    console.error(`[proxy-stream] ${status} for ${url}: ${details}`);
    if (!res.headersSent) {
      res.status(status < 500 ? status : 502).json({ error: "proxy failed", details });
    }
  }
}
