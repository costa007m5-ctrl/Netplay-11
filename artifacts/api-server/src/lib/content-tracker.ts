import axios from "axios";
import { logger } from "./logger";
import { db, moviesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.VITE_TMDB_API_KEY;
const ONESIGNAL_APP_ID = process.env.VITE_ONESIGNAL_APP_ID || "581f23c1-2b57-4646-8780-6cd2ccbba30e";
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

interface TrackerState {
  running: boolean;
  lastCheck: number | null;
  lastCheckResult: { newMovies: number; newEpisodes: number } | null;
  nextCheckAt: number | null;
  totalNotificationsSent: number;
  log: string[];
}

const state: TrackerState = {
  running: false,
  lastCheck: null,
  lastCheckResult: null,
  nextCheckAt: null,
  totalNotificationsSent: 0,
  log: [],
};

function addLog(msg: string) {
  const ts = new Date().toLocaleTimeString("pt-BR");
  const line = `[${ts}] ${msg}`;
  state.log.unshift(line);
  if (state.log.length > 100) state.log.pop();
  logger.info(`[content-tracker] ${msg}`);
}

async function tmdbGet(path: string, params: Record<string, string> = {}) {
  if (!TMDB_KEY) throw new Error("TMDB API key não configurada");
  const url = `${TMDB_BASE}${path}`;
  const res = await axios.get(url, {
    params: { api_key: TMDB_KEY, language: "pt-BR", ...params },
    timeout: 12000,
  });
  return res.data;
}

async function sendPushNotification(title: string, body: string, imageUrl?: string) {
  if (!ONESIGNAL_REST_KEY) {
    addLog(`[push] Chave REST OneSignal ausente — pulando notificação: "${title}"`);
    return false;
  }
  try {
    const payload: any = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      headings: { pt: title, en: title },
      contents: { pt: body, en: body },
    };
    if (imageUrl) payload.big_picture = imageUrl;

    await axios.post("https://onesignal.com/api/v1/notifications", payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
      },
      timeout: 10000,
    });
    state.totalNotificationsSent++;
    addLog(`[push] Notificação enviada: ${title}`);
    return true;
  } catch (e: any) {
    addLog(`[push] Erro ao enviar: ${e?.message}`);
    return false;
  }
}

// Busca IDs existentes no banco em lote (muito mais eficiente)
async function getExistingIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  try {
    const CHUNK = 500;
    const existing = new Set<number>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const rows = await db
        .select({ id: moviesTable.id })
        .from(moviesTable)
        .where(inArray(moviesTable.id, chunk));
      rows.forEach((r) => existing.add(r.id));
    }
    return existing;
  } catch (e: any) {
    addLog(`Erro ao consultar IDs no banco: ${e?.message}`);
    return new Set();
  }
}

async function checkNewMovies(): Promise<number> {
  let newCount = 0;
  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const data = await tmdbGet("/discover/movie", {
      sort_by: "release_date.desc",
      "release_date.gte": weekAgo,
      "release_date.lte": today,
      "vote_count.gte": "10",
      region: "BR",
      page: "1",
    });

    const movies = (data.results || []).slice(0, 15);
    const tmdbIds: number[] = movies.map((m: any) => m.id);
    const existingIds = await getExistingIds(tmdbIds);

    for (const m of movies) {
      if (!existingIds.has(m.id)) {
        newCount++;
        const poster = m.poster_path
          ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
          : undefined;
        if (newCount <= 1) {
          await sendPushNotification(
            `🎬 Novo Lançamento: ${m.title}`,
            m.overview?.slice(0, 120) || "Novo filme disponível",
            poster,
          );
        }
      }
    }
    addLog(`Filmes verificados: ${movies.length} — ${newCount} novos (não estão no catálogo)`);
  } catch (e: any) {
    addLog(`Erro ao verificar novos filmes: ${e?.message}`);
  }
  return newCount;
}

async function checkNewEpisodes(): Promise<number> {
  let newCount = 0;
  try {
    const data = await tmdbGet("/tv/on_the_air", { page: "1" });
    const shows = (data.results || []).slice(0, 10);
    const showIds: number[] = shows.map((s: any) => s.id);

    // Só notifica séries que estão no nosso catálogo
    const existingIds = await getExistingIds(showIds);

    for (const show of shows) {
      if (!existingIds.has(show.id)) continue;
      try {
        const details = await tmdbGet(`/tv/${show.id}`);
        const lastEp = details.last_episode_to_air;
        if (lastEp?.air_date) {
          const airDate = new Date(lastEp.air_date);
          const daysSinceAir = (Date.now() - airDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceAir <= 1) {
            newCount++;
            const poster = show.poster_path
              ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
              : undefined;
            if (newCount <= 2) {
              await sendPushNotification(
                `📺 Novo Episódio: ${show.name}`,
                `T${lastEp.season_number}·E${lastEp.episode_number} — ${lastEp.name || "Disponível agora"}`,
                poster,
              );
            }
          }
        }
      } catch {}
    }
    addLog(`Séries verificadas: ${existingIds.size} no catálogo de ${shows.length} — ${newCount} com episódio hoje`);
  } catch (e: any) {
    addLog(`Erro ao verificar novos episódios: ${e?.message}`);
  }
  return newCount;
}

async function runCheck() {
  if (state.running) return;
  state.running = true;
  addLog("Iniciando verificação de novos conteúdos...");

  try {
    const [newMovies, newEpisodes] = await Promise.all([
      checkNewMovies(),
      checkNewEpisodes(),
    ]);

    state.lastCheck = Date.now();
    state.lastCheckResult = { newMovies, newEpisodes };
    addLog(`Verificação concluída — ${newMovies} filmes novos detectados, ${newEpisodes} episódios novos`);
  } catch (e: any) {
    addLog(`Erro na verificação geral: ${e?.message}`);
  } finally {
    state.running = false;
    state.nextCheckAt = Date.now() + CHECK_INTERVAL_MS;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startContentTracker() {
  if (timer) return;
  addLog("Rastreador de conteúdo iniciado (intervalo: 6h)");
  // Primeira checagem após 60s (server já totalmente inicializado + DB conexão estabilizada)
  state.nextCheckAt = Date.now() + 60_000;
  setTimeout(() => runCheck(), 60_000);
  timer = setInterval(() => runCheck(), CHECK_INTERVAL_MS);
}

export function stopContentTracker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    addLog("Rastreador parado");
  }
}

export async function runContentTrackerNow() {
  runCheck();
}

export function getContentTrackerState() {
  return { ...state };
}
