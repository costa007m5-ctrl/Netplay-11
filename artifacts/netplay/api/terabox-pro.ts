import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url query param required" });
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "TERABOX_PRO_API_KEY not configured" });
  }

  try {
    const upstream = await fetch(
      `https://xapiverse.com/api/terabox-pro?url=${encodeURIComponent(url)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "xAPIverse-Key": apiKey,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch from Terabox API", details: err.message });
  }
}
