import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      timeout: 25000,
      maxRedirects: 10,
    });

    const contentType: string =
      (response.headers["content-type"] as string) || "";
    const isM3u8 =
      url.includes(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl");

    if (isM3u8) {
      const text = Buffer.from(response.data as ArrayBuffer).toString("utf-8");

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
    const err = error as { response?: { status?: number }; message?: string };
    const status = err?.response?.status ?? 502;
    const details = err?.message ?? "unknown error";
    console.error(`[proxy-stream] ${status} for ${url}: ${details}`);
    res.status(status < 500 ? status : 502).json({ error: "proxy failed", details });
  }
}
