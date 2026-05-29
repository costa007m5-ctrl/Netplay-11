import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
  if (!pool) {
    // Usa sempre o proxy público do Railway (funciona de qualquer ambiente externo)
    const host = "zephyr.proxy.rlwy.net";
    const port = 47257;
    const user = process.env.MYSQL_USER || "root";
    const password = process.env.MYSQL_PASSWORD;
    const database = process.env.MYSQL_DATABASE || "railway";

    if (!password) {
      throw new Error("MYSQL_PASSWORD não configurada.");
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function testMysqlConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const p = getMysqlPool();
    const [rows] = await p.execute("SELECT 1 AS ok");
    return { ok: true, message: "Conexão com MySQL Railway OK" };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Erro ao conectar" };
  }
}
