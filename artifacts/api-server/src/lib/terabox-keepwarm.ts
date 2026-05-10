import axios from "axios";
import { logger } from "./logger";

type Source = "v1" | "v2" | "direct" | "kingx" | "drive";

interface TrackedUrl {
  source: Source;
  origin: "auto" | "sync";
  lastSeen: number;
  lastWarmed: number;
  lastStatus: "ok" | "fail" | "pending";
  failures: number;
  warmCount: number;
}

const tracked = new Map<string, TrackedUrl>();

let config = {
  enabled: true,
  intervalMs: 3 * 60 * 1000,
  expiresAt: 0 as number,
};

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED = 5000;
const CONCURRENCY = 4;
const FAILURE_THRESHOLD = 8;

let lastCycle: { startedAt: number; durationMs: number; success: number; failed: number; total: number } | null = null;
let cycleInProgress = false;

function isDynamicRef(url: string): boolean {
  return url.startsWith("terabox-folder://") || url.startsWith("teraboxv2-folder://");
}

function parseDynamicRef(url: string): { folderUrl: string; v2: boolean } {
  const v2 = url.startsWith("teraboxv2-folder://");
  const stripped = url.replace(/^teraboxv2-folder:\/\//, "").replace(/^terabox-folder:\/\//, "");
  const folderUrl = stripped.split("###")[0];
  return { folderUrl, v2 };
}

function detectSource(url: string): Source | null {
  if (!url) return null;
  if (url.startsWith("teraboxv2-folder://")) return "v2";
  if (url.startsWith("terabox-folder://")) return "v1";
  if (/terabox|1024tera|teraboxapp|dubox|momerybox|4funbox|mirrobox|nephobox|freeterabox|teraboxlink|terafileshare/i.test(url)) return "v1";
  if (url.includes("player.kingx.dev") || url.includes("teradl.kingx.dev")) return "kingx";
  if (url.includes("drive.google.com")) return "drive";
  if (/^https?:\/\//i.test(url) && /\.(m3u8|mp4|webm|mkv|mov)(\?|$)/i.test(url)) return "direct";
  return null;
}

export function trackUrl(url: string, source?: Source, origin: "auto" | "sync" = "auto") {
  if (!url) return;
  const detected = source || detectSource(url);
  if (!detected) return;
  const existing = tracked.get(url);
  if (existing) {
    existing.lastSeen = Date.now();
    existing.source = detected;
    if (origin === "sync") existing.origin = "sync";
  } else {
    if (tracked.size >= MAX_TRACKED) {
      // remove a entrada mais antiga
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of tracked) {
        if (v.origin === "sync") continue; // synced URLs nunca caem
        if (v.lastSeen < oldestTs) {
          oldestTs = v.lastSeen;
          oldestKey = k;
        }
      }
      if (oldestKey) tracked.delete(oldestKey);
    }
    tracked.set(url, { source: detected, origin, lastSeen: Date.now(), lastWarmed: 0, lastStatus: "pending", failures: 0, warmCount: 0 });
  }
}

async function headOnly(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const r = await axios.head(url, { timeout: timeoutMs, validateStatus: () => true, maxRedirects: 3 });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function warmTeraboxApi(url: string, source: Source): Promise<boolean> {
  const v1Key = process.env.TERABOX_PRO_API_KEY;
  const v2Key = process.env.TERABOX_V2_API_KEY;

  let folderUrl = url;
  let useV2 = source === "v2";

  if (isDynamicRef(url)) {
    const parsed = parseDynamicRef(url);
    folderUrl = parsed.folderUrl;
    useV2 = parsed.v2;
  }

  let data: any = null;
  try {
    if (useV2 && v2Key) {
      const r = await axios.post(
        "https://api-v2.teraboxdl.site/api/terabox/extract",
        { url: folderUrl },
        { headers: { "Content-Type": "application/json", "X-API-KEY": v2Key }, timeout: 30000 },
      );
      data = r.data;
    } else if (v1Key) {
      const r = await axios.post(
        "https://xapiverse.com/api/terabox-pro",
        { url: folderUrl },
        { headers: { "Content-Type": "application/json", "xAPIverse-Key": v1Key }, timeout: 25000 },
      );
      data = r.data;
    } else {
      return false;
    }
  } catch {
    return false;
  }

  // HEAD nos links de stream para esquentar o CDN
  const list: any[] = Array.isArray(data?.list) ? data.list : data?.list ? [data.list] : data?.fast_stream_url ? [data] : [];
  const urls = new Set<string>();
  for (const file of list.slice(0, 5)) {
    const fs = file?.fast_stream_url || {};
    for (const k of ["720p", "480p", "360p", "1080p", "auto"]) {
      if (typeof fs[k] === "string" && fs[k]) urls.add(fs[k]);
    }
    const direct = file?.normal_dlink || file?.dlink || file?.url;
    if (typeof direct === "string" && direct) urls.add(direct);
  }
  await Promise.allSettled(
    Array.from(urls).slice(0, 8).map((u) => headOnly(u, 5000)),
  );

  return urls.size > 0;
}

async function warmKingX(url: string): Promise<boolean> {
  // Extrai o m3u8 interno e faz HEAD
  try {
    if (url.includes("#")) {
      const hash = url.split("#")[1] || "";
      const params = new URLSearchParams(hash);
      const v = params.get("video_url");
      if (v) return headOnly(v, 5000);
    }
    if (url.includes("teradl.kingx.dev") && url.includes(".m3u8")) {
      return headOnly(url, 5000);
    }
  } catch {
    // ignore
  }
  return false;
}

async function warmDrive(url: string): Promise<boolean> {
  // Apenas HEAD na URL pública
  return headOnly(url, 5000);
}

async function warmDirect(url: string): Promise<boolean> {
  return headOnly(url, 5000);
}

async function warmOne(url: string, entry: TrackedUrl): Promise<boolean> {
  let ok = false;
  switch (entry.source) {
    case "v1":
    case "v2":
      ok = await warmTeraboxApi(url, entry.source);
      break;
    case "kingx":
      ok = await warmKingX(url);
      break;
    case "drive":
      ok = await warmDrive(url);
      break;
    case "direct":
      ok = await warmDirect(url);
      break;
  }
  if (ok) {
    entry.lastWarmed = Date.now();
    entry.lastStatus = "ok";
    entry.failures = 0;
    entry.warmCount++;
  } else {
    entry.failures++;
    entry.lastStatus = "fail";
  }
  return ok;
}

async function runKeepwarm() {
  if (cycleInProgress) return;
  if (!config.enabled) return;
  if (config.expiresAt > 0 && Date.now() > config.expiresAt) {
    config.enabled = false;
    logger.info("[keepwarm] duração expirou — desativando");
    return;
  }

  cycleInProgress = true;
  try {
    const now = Date.now();
    for (const [k, v] of tracked) {
      if (v.origin === "sync") continue;
      if (now - v.lastSeen > STALE_AFTER_MS) tracked.delete(k);
      else if (v.failures >= FAILURE_THRESHOLD) tracked.delete(k);
    }

    if (tracked.size === 0) {
      lastCycle = { startedAt: now, durationMs: 0, success: 0, failed: 0, total: 0 };
      return;
    }

    const entries = Array.from(tracked.entries());
    const start = Date.now();
    let success = 0;
    let failed = 0;

    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const batch = entries.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(([url, entry]) => warmOne(url, entry)));
      for (const ok of results) {
        if (ok) success++;
        else failed++;
      }
    }

    lastCycle = { startedAt: start, durationMs: Date.now() - start, success, failed, total: entries.length };
    logger.info(lastCycle, "[keepwarm] ciclo concluído");
  } finally {
    cycleInProgress = false;
  }
}

let timer: NodeJS.Timeout | null = null;

function rescheduleTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (config.enabled) {
    timer = setInterval(() => {
      runKeepwarm().catch((e) => logger.error({ err: e }, "[keepwarm] erro no ciclo"));
    }, config.intervalMs);
  }
}

export function startKeepwarm() {
  // Primeiro ciclo após 60s
  setTimeout(() => {
    runKeepwarm().catch((e) => logger.error({ err: e }, "[keepwarm] erro no primeiro ciclo"));
    rescheduleTimer();
  }, 60_000);
  logger.info({ intervalMs: config.intervalMs }, "[keepwarm] iniciado");
}

export function syncUrls(urls: string[]) {
  let added = 0;
  let updated = 0;
  for (const url of urls) {
    const had = tracked.has(url);
    trackUrl(url, undefined, "sync");
    if (had) updated++;
    else if (tracked.has(url)) added++;
  }
  return { added, updated, totalTracked: tracked.size };
}

export function setConfig(opts: { enabled?: boolean; intervalMs?: number; durationMs?: number | null }) {
  if (typeof opts.enabled === "boolean") config.enabled = opts.enabled;
  if (typeof opts.intervalMs === "number" && opts.intervalMs >= 30_000) config.intervalMs = opts.intervalMs;
  if (opts.durationMs === null) config.expiresAt = 0; // ilimitado
  else if (typeof opts.durationMs === "number" && opts.durationMs > 0) config.expiresAt = Date.now() + opts.durationMs;
  rescheduleTimer();
  return getKeepwarmStatus();
}

export async function runNow() {
  if (cycleInProgress) return { triggered: false, reason: "cycle already running" };
  runKeepwarm().catch((e) => logger.error({ err: e }, "[keepwarm] erro em runNow"));
  return { triggered: true, total: tracked.size };
}

export function getKeepwarmStatus() {
  const now = Date.now();
  const items = Array.from(tracked.entries()).map(([url, v]) => ({
    url: url.length > 120 ? url.slice(0, 120) + "…" : url,
    source: v.source,
    origin: v.origin,
    lastSeenSec: Math.round((now - v.lastSeen) / 1000),
    lastWarmedSec: v.lastWarmed ? Math.round((now - v.lastWarmed) / 1000) : null,
    lastStatus: v.lastStatus,
    failures: v.failures,
    warmCount: v.warmCount,
  }));

  // ETA: tempo estimado pra um ciclo completo
  const avgPerUrlMs = lastCycle && lastCycle.total > 0 ? lastCycle.durationMs / lastCycle.total : 800;
  const etaMs = Math.ceil(tracked.size / CONCURRENCY) * avgPerUrlMs;

  // Conta por source
  const bySource: Record<string, number> = {};
  let okCount = 0;
  let pendingCount = 0;
  let failCount = 0;
  for (const [, v] of tracked) {
    bySource[v.source] = (bySource[v.source] || 0) + 1;
    if (v.lastStatus === "ok") okCount++;
    else if (v.lastStatus === "fail") failCount++;
    else pendingCount++;
  }

  return {
    config: {
      enabled: config.enabled,
      intervalMs: config.intervalMs,
      expiresAt: config.expiresAt || null,
      remainingMs: config.expiresAt > 0 ? Math.max(0, config.expiresAt - now) : null,
    },
    stats: {
      total: tracked.size,
      bySource,
      ok: okCount,
      pending: pendingCount,
      failed: failCount,
    },
    lastCycle,
    etaMs,
    cycleInProgress,
    items,
  };
}
