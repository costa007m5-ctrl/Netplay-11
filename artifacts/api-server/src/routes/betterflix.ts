import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/betterflix/stream", async (req, res) => {
  const { id, type, season, episode } = req.query;
  const key = process.env.VITE_BETTERFLIX_API_KEY || process.env.BETTERFLIX_API_KEY || '';

  if (!id || !type) {
    res.status(400).json({ error: 'id e type são obrigatórios' });
    return;
  }

  const params = new URLSearchParams({ id: String(id), type: String(type) });
  if (type === 'tv') {
    params.set('season', String(season || 1));
    params.set('episode', String(episode || 1));
  }
  if (key) params.set('key', key);

  const playerUrl = `https://betterflix.click/api/player?${params}`;
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://betterflix.click/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  };

  try {
    // 1) Tenta endpoint JSON dedicado /api/stream
    try {
      const { data: jsonData } = await axios.get(`https://betterflix.click/api/stream?${params}`, {
        timeout: 8000,
        headers: { ...baseHeaders, Accept: 'application/json' },
      });
      if (jsonData?.url) {
        res.json({ streamUrl: jsonData.url, type: jsonData.type || 'm3u8', embedUrl: playerUrl });
        return;
      }
      if (Array.isArray(jsonData?.sources) && jsonData.sources.length > 0) {
        const best = jsonData.sources.find((s: any) => s.quality === '1080p') || jsonData.sources[0];
        res.json({ streamUrl: best.url || best.file, type: 'm3u8', embedUrl: playerUrl });
        return;
      }
    } catch {}

    // 2) Busca a página do player e extrai URL de stream do HTML/JS embutido
    const { data: html } = await axios.get(playerUrl, {
      timeout: 15000,
      headers: baseHeaders,
    });

    const patterns: RegExp[] = [
      /["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /file\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /src\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /source\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8(?:[?#][^"'`\s]*)?)[`"']/,
      /["'`](https?:\/\/[^"'`\s]+\.mp4(?:[?#][^"'`\s]*)?)[`"']/,
    ];

    for (const pattern of patterns) {
      const match = String(html).match(pattern);
      if (match?.[1]) {
        const streamUrl = match[1];
        const streamType = streamUrl.includes('.m3u8') ? 'm3u8' : 'mp4';
        res.json({ streamUrl, type: streamType, embedUrl: playerUrl });
        return;
      }
    }

    // 3) Sem stream extraível — devolve embedUrl para o frontend usar no NetflixPlayer como iframe
    res.json({ streamUrl: null, embedUrl: playerUrl });
  } catch (err: any) {
    res.status(502).json({ error: 'Falha ao resolver stream BetterFlix', detail: err.message });
  }
});

router.get("/betterflix/canais", async (_req, res) => {
  try {
    const { data } = await axios.get("https://betterflix.click/api/canais.json", {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    res.json(data);
  } catch (err: any) {
    // Retorna array vazio em vez de 502 para não travar o painel admin
    res.json([]);
  }
});

router.get("/betterflix/jogos", async (_req, res) => {
  try {
    const { data } = await axios.get("https://betterflix.click/api/jogos.json", {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    res.json(data);
  } catch (err: any) {
    // Retorna array vazio em vez de 502 para não travar o painel admin
    res.json([]);
  }
});

export default router;
