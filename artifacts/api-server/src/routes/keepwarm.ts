import { Router, type IRouter } from "express";
import axios from "axios";
import { syncUrls, setConfig, runNow, getKeepwarmStatus } from "../lib/terabox-keepwarm";

const router: IRouter = Router();

type Source = "v1" | "v2" | "kingx" | "drive" | "direct" | "unknown";

function detectSource(url: string): Source {
  if (!url) return "unknown";
  if (url.startsWith("teraboxv2-folder://")) return "v2";
  if (url.startsWith("terabox-folder://")) return "v1";
  if (/terabox|1024tera|teraboxapp|dubox|momerybox|4funbox|mirrobox|nephobox|freeterabox|teraboxlink|terafileshare/i.test(url)) return "v1";
  if (url.includes("player.kingx.dev") || url.includes("teradl.kingx.dev")) return "kingx";
  if (url.includes("drive.google.com")) return "drive";
  if (/^https?:\/\//i.test(url) && /\.(m3u8|mp4|webm|mkv|mov)(\?|$)/i.test(url)) return "direct";
  return "unknown";
}

function parseDynRef(url: string) {
  const v2 = url.startsWith("teraboxv2-folder://");
  const stripped = url.replace(/^teraboxv2-folder:\/\//, "").replace(/^terabox-folder:\/\//, "");
  return { folderUrl: stripped.split("###")[0], v2 };
}

async function headOnly(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const r = await axios.head(url, { timeout: timeoutMs, maxRedirects: 3, validateStatus: () => true });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function warmTerabox(url: string, source: Source): Promise<boolean> {
  const v1Key = process.env.TERABOX_PRO_API_KEY;
  const v2Key = process.env.TERABOX_V2_API_KEY;
  let folderUrl = url;
  let useV2 = source === "v2";
  if (url.startsWith("terabox-folder://") || url.startsWith("teraboxv2-folder://")) {
    const p = parseDynRef(url);
    folderUrl = p.folderUrl;
    useV2 = p.v2;
  }
  let data: any = null;
  try {
    if (useV2 && v2Key) {
      const r = await axios.post("https://api-v2.teraboxdl.site/api/terabox/extract", { url: folderUrl }, { headers: { "Content-Type": "application/json", "X-API-KEY": v2Key }, timeout: 28000 });
      data = r.data;
    } else if (v1Key) {
      const r = await axios.post("https://xapiverse.com/api/terabox-pro", { url: folderUrl }, { headers: { "Content-Type": "application/json", "xAPIverse-Key": v1Key }, timeout: 25000 });
      data = r.data;
    }
  } catch {
    return false;
  }
  if (!data) return false;
  const list: any[] = Array.isArray(data?.list) ? data.list : data?.list ? [data.list] : [];
  const urls = new Set<string>();
  for (const file of list.slice(0, 5)) {
    const fs = file?.fast_stream_url || {};
    for (const k of ["720p", "480p", "360p", "1080p", "auto"]) {
      if (typeof fs[k] === "string" && fs[k]) urls.add(fs[k]);
    }
    const direct = file?.normal_dlink || file?.dlink || file?.url;
    if (typeof direct === "string" && direct) urls.add(direct);
  }
  if (urls.size === 0) return list.length > 0;
  await Promise.allSettled(Array.from(urls).slice(0, 6).map((u) => headOnly(u, 4000)));
  return true;
}

async function warmKingX(url: string): Promise<boolean> {
  if (url.includes("#")) {
    const hash = url.split("#")[1] || "";
    const params = new URLSearchParams(hash);
    const v = params.get("video_url");
    if (v) return headOnly(v, 5000);
  }
  return headOnly(url, 5000);
}

async function warmOne(url: string) {
  const start = Date.now();
  const source = detectSource(url);
  let ok = false;
  if (source === "v1" || source === "v2") ok = await warmTerabox(url, source);
  else if (source === "kingx") ok = await warmKingX(url);
  else if (source === "drive" || source === "direct") ok = await headOnly(url, 5000);
  return { url, source, ok, durationMs: Date.now() - start };
}

router.post("/keepwarm-batch", async (req, res) => {
  try {
    const urls: string[] = Array.isArray(req.body?.urls) ? req.body.urls.filter((u: any) => typeof u === "string" && u.length) : [];
    if (urls.length === 0) {
      res.status(400).json({ error: "body.urls (array of strings) required" });
      return;
    }
    const concurrency = Math.min(6, Math.max(1, Number(req.body?.concurrency) || 4));
    const limited = urls.slice(0, 40);
    const start = Date.now();

    const results: any[] = [];
    let i = 0;
    const workers: Promise<void>[] = [];
    for (let w = 0; w < concurrency; w++) {
      workers.push((async () => {
        while (true) {
          const idx = i++;
          if (idx >= limited.length) return;
          results[idx] = await warmOne(limited[idx]);
        }
      })());
    }
    await Promise.all(workers);

    const ok = results.filter((r) => r.ok).length;
    res.json({ total: results.length, ok, fail: results.length - ok, durationMs: Date.now() - start, results });
  } catch (e: any) {
    res.status(500).json({ error: "keepwarm-batch failed", details: e?.message ?? "unknown" });
  }
});

router.get("/keepwarm/status", (_req, res) => {
  res.json(getKeepwarmStatus());
});

router.post("/keepwarm/sync", async (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.filter((u: any) => typeof u === "string" && u.length) : [];
  if (urls.length === 0) {
    res.status(400).json({ error: "body.urls (array of strings) required" });
    return;
  }
  const result = syncUrls(urls);
  // Immediately warm newly added URLs so they're hot right away (don't wait for next cycle)
  if (result.added > 0) {
    const newUrls = urls.filter((u: string) => {
      const src = detectSource(u);
      return src === "kingx" || src === "direct";
    }).slice(0, 6);
    if (newUrls.length > 0) {
      Promise.allSettled(newUrls.map((u: string) => warmOne(u))).catch(() => {});
    }
  }
  res.json(result);
});

router.post("/keepwarm/config", (req, res) => {
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
  const intervalMs = typeof req.body?.intervalMs === "number" ? req.body.intervalMs : undefined;
  let durationMs: number | null | undefined;
  if (req.body?.durationMs === null || req.body?.durationMs === "unlimited") durationMs = null;
  else if (typeof req.body?.durationMs === "number") durationMs = req.body.durationMs;
  const status = setConfig({ enabled, intervalMs, durationMs });
  res.json(status);
});

router.post("/keepwarm/run-now", async (_req, res) => {
  const result = await runNow();
  res.json(result);
});

export default router;
