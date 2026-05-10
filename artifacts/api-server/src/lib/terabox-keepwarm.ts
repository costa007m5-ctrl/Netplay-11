import axios from "axios";
import { logger } from "./logger";

type Source = "v1" | "v2";

interface TrackedUrl {
  source: Source;
  lastSeen: number;
  lastWarmed: number;
  failures: number;
}

const tracked = new Map<string, TrackedUrl>();

const KEEPWARM_INTERVAL_MS = 3 * 60 * 1000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED = 500;
const CONCURRENCY = 3;
const FAILURE_THRESHOLD = 5;

export function trackUrl(url: string, source: Source) {
  if (!url) return;
  const existing = tracked.get(url);
  if (existing) {
    existing.lastSeen = Date.now();
    existing.source = source;
  } else {
    if (tracked.size >= MAX_TRACKED) {
      // remove o mais antigo
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of tracked) {
        if (v.lastSeen < oldestTs) {
          oldestTs = v.lastSeen;
          oldestKey = k;
        }
      }
      if (oldestKey) tracked.delete(oldestKey);
    }
    tracked.set(url, { source, lastSeen: Date.now(), lastWarmed: 0, failures: 0 });
  }
}

async function warmOne(url: string, entry: TrackedUrl): Promise<boolean> {
  const v1Key = process.env.TERABOX_PRO_API_KEY;
  const v2Key = process.env.TERABOX_V2_API_KEY;

  try {
    let data: any = null;
    if (entry.source === "v2" && v2Key) {
      const r = await axios.post(
        "https://api-v2.teraboxdl.site/api/terabox/extract",
        { url },
        { headers: { "Content-Type": "application/json", "X-API-KEY": v2Key }, timeout: 30000 },
      );
      data = r.data;
    } else if (v1Key) {
      const r = await axios.post(
        "https://xapiverse.com/api/terabox-pro",
        { url },
        { headers: { "Content-Type": "application/json", "xAPIverse-Key": v1Key }, timeout: 25000 },
      );
      data = r.data;
    } else {
      return false;
    }

    // HEAD nos links principais para esquentar o CDN
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
      Array.from(urls).slice(0, 8).map((u) =>
        axios.head(u, { timeout: 5000, validateStatus: () => true }).catch(() => undefined),
      ),
    );

    entry.lastWarmed = Date.now();
    entry.failures = 0;
    return true;
  } catch (err: any) {
    entry.failures++;
    logger.warn({ url: url.slice(0, 60), failures: entry.failures, err: err?.message }, "[keepwarm] falha ao reaquecer");
    return false;
  }
}

async function runKeepwarm() {
  // Limpa entradas muito antigas (não acessadas em 24h)
  const now = Date.now();
  for (const [k, v] of tracked) {
    if (now - v.lastSeen > STALE_AFTER_MS) tracked.delete(k);
    else if (v.failures >= FAILURE_THRESHOLD) tracked.delete(k);
  }

  if (tracked.size === 0) return;

  const entries = Array.from(tracked.entries());
  const start = Date.now();
  let success = 0;
  let failed = 0;

  // Processa com concorrência limitada
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(([url, entry]) => warmOne(url, entry)));
    for (const ok of results) {
      if (ok) success++;
      else failed++;
    }
  }

  logger.info(
    { total: entries.length, success, failed, ms: Date.now() - start },
    "[keepwarm] ciclo concluído",
  );
}

let timer: NodeJS.Timeout | null = null;

export function startKeepwarm() {
  if (timer) return;
  // Primeira execução depois de 60s, depois a cada 3 min
  setTimeout(() => {
    runKeepwarm().catch((e) => logger.error({ err: e }, "[keepwarm] erro no primeiro ciclo"));
    timer = setInterval(() => {
      runKeepwarm().catch((e) => logger.error({ err: e }, "[keepwarm] erro no ciclo"));
    }, KEEPWARM_INTERVAL_MS);
  }, 60_000);
  logger.info({ intervalMs: KEEPWARM_INTERVAL_MS }, "[keepwarm] iniciado");
}

export function getKeepwarmStatus() {
  const now = Date.now();
  const items = Array.from(tracked.entries()).map(([url, v]) => ({
    url: url.slice(0, 80),
    source: v.source,
    lastSeenSec: Math.round((now - v.lastSeen) / 1000),
    lastWarmedSec: v.lastWarmed ? Math.round((now - v.lastWarmed) / 1000) : null,
    failures: v.failures,
  }));
  return {
    total: tracked.size,
    intervalMs: KEEPWARM_INTERVAL_MS,
    items,
  };
}
