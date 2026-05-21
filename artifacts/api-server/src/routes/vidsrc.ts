import { Router } from "express";
import axios from "axios";

const router = Router();

const VIDSRC_DOMAINS = [
  "vidsrc-embed.ru",
  "vidsrc-embed.su",
  "vidsrcme.su",
  "vsrc.su",
];

async function fetchLatestFromDomain(
  domain: string,
  type: "movies" | "tvshows" | "episodes",
  page: number
): Promise<any[]> {
  const url = `https://${domain}/${type}/latest/page-${page}.json`;
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: `https://${domain}/`,
    },
  });
  return Array.isArray(data) ? data : data?.result || [];
}

router.get("/vidsrc/latest", async (req, res) => {
  const type = (req.query.type as string) || "movies";
  const page = Number(req.query.page) || 1;
  const domainParam = req.query.domain as string | undefined;

  if (!["movies", "tvshows", "episodes"].includes(type)) {
    res.status(400).json({ error: "type deve ser movies, tvshows ou episodes" });
    return;
  }

  const domains = domainParam
    ? [domainParam, ...VIDSRC_DOMAINS.filter((d) => d !== domainParam)]
    : VIDSRC_DOMAINS;

  for (const domain of domains) {
    try {
      const results = await fetchLatestFromDomain(
        domain,
        type as "movies" | "tvshows" | "episodes",
        page
      );
      res.json({ domain, results });
      return;
    } catch {
      // tenta próximo domínio
    }
  }

  res.status(502).json({ error: "Todos os domínios Vidsrc falharam" });
});

export default router;
