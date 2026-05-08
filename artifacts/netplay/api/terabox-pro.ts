import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callTeraboxApi, extractErrorDetails } from "./_lib/terabox";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch from Terabox API",
      details: extractErrorDetails(error),
    });
  }
}
