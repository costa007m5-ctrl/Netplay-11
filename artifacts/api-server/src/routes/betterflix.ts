import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/betterflix/canais", async (_req, res) => {
  try {
    const { data } = await axios.get("https://betterflix.click/api/canais.json", {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: "Falha ao buscar canais", detail: err.message });
  }
});

router.get("/betterflix/jogos", async (_req, res) => {
  try {
    const { data } = await axios.get("https://betterflix.click/api/jogos.json", {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: "Falha ao buscar jogos", detail: err.message });
  }
});

export default router;
