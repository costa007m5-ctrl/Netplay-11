export const config = {
  maxDuration: 30,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let epgFullCache: any[] | null = null;
let epgFullCachedAt = 0;
const EPG_FULL_CACHE_TTL = 5 * 60 * 1000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getEpgFull(): Promise<any[]> {
  if (epgFullCache && Date.now() - epgFullCachedAt < EPG_FULL_CACHE_TTL) {
    return epgFullCache;
  }
  const response = await fetch("http://embedtv.lat/api/epgs_full", {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": USER_AGENT },
  });
  const data = await response.json();
  epgFullCache = Array.isArray(data) ? data : [];
  epgFullCachedAt = Date.now();
  return epgFullCache;
}

export default async function handler(_req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (_req.method === "OPTIONS") { res.status(204).end(); return; }

  try {
    const epgList = await getEpgFull();
    const result: Record<string, any> = {};
    const now = Date.now();

    for (const entry of epgList) {
      if (!entry?.epg) continue;
      const epg = entry.epg;
      const startMs = epg.start_date ? new Date(epg.start_date).getTime() : now - 1_800_000;
      const stopMs = epg.end_date ? new Date(epg.end_date).getTime() : startMs + 3_600_000;
      const progress = Math.min(100, Math.max(0, Math.round(((now - startMs) / (stopMs - startMs)) * 100)));
      const payload = { title: epg.title || "", description: epg.desc || null, startMs, stopMs, progress };
      result[entry.id] = payload;
      if (entry.name) result[normalize(entry.name)] = payload;
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(result);
  } catch {
    res.json(epgFullCache ? {} : {});
  }
}
