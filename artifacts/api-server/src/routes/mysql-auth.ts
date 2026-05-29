import { Router } from "express";
import bcrypt from "bcryptjs";
import { getMysqlPool } from "../lib/mysql";

const router = Router();

router.post("/mysql/auth/register", async (req, res) => {
  const { email, password, name, whatsapp } = req.body as {
    email: string; password: string; name?: string; whatsapp?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }

  try {
    const pool = getMysqlPool();
    const [[existing]] = await pool.execute(
      "SELECT id FROM users WHERE email = ?", [email]
    ) as any;

    if (existing) {
      res.status(409).json({ error: "Email já cadastrado neste banco" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const id = `mysql_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await pool.execute(
      `INSERT INTO users (id, email, name, whatsapp, plan, is_admin, password_hash)
       VALUES (?, ?, ?, ?, 'free', FALSE, ?)`,
      [id, email, name || null, whatsapp || null, hash]
    );

    res.json({
      success: true,
      user: { id, email, name: name || null, plan: "free", is_admin: false },
    });
  } catch (err: any) {
    if (err?.code === "ER_NO_SUCH_TABLE" || err?.message?.includes("password_hash")) {
      res.status(503).json({ error: "Tabelas ainda não criadas. Acesse Admin 2.0 e rode a migração primeiro." });
    } else {
      res.status(500).json({ error: err?.message || "Erro ao cadastrar" });
    }
  }
});

router.post("/mysql/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }

  try {
    const pool = getMysqlPool();
    const [[user]] = await pool.execute(
      "SELECT id, email, name, plan, is_admin, password_hash FROM users WHERE email = ?",
      [email]
    ) as any;

    if (!user) {
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash || "");
    if (!valid) {
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        is_admin: !!user.is_admin,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao autenticar" });
  }
});

export default router;
