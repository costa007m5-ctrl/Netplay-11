import { Router } from "express";
import axios from "axios";
import { trackUrl } from "../lib/terabox-keepwarm";

const router = Router();

const teraboxCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(url: string): any | null {
  const entry = teraboxCache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    teraboxCache.delete(url);
    return null;
  }
  return entry.data;
}

function setCached(url: string, data: any) {
  teraboxCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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

// Pre-warm: faz um HEAD nos links principais para "esquentar" o cache do CDN do Terabox.
// Best-effort — falhas são silenciosas e não bloqueiam a resposta ao cliente.
async function prewarmLinks(data: any) {
  try {
    const list: any[] = Array.isArray(data?.list) ? data.list : data?.list ? [data.list] : data?.fast_stream_url ? [data] : [];
    const urls = new Set<string>();
    for (const file of list.slice(0, 3)) {
      const fs = file?.fast_stream_url || {};
      for (const k of ["720p", "480p", "360p", "1080p"]) {
        if (typeof fs[k] === "string" && fs[k]) urls.add(fs[k]);
      }
      const direct = file?.normal_dlink || file?.dlink || file?.url;
      if (typeof direct === "string" && direct) urls.add(direct);
    }
    await Promise.allSettled(
      Array.from(urls).slice(0, 6).map((u) =>
        axios.head(u, { timeout: 4000, validateStatus: () => true }).catch(() => undefined),
      ),
    );
  } catch {
    // ignore
  }
}

async function callTeraboxApi(url: string, apiKey: string, opts?: { nocache?: boolean }) {
  if (!opts?.nocache) {
    const cached = getCached(url);
    if (cached) return cached;
  } else {
    teraboxCache.delete(url);
  }

  const response = await axios.post(
    "https://xapiverse.com/api/terabox-pro",
    { url },
    {
      headers: {
        "Content-Type": "application/json",
        "xAPIverse-Key": apiKey,
      },
      timeout: 12000,
    },
  );

  if (response.data?.status !== "error") {
    setCached(url, response.data);
    // pre-aquece em background, sem await
    prewarmLinks(response.data);
  }

  return response.data;
}

router.get("/terabox-pro", async (req, res) => {
  const { url, nocache, fallback } = req.query;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  const v2Key = process.env.TERABOX_V2_API_KEY;
  if (!apiKey && !v2Key) {
    res.status(503).json({ error: "TERABOX_PRO_API_KEY not configured" });
    return;
  }

  const useNocache = nocache === "1" || nocache === "true";
  const allowFallback = fallback !== "0" && fallback !== "false";

  // Registra a URL pra ser reaquecida periodicamente
  trackUrl(url, "v1");

  // Tenta V1
  if (apiKey) {
    try {
      const data = await callTeraboxApi(url, apiKey, { nocache: useNocache });
      // Normalizar nomes de arquivo para formato consistente com V3
      // O V1 (xapiverse) retorna dados brutos onde o nome real pode estar em
      // server_filename, filename ou name — padronizamos tudo para filename+name
      if (data && Array.isArray(data.list)) {
        data.list = data.list.map((f: any) => {
          const resolvedName = f.server_filename || f.filename || f.name || '';
          return { ...f, filename: resolvedName, name: resolvedName, server_filename: resolvedName };
        });
      }
      const list: any[] = Array.isArray(data?.list) ? data.list : [];
      const hasPlayable = list.some((f) => pickBestUrl(f));
      if (hasPlayable || !allowFallback || !v2Key) {
        res.json(data);
        return;
      }
      console.warn("[terabox-pro] V1 retornou sem link tocável — tentando fallback V2");
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.warn("[terabox-pro] V1 falhou, tentando fallback V2:", err?.message);
      if (!allowFallback || !v2Key) {
        const details = err?.message ?? "unknown error";
        res.status(500).json({ error: "Failed to fetch from Terabox API", details });
        return;
      }
    }
  }

  // Fallback V2
  if (v2Key && allowFallback) {
    try {
      const v2Resp = await axios.post(
        "https://api-v2.teraboxdl.site/api/terabox/extract",
        { url },
        {
          headers: { "Content-Type": "application/json", "X-API-KEY": v2Key },
          timeout: 15000,
        },
      );
      // Marca a resposta para client saber que veio de fallback
      const data = v2Resp.data;
      if (data && typeof data === "object") {
        (data as any)._source = "v2-fallback";
        // Normalizar nomes para formato consistente
        if (Array.isArray(data.list)) {
          data.list = data.list.map((f: any) => {
            const resolvedName = f.server_filename || f.filename || f.name || '';
            return { ...f, filename: resolvedName, name: resolvedName, server_filename: resolvedName };
          });
        }
      }
      res.json(data);
      return;
    } catch (error: unknown) {
      const err = error as { message?: string };
      res.status(502).json({ error: "Both V1 and V2 Terabox APIs failed", details: err?.message });
      return;
    }
  }

  res.status(500).json({ error: "Failed to fetch from Terabox API" });
});

router.post("/terabox/convert", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    res.status(400).json({ success: false, error: "url body param required" });
    return;
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey) {
    res.status(503).json({ success: false, error: "TERABOX_PRO_API_KEY not configured" });
    return;
  }

  try {
    const data = await callTeraboxApi(url, apiKey);

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

    res.json({ success: true, videoUrl, directUrl: videoUrl });
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    const details =
      err?.response?.data != null
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message ?? "unknown error";
    res.status(500).json({ success: false, error: "Falha ao converter link do TeraBox", details });
  }
});

export default router;
