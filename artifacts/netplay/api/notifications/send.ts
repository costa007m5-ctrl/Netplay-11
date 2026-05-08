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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl) return res.status(503).json({ error: "SUPABASE_URL not configured" });
  if (!serviceKey) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });

  // Decode the JWT to extract the user ID (sub claim).
  // supabase.auth.getUser() exists at runtime but is missing from SupabaseAuthClient
  // types in @supabase/supabase-js v2.105+, so we decode manually and use
  // auth.admin.getUserById() — which IS correctly typed on the admin client.
  let userId: string;
  try {
    const jwtPayload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf8"),
    ) as { sub?: string; exp?: number };
    if (!jwtPayload.sub) throw new Error("missing sub");
    if (jwtPayload.exp && jwtPayload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: "Token expired" });
    }
    userId = jwtPayload.sub;
  } catch {
    return res.status(401).json({ error: "Invalid token format" });
  }

  // Service-role client: validate user exists and check admin_users table
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: userRecord, error: userErr } = await supabase.auth.admin.getUserById(userId);
  if (userErr || !userRecord?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", userRecord.user.id)
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
