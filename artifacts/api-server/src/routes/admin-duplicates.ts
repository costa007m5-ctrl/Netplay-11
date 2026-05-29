import { Router } from "express";

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

router.get("/admin/duplicates", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({ error: "Supabase não configurado" });
    return;
  }
  try {
    // Busca todos os filmes com campos mínimos para detectar duplicatas
    const SELECT = "id,title,type,poster_path,video_url,video_url_2,tmdb_id,is_hidden,created_at";
    let allItems: any[] = [];
    let offset = 0;
    const PAGE = 1000;

    while (true) {
      const url = `${SUPABASE_URL}/rest/v1/movies?select=${SELECT}&order=created_at.asc&limit=${PAGE}&offset=${offset}`;
      const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
      const batch = (await resp.json()) as any[];
      allItems = allItems.concat(batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }

    // Agrupa por título (case-insensitive)
    const grouped: Record<string, any[]> = {};
    for (const item of allItems) {
      const key = (item.title as string || "").toLowerCase().trim();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    const duplicates = Object.values(grouped).filter(g => g.length > 1);

    res.json({
      duplicates,
      total: duplicates.reduce((acc, g) => acc + g.length, 0),
      groups: duplicates.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao buscar duplicatas" });
  }
});

router.delete("/admin/duplicates/batch", async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "IDs inválidos" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({ error: "Supabase não configurado" });
    return;
  }
  try {
    // Supabase REST: DELETE WHERE id IN (...)
    const url = `${SUPABASE_URL}/rest/v1/movies?id=in.(${ids.join(",")})`;
    const resp = await fetch(url, {
      method: "DELETE",
      headers: supabaseHeaders,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Supabase error ${resp.status}: ${text}`);
    }
    res.json({ success: true, deleted: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao deletar em lote" });
  }
});

router.delete("/admin/duplicates/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({ error: "Supabase não configurado" });
    return;
  }
  try {
    const url = `${SUPABASE_URL}/rest/v1/movies?id=eq.${id}`;
    const resp = await fetch(url, {
      method: "DELETE",
      headers: supabaseHeaders,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Supabase error ${resp.status}: ${text}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao deletar" });
  }
});

export default router;
