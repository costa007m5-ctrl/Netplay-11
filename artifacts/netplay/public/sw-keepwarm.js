// NetPlay Keep-Warm Service Worker
// Mantém os links Terabox/etc aquecidos em segundo plano.

const SW_VERSION = "keepwarm-v1";
const DB_NAME = "netplay_keepwarm";
const DB_VERSION = 1;
const STORE = "kv";
const TAG_PERIODIC = "netplay-keepwarm-periodic";
const TAG_ONESHOT = "netplay-keepwarm-oneshot";
const BATCH_SIZE = 30;
const BATCH_CONCURRENCY = 4;
const DEFAULT_INTERVAL_MS = 3 * 60 * 1000;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// ---------- IndexedDB helpers ----------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Aquecimento em lote ----------
async function warmAllOnce(originPath) {
  const urls = (await idbGet("urls")) || [];
  if (urls.length === 0) return { ok: 0, fail: 0, total: 0 };

  let totalOk = 0, totalFail = 0;
  const start = Date.now();

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    try {
      const r = await fetch(originPath + "api/keepwarm-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: batch, concurrency: BATCH_CONCURRENCY }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      totalOk += data.ok || 0;
      totalFail += data.fail || 0;
    } catch (e) {
      totalFail += batch.length;
    }
  }

  const summary = {
    at: Date.now(),
    durationMs: Date.now() - start,
    ok: totalOk,
    fail: totalFail,
    total: urls.length,
  };
  await idbSet("lastCycle", summary);

  // Notifica clientes abertos
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage({ type: "keepwarm-cycle-complete", summary });

  return summary;
}

function getOriginPath() {
  // Usa o scope do SW como base (compatível com basePath do Vite)
  try {
    return new URL("./", self.registration.scope).toString();
  } catch {
    return self.location.origin + "/";
  }
}

// ---------- Eventos ----------
self.addEventListener("periodicsync", (event) => {
  if (event.tag === TAG_PERIODIC) {
    event.waitUntil(warmAllOnce(getOriginPath()).catch(() => {}));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === TAG_ONESHOT) {
    event.waitUntil(warmAllOnce(getOriginPath()).catch(() => {}));
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "keepwarm-set-urls") {
    event.waitUntil(idbSet("urls", Array.isArray(data.urls) ? data.urls : []));
  } else if (data.type === "keepwarm-set-config") {
    event.waitUntil(idbSet("config", data.config || {}));
  } else if (data.type === "keepwarm-run-now") {
    event.waitUntil(warmAllOnce(getOriginPath()).then((s) => {
      try { event.source && event.source.postMessage({ type: "keepwarm-cycle-complete", summary: s }); } catch {}
    }).catch(() => {}));
  } else if (data.type === "keepwarm-get-status") {
    event.waitUntil((async () => {
      const lastCycle = (await idbGet("lastCycle")) || null;
      const urls = (await idbGet("urls")) || [];
      const config = (await idbGet("config")) || {};
      try { event.source && event.source.postMessage({ type: "keepwarm-status", lastCycle, urlCount: urls.length, config }); } catch {}
    })());
  } else if (data.type === "keepwarm-ping") {
    try { event.source && event.source.postMessage({ type: "keepwarm-pong", version: SW_VERSION }); } catch {}
  }
});

// Fallback: timer interno (só roda enquanto o SW estiver ativo, mas dá uma camada extra)
let internalTimer = null;
async function startInternalTimer() {
  if (internalTimer) return;
  const config = (await idbGet("config")) || {};
  const interval = Math.max(60_000, Number(config.intervalMs) || DEFAULT_INTERVAL_MS);
  internalTimer = setInterval(() => {
    warmAllOnce(getOriginPath()).catch(() => {});
  }, interval);
}
self.addEventListener("activate", () => {
  startInternalTimer().catch(() => {});
});
