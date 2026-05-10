export const config = {
  maxDuration: 60,
};

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

function parseDynRef(url: string): { folderUrl: string; v2: boolean } {
  const v2 = url.startsWith("teraboxv2-folder://");
  const stripped = url.replace(/^teraboxv2-folder:\/\//, "").replace(/^terabox-folder:\/\//, "");
  return { folderUrl: stripped.split("###")[0], v2 };
}

async function headOnly(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
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
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 28000);
    if (useV2 && v2Key) {
      const r = await fetch("https://api-v2.teraboxdl.site/api/terabox/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": v2Key },
        body: JSON.stringify({ url: folderUrl }),
        signal: ctrl.signal,
      });
      data = await r.json().catch(() => null);
    } else if (v1Key) {
      const r = await fetch("https://xapiverse.com/api/terabox-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json", "xAPIverse-Key": v1Key },
        body: JSON.stringify({ url: folderUrl }),
        signal: ctrl.signal,
      });
      data = await r.json().catch(() => null);
    }
    clearTimeout(timeoutId);
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
  if (urls.size === 0) return list.length > 0; // a extração funcionou, ainda que não consigamos HEAD
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

async function warmOne(url: string): Promise<{ url: string; source: Source; ok: boolean; durationMs: number }> {
  const start = Date.now();
  const source = detectSource(url);
  let ok = false;
  if (source === "v1" || source === "v2") ok = await warmTerabox(url, source);
  else if (source === "kingx") ok = await warmKingX(url);
  else if (source === "drive" || source === "direct") ok = await headOnly(url, 5000);
  return { url, source, ok, durationMs: Date.now() - start };
}

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<any>) {
  const results: any[] = [];
  let i = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push((async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        results[idx] = await fn(items[idx]);
      }
    })());
  }
  await Promise.all(workers);
  return results;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: any) => typeof u === "string" && u.length > 0)
      : [];
    if (urls.length === 0) {
      res.status(400).json({ error: "body.urls (array of strings) required" });
      return;
    }

    const concurrency = Math.min(6, Math.max(1, Number(body?.concurrency) || 4));
    const limited = urls.slice(0, 40); // proteção: máx 40 por chamada (limite de 60s)

    const start = Date.now();
    const results = await runWithConcurrency(limited, concurrency, warmOne);
    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;

    res.status(200).json({
      total: results.length,
      ok,
      fail,
      durationMs: Date.now() - start,
      results,
    });
  } catch (e: any) {
    console.error("[keepwarm-batch] crashed", e?.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "keepwarm-batch failed", details: e?.message ?? "unknown" });
    }
  }
}
