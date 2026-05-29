export const config = {
  maxDuration: 15,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let epgFullCache: any[] | null = null;
let epgFullCachedAt = 0;
const EPG_FULL_CACHE_TTL = 5 * 60 * 1000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getEpgFull(): Promise<any[]> {
  if (epgFullCache && Date.now() - epgFullCachedAt < EPG_FULL_CACHE_TTL) return epgFullCache;
  const response = await fetch("http://embedtv.lat/api/epgs_full", {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": USER_AGENT },
  });
  const data = await response.json();
  epgFullCache = Array.isArray(data) ? data : [];
  epgFullCachedAt = Date.now();
  return epgFullCache;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const id = String(req.query.id || req.query.name || "").trim();
  if (!id) { res.json({ current: null, next: null }); return; }

  try {
    const epgList = await getEpgFull();
    const normId = normalize(id);

    const entry =
      epgList.find((e: any) => e.id === id) ||
      epgList.find((e: any) => normalize(e.id) === normId) ||
      epgList.find((e: any) => normalize(e.id).includes(normId.slice(0, 5))) ||
      epgList.find((e: any) => normId.includes(normalize(e.id).slice(0, 5)));

    if (!entry?.epg) { res.json({ current: null, next: null }); return; }

    const epg = entry.epg;
    const startMs = epg.start_date ? new Date(epg.start_date).getTime() : Date.now() - 1800000;
    const stopMs = startMs + 3_600_000;
    const now = Date.now();
    const progress = Math.min(100, Math.max(0, Math.round(((now - startMs) / (stopMs - startMs)) * 100)));

    res.json({
      current: { title: epg.title || "", description: epg.desc || null, startMs, stopMs, progress },
      next: null,
    });
  } catch {
    res.json({ current: null, next: null });
  }
}
