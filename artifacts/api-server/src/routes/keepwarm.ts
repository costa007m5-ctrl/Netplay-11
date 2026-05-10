import { Router, type IRouter } from "express";
import { syncUrls, setConfig, runNow, getKeepwarmStatus } from "../lib/terabox-keepwarm";

const router: IRouter = Router();

router.get("/keepwarm/status", (_req, res) => {
  res.json(getKeepwarmStatus());
});

router.post("/keepwarm/sync", (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.filter((u: any) => typeof u === "string" && u.length) : [];
  if (urls.length === 0) {
    res.status(400).json({ error: "body.urls (array of strings) required" });
    return;
  }
  const result = syncUrls(urls);
  res.json(result);
});

router.post("/keepwarm/config", (req, res) => {
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
  const intervalMs = typeof req.body?.intervalMs === "number" ? req.body.intervalMs : undefined;
  let durationMs: number | null | undefined;
  if (req.body?.durationMs === null || req.body?.durationMs === "unlimited") durationMs = null;
  else if (typeof req.body?.durationMs === "number") durationMs = req.body.durationMs;
  const status = setConfig({ enabled, intervalMs, durationMs });
  res.json(status);
});

router.post("/keepwarm/run-now", async (_req, res) => {
  const result = await runNow();
  res.json(result);
});

export default router;
