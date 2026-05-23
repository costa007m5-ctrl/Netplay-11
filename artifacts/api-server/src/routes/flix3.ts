import { Router } from "express";

const router = Router();

const LISTS: Record<string, string> = {
  movie: "https://redeflixapi.store/list-movie-ids.txt",
  tv: "https://redeflixapi.store/list-tv-ids.txt",
  anime: "https://redeflixapi.store/list-anime-ids.txt",
  dorama: "https://redeflixapi.store/list-dorama-ids.txt",
};

router.get("/flix3/ids/:type", async (req, res) => {
  const { type } = req.params;
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
    res.json({ type, total: ids.length, ids });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Falha ao buscar lista" });
  }
});

export default router;
