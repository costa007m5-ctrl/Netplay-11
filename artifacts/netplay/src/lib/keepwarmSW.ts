// Helper para registrar e conversar com o Service Worker de keep-warm

const SW_PATH = `${import.meta.env.BASE_URL}sw-keepwarm.js`;
const PERIODIC_TAG = "netplay-keepwarm-periodic";
const ONESHOT_TAG = "netplay-keepwarm-oneshot";

export interface SWStatus {
  registered: boolean;
  active: boolean;
  periodicSyncSupported: boolean;
  periodicSyncRegistered: boolean;
  permission: "granted" | "denied" | "prompt" | "unsupported";
  lastCycle: { at: number; durationMs: number; ok: number; fail: number; total: number } | null;
  urlCount: number;
}

export async function registerKeepwarmSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: import.meta.env.BASE_URL });
    return reg;
  } catch (e) {
    console.error("[keepwarmSW] registro falhou", e);
    return null;
  }
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)) || null;
  } catch {
    return null;
  }
}

async function postToSW(message: any): Promise<any> {
  const reg = await getRegistration();
  const target = reg?.active || reg?.waiting || reg?.installing;
  if (!target) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => resolve(null), 5000);
    channel.port1.onmessage = (e) => {
      clearTimeout(timeout);
      resolve(e.data);
    };
    try {
      target.postMessage(message, [channel.port2]);
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

export async function pushUrls(urls: string[]): Promise<void> {
  await postToSW({ type: "keepwarm-set-urls", urls });
}

export async function pushConfig(config: { intervalMs?: number; expiresAt?: number | null; enabled?: boolean }): Promise<void> {
  await postToSW({ type: "keepwarm-set-config", config });
}

export async function triggerRunNow(): Promise<void> {
  // Tenta via Background Sync (mais confiável)
  const reg = await getRegistration();
  if (reg && "sync" in reg) {
    try { await (reg as any).sync.register(ONESHOT_TAG); } catch { /* ignore */ }
  }
  // E também postMessage como fallback imediato
  await postToSW({ type: "keepwarm-run-now" });
}

export async function getSWStatus(): Promise<SWStatus> {
  const reg = await getRegistration();
  const periodicSyncSupported = !!(reg && "periodicSync" in reg);
  let periodicSyncRegistered = false;
  let permission: SWStatus["permission"] = "unsupported";

  if (reg && "periodicSync" in reg) {
    try {
      const tags = await (reg as any).periodicSync.getTags();
      periodicSyncRegistered = Array.isArray(tags) && tags.includes(PERIODIC_TAG);
    } catch { /* ignore */ }
  }

  if ("permissions" in navigator) {
    try {
      const status = await (navigator.permissions as any).query({ name: "periodic-background-sync" });
      permission = status.state as any;
    } catch {
      permission = "unsupported";
    }
  }

  let lastCycle: SWStatus["lastCycle"] = null;
  let urlCount = 0;
  if (reg?.active) {
    const status = await postToSW({ type: "keepwarm-get-status" });
    if (status?.type === "keepwarm-status") {
      lastCycle = status.lastCycle;
      urlCount = status.urlCount;
    }
  }

  return {
    registered: !!reg,
    active: !!reg?.active,
    periodicSyncSupported,
    periodicSyncRegistered,
    permission,
    lastCycle,
    urlCount,
  };
}

export async function registerPeriodicSync(intervalMs: number = 3 * 60 * 1000): Promise<{ ok: boolean; reason?: string }> {
  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: "Service Worker não registrado" };
  if (!("periodicSync" in reg)) return { ok: false, reason: "Periodic Background Sync não suportado neste navegador (use Chrome/Edge com o site instalado como PWA)" };

  // Pede permissão (se aplicável)
  if ("permissions" in navigator) {
    try {
      const status = await (navigator.permissions as any).query({ name: "periodic-background-sync" });
      if (status.state === "denied") return { ok: false, reason: "Permissão negada pelo navegador" };
    } catch { /* ignore */ }
  }

  try {
    await (reg as any).periodicSync.register(PERIODIC_TAG, {
      minInterval: Math.max(60_000, intervalMs),
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "Falha ao registrar" };
  }
}

export async function unregisterPeriodicSync(): Promise<void> {
  const reg = await getRegistration();
  if (reg && "periodicSync" in reg) {
    try { await (reg as any).periodicSync.unregister(PERIODIC_TAG); } catch { /* ignore */ }
  }
}
