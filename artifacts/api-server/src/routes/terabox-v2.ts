import { Router, type IRouter } from "express";
import axios from "axios";
import { trackUrl } from "../lib/terabox-keepwarm";

const router: IRouter = Router();

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function pick(o: any, keys: string[]): any {
  for (const k of keys) {
    if (o && o[k] != null) return o[k];
  }
  return undefined;
}

function normalizeItem(raw: any): any {
  if (!raw || typeof raw !== "object") return null;
  const name = pick(raw, ["server_filename", "name", "filename", "file_name", "title"]) || "Desconhecido";
  const isDir = pick(raw, ["is_dir", "isDir", "is_folder"]);
  const isDirStr = isDir === true || isDir === "1" || isDir === 1 ? "1" : "0";

  const streams = pick(raw, ["fast_stream_url", "stream_urls", "streaming_links", "streams", "hls_links", "hls"]) || {};
  const fast: Record<string, string> = {};
  if (streams && typeof streams === "object") {
    for (const k of Object.keys(streams)) {
      const v = streams[k];
      if (typeof v === "string" && v) {
        const key = /^\d+$/.test(k) ? `${k}p` : k.toLowerCase();
        fast[key] = v;
      } else if (v && typeof v === "object" && typeof v.url === "string") {
        const key = /^\d+$/.test(k) ? `${k}p` : k.toLowerCase();
        fast[key] = v.url;
      }
    }
  }
  const hlsSingle = pick(raw, ["hls_url", "stream_url", "m3u8", "playable_url"]);
  if (hlsSingle && typeof hlsSingle === "string" && Object.keys(fast).length === 0) {
    // v2 returns single stream_url per item — use it for all qualities so existing
    // probe + selector code can work uniformly
    fast["auto"] = hlsSingle;
    fast["1080p"] = hlsSingle;
    fast["720p"] = hlsSingle;
    fast["480p"] = hlsSingle;
    fast["360p"] = hlsSingle;
  }

  return {
    fs_id: pick(raw, ["fs_id", "id", "fileId"]),
    name,
    filename: name,
    is_dir: isDirStr,
    type: pick(raw, ["type", "file_type"]) || (Object.keys(fast).length ? "video" : undefined),
    size: pick(raw, ["size", "size_bytes"]),
    size_formatted: pick(raw, ["size_formatted", "size_str", "human_size"]),
    duration: pick(raw, ["duration", "length"]),
    quality: pick(raw, ["quality", "resolution"]),
    normal_dlink: pick(raw, ["dlink", "normal_dlink", "download_link", "direct_link", "url", "download_url"]),
    fast_stream_url: Object.keys(fast).length ? fast : undefined,
    subtitle_url: pick(raw, ["subtitle_url", "subtitle", "captions"]),
    thumbnail: pick(raw, ["thumbnail", "thumb", "thumb_url", "image"]),
    folder: pick(raw, ["folder", "path", "dir", "dir_path"]),
  };
}

function normalizeResponse(raw: any): any {
  if (!raw || typeof raw !== "object") return { status: "error", error: "Empty response" };

  if (Array.isArray(raw.list)) {
    return {
      status: raw.status || "success",
      total_files: raw.total_files ?? raw.list.length,
      total_folders: raw.total_folders ?? 0,
      folder_zip_dlink: raw.folder_zip_dlink,
      list: raw.list.map(normalizeItem).filter(Boolean),
      _v2_raw: raw,
    };
  }

  const candidateArrays: any[] = [];
  const tryArr = (v: any) => Array.isArray(v) && candidateArrays.push(v);
  tryArr(raw.files);
  tryArr(raw.data?.files);
  tryArr(raw.data?.list);
  tryArr(raw.results);
  tryArr(raw.items);
  tryArr(raw.data);

  const arr = candidateArrays.find(a => a.length > 0) || candidateArrays[0];

  if (arr && Array.isArray(arr)) {
    return {
      status: raw.status || "success",
      total_files: raw.total_files ?? arr.length,
      total_folders: raw.total_folders ?? 0,
      folder_zip_dlink: raw.folder_zip_dlink || raw.zip_url,
      list: arr.map(normalizeItem).filter(Boolean),
      _v2_raw: raw,
    };
  }

  const single = normalizeItem(raw.data || raw);
  if (single && (single.normal_dlink || single.fast_stream_url || single.name !== "Desconhecido")) {
    return {
      status: raw.status || "success",
      total_files: 1,
      total_folders: 0,
      list: [single],
      _v2_raw: raw,
    };
  }

  return { status: "error", error: "Unable to parse v2 response", _v2_raw: raw };
}

async function prewarmV2(data: any) {
  try {
    const list: any[] = Array.isArray(data?.list) ? data.list : [];
    const urls = new Set<string>();
    for (const file of list.slice(0, 3)) {
      const fs = file?.fast_stream_url || {};
      for (const k of ["720p", "480p", "360p", "1080p", "auto"]) {
        if (typeof fs[k] === "string" && fs[k]) urls.add(fs[k]);
      }
      const direct = file?.normal_dlink;
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

async function callV2Api(payload: { url: string; dir_path?: string; page?: number }, apiKey: string, opts?: { nocache?: boolean }) {
  const cacheKey = `${payload.url}|${payload.dir_path || ""}|${payload.page || ""}`;
  if (!opts?.nocache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.data;
  } else {
    cache.delete(cacheKey);
  }

  const response = await axios.post(
    "https://api-v2.teraboxdl.site/api/terabox/extract",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      timeout: 110000,
    },
  );

  const data = normalizeResponse(response.data);

  if (data?.status !== "error") {
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    prewarmV2(data);
  }

  return data;
}

function v2HasPlayable(data: any): boolean {
  if (!data || !Array.isArray(data.list)) return false;
  return data.list.some((f: any) => {
    const fs = f?.fast_stream_url || {};
    return !!(fs["1080p"] || fs["720p"] || fs["480p"] || fs["360p"] || fs["auto"] || f?.normal_dlink);
  });
}

async function callV1AsV2Fallback(url: string, apiKey: string): Promise<any | null> {
  try {
    const response = await axios.post(
      "https://xapiverse.com/api/terabox-pro",
      { url },
      {
        headers: { "Content-Type": "application/json", "xAPIverse-Key": apiKey },
        timeout: 25000,
      },
    );
    if (response.data && typeof response.data === "object") {
      (response.data as any)._source = "v1-fallback";
    }
    return response.data;
  } catch {
    return null;
  }
}

async function handle(req: any, res: any) {
  let url: string | undefined;
  let dirPath: string | undefined;
  let page: number | undefined;
  let nocache: boolean = false;
  let allowFallback: boolean = true;

  if (req.method === "GET") {
    url = req.query?.url as string | undefined;
    dirPath = req.query?.dir_path as string | undefined;
    page = req.query?.page ? Number(req.query.page) : undefined;
    nocache = req.query?.nocache === "1" || req.query?.nocache === "true";
    allowFallback = req.query?.fallback !== "0" && req.query?.fallback !== "false";
  } else {
    url = req.body?.url;
    dirPath = req.body?.dir_path;
    page = req.body?.page;
    nocache = req.body?.nocache === true || req.body?.nocache === "1";
    allowFallback = req.body?.fallback !== false && req.body?.fallback !== "0";
  }

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url required" });
    return;
  }

  const apiKey = process.env.TERABOX_V2_API_KEY;
  const v1Key = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey && !v1Key) {
    res.status(503).json({ error: "TERABOX_V2_API_KEY not configured" });
    return;
  }

  trackUrl(url, "v2");

  if (apiKey) {
    try {
      const data = await callV2Api({ url, dir_path: dirPath, page }, apiKey, { nocache });
      if (v2HasPlayable(data) || !allowFallback || !v1Key) {
        res.json(data);
        return;
      }
      console.warn("[terabox-v2] V2 retornou sem link tocável — tentando fallback V1");
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string; code?: string };
      console.warn("[terabox-v2] V2 falhou, tentando fallback V1:", err?.message);
      if (!allowFallback || !v1Key) {
        const isTimeout = err?.code === "ECONNABORTED";
        const upstreamStatus = err?.response?.status;
        const details =
          err?.response?.data != null
            ? typeof err.response.data === "string"
              ? err.response.data.slice(0, 300)
              : JSON.stringify(err.response.data).slice(0, 500)
            : err?.message ?? "unknown error";
        res.status(isTimeout ? 504 : upstreamStatus && upstreamStatus >= 400 ? 502 : 500).json({
          error: isTimeout ? "Terabox V2 API timed out" : "Failed to fetch from Terabox V2 API",
          details,
        });
        return;
      }
    }
  }

  if (v1Key && allowFallback) {
    const v1Data = await callV1AsV2Fallback(url, v1Key);
    if (v1Data) {
      res.json(v1Data);
      return;
    }
  }

  res.status(502).json({ error: "Both V2 and V1 Terabox APIs failed" });
}

router.get("/terabox-v2", handle);
router.post("/terabox-v2", handle);

export default router;
