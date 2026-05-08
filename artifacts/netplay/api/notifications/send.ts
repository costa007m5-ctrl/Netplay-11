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

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "Supabase env vars not configured" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", userData.user.id)
    .single();

  if (!adminRow) return res.status(403).json({ error: "Not an admin" });

  const appId =
    process.env.ONESIGNAL_APP_ID ?? process.env.VITE_ONESIGNAL_APP_ID ?? "";
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY ?? "";

  if (!restApiKey) return res.status(503).json({ error: "ONESIGNAL_REST_API_KEY not configured" });
  if (!appId) return res.status(503).json({ error: "ONESIGNAL_APP_ID not configured" });

  const { title, message, imageUrl, targetUrl } = req.body ?? {};
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
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to send notification", details: err.message });
  }
}
