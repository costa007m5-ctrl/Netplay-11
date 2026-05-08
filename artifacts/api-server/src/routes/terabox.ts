import { Router, type IRouter } from "express";
import axios from "axios";

const router: IRouter = Router();

function pickBestUrl(file: any): string | null {
  return (
    file?.fast_stream_url?.["1080p"] ||
    file?.fast_stream_url?.["720p"] ||
    file?.fast_stream_url?.["480p"] ||
    file?.fast_stream_url?.["360p"] ||
    file?.normal_dlink ||
    file?.stream_url ||
    file?.url ||
    file?.dlink ||
    null
  );
}

async function callTeraboxApi(url: string, apiKey: string) {
  const response = await axios.post(
    "https://xapiverse.com/api/terabox-pro",
    { url },
    {
      headers: {
        "Content-Type": "application/json",
        "xAPIverse-Key": apiKey,
      },
      timeout: 30000,
    },
  );
  return response.data;
}

router.get("/terabox-pro", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TERABOX_PRO_API_KEY not configured" });
    return;
  }

  try {
    const data = await callTeraboxApi(url, apiKey);
    res.json(data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    const details =
      err?.response?.data != null
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message ?? "unknown error";
    res.status(500).json({ error: "Failed to fetch from Terabox API", details });
  }
});

router.post("/terabox/convert", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    res.status(400).json({ success: false, error: "url body param required" });
    return;
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey) {
    res.status(503).json({ success: false, error: "TERABOX_PRO_API_KEY not configured" });
    return;
  }

  try {
    const data = await callTeraboxApi(url, apiKey);

    const list: any[] = Array.isArray(data.list)
      ? data.list
      : data.list
        ? [data.list]
        : data.filename || data.fast_stream_url || data.dlink
          ? [data]
          : [];

    const file = list[0];

    if (!file) {
      res.status(404).json({ success: false, error: "Nenhum arquivo encontrado no link do TeraBox." });
      return;
    }

    const videoUrl = pickBestUrl(file);

    if (!videoUrl) {
      res.status(404).json({ success: false, error: "Nenhum link de vídeo encontrado para esse arquivo." });
      return;
    }

    res.json({ success: true, videoUrl, directUrl: videoUrl });
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    const details =
      err?.response?.data != null
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message ?? "unknown error";
    res.status(500).json({ success: false, error: "Falha ao converter link do TeraBox", details });
  }
});

export default router;
