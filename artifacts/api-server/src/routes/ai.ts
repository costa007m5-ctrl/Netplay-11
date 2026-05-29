import { Router } from "express";

const router = Router();

router.post("/ai/translate", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text body param required" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.json({ translated: text });
    return;
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following movie/series text strictly to Brazilian Portuguese (pt-BR). Just return the translation, no extra text: "${text}"`,
    });
    const translated = response.text?.trim() || text;
    res.json({ translated });
  } catch (error: any) {
    console.error("[ai/translate] error:", error?.message);
    res.json({ translated: text });
  }
});

export default router;
