const appPromise = import("../artifacts/api-server/dist/vercel/app.mjs").then(
  (m) => m.default,
);

export default function handler(req: any, res: any) {
  appPromise
    .then((app) => app(req, res))
    .catch((err: any) => {
      res
        .status(500)
        .json({ error: "Falha ao inicializar servidor", message: err?.message });
    });
}
