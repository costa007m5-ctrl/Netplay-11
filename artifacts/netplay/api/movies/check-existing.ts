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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const { ids } = body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.json({ existingIds: [] });
    return;
  }

  try {
    const supabase = getSupabase();
    const CHUNK = 500;
    const existingIds: number[] = [];

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("movies")
        .select("id")
        .in("id", chunk);
      if (error) throw error;
      for (const row of data || []) existingIds.push(row.id);
    }

    res.json({ existingIds });
  } catch (error: any) {
    console.error("[movies/check-existing] error:", error?.message);
    res.status(500).json({ error: error?.message || "Erro ao verificar IDs" });
  }
}
