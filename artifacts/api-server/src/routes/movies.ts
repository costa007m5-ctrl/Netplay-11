import { Router } from "express";
import { getMysqlPool } from "../lib/mysql";

const router = Router();

router.post("/movies/check-existing", async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.json({ existingIds: [] });
    return;
  }
  try {
    const pool = getMysqlPool();
    const CHUNK = 500;
    const existingIds: number[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "?").join(",");
      const [rows] = await pool.execute<any[]>(
        `SELECT id FROM movies WHERE id IN (${placeholders})`,
        chunk
      );
      (rows as any[]).forEach((r: any) => existingIds.push(r.id));
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
    const pool = getMysqlPool();
    await pool.execute(
      `INSERT INTO movies
        (id, title, type, overview, poster_path, backdrop_path, release_date, first_air_date,
         release_year, rating, runtime, genres, genre, video_url, logo_path, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), type=VALUES(type), overview=VALUES(overview),
         poster_path=VALUES(poster_path), backdrop_path=VALUES(backdrop_path),
         release_date=VALUES(release_date), first_air_date=VALUES(first_air_date),
         release_year=VALUES(release_year), rating=VALUES(rating),
         runtime=VALUES(runtime), genres=VALUES(genres), genre=VALUES(genre),
         video_url=VALUES(video_url), logo_path=VALUES(logo_path),
         updated_at=NOW()`,
      [
        Number(movie.id),
        movie.title,
        movie.type || "movie",
        movie.overview ?? null,
        movie.poster_path ?? null,
        movie.backdrop_path ?? null,
        movie.release_date ?? null,
        movie.first_air_date ?? null,
        movie.release_year ? Number(movie.release_year) : null,
        movie.rating ? Number(movie.rating) : null,
        movie.runtime ? Number(movie.runtime) : null,
        movie.genres ?? null,
        movie.genre ?? null,
        movie.video_url ?? "",
        movie.logo_path ?? null,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao inserir filme" });
  }
});

router.get("/movies", async (req, res) => {
  try {
    const pool = getMysqlPool();
    const limit = Math.min(Number(req.query.limit) || 500, 10000);
    const offset = Number(req.query.offset) || 0;
    const type = req.query.type as string | undefined;

    let rows: any[];
    if (type) {
      [rows] = await pool.execute(
        `SELECT * FROM movies WHERE type = ? LIMIT ${limit} OFFSET ${offset}`,
        [type]
      ) as any;
    } else {
      [rows] = await pool.execute(
        `SELECT * FROM movies LIMIT ${limit} OFFSET ${offset}`
      ) as any;
    }
    res.json({ movies: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao buscar filmes" });
  }
});

export default router;
