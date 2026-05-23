import { Router } from "express";
import { db, moviesTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";

const router = Router();

router.post("/movies/check-existing", async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.json({ existingIds: [] });
    return;
  }
  try {
    const CHUNK = 500;
    const existingIds: number[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const rows = await db
        .select({ id: moviesTable.id })
        .from(moviesTable)
        .where(inArray(moviesTable.id, chunk));
      rows.forEach((r) => existingIds.push(r.id));
    }
    res.json({ existingIds });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao verificar IDs" });
  }
});

router.post("/movies/upsert", async (req, res) => {
  const movie = req.body;
  if (!movie || !movie.id || !movie.title) {
    res.status(400).json({ error: "id e title são obrigatórios" });
    return;
  }
  try {
    await db
      .insert(moviesTable)
      .values({
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
      })
      .onConflictDoUpdate({
        target: moviesTable.id,
        set: {
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
        },
      });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao inserir filme" });
  }
});

router.get("/movies", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 10000);
    const offset = Number(req.query.offset) || 0;
    const type = req.query.type as string | undefined;

    if (type) {
      const rows = await db
        .select()
        .from(moviesTable)
        .where(eq(moviesTable.type, type))
        .limit(limit)
        .offset(offset);
      res.json({ movies: rows, total: rows.length });
      return;
    }
    const rows = await db.select().from(moviesTable).limit(limit).offset(offset);
    res.json({ movies: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao buscar filmes" });
  }
});

export default router;
