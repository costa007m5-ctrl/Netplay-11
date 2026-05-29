import { createClient } from "@supabase/supabase-js";

export const config = {
  maxDuration: 15,
};

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  try {
    const supabase = getSupabase();

    if (req.method === "GET") {
      const { data, error } = await supabase.from("settings").select("key, value");
      if (error) throw error;

      const result: Record<string, string> = {};
      for (const row of data || []) {
        result[row.key] = row.value;
      }

      if (!result["betterflix_b2b_key"]) {
        const envKey = process.env.BETTERFLIX_API_KEY || process.env.VITE_BETTERFLIX_API_KEY || "";
        if (envKey) result["betterflix_b2b_key"] = envKey;
      }

      res.json(result);
      return;
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

      const updates: Record<string, string> = body || {};
      if (typeof updates !== "object") {
        res.status(400).json({ error: "Body inválido" });
        return;
      }

      const rows = Object.entries(updates).map(([key, value]) => ({ key, value: String(value) }));

      const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;

      res.json({ success: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("[settings] error:", error?.message);
    res.status(500).json({ error: error?.message || "Erro ao acessar configurações" });
  }
}
