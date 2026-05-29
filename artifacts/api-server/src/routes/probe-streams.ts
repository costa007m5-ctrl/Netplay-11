import { Router } from "express";
import axios from "axios";

const router = Router();

interface UrlEntry {
  quality: string;
  label: string;
  url: string;
}

interface WorkingEntry extends UrlEntry {
  ms: number;
}

async function probeOne(entry: UrlEntry): Promise<WorkingEntry | null> {
  const start = Date.now();
  try {
    const res = await axios.get(entry.url, {
      headers: {
        "Range": "bytes=0-65535",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.terabox.com/",
      },
      timeout: 7000,
      validateStatus: (s) => s < 500,
      responseType: "stream",
      maxRedirects: 5,
    });

    // Immediately destroy the stream — we only need headers
    try { res.data?.destroy?.(); } catch { /* ignore */ }

    // 200, 206, 301, 302, 303, 307, 308 are considered "alive"
    const ok = res.status === 200 || res.status === 206 ||
               (res.status >= 300 && res.status < 400);

    if (ok) {
      return { ...entry, ms: Date.now() - start };
    }
    return null;
  } catch {
    return null;
  }
}

router.post("/probe-streams", async (req, res) => {
  const urls: UrlEntry[] = Array.isArray(req.body?.urls) ? req.body.urls : [];

  if (urls.length === 0) {
    res.json({ working: [] });
    return;
  }

  // Probe up to 6 URLs in parallel with a 8s global ceiling
  const toProbe = urls.slice(0, 6);

  const results = await Promise.allSettled(
    toProbe.map((entry) => probeOne(entry))
  );

  const working: WorkingEntry[] = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is WorkingEntry => v !== null);

  res.json({ working });
});

export default router;
