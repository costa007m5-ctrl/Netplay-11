import { Router } from "express";
import axios from "axios";
import { db, moviesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const router = Router();

const LISTS: Record<string, { url: string; tmdbType: "movie" | "tv" }> = {
  movie:  { url: "https://redeflixapi.store/list-movie-ids.txt",  tmdbType: "movie" },
  tv:     { url: "https://redeflixapi.store/list-tv-ids.txt",     tmdbType: "tv" },
  anime:  { url: "https://redeflixapi.store/list-anime-ids.txt",  tmdbType: "tv" },
  dorama: { url: "https://redeflixapi.store/list-dorama-ids.txt", tmdbType: "tv" },
};

interface SyncJob {
  id: string;
  type: string;
  status: "running" | "done" | "error" | "cancelled";
  total: number;
  existing: number;
  inserted: number;
  skipped: number;
  errors: number;
  log: string[];
  errorMsg?: string;
  startedAt: number;
  cancelFlag: boolean;
}

const jobs = new Map<string, SyncJob>();

function appendLog(job: SyncJob, msg: string) {
  job.log = [...job.log.slice(-300), msg];
}

async function runSync(job: SyncJob, type: string) {
  const cfg = LISTS[type];
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

  try {
    appendLog(job, `🚀 Iniciando sync de ${type}...`);

    const response = await fetch(cfg.url, {
      headers: { "User-Agent": "NetPlay/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Falha ao buscar lista: ${response.status}`);

    const text = await response.text();
    const ids = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && /^\d+$/.test(l))
      .map(Number);

    job.total = ids.length;
    appendLog(job, `✅ Lista obtida: ${ids.length} IDs`);

    const CHUNK = 500;
    const existingSet = new Set<number>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      if (job.cancelFlag) break;
      const chunk = ids.slice(i, i + CHUNK);
      const rows = await db
        .select({ id: moviesTable.id })
        .from(moviesTable)
        .where(inArray(moviesTable.id, chunk));
      rows.forEach((r) => existingSet.add(r.id));
    }

    job.existing = existingSet.size;
    const newIds = ids.filter((id) => !existingSet.has(id));
    appendLog(job, `📦 Já cadastrados: ${existingSet.size} | Novos: ${newIds.length}`);

    if (!TMDB_KEY) {
      job.status = "error";
      job.errorMsg = "TMDB_API_KEY não configurada nos Secrets.";
      appendLog(job, `⚠️ ${job.errorMsg}`);
      return;
    }

    const BATCH = 5;
    const DELAY = 350;

    for (let i = 0; i < newIds.length; i += BATCH) {
      if (job.cancelFlag) {
        appendLog(job, "⛔ Sync cancelado.");
        job.status = "cancelled";
        return;
      }

      const batch = newIds.slice(i, i + BATCH);

      await Promise.allSettled(
        batch.map(async (tmdbId) => {
          try {
            const mediaType = cfg.tmdbType;
            const { data: details } = await axios.get(
              `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=pt-BR`,
              { timeout: 8000 }
            );

            if (!details || (!details.title && !details.name)) {
              job.skipped++;
              return;
            }

            const isMovie = mediaType === "movie";
            const genreNames = (details.genres || [])
              .map((g: any) => g.name)
              .join(", ");

            await db
              .insert(moviesTable)
              .values({
                id: tmdbId,
                title: isMovie
                  ? details.title
                  : details.name || details.original_name,
                type: isMovie ? "movie" : "series",
                overview: details.overview || null,
                poster_path: details.poster_path || null,
                backdrop_path: details.backdrop_path || null,
                release_date: isMovie ? details.release_date || null : null,
                first_air_date: !isMovie ? details.first_air_date || null : null,
                release_year: isMovie
                  ? details.release_date
                    ? new Date(details.release_date).getFullYear()
                    : null
                  : details.first_air_date
                  ? new Date(details.first_air_date).getFullYear()
                  : null,
                rating: details.vote_average || null,
                runtime: isMovie
                  ? details.runtime || null
                  : details.episode_run_time?.[0] || null,
                genres: genreNames || null,
                genre: details.genres?.[0]?.name || null,
                video_url: "",
              })
              .onConflictDoNothing();

            job.inserted++;
          } catch (err: any) {
            job.errors++;
            appendLog(job, `❌ ID ${tmdbId}: ${err?.message || "erro"}`);
          }
        })
      );

      if (i > 0 && i % 50 === 0) {
        appendLog(
          job,
          `⏳ ${i}/${newIds.length} — inseridos: ${job.inserted}, erros: ${job.errors}`
        );
      }

      await new Promise((r) => setTimeout(r, DELAY));
    }

    if (!job.cancelFlag) {
      job.status = "done";
      appendLog(
        job,
        `🎉 Concluído! Inseridos: ${job.inserted} | Pulados: ${job.skipped} | Erros: ${job.errors}`
      );
    }
  } catch (err: any) {
    job.status = "error";
    job.errorMsg = err?.message || "Erro desconhecido";
    appendLog(job, `💥 Erro fatal: ${err?.message}`);
  }
}

router.post("/sync/flix3/start", (req, res) => {
  const { type } = req.body as { type: string };

  if (!LISTS[type]) {
    res.status(400).json({ error: `Tipo inválido: ${type}` });
    return;
  }

  for (const job of jobs.values()) {
    if (job.type === type && job.status === "running") {
      job.cancelFlag = true;
      job.status = "cancelled";
    }
  }

  const jobId = `${type}-${Date.now()}`;
  const job: SyncJob = {
    id: jobId,
    type,
    status: "running",
    total: 0,
    existing: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    log: [],
    startedAt: Date.now(),
    cancelFlag: false,
  };

  jobs.set(jobId, job);

  runSync(job, type).catch((err) => {
    job.status = "error";
    job.errorMsg = err.message;
  });

  res.json({ jobId, message: `Sync de ${type} iniciado em segundo plano` });
});

router.post("/sync/flix3/cancel/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }
  job.cancelFlag = true;
  job.status = "cancelled";
  res.json({ success: true });
});

router.get("/sync/flix3/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }
  res.json(job);
});

router.get("/sync/flix3/active", (_req, res) => {
  const result: Record<string, any> = {};
  for (const [id, job] of jobs.entries()) {
    result[id] = { ...job, log: job.log.slice(-20) };
  }
  res.json(result);
});

export default router;
