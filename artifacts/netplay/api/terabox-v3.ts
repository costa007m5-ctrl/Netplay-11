import crypto from "node:crypto";

export const config = {
  maxDuration: 60,
};

const BASE_URL = "https://api.teraboxdl.site";
const API_PATH = "/v1/api";

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function makeSignature(apiSecret: string, method: string, path: string, timestamp: string, body: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(`${method}${path}${timestamp}${body}`)
    .digest("hex");
}

function normalizeItem(raw: any): any {
  if (!raw || typeof raw !== "object") return null;
  const name = raw.server_filename || raw.filename || raw.name || "Desconhecido";

  const streamUrl = raw.stream_url || null;
  const streamDownloadUrl = raw.stream_download_url || null;
  const directLink = raw.direct_link || raw.normal_dlink || raw.dlink || null;

  const rawFast = raw.fast_stream_url || raw.qualities || {};
  const fast: Record<string, string> = {};

  const qualityKeys = ["1080p", "720p", "480p", "360p", "240p"];
  let usedRealLadder = false;
  for (const k of qualityKeys) {
    if (rawFast[k] && typeof rawFast[k] === "string") {
      fast[k] = rawFast[k];
      usedRealLadder = true;
    }
  }
  if (rawFast["auto"] && typeof rawFast["auto"] === "string") {
    fast["auto"] = rawFast["auto"];
  }
  if (!usedRealLadder && !fast["auto"] && streamUrl) {
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
    stream_download_url: streamDownloadUrl,
    fast_stream_url: Object.keys(fast).length ? fast : undefined,
    thumbnail: raw.thumbs?.url1 || raw.thumbs?.url2 || raw.thumbs?.icon || null,
    thumbs: raw.thumbs,
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

  const items = raw.list || raw.files || raw.data?.list || raw.data?.files || [];
  if (Array.isArray(items)) {
    return {
      status: "success",
      total_files: raw.total_files ?? items.length,
      total_folders: raw.total_folders ?? 0,
      folder_zip_dlink: raw.folder_zip_dlink || null,
      list: items.map(normalizeItem).filter(Boolean),
      _v3_raw: raw,
    };
  }

  const single = normalizeItem(raw);
  if (single && single.name !== "Desconhecido") {
    return { status: "success", total_files: 1, total_folders: 0, list: [single], _v3_raw: raw };
  }

  return { status: "error", error: "Unable to parse v3 response", _v3_raw: raw };
}

async function callV3Api(
  payload: { url: string; dir_path?: string; page?: number },
  apiKey: string,
  apiSecret?: string,
  opts?: { nocache?: boolean }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${API_PATH}`, {
      method: "POST",
      headers: reqHeaders,
      body,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 200)}`);
  }

  const normalized = normalizeResponse(data);

  if (normalized?.status !== "error") {
    cache.set(cacheKey, { data: normalized, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return normalized;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    url = body?.url;
    dirPath = body?.dir_path;
    page = body?.page;
    nocache = body?.nocache === true || body?.nocache === "1";
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

  try {
    const data = await callV3Api({ url, dir_path: dirPath, page }, apiKey, apiSecret, { nocache });
    res.json(data);
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    console.error(`[terabox-v3] error: ${error?.message}`);
    if (!res.headersSent) {
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? "Terabox V3 API timed out" : "Failed to fetch from Terabox V3 API",
        details: error?.message ?? "unknown error",
      });
    }
  }
}
