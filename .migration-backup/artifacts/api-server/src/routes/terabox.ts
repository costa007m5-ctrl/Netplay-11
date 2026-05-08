import { Router, type IRouter } from "express";
import axios from "axios";

const router: IRouter = Router();

router.get("/terabox-pro", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  const apiKey = process.env.TERABOX_PRO_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "TERABOX_PRO_API_KEY not configured" });
    return;
  }

  try {
    const response = await axios.post(
      "https://xapiverse.com/api/terabox-pro",
      { url },
      {
        headers: {
          "Content-Type": "application/json",
          "xAPIverse-Key": apiKey,
        },
        timeout: 15000,
      },
    );
    res.json(response.data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    const details =
      err?.response?.data != null
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message ?? "unknown error";
    res.status(500).json({ error: "Failed to fetch from Terabox API", details });
  }
});

export default router;
