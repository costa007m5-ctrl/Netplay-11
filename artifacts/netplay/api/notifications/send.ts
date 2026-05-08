import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Call Supabase REST API directly — no SDK, no TS type conflicts. */
async function supabaseRequest(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
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

  // 1. Verify the user's JWT and get their user ID via Supabase Auth REST API.
  //    POST /auth/v1/token with the access token returns the user object.
  const authRes = await supabaseRequest(supabaseUrl, serviceKey, "/auth/v1/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!authRes.ok) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const authUser = authRes.data as { id?: string } | null;
  const userId = authUser?.id;
  if (!userId) return res.status(401).json({ error: "Could not identify user" });

  // 2. Check if the user is in admin_users table via Supabase PostgREST.
  const adminRes = await supabaseRequest(
    supabaseUrl,
    serviceKey,
    `/rest/v1/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
  );

  const adminRows = Array.isArray(adminRes.data) ? adminRes.data : [];
  if (!adminRows.length) return res.status(403).json({ error: "Not an admin" });

  // 3. Send the OneSignal notification.
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
