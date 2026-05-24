import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
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
    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(settingsTable)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: String(value), updated_at: new Date() },
        });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao salvar configurações" });
  }
});

export default router;
