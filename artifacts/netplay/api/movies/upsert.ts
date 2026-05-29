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

  let movie = req.body;
  if (typeof movie === "string") { try { movie = JSON.parse(movie); } catch { movie = {}; } }

  if (!movie || !movie.id || !movie.title) {
    res.status(400).json({ error: "id e title são obrigatórios" });
    return;
  }

  try {
    const supabase = getSupabase();

    const row = {
      id: Number(movie.id),
      title: movie.title,
      type: movie.type || "movie",
      overview: movie.overview || null,
      poster_path: movie.poster_path || null,
      backdrop_path: movie.backdrop_path || null,
      release_date: movie.release_date || null,
      first_air_date: movie.first_air_date || null,
      release_year: movie.release_year ? Number(movie.release_year) : null,
      rating: movie.rating ? Number(movie.rating) : null,
      runtime: movie.runtime ? Number(movie.runtime) : null,
      genres: movie.genres || null,
      genre: movie.genre || null,
      video_url: movie.video_url || "",
      logo_path: movie.logo_path || null,
    };

    const { error } = await supabase
      .from("movies")
      .upsert(row, { onConflict: "id" });

    if (error) throw error;

    res.json({ success: true, id: row.id });
  } catch (error: any) {
    console.error("[movies/upsert] error:", error?.message);
    res.status(500).json({ error: error?.message || "Erro ao salvar filme" });
  }
}
