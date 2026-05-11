import { Router, type IRouter } from "express";
import axios from "axios";
import crypto from "node:crypto";
import { trackUrl } from "../lib/terabox-keepwarm";

const router: IRouter = Router();

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const BASE_URL = "https://api.teraboxdl.site";
const API_PATH = "/v1/api";

function makeSignature(apiSecret: string, method: string, path: string, timestamp: string, body: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(`${method}${path}${timestamp}${body}`)
    .digest("hex");
}

function normalizeItem(raw: any): any {
  if (!raw || typeof raw !== "object") return null;
  const name = raw.server_filename || raw.filename || raw.name || "Desconhecido";

  const streamUrl = raw.stream_url || raw.stream_download_url || null;
  const directLink = raw.direct_link || raw.normal_dlink || raw.dlink || null;

  // Build quality map from raw API response if it provides real per-quality URLs.
  // Only fall back to mapping all keys to the same stream_url when no real ladder exists
  // (otherwise the frontend probes N identical URLs wasting time).
  const rawFast = raw.fast_stream_url || raw.qualities || {};
  const fast: Record<string, string> = {};

  // Prefer real quality entries from the API response
  const qualityKeys = ["1080p", "720p", "480p", "360p", "240p"];
  let usedRealLadder = false;
  for (const k of qualityKeys) {
    if (rawFast[k] && typeof rawFast[k] === "string") {
      fast[k] = rawFast[k];
      usedRealLadder = true;
    }
  }
  // If the API doesn't provide a real ladder, use stream_url once under "auto"
  // so the frontend can play it without probing 5 identical URLs.
  if (!usedRealLadder && streamUrl) {
    fast["auto"] = streamUrl;
  }

  return {
    fs_id: raw.fs_id,
    name,
    filename: name,
    server_filename: name,
    is_dir: raw.is_dir !== undefined ? String(raw.is_dir) : "0",
    size: raw.size,
    formatted_size: raw.formatted_size,
    normal_dlink: directLink,
    stream_url: streamUrl,
    fast_stream_url: Object.keys(fast).length ? fast : undefined,
    thumbnail: raw.thumbs?.url1 || raw.thumbs?.url2 || raw.thumbs?.icon || null,
    thumbs: raw.thumbs,
    // Path info needed for recursive subfolder scanning
    path: raw.path || raw.dir_path || raw.server_path || null,
    dir_path: raw.dir_path || raw.path || raw.server_path || null,
  };
}

function normalizeResponse(raw: any): any {
  if (!raw || typeof raw !== "object") {
    return { status: "error", error: "Empty response" };
  }

  if (raw.errno !== 0 && raw.errno !== undefined) {
    return { status: "error", error: `API error (errno=${raw.errno})`, _v3_raw: raw };
  }

  const arr: any[] = Array.isArray(raw.list) ? raw.list : [];
  return {
    status: "success",
    errno: raw.errno ?? 0,
    request_id: raw.request_id,
    server_time: raw.server_time,
    share_id: raw.share_id,
    uk: raw.uk,
    title: raw.title,
    total_size: raw.total_size,
    total_size_bytes: raw.total_size_bytes,
    total_files: raw.total_files ?? arr.length,
    total_folders: raw.total_folders ?? 0,
    list: arr.map(normalizeItem).filter(Boolean),
    _v3_raw: raw,
  };
}

async function callV3Api(
  payload: { url: string; dir_path?: string; page?: number },
  apiKey: string,
  apiSecret: string,
  opts?: { nocache?: boolean },
): Promise<any> {
  const cacheKey = `v3:${payload.url}|${payload.dir_path || ""}|${payload.page || ""}`;
  if (!opts?.nocache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.data;
  } else {
    cache.delete(cacheKey);
  }

  const body = JSON.stringify({
    url: payload.url,
    dir_path: payload.dir_path ?? "",
    page: payload.page ?? 1,
  });

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  if (apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = makeSignature(apiSecret, "POST", API_PATH, timestamp, body);
    reqHeaders["X-Timestamp"] = timestamp;
    reqHeaders["X-Signature"] = signature;
  }

  const response = await axios.post(`${BASE_URL}${API_PATH}`, body, {
    headers: reqHeaders,
    timeout: 60000,
  });

  const data = normalizeResponse(response.data);

  if (data?.status !== "error") {
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return data;
}

async function handle(req: any, res: any) {
  let url: string | undefined;
  let dirPath: string | undefined;
  let page: number | undefined;
  let nocache = false;

  if (req.method === "GET") {
    url = req.query?.url as string | undefined;
    dirPath = req.query?.dir_path as string | undefined;
    page = req.query?.page ? Number(req.query.page) : undefined;
    nocache = req.query?.nocache === "1" || req.query?.nocache === "true";
  } else {
    url = req.body?.url;
    dirPath = req.body?.dir_path;
    page = req.body?.page;
    nocache = req.body?.nocache === true || req.body?.nocache === "1";
  }

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url required" });
    return;
  }

  const apiKey = process.env.TERABOX_V3_API_KEY;
  const apiSecret = process.env.TERABOX_V3_API_SECRET;

  if (!apiKey) {
    res.status(503).json({ error: "TERABOX_V3_API_KEY not configured" });
    return;
  }

  trackUrl(url, "v2");

  try {
    const data = await callV3Api({ url, dir_path: dirPath, page }, apiKey, apiSecret, { nocache });
    res.json(data);
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string; code?: string };
    const isTimeout = err?.code === "ECONNABORTED";
    const upstreamStatus = err?.response?.status;
    const details =
      err?.response?.data != null
        ? typeof err.response.data === "string"
          ? err.response.data.slice(0, 300)
          : JSON.stringify(err.response.data).slice(0, 500)
        : err?.message ?? "unknown error";
    res.status(isTimeout ? 504 : upstreamStatus && upstreamStatus >= 400 ? 502 : 500).json({
      error: isTimeout ? "Terabox V3 API timed out" : "Failed to fetch from Terabox V3 API",
      details,
    });
  }
}

router.get("/terabox-v3", handle);
router.post("/terabox-v3", handle);

export default router;
