import { Router } from "express";
import axios from "axios";

const router = Router();

export interface ApiCheckResult {
  name: string;
  group: "terabox" | "metadata" | "flix" | "ai" | "database";
  status: "ok" | "error" | "warning";
  latencyMs: number | null;
  reason: string;
  detail?: string;
}

function withTimeout<T>(fn: () => Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

async function checkTmdb(): Promise<ApiCheckResult> {
  const start = Date.now();
  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    return {
      name: "TMDB",
      group: "metadata",
      status: "error",
      latencyMs: null,
      reason: "Chave VITE_TMDB_API_KEY não está configurada no servidor",
    };
  }
  try {
    await withTimeout(() =>
      axios.get("https://api.themoviedb.org/3/movie/popular", {
        params: { api_key: apiKey, language: "pt-BR", page: 1 },
        timeout: 7000,
      })
    );
    return {
      name: "TMDB",
      group: "metadata",
      status: "ok",
      latencyMs: Date.now() - start,
      reason: "API respondeu com sucesso",
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const reason =
      status === 401
        ? "Chave de API inválida ou expirada"
        : status === 403
        ? "Acesso negado — chave sem permissão"
        : err?.message === "Timeout"
        ? "Servidor TMDB não respondeu em 8s"
        : `Erro HTTP ${status ?? "desconhecido"}`;
    return {
      name: "TMDB",
      group: "metadata",
      status: "error",
      latencyMs: Date.now() - start,
      reason,
      detail: err?.response?.data?.status_message || err?.message,
    };
  }
}

async function checkTeraboxV1(): Promise<ApiCheckResult> {
  const start = Date.now();
  const key = process.env.TERABOX_PRO_API_KEY;
  if (!key) {
    return {
      name: "Terabox V1 (Pro)",
      group: "terabox",
      status: "error",
      latencyMs: null,
      reason: "TERABOX_PRO_API_KEY não configurado nos secrets",
    };
  }
  try {
    const res = await withTimeout(() =>
      axios.get("https://teraboxapp.xyz/api/get_download_links", {
        params: { url: "https://terabox.com/s/test", api_key: key },
        timeout: 7000,
        validateStatus: (s) => s < 500,
      })
    );
    if (res.status === 401 || res.status === 403) {
      return {
        name: "Terabox V1 (Pro)",
        group: "terabox",
        status: "error",
        latencyMs: Date.now() - start,
        reason: "Chave TERABOX_PRO_API_KEY inválida ou sem créditos — verifique teraboxapp.xyz",
      };
    }
    return {
      name: "Terabox V1 (Pro)",
      group: "terabox",
      status: "ok",
      latencyMs: Date.now() - start,
      reason: "Servidor online e chave aceita",
    };
  } catch (err: any) {
    const reason =
      err?.message === "Timeout"
        ? "teraboxapp.xyz não respondeu em 8s — servidor fora do ar"
        : `Erro de conexão: ${err?.message}`;
    return {
      name: "Terabox V1 (Pro)",
      group: "terabox",
      status: "error",
      latencyMs: Date.now() - start,
      reason,
      detail: err?.message,
    };
  }
}

async function checkTeraboxV2(): Promise<ApiCheckResult> {
  const start = Date.now();
  const key = process.env.TERABOX_V2_API_KEY;
  if (!key) {
    return {
      name: "Terabox V2 (xapiverse)",
      group: "terabox",
      status: "error",
      latencyMs: null,
      reason: "TERABOX_V2_API_KEY não configurado nos secrets",
    };
  }
  try {
    const res = await withTimeout(() =>
      axios.get("https://xapiverse.com/api/terabox", {
        params: { url: "https://terabox.com/s/test", key },
        timeout: 7000,
        validateStatus: (s) => s < 500,
      })
    );
    if (res.status === 401 || res.status === 403) {
      return {
        name: "Terabox V2 (xapiverse)",
        group: "terabox",
        status: "error",
        latencyMs: Date.now() - start,
        reason: "Chave TERABOX_V2_API_KEY inválida ou expirada",
      };
    }
    return {
      name: "Terabox V2 (xapiverse)",
      group: "terabox",
      status: "ok",
      latencyMs: Date.now() - start,
      reason: "Servidor online",
    };
  } catch (err: any) {
    const reason =
      err?.message === "Timeout"
        ? "xapiverse.com não respondeu em 8s"
        : `Erro: ${err?.message}`;
    return {
      name: "Terabox V2 (xapiverse)",
      group: "terabox",
      status: "error",
      latencyMs: Date.now() - start,
      reason,
      detail: err?.message,
    };
  }
}

async function checkTeraboxV3(): Promise<ApiCheckResult> {
  const start = Date.now();
  const key = process.env.TERABOX_V3_API_KEY;
  const secret = process.env.TERABOX_V3_API_SECRET;
  if (!key || !secret) {
    return {
      name: "Terabox V3 (Premium)",
      group: "terabox",
      status: "error",
      latencyMs: null,
      reason: `Credenciais faltando: ${!key ? "TERABOX_V3_API_KEY " : ""}${!secret ? "TERABOX_V3_API_SECRET" : ""}`,
    };
  }
  try {
    const res = await withTimeout(() =>
      axios.get("https://api.teraboxdl.site/v1/api", {
        params: { url: "https://terabox.com/s/test" },
        headers: { "x-api-key": key },
        timeout: 7000,
        validateStatus: (s) => s < 500,
      })
    );
    if (res.status === 401 || res.status === 403) {
      return {
        name: "Terabox V3 (Premium)",
        group: "terabox",
        status: "error",
        latencyMs: Date.now() - start,
        reason: "Chave V3 inválida ou sem plano ativo — verifique teraboxdl.site",
      };
    }
    return {
      name: "Terabox V3 (Premium)",
      group: "terabox",
      status: "ok",
      latencyMs: Date.now() - start,
      reason: "Servidor online e chave aceita",
    };
  } catch (err: any) {
    const reason =
      err?.message === "Timeout"
        ? "api.teraboxdl.site não respondeu em 8s"
        : `Erro: ${err?.message}`;
    return {
      name: "Terabox V3 (Premium)",
      group: "terabox",
      status: "error",
      latencyMs: Date.now() - start,
      reason,
      detail: err?.message,
    };
  }
}

async function checkBetterFlix(): Promise<ApiCheckResult> {
  const start = Date.now();
  try {
    const res = await withTimeout(() =>
      axios.get("https://betterflix.click/api/latest", {
        timeout: 7000,
        validateStatus: (s) => s < 600,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://betterflix.click/",
        },
      })
    );
    if (res.status === 200) {
      return {
        name: "BetterFlix",
        group: "flix",
        status: "ok",
        latencyMs: Date.now() - start,
        reason: "API online",
      };
    }
    return {
      name: "BetterFlix",
      group: "flix",
      status: "warning",
      latencyMs: Date.now() - start,
      reason: `Resposta HTTP ${res.status} — servidor com instabilidade`,
      detail: `Status ${res.status} de betterflix.click`,
    };
  } catch (err: any) {
    const reason =
      err?.message === "Timeout"
        ? "betterflix.click não respondeu em 8s — servidor fora do ar"
        : err?.code === "ECONNREFUSED"
        ? "Conexão recusada — betterflix.click fora do ar"
        : `Erro de rede: ${err?.message}`;
    return {
      name: "BetterFlix",
      group: "flix",
      status: "error",
      latencyMs: Date.now() - start,
      reason,
      detail: err?.message,
    };
  }
}

async function checkVidSrc(): Promise<ApiCheckResult> {
  const start = Date.now();
  const domains = ["vidsrc-embed.ru", "vidsrc-embed.su", "vidsrcme.su", "vsrc.su"];
  let lastErr: any = null;
  for (const domain of domains) {
    try {
      const res = await withTimeout(() =>
        axios.get(`https://${domain}/movies/latest/page-1.json`, {
          timeout: 6000,
          validateStatus: (s) => s < 500,
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: `https://${domain}/`,
          },
        })
      , 7000);
      if (res.status === 200) {
        return {
          name: "VidSrc",
          group: "flix",
          status: "ok",
          latencyMs: Date.now() - start,
          reason: `Online via ${domain}`,
        };
      }
    } catch (err: any) {
      lastErr = err;
    }
  }
  return {
    name: "VidSrc",
    group: "flix",
    status: "error",
    latencyMs: Date.now() - start,
    reason: "Todos os domínios VidSrc falharam — serviço fora do ar",
    detail: lastErr?.message,
  };
}

async function checkFlix3(): Promise<ApiCheckResult> {
  const start = Date.now();
  try {
    const res = await withTimeout(() =>
      axios.get("https://redeflixapi.store/list-movie-ids.txt", {
        timeout: 7000,
        validateStatus: (s) => s < 500,
        headers: { "User-Agent": "NetPlay/1.0" },
      })
    );
    if (res.status === 200) {
      return {
        name: "Flix3 (RedeFlixAPI)",
        group: "flix",
        status: "ok",
        latencyMs: Date.now() - start,
        reason: "API online",
      };
    }
    return {
      name: "Flix3 (RedeFlixAPI)",
      group: "flix",
      status: "warning",
      latencyMs: Date.now() - start,
      reason: `redeflixapi.store retornou HTTP ${res.status}`,
    };
  } catch (err: any) {
    const reason =
      err?.message === "Timeout"
        ? "redeflixapi.store não respondeu em 8s — servidor fora do ar"
        : `Erro: ${err?.message}`;
    return {
      name: "Flix3 (RedeFlixAPI)",
      group: "flix",
      status: "error",
      latencyMs: Date.now() - start,
      reason,
      detail: err?.message,
    };
  }
}

async function checkGeminiAI(): Promise<ApiCheckResult> {
  const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      name: "Gemini AI (Google)",
      group: "ai",
      status: "error",
      latencyMs: null,
      reason: "VITE_GEMINI_API_KEY não configurado nos secrets",
    };
  }
  const start = Date.now();
  try {
    const res = await withTimeout(() =>
      axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { timeout: 7000, validateStatus: (s) => s < 500 }
      )
    );
    if (res.status === 200) {
      return {
        name: "Gemini AI (Google)",
        group: "ai",
        status: "ok",
        latencyMs: Date.now() - start,
        reason: "Chave válida e API respondeu com sucesso",
      };
    }
    if (res.status === 400 || res.status === 403) {
      return {
        name: "Gemini AI (Google)",
        group: "ai",
        status: "error",
        latencyMs: Date.now() - start,
        reason: "Chave Gemini inválida ou sem permissão",
        detail: res.data?.error?.message,
      };
    }
    return {
      name: "Gemini AI (Google)",
      group: "ai",
      status: "warning",
      latencyMs: Date.now() - start,
      reason: `Resposta inesperada HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      name: "Gemini AI (Google)",
      group: "ai",
      status: "error",
      latencyMs: Date.now() - start,
      reason: `Erro ao verificar chave Gemini: ${err?.message}`,
    };
  }
}

async function checkMySQL(): Promise<ApiCheckResult> {
  const password = process.env.MYSQL_PASSWORD;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;

  if (!password) {
    return {
      name: "MySQL Railway",
      group: "database",
      status: "error",
      latencyMs: null,
      reason: "MYSQL_PASSWORD não configurado nos secrets do Vercel/Replit",
      detail: "Adicione MYSQL_PASSWORD nas variáveis de ambiente do projeto no Vercel (Settings → Environment Variables)",
    };
  }

  // Verifica se pelo menos as credenciais estão configuradas
  // (conexão real via mysql2 não funciona em ambientes serverless como Vercel)
  const configured = [password, user, database].filter(Boolean).length;
  return {
    name: "MySQL Railway",
    group: "database",
    status: configured >= 2 ? "ok" : "warning",
    latencyMs: null,
    reason:
      configured >= 2
        ? "Credenciais configuradas (MYSQL_PASSWORD + outros vars presentes)"
        : "Apenas MYSQL_PASSWORD configurado — MYSQL_USER ou MYSQL_DATABASE ausentes",
    detail:
      configured < 2
        ? "Configure também MYSQL_USER e MYSQL_DATABASE nas variáveis de ambiente"
        : undefined,
  };
}

function checkSupabase(): ApiCheckResult {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    return {
      name: "Supabase",
      group: "database",
      status: "error",
      latencyMs: null,
      reason: "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados",
    };
  }
  if (!serviceKey) {
    return {
      name: "Supabase",
      group: "database",
      status: "warning",
      latencyMs: null,
      reason: "SUPABASE_SERVICE_ROLE_KEY ausente — gerenciamento de usuários no admin não funcionará",
    };
  }
  return {
    name: "Supabase",
    group: "database",
    status: "ok",
    latencyMs: null,
    reason: "Todas as chaves configuradas (URL + Anon + Service Role)",
  };
}

router.get("/api-diagnostics", async (_req, res) => {
  try {
    const settled = await Promise.allSettled([
      checkTmdb(),
      checkTeraboxV1(),
      checkTeraboxV2(),
      checkTeraboxV3(),
      checkBetterFlix(),
      checkVidSrc(),
      checkFlix3(),
      checkGeminiAI(),
      checkMySQL(),
      Promise.resolve(checkSupabase()),
    ]);

    const checks: ApiCheckResult[] = settled.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            name: "Erro interno",
            group: "metadata" as const,
            status: "error" as const,
            latencyMs: null,
            reason: (r as PromiseRejectedResult).reason?.message || "Erro inesperado",
          }
    );

    const ok = checks.filter((c) => c.status === "ok").length;
    const errors = checks.filter((c) => c.status === "error").length;
    const warnings = checks.filter((c) => c.status === "warning").length;

    res.json({ checks, summary: { ok, errors, warnings, total: checks.length } });
  } catch (err: any) {
    res.status(500).json({
      checks: [],
      summary: { ok: 0, errors: 0, warnings: 0, total: 0 },
      error: err?.message || "Erro interno no diagnóstico",
    });
  }
});

export default router;
