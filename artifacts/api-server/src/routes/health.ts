import { Router } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/debug-env", (_req, res) => {
  const hasTmdb = !!(process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY);
  const hasSupabaseUrl = !!process.env.VITE_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.VITE_SUPABASE_ANON_KEY;
  const hasMysqlPassword = !!process.env.MYSQL_PASSWORD;
  const hasGemini = !!(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
  const hasTeraboxV1 = !!process.env.TERABOX_PRO_API_KEY;
  const hasTeraboxV2 = !!process.env.TERABOX_V2_API_KEY;
  const hasTeraboxV3 = !!(process.env.TERABOX_V3_API_KEY && process.env.TERABOX_V3_API_SECRET);

  const missing: string[] = [];
  if (!hasTmdb) missing.push("VITE_TMDB_API_KEY");
  if (!hasSupabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!hasSupabaseKey) missing.push("VITE_SUPABASE_ANON_KEY");
  if (!hasMysqlPassword) missing.push("MYSQL_PASSWORD");
  if (!hasGemini) missing.push("VITE_GEMINI_API_KEY");

  res.json({
    status: missing.length === 0 ? "ok" : "missing_env_vars",
    env: {
      VITE_TMDB_API_KEY: hasTmdb,
      VITE_SUPABASE_URL: hasSupabaseUrl,
      VITE_SUPABASE_ANON_KEY: hasSupabaseKey,
      MYSQL_PASSWORD: hasMysqlPassword,
      VITE_GEMINI_API_KEY: hasGemini,
      TERABOX_PRO_API_KEY: hasTeraboxV1,
      TERABOX_V2_API_KEY: hasTeraboxV2,
      TERABOX_V3: hasTeraboxV3,
    },
    missing,
    node_env: process.env.NODE_ENV || "development",
    runtime: process.env.VERCEL ? "vercel" : process.env.REPLIT_DEV_DOMAIN ? "replit" : "local",
    version: "2025-05-29",
  });
});

export default router;
