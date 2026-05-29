export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { text } = body || {};
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text body param required" });
    return;
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.json({ translated: text });
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate the following movie/series text strictly to Brazilian Portuguese (pt-BR). Just return the translation, no extra text: "${text}"`,
            }],
          }],
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      res.json({ translated: text });
      return;
    }

    const data: any = await response.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    res.json({ translated });
  } catch (error: any) {
    console.error("[ai/translate] error:", error?.message);
    res.json({ translated: text });
  }
}
