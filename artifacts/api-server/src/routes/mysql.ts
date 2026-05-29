import { Router } from "express";
import { getMysqlPool, testMysqlConnection } from "../lib/mysql";
import { db, moviesTable } from "@workspace/db";

const pgAvailable = () => !!process.env.DATABASE_URL && db !== null;

const router = Router();

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS movies (
  id INT PRIMARY KEY,
  title VARCHAR(512) NOT NULL,
  type VARCHAR(32) NOT NULL,
  overview TEXT,
  poster_path VARCHAR(512),
  backdrop_path VARCHAR(512),
  release_date VARCHAR(32),
  first_air_date VARCHAR(32),
  release_year INT,
  rating FLOAT,
  runtime INT,
  genres VARCHAR(512),
  genre VARCHAR(128),
  video_url VARCHAR(2048) DEFAULT '',
  logo_path VARCHAR(512),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  \`key\` VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS streaming_providers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(512),
  url VARCHAR(512),
  color VARCHAR(32),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255),
  name VARCHAR(255),
  whatsapp VARCHAR(32),
  plan VARCHAR(32) DEFAULT 'free',
  is_admin BOOLEAN DEFAULT FALSE,
  referred_by VARCHAR(255),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  movie_id INT NOT NULL,
  watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  progress_seconds INT DEFAULT 0,
  INDEX idx_user_id (user_id),
  INDEX idx_movie_id (movie_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  movie_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fav (user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS watch_parties (
  id VARCHAR(255) PRIMARY KEY,
  movie_id INT NOT NULL,
  host_id VARCHAR(255) NOT NULL,
  current_pos FLOAT DEFAULT 0,
  is_playing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

router.get("/mysql/test", async (_req, res) => {
  const result = await testMysqlConnection();
  res.status(result.ok ? 200 : 500).json(result);
});

router.post("/mysql/create-tables", async (_req, res) => {
  try {
    const pool = getMysqlPool();
    const statements = CREATE_TABLES_SQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const results: string[] = [];
    for (const stmt of statements) {
      await pool.execute(stmt);
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (match) results.push(match[1]);
    }

    // Garante coluna password_hash na tabela users (retrocompatibilidade)
    try {
      await pool.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"
      );
    } catch {}

    // Garante que video_url é VARCHAR e não TEXT (corrige criações antigas)
    try {
      await pool.execute(
        "ALTER TABLE movies MODIFY COLUMN video_url VARCHAR(2048) DEFAULT ''"
      );
    } catch {}

    res.json({ success: true, tablesCreated: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Erro ao criar tabelas" });
  }
});

router.post("/mysql/migrate", async (req, res) => {
  if (!pgAvailable()) {
    res.status(503).json({ error: "PostgreSQL não disponível neste ambiente (Vercel). Use apenas MySQL Railway." });
    return;
  }
  const { batchSize = 100, offset = 0 } = req.body as { batchSize?: number; offset?: number };

  try {
    const pool = getMysqlPool();

    const pgMovies = await db!
      .select()
      .from(moviesTable)
      .limit(batchSize)
      .offset(offset);

    if (pgMovies.length === 0) {
      res.json({ success: true, migrated: 0, total: 0, done: true });
      return;
    }

    let migrated = 0;
    for (const m of pgMovies) {
      await pool.execute(
        `INSERT INTO movies
          (id, title, type, overview, poster_path, backdrop_path, release_date, first_air_date,
           release_year, rating, runtime, genres, genre, video_url, logo_path, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title=VALUES(title), type=VALUES(type), overview=VALUES(overview),
           poster_path=VALUES(poster_path), backdrop_path=VALUES(backdrop_path),
           video_url=VALUES(video_url), logo_path=VALUES(logo_path),
           rating=VALUES(rating), updated_at=VALUES(updated_at)`,
        [
          m.id, m.title, m.type, m.overview ?? null,
          m.poster_path ?? null, m.backdrop_path ?? null,
          m.release_date ?? null, m.first_air_date ?? null,
          m.release_year ?? null, m.rating ?? null,
          m.runtime ?? null, m.genres ?? null,
          m.genre ?? null, m.video_url ?? "",
          m.logo_path ?? null,
          m.updated_at ?? new Date(),
          m.created_at ?? new Date(),
        ]
      );
      migrated++;
    }

    const [[countRow]] = await pool.execute("SELECT COUNT(*) as total FROM movies") as any;
    res.json({ success: true, migrated, total: countRow.total, done: pgMovies.length < batchSize });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Erro na migração" });
  }
});

router.post("/mysql/import-to-pg", async (req, res) => {
  if (!pgAvailable()) {
    res.status(503).json({ error: "PostgreSQL não disponível neste ambiente (Vercel). Use apenas MySQL Railway." });
    return;
  }
  const { batchSize = 500, offset = 0 } = req.body as { batchSize?: number; offset?: number };

  try {
    const pool = getMysqlPool();

    const safeBatch = Math.min(Math.max(1, Number(batchSize)), 1000);
    const safeOffset = Math.max(0, Number(offset));
    const [rows] = await pool.execute(
      `SELECT id, title, type, overview, poster_path, backdrop_path, release_date, first_air_date,
              release_year, rating, runtime, genres, genre, video_url, logo_path, updated_at, created_at
       FROM movies LIMIT ${safeBatch} OFFSET ${safeOffset}`
    ) as any;

    if (!rows || rows.length === 0) {
      res.json({ success: true, imported: 0, done: true });
      return;
    }

    let imported = 0;
    for (const m of rows) {
      await db!.insert(moviesTable).values({
        id: Number(m.id),
        title: m.title,
        type: m.type || "movie",
        overview: m.overview ?? null,
        poster_path: m.poster_path ?? null,
        backdrop_path: m.backdrop_path ?? null,
        release_date: m.release_date ?? null,
        first_air_date: m.first_air_date ?? null,
        release_year: m.release_year ? Number(m.release_year) : null,
        rating: m.rating ? Number(m.rating) : null,
        runtime: m.runtime ? Number(m.runtime) : null,
        genres: m.genres ?? null,
        genre: m.genre ?? null,
        video_url: m.video_url ?? "",
        logo_path: m.logo_path ?? null,
        updated_at: m.updated_at ? new Date(m.updated_at) : new Date(),
        created_at: m.created_at ? new Date(m.created_at) : new Date(),
      }).onConflictDoUpdate({
        target: moviesTable.id,
        set: {
          title: m.title,
          type: m.type || "movie",
          overview: m.overview ?? null,
          poster_path: m.poster_path ?? null,
          backdrop_path: m.backdrop_path ?? null,
          video_url: m.video_url ?? "",
          logo_path: m.logo_path ?? null,
          rating: m.rating ? Number(m.rating) : null,
          updated_at: new Date(),
        },
      });
      imported++;
    }

    res.json({ success: true, imported, offset, done: rows.length < batchSize });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Erro na importação" });
  }
});

router.get("/mysql/stats", async (_req, res) => {
  try {
    const pool = getMysqlPool();
    const tables = ["movies", "settings", "streaming_providers", "users", "watch_history", "favorites", "watch_parties"];
    const stats: Record<string, number> = {};
    for (const t of tables) {
      try {
        const [[row]] = await pool.execute(`SELECT COUNT(*) as c FROM ${t}`) as any;
        stats[t] = row.c;
      } catch {
        stats[t] = -1;
      }
    }
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
