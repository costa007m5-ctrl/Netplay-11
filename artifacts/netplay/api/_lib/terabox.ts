import axios from "axios";

const teraboxCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(url: string): any | null {
  const entry = teraboxCache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    teraboxCache.delete(url);
    return null;
  }
  return entry.data;
}

function setCached(url: string, data: any) {
  teraboxCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function pickBestUrl(file: any): string | null {
  return (
    file?.fast_stream_url?.["1080p"] ||
    file?.fast_stream_url?.["720p"] ||
    file?.fast_stream_url?.["480p"] ||
    file?.fast_stream_url?.["360p"] ||
    file?.normal_dlink ||
    file?.stream_url ||
    file?.url ||
    file?.dlink ||
    null
  );
}

export async function callTeraboxApi(url: string, apiKey: string) {
  const cached = getCached(url);
  if (cached) return cached;

  const response = await axios.post(
    "https://xapiverse.com/api/terabox-pro",
    { url },
    {
      headers: {
        "Content-Type": "application/json",
        "xAPIverse-Key": apiKey,
      },
      timeout: 50000,
    },
  );

  if (response.data?.status !== "error") {
    setCached(url, response.data);
  }

  return response.data;
}

export function extractErrorDetails(error: any): string {
  if (error?.response?.data != null) {
    return typeof error.response.data === "string"
      ? error.response.data
      : JSON.stringify(error.response.data);
  }
  return error?.message ?? "unknown error";
}
