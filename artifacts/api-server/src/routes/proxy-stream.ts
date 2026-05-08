import { Router, type IRouter } from "express";
import axios from "axios";

const router: IRouter = Router();

router.get("/proxy-stream", async (req, res) => {
  const { url, referer } = req.query;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  const refererStr =
    typeof referer === "string" && referer ? referer : "https://player.kingx.dev/";

  try {
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

    const response = await axios.get(url, {
      headers,
      responseType: "arraybuffer",
      timeout: 20000,
      maxRedirects: 10,
    });

    const contentType: string =
      (response.headers["content-type"] as string) || "";
    const isM3u8 =
      url.includes(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl");

    // Always allow CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (isM3u8) {
      const text = Buffer.from(response.data as ArrayBuffer).toString("utf-8");

      // Determine the base URL for resolving relative paths
      const lastSlash = url.lastIndexOf("/");
      const baseUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : url;
      let urlOrigin = "";
      try {
        urlOrigin = new URL(url).origin;
      } catch {
        urlOrigin = "";
      }

      // Rewrite every non-comment line (URI or key URL) to go through this proxy
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

      // Also rewrite URI= values inside tags like #EXT-X-KEY
      const rewrittenKeys = rewritten.replace(
        /URI="([^"]+)"/g,
        (_match, uri) => {
          let absoluteUri = uri;
          if (!uri.startsWith("http")) {
            absoluteUri = uri.startsWith("/")
              ? urlOrigin + uri
              : baseUrl + uri;
          }
          return `URI="/api/proxy-stream?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(refererStr)}"`;
        }
      );

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(rewrittenKeys);
    } else {
      // Binary segment / key — stream directly
      const ct = contentType || "application/octet-stream";
      res.setHeader("Content-Type", ct);

      const contentLength = response.headers["content-length"];
      if (contentLength) {
        res.setHeader("Content-Length", contentLength as string);
      }

      const cacheControl = response.headers["cache-control"];
      if (cacheControl) {
        res.setHeader("Cache-Control", cacheControl as string);
      }

      res.send(Buffer.from(response.data as ArrayBuffer));
    }
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string };
    const status = err?.response?.status ?? 502;
    const details = err?.message ?? "unknown error";
    console.error(`[proxy-stream] ${status} for ${url}: ${details}`);
    res.status(status < 500 ? status : 502).json({ error: "proxy failed", details });
  }
});

router.options("/proxy-stream", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.sendStatus(204);
});

export default router;
