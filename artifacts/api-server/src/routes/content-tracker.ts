import { Router } from "express";
import { getContentTrackerState, runContentTrackerNow } from "../lib/content-tracker";

const router = Router();

router.get("/content-tracker/status", (_req, res) => {
  res.json(getContentTrackerState());
});

router.post("/content-tracker/run-now", async (_req, res) => {
  try {
    runContentTrackerNow();
    res.json({ ok: true, message: "Verificação iniciada em background" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Erro ao iniciar verificação" });
  }
});

export default router;
