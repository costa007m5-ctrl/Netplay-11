import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url query param required" });
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "TERABOX_PRO_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://xapiverse.com/api/terabox-pro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xAPIverse-Key": apiKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return res.status(500).json({ error: "Failed to fetch from Terabox API", details: msg });
  }
}
