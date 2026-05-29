import { Router } from "express";
import { getMysqlPool, testMysqlConnection } from "../lib/mysql";
import { db, moviesTable } from "@workspace/db";

const router = Router();

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS movies (
  id INT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date TEXT,
  first_air_date TEXT,
  release_year INT,
  rating FLOAT,
  runtime INT,
  genres TEXT,
  genre TEXT,
  video_url TEXT DEFAULT '',
  logo_path TEXT,
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
  name TEXT NOT NULL,
  logo_url TEXT,
  url TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email TEXT,
  name TEXT,
  whatsapp TEXT,
  plan TEXT DEFAULT 'free',
  is_admin BOOLEAN DEFAULT FALSE,
  referred_by TEXT,
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
  current_time FLOAT DEFAULT 0,
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
    res.json({ success: true, tablesCreated: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Erro ao criar tabelas" });
  }
});

router.post("/mysql/migrate", async (req, res) => {
  const { batchSize = 100, offset = 0 } = req.body as { batchSize?: number; offset?: number };

  try {
    const pool = getMysqlPool();

    const pgMovies = await db
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
