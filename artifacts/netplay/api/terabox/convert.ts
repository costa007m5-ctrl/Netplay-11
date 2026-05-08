import { callTeraboxApi, pickBestUrl, extractErrorDetails } from "../_lib/terabox";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const body: any = req.body || {};
  const url: unknown = body.url;
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
    const data: any = await callTeraboxApi(url, apiKey);

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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Falha ao converter link do TeraBox",
      details: extractErrorDetails(error),
    });
  }
}
