import { Router, type IRouter } from "express";
import axios from "axios";

const router: IRouter = Router();

const DRIVE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

// Resolve the direct binary URL for a Google Drive file ID.
// Google Drive redirects through a confirmation flow for large files.
// We follow all redirects and return the final streaming URL + cookies.
async function resolveDirectUrl(
  fileId: string,
  rangeHeader?: string
): Promise<{
  url: string;
  cookies: string;
}> {
  // The usercontent.google.com domain is the canonical direct-download host
  const candidates = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
  ];

  for (const candidate of candidates) {
    try {
      // HEAD request to detect if we get redirected or get a "virus scan" warning page
      const probe = await axios.get(candidate, {
        headers: {
          ...DRIVE_HEADERS,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
        maxRedirects: 15,
        responseType: "stream",
        timeout: 15000,
        validateStatus: (s) => s < 500,
      });

      const ct: string = probe.headers["content-type"] || "";

      if (ct.includes("text/html")) {
        // Google is showing a confirmation page — destroy the stream and try next
        probe.data.destroy();
        continue;
      }

      // We got a binary response — this is the real URL after redirects
      // Grab the final URL from the redirect chain
      const finalUrl: string =
        (probe.request as any)?.res?.responseUrl ||
        (probe.request as any)?.responseURL ||
        candidate;

      const cookieHeader = (probe.headers["set-cookie"] || []).join("; ");

      probe.data.destroy();
      return { url: finalUrl, cookies: cookieHeader };
    } catch {
      // Try next candidate
    }
  }

  // Fallback: return the usercontent URL and let axios handle it at stream time
  return {
    url: candidates[0],
    cookies: "",
  };
}

router.get("/stream/:driveId", async (req, res) => {
  const { driveId } = req.params;

  if (!driveId || !/^[-\w]{10,}$/.test(driveId)) {
    res.status(400).json({ error: "ID do Google Drive inválido" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "*");

  const rangeHeader =
    typeof req.headers.range === "string" ? req.headers.range : undefined;

  try {
    const { url: resolvedUrl, cookies } = await resolveDirectUrl(
      driveId,
      rangeHeader
    );

    const reqHeaders: Record<string, string> = {
      ...DRIVE_HEADERS,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
    };

    const upstream = await axios.get(resolvedUrl, {
      headers: reqHeaders,
      responseType: "stream",
      maxRedirects: 10,
      timeout: 60000,
      validateStatus: (s) => s < 500,
    });

    const status = upstream.status === 206 ? 206 : rangeHeader ? 206 : 200;

    let contentType: string =
      (upstream.headers["content-type"] as string) || "video/mp4";

    // Google Drive often returns application/octet-stream — normalize to video/mp4
    // so the browser's media element accepts the stream without sniffing
    if (
      contentType === "application/octet-stream" ||
      contentType.startsWith("application/octet-stream")
    ) {
      contentType = "video/mp4";
    }

    const contentLength = upstream.headers["content-length"];
    const contentRange = upstream.headers["content-range"];

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");

    if (contentLength) res.setHeader("Content-Length", contentLength as string);
    if (contentRange) res.setHeader("Content-Range", contentRange as string);

    // Cache for 1 hour on the client to avoid re-fetching on seek
    res.setHeader("Cache-Control", "private, max-age=3600");

    res.status(status);
    upstream.data.pipe(res);

    req.on("close", () => {
      upstream.data.destroy();
    });
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number };
      message?: string;
    };
    const status = err?.response?.status ?? 502;
    console.error(`[drive-stream] Erro ao transmitir ${driveId}: ${err?.message}`);
    if (!res.headersSent) {
      res.status(status < 500 ? status : 502).json({
        error: "Falha ao transmitir o arquivo do Google Drive",
        details: err?.message,
      });
    }
  }
});

router.options("/stream/:driveId", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.sendStatus(204);
});

router.head("/stream/:driveId", async (req, res) => {
  const { driveId } = req.params;

  if (!driveId || !/^[-\w]{10,}$/.test(driveId)) {
    res.status(400).end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", "video/mp4");
  res.status(200).end();
});

export default router;
