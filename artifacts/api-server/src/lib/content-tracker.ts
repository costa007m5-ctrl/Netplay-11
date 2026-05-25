import axios from "axios";
import { logger } from "./logger";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.VITE_TMDB_API_KEY;
const ONESIGNAL_APP_ID = process.env.VITE_ONESIGNAL_APP_ID || "581f23c1-2b57-4646-8780-6cd2ccbba30e";
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY;

// Supabase REST (sem Drizzle — funciona em background services)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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
  const url = new URL(`${TMDB_BASE}${path}`);
  Object.entries({ api_key: TMDB_KEY, language: "pt-BR", ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await axios.get(url.toString(), { timeout: 12000 });
  return res.data;
}

// Verifica quais IDs TMDB já existem no Supabase via REST API
async function getExistingIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0 || !SUPABASE_URL || !SUPABASE_KEY) return new Set();
  try {
    const url = `${SUPABASE_URL}/rest/v1/movies?select=id&id=in.(${ids.join(",")})`;
    const res = await axios.get(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: "application/json",
      },
      timeout: 10000,
    });
    const rows: { id: number }[] = res.data || [];
    return new Set(rows.map((r) => r.id));
  } catch (e: any) {
    addLog(`Erro ao consultar IDs no Supabase: ${e?.message}`);
    return new Set();
  }
}

async function sendPushNotification(title: string, body: string, imageUrl?: string) {
  if (!ONESIGNAL_REST_KEY) {
    addLog(`[push] Chave REST OneSignal ausente — pulando: "${title}"`);
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
      headers: { "Content-Type": "application/json", Authorization: `Basic ${ONESIGNAL_REST_KEY}` },
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
        if (newCount <= 1) {
          const poster = m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : undefined;
          await sendPushNotification(
            `🎬 Novo Lançamento: ${m.title}`,
            m.overview?.slice(0, 120) || "Novo filme disponível",
            poster,
          );
        }
      }
    }
    addLog(`Filmes: ${movies.length} verificados — ${newCount} fora do catálogo`);
  } catch (e: any) {
    addLog(`Erro ao verificar filmes: ${e?.message}`);
  }
  return newCount;
}

async function checkNewEpisodes(): Promise<number> {
  let newCount = 0;
  try {
    const data = await tmdbGet("/tv/on_the_air", { page: "1" });
    const shows = (data.results || []).slice(0, 10);
    const showIds: number[] = shows.map((s: any) => s.id);
    const existingIds = await getExistingIds(showIds);

    for (const show of shows) {
      if (!existingIds.has(show.id)) continue;
      try {
        const details = await tmdbGet(`/tv/${show.id}`);
        const lastEp = details.last_episode_to_air;
        if (lastEp?.air_date) {
          const daysSince = (Date.now() - new Date(lastEp.air_date).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince <= 1) {
            newCount++;
            if (newCount <= 2) {
              const poster = show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : undefined;
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
    addLog(`Séries: ${existingIds.size} no catálogo de ${shows.length} — ${newCount} com ep hoje`);
  } catch (e: any) {
    addLog(`Erro ao verificar séries: ${e?.message}`);
  }
  return newCount;
}

async function runCheck() {
  if (state.running) return;
  state.running = true;
  addLog("Iniciando verificação de novos conteúdos...");
  try {
    const [newMovies, newEpisodes] = await Promise.all([checkNewMovies(), checkNewEpisodes()]);
    state.lastCheck = Date.now();
    state.lastCheckResult = { newMovies, newEpisodes };
    addLog(`Concluído — ${newMovies} filmes novos, ${newEpisodes} episódios novos`);
  } catch (e: any) {
    addLog(`Erro geral: ${e?.message}`);
  } finally {
    state.running = false;
    state.nextCheckAt = Date.now() + CHECK_INTERVAL_MS;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startContentTracker() {
  if (timer) return;
  addLog("Rastreador iniciado — verificação a cada 6h");
  // Primeira checagem 90s após o servidor iniciar
  state.nextCheckAt = Date.now() + 90_000;
  setTimeout(() => runCheck(), 90_000);
  timer = setInterval(() => runCheck(), CHECK_INTERVAL_MS);
}

export function stopContentTracker() {
  if (timer) { clearInterval(timer); timer = null; addLog("Rastreador parado"); }
}

export async function runContentTrackerNow() { runCheck(); }

export function getContentTrackerState() { return { ...state }; }
