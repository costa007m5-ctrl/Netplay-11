import { Router, type IRouter } from "express";
import axios from "axios";
import { verifyAdminSession } from "../lib/supabase";

const router: IRouter = Router();

router.post("/notifications/send", async (req, res) => {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Authorization header required" });
    return;
  }

  const check = await verifyAdminSession(token);
  if (!check.ok) {
    res.status(401).json({ error: check.reason });
    return;
  }

  const { title, message, imageUrl, targetUrl } = req.body as {
    title?: string;
    message?: string;
    imageUrl?: string;
    targetUrl?: string;
  };

  const appId =
    process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!restApiKey) {
    res.status(503).json({ error: "ONESIGNAL_REST_API_KEY not configured" });
    return;
  }
  if (!appId) {
    res
      .status(503)
      .json({ error: "ONESIGNAL_APP_ID not configured" });
    return;
  }

  const heading = title ?? "NetPremium";
  const content = message ?? "";

  try {
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

    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      payload,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${restApiKey}`,
        },
        timeout: 10000,
      },
    );
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    const details =
      err?.response?.data != null
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message ?? "unknown error";
    res.status(500).json({ error: "Failed to send notification", details });
  }
});

export default router;
