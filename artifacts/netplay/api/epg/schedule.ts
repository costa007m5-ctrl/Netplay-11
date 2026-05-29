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

function buildProgram(p: any, now: number) {
  const startMs = p.start_date ? new Date(p.start_date).getTime() : now - 1_800_000;
  const stopMs = p.end_date ? new Date(p.end_date).getTime() : startMs + 3_600_000;
  const progress = now >= startMs && now <= stopMs
    ? Math.min(100, Math.max(0, Math.round(((now - startMs) / (stopMs - startMs)) * 100)))
    : (now > stopMs ? 100 : 0);
  return { title: p.title || "", description: p.desc || p.description || null, startMs, stopMs, progress };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const id = String(req.query.id || "").trim();
  if (!id) { res.json({ programs: [] }); return; }

  try {
    const epgList = await getEpgFull();
    const normId = normalize(id);
    const entry =
      epgList.find((e: any) => e.id === id) ||
      epgList.find((e: any) => normalize(e.id) === normId) ||
      epgList.find((e: any) => normalize(e.id).includes(normId.slice(0, 5))) ||
      epgList.find((e: any) => normId.includes(normalize(e.id).slice(0, 5)));

    if (!entry) { res.json({ programs: [] }); return; }

    const now = Date.now();
    const rawList: any[] = entry.programs || entry.epg_list || entry.epgs || entry.schedule || entry.guide || [];

    if (rawList.length > 0) {
      res.json({ programs: rawList.map((p: any) => buildProgram(p, now)) });
    } else if (entry.epg) {
      res.json({ programs: [buildProgram(entry.epg, now)] });
    } else {
      res.json({ programs: [] });
    }
  } catch {
    res.json({ programs: [] });
  }
}
