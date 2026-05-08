import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).trim();

const supabaseServiceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();

export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function verifyAdminSession(
  bearerToken: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  if (!supabaseAdmin) {
    return { ok: false, reason: "Supabase admin client not configured" };
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(bearerToken);

  if (userError || !userData.user) {
    return { ok: false, reason: "Invalid or expired session token" };
  }

  const email = userData.user.email;
  if (!email) {
    return { ok: false, reason: "User has no email" };
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (adminError) {
    return { ok: false, reason: "Failed to verify admin status" };
  }
  if (!adminRow) {
    return { ok: false, reason: "User is not an admin" };
  }

  return { ok: true, email };
}
