export const config = {
  maxDuration: 30,
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { id, type, season, episode } = req.query;
  if (!id || !type) {
    res.status(400).json({ error: "id e type são obrigatórios" });
    return;
  }

  const params = new URLSearchParams({ id: String(id), type: String(type) });
  if (type === "tv") {
    params.set("season", String(season || 1));
    params.set("episode", String(episode || 1));
  }
  const key = process.env.BETTERFLIX_API_KEY || process.env.VITE_BETTERFLIX_API_KEY || "";
  if (key) params.set("key", key);

  const playerUrl = `https://betterflix.click/api/player?${params}`;
  const baseHeaders: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Referer": "https://betterflix.click/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  };

  try {
    const jsonRes = await fetch(`https://betterflix.click/api/stream?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers: { ...baseHeaders, Accept: "application/json" },
    });
    if (jsonRes.ok) {
      const jsonData: any = await jsonRes.json();
      if (jsonData?.url) {
        res.json({ streamUrl: jsonData.url, type: jsonData.type || "m3u8", embedUrl: playerUrl });
        return;
      }
      if (Array.isArray(jsonData?.sources) && jsonData.sources.length > 0) {
        const best = jsonData.sources.find((s: any) => s.quality === "1080p") || jsonData.sources[0];
        res.json({ streamUrl: best.url || best.file, type: "m3u8", embedUrl: playerUrl });
        return;
      }
    }
  } catch {}

  try {
    const htmlRes = await fetch(playerUrl, {
      signal: AbortSignal.timeout(15000),
      headers: baseHeaders,
    });
    if (!htmlRes.ok) {
      res.json({ streamUrl: null, embedUrl: playerUrl });
      return;
    }

    const html = await htmlRes.text();

    const patterns: RegExp[] = [
      /["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /file\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /src\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /["'`](https?:\/\/[^"'`\s]+\.mp4(?:[?#][^"'`\s]*)?)[`"']/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const streamUrl = match[1];
        const streamType = streamUrl.includes(".m3u8") ? "m3u8" : "mp4";
        res.json({ streamUrl, type: streamType, embedUrl: playerUrl });
        return;
      }
    }

    res.json({ streamUrl: null, embedUrl: playerUrl });
  } catch (err: any) {
    res.status(502).json({ error: "Falha ao resolver stream BetterFlix", detail: err?.message });
  }
}
