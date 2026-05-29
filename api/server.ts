const appPromise = import("../artifacts/api-server/src/app.js").then(
  (m) => m.default,
);

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
