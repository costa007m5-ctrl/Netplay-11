export const config = {
  maxDuration: 30,
};

const LISTS: Record<string, string> = {
  movie: "https://redeflixapi.store/list-movie-ids.txt",
  tv: "https://redeflixapi.store/list-tv-ids.txt",
  anime: "https://redeflixapi.store/list-anime-ids.txt",
  dorama: "https://redeflixapi.store/list-dorama-ids.txt",
};

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const type = String(req.query.type || "");
  const url = LISTS[type];

  if (!url) {
    res.status(400).json({ error: `Tipo inválido: ${type}. Use: movie, tv, anime, dorama` });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NetPlay/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `redeflixapi.store retornou ${response.status}` });
      return;
    }

    const text = await response.text();
    const ids = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && /^\d+$/.test(l))
      .map(Number);

    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=600");
    res.json({ type, total: ids.length, ids });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Falha ao buscar lista" });
  }
}
