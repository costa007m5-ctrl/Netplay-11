import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = (req.headers["authorization"] as string) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Authorization header required" });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !anonKey) {
    return res.status(503).json({ error: "SUPABASE_URL / SUPABASE_ANON_KEY not configured" });
  }
  if (!serviceKey) {
    return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  // Verify the JWT using the anon-key client (GoTrueClient.getUser accepts a JWT)
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  // Check admin_users table using the service-role client (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("id")
    .eq("user_id", userData.user.id)
    .single();

  if (!adminRow) return res.status(403).json({ error: "Not an admin" });

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
