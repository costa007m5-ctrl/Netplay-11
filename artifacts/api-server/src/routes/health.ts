import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/debug-env", (_req, res) => {
  res.json({
    hasUrl: !!process.env.VITE_SUPABASE_URL,
    hasKey: !!process.env.VITE_TMDB_API_KEY || !!process.env.TMDB_API_KEY,
    hasMPToken: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
    NODE_ENV: process.env.NODE_ENV || "development",
    host: process.env.REPLIT_DEV_DOMAIN || "localhost",
  });
});

export default router;
