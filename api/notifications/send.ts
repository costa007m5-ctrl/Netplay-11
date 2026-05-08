import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Thin wrapper around Supabase REST — no SDK, no TS type conflicts. */
async function supabaseGet(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  userToken?: string,
): Promise<{ ok: boolean; data: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${userToken ?? serviceKey}`,
  };
  const res = await fetch(`${supabaseUrl}${path}`, { headers });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = (req.headers["authorization"] as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Authorization header required" });

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl) return res.status(503).json({ error: "SUPABASE_URL not configured" });
  if (!serviceKey) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });

  // 1. Verify the user JWT via Supabase Auth REST (GET /auth/v1/user with user token)
  const authResult = await supabaseGet(supabaseUrl, serviceKey, "/auth/v1/user", token);
  if (!authResult.ok) return res.status(401).json({ error: "Invalid or expired session" });

  const userId = (authResult.data as { id?: string } | null)?.id;
  if (!userId) return res.status(401).json({ error: "Could not identify user" });

  // 2. Check admin_users table via PostgREST (service key bypasses RLS)
  const adminResult = await supabaseGet(
    supabaseUrl,
    serviceKey,
    `/rest/v1/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
  );
  const rows = Array.isArray(adminResult.data) ? adminResult.data : [];
  if (!rows.length) return res.status(403).json({ error: "Not an admin" });

  // 3. Send OneSignal notification
  const appId = process.env.ONESIGNAL_APP_ID ?? process.env.VITE_ONESIGNAL_APP_ID ?? "";
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY ?? "";
  if (!restApiKey) return res.status(503).json({ error: "ONESIGNAL_REST_API_KEY not configured" });
  if (!appId) return res.status(503).json({ error: "ONESIGNAL_APP_ID not configured" });

  const { title, message, imageUrl, targetUrl } = (req.body as Record<string, string>) ?? {};
  const heading = title ?? "NetPremium";
  const content = message ?? "";

  const payload: Record<string, unknown> = {
    app_id: appId,
    included_segments: ["Subscribed Users", "All"],
    headings: { en: heading, pt: heading },
    contents: { en: content, pt: content },
  };
  if (targetUrl) payload.url = targetUrl;
  if (imageUrl) {
    payload.big_picture = imageUrl;
    payload.chrome_web_image = imageUrl;
  }

  try {
    const upstream = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const data = await upstream.json();
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return res.status(500).json({ error: "Failed to send notification", details: msg });
  }
}
