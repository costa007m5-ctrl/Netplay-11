import { Router } from "express";
import { getMysqlPool } from "../lib/mysql";

const router = Router();

async function ensureSettingsTable() {
  try {
    const pool = getMysqlPool();
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch {}
}

router.get("/settings", async (_req, res) => {
  try {
    await ensureSettingsTable();
    const pool = getMysqlPool();
    const [rows] = await pool.execute("SELECT `key`, value FROM settings") as any;
    const result: Record<string, string> = {};
    for (const row of (rows as any[])) {
      result[row.key] = row.value;
    }

    if (!result["betterflix_b2b_key"]) {
      const envKey =
        process.env.BETTERFLIX_API_KEY ||
        process.env.VITE_BETTERFLIX_API_KEY ||
        "";
      if (envKey) result["betterflix_b2b_key"] = envKey;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao buscar configurações" });
  }
});

router.post("/settings", async (req, res) => {
  const updates: Record<string, string> = req.body;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Body inválido" });
    return;
  }
  try {
    await ensureSettingsTable();
    const pool = getMysqlPool();
    for (const [key, value] of Object.entries(updates)) {
      await pool.execute(
        "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()",
        [key, String(value)]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao salvar configurações" });
  }
});

export default router;
