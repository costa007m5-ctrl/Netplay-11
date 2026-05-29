export const config = {
  maxDuration: 30,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function proxyBetterFlixRecents(subpath: string, query: Record<string, any>, res: any) {
  const qs = new URLSearchParams(query).toString();
  const targetUrl = `https://betterflix.click/api/recents${subpath}${qs ? "?" + qs : ""}`;
  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://betterflix.click/",
        "Accept": "application/json",
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: "Falha ao buscar recentes BetterFlix", detail: err?.message });
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { subpath, ...query } = req.query;
  const sub = subpath ? `/${Array.isArray(subpath) ? subpath.join("/") : subpath}` : "";
  await proxyBetterFlixRecents(sub, query, res);
}
