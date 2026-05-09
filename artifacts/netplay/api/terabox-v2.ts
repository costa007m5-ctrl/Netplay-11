export const config = {
  maxDuration: 60,
};

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const SAFETY_MS = 5 * 60 * 1000;

function deriveTtlMs(url: string): number {
  try {
    const u = new URL(url);
    const exp = u.searchParams.get("expires");
    if (exp && /^\d+$/.test(exp)) {
      const expMs = parseInt(exp, 10) * 1000;
      const remaining = expMs - Date.now() - SAFETY_MS;
      if (remaining > 0) return Math.min(remaining, CACHE_TTL_MS);
      return 0;
    }
  } catch {}
  return CACHE_TTL_MS;
}

// Normalize v2 response into v1-like shape: { status, list: [{ name, fast_stream_url, normal_dlink, quality, is_dir, size_formatted, duration, thumbnail, folder }] }
function pick(o: any, keys: string[]): any {
  for (const k of keys) {
    if (o && o[k] != null) return o[k];
  }
  return undefined;
}

function normalizeItem(raw: any): any {
  if (!raw || typeof raw !== "object") return null;
  const name = pick(raw, ["name", "filename", "file_name", "title"]) || "Desconhecido";
  const isDir = pick(raw, ["is_dir", "isDir", "is_folder"]);
  const isDirStr = isDir === true || isDir === "1" || isDir === 1 ? "1" : "0";

  // Streaming URLs by quality
  const streams = pick(raw, ["fast_stream_url", "stream_urls", "streaming_links", "streams", "hls_links", "hls"]) || {};
  const fast: Record<string, string> = {};
  if (streams && typeof streams === "object") {
    for (const k of Object.keys(streams)) {
      const v = streams[k];
      if (typeof v === "string" && v) {
        // normalize "1080" -> "1080p"
        const key = /^\d+$/.test(k) ? `${k}p` : k.toLowerCase();
        fast[key] = v;
      } else if (v && typeof v === "object" && typeof v.url === "string") {
        const key = /^\d+$/.test(k) ? `${k}p` : k.toLowerCase();
        fast[key] = v.url;
      }
    }
  }
  // Some APIs return single hls url
  const hlsSingle = pick(raw, ["hls_url", "stream_url", "m3u8", "playable_url"]);
  if (hlsSingle && typeof hlsSingle === "string" && Object.keys(fast).length === 0) {
    fast["auto"] = hlsSingle;
  }

  const directDl = pick(raw, ["normal_dlink", "download_link", "dlink", "direct_link", "url", "download_url"]);
  const quality = pick(raw, ["quality", "resolution"]);
  const size = pick(raw, ["size_formatted", "size_str", "human_size"]);
  const sizeBytes = pick(raw, ["size", "size_bytes"]);
  const duration = pick(raw, ["duration", "length"]);
  const thumb = pick(raw, ["thumbnail", "thumb", "thumb_url", "image"]);
  const subtitle = pick(raw, ["subtitle_url", "subtitle", "captions"]);
  const folder = pick(raw, ["folder", "path", "dir", "dir_path"]);
  const fsId = pick(raw, ["fs_id", "id", "fileId"]);
  const type = pick(raw, ["type", "file_type"]);

  return {
    fs_id: fsId,
    name,
    filename: name,
    is_dir: isDirStr,
    type: type || (Object.keys(fast).length ? "video" : undefined),
    size: typeof sizeBytes === "number" ? sizeBytes : undefined,
    size_formatted: size,
    duration,
    quality,
    normal_dlink: directDl,
    fast_stream_url: Object.keys(fast).length ? fast : undefined,
    subtitle_url: subtitle,
    thumbnail: thumb,
    folder,
  };
}

function normalizeResponse(raw: any): any {
  if (!raw || typeof raw !== "object") return { status: "error", error: "Empty response" };

  // Already v1-ish?
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

  // Common v2 shapes
  const candidateArrays: any[] = [];
  const tryArr = (v: any) => Array.isArray(v) && candidateArrays.push(v);
  tryArr(raw.files);
  tryArr(raw.data?.files);
  tryArr(raw.data?.list);
  tryArr(raw.results);
  tryArr(raw.items);
  tryArr(raw.data);

  let arr = candidateArrays.find(a => a.length > 0) || candidateArrays[0];

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

  // Single file fallback
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

  try {
    let url: string | undefined;
    let dirPath: string | undefined;
    let page: number | undefined;

    if (req.method === "GET") {
      url = req.query?.url;
      dirPath = req.query?.dir_path;
      page = req.query?.page ? Number(req.query.page) : undefined;
    } else {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      url = body.url;
      dirPath = body.dir_path;
      page = body.page;
    }

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url required" });
      return;
    }

    const apiKey = process.env.TERABOX_V2_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "TERABOX_V2_API_KEY not configured" });
      return;
    }

    const cacheKey = `${url}|${dirPath || ""}|${page || ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      const remainingSec = Math.max(1, Math.floor((cached.expiresAt - Date.now()) / 1000));
      res.setHeader("Cache-Control", `public, s-maxage=${remainingSec}, stale-while-revalidate=60`);
      res.setHeader("X-Cache", "HIT-MEMORY");
      res.status(200).json(cached.data);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    let upstream: Response;
    try {
      const payload: any = { url };
      if (dirPath) payload.dir_path = dirPath;
      if (page) payload.page = page;

      upstream = await fetch("https://api-v2.teraboxdl.site/api/terabox/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr?.name === "AbortError";
      console.error(`[terabox-v2] upstream fetch error: ${fetchErr?.message}`);
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? "Terabox V2 API timed out" : "Terabox V2 API unreachable",
        details: fetchErr?.message ?? "fetch failed",
      });
      return;
    }
    clearTimeout(timeoutId);

    const text = await upstream.text();
    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch {
      console.error(`[terabox-v2] non-JSON (${upstream.status}): ${text.slice(0, 200)}`);
      res.status(502).json({
        error: "Terabox V2 API returned non-JSON",
        status: upstream.status,
        details: text.slice(0, 300),
      });
      return;
    }

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: raw?.error || raw?.message || `Upstream returned ${upstream.status}`,
        details: raw,
      });
      return;
    }

    const data = normalizeResponse(raw);

    if (data?.status !== "error") {
      const ttl = deriveTtlMs(url);
      if (ttl > 0) {
        cache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
        const sMaxAge = Math.max(1, Math.floor(ttl / 1000));
        res.setHeader("Cache-Control", `public, s-maxage=${sMaxAge}, stale-while-revalidate=60`);
        res.setHeader("X-Cache", "MISS-STORED");
      } else {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Cache", "BYPASS-EXPIRED");
      }
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error(`[terabox-v2] handler crashed: ${error?.message}`, error?.stack);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to fetch from Terabox V2 API",
        details: error?.message ?? "unknown error",
      });
    }
  }
}
