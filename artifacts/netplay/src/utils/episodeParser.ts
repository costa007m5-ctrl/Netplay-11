export interface EpisodePattern {
  id: string;
  label: string;
  description: string;
  example: string;
  regexStr: string;
  seasonGroup: number | null;
  episodeGroup: number;
  enabled: boolean;
  builtin: boolean;
}

export const BUILTIN_PATTERNS: EpisodePattern[] = [
  {
    id: 'sxxexx',
    label: 'S01E03 / s1e3',
    description: 'Padrão internacional com S e E',
    example: 'Naruto.S01E03.mkv',
    regexStr: '[Ss](\\d{1,2})[\\s._-]*[Ee](\\d{1,3})',
    seasonGroup: 1,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'xby',
    label: '1x03 / 01x03',
    description: 'Temporada × Episódio separado por x ou ×',
    example: 'Naruto.1x03.mkv',
    regexStr: '(?:^|[^\\dA-Za-z])(\\d{1,2})\\s*[x×X]\\s*(\\d{1,3})(?=[^\\d]|$)',
    seasonGroup: 1,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'txxexx',
    label: 'T01E03 / T1E3',
    description: 'Padrão brasileiro com T (Temporada) e E',
    example: 'Naruto.T01E03.mkv',
    regexStr: '[Tt](\\d{1,2})[\\s._-]*[Ee](\\d{1,3})',
    seasonGroup: 1,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'temp_ep',
    label: 'Temporada 1 Episodio 3',
    description: 'Extenso em português (Temp/Temporada + Ep/Episodio)',
    example: 'Serie Temporada 2 Episodio 5.mkv',
    regexStr: '[Tt]emp(?:orada)?[\\s._-]*(\\d{1,2})[\\s._-]+(?:[Ee]p(?:is[oó]dio)?|EP)[\\s._-]*(\\d{1,3})',
    seasonGroup: 1,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'season_episode',
    label: 'Season 1 Episode 3',
    description: 'Extenso em inglês',
    example: 'Serie Season 1 Episode 3.mkv',
    regexStr: '[Ss]eason[\\s._-]*(\\d{1,2})[\\s._-]+[Ee]pisode[\\s._-]*(\\d{1,3})',
    seasonGroup: 1,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'dot_num',
    label: '1.03 / 01.03 (separadores)',
    description: 'Temporada.Episódio separados por ponto e rodeados de separadores',
    example: 'Serie - 1.03 - Titulo.mkv',
    regexStr: '(?:^|[\\s\\-_\\[(])(\\d{1,2})\\.(\\d{2,3})(?=[\\s\\-_\\])])',
    seasonGroup: 1,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'code_ep',
    label: 'ABC.002 (Código + Episódio)',
    description: 'Prefixo alfabético (código da série) seguido de número de episódio. Ex: DBC.002, XYZ-014. Temporada padrão = 1.',
    example: 'DBC.002.BD1080p.MemoriadaTV.Menor.mkv',
    regexStr: '(?:^|[\\s._-])([A-Za-z]{2,6})[._-]0*(\\d{1,3})(?=[._-]|$)',
    seasonGroup: null,
    episodeGroup: 2,
    enabled: true,
    builtin: true,
  },
  {
    id: 'bare_ep3',
    label: 'E03 / EP03 (só episódio)',
    description: 'Apenas número de episódio com prefixo E ou EP, sem temporada',
    example: 'Serie.EP03.mkv',
    regexStr: '(?:^|[\\s._-])[Ee][Pp]?(\\d{1,3})(?=[\\s._-]|$)',
    seasonGroup: null,
    episodeGroup: 1,
    enabled: true,
    builtin: true,
  },
];

const STORAGE_KEY = 'ep_parser_patterns';

export function getPatterns(): EpisodePattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BUILTIN_PATTERNS;
    const saved: Partial<EpisodePattern>[] = JSON.parse(raw);
    const merged = BUILTIN_PATTERNS.map(bp => {
      const override = saved.find(s => s.id === bp.id);
      if (override) return { ...bp, enabled: override.enabled ?? bp.enabled };
      return bp;
    });
    const customs = saved.filter(s => !s.builtin && s.id && s.regexStr);
    return [...merged, ...(customs as EpisodePattern[])];
  } catch {
    return BUILTIN_PATTERNS;
  }
}

export function savePatterns(patterns: EpisodePattern[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      patterns.map(p => ({ id: p.id, enabled: p.enabled, ...(p.builtin ? {} : p) }))
    ));
  } catch {}
}

export const QUALITY_RE =
  /[\s._-]*(4K|2160p|1080p|720p|480p|360p|240p|UHD|FHD|HDR10?|SDR|HMAX|DSNP|AMZN|PCOK|NF|ATVP|WEB[-.]?DL|WEBRip|BluRay|Blu[-.]?Ray|HDTV|PDTV|DVDRip|BDRip|BRRip|WEB|DD[\d.]+|DDP[\d.]+|AAC[\d.]*|AC3|MP3|DTS[-\w]*|TrueHD|FLAC|x26[45]|H\.?26[45]|HEVC|AVC|REMUX|REPACK|PROPER|DUAL|MULTI|EXTENDED|DIRECTORS|UNRATED|REMASTERED|INTERNAL|RETAIL|LIMITED|COMPLETE|HYBRID).*/i;

export function stripGroupTags(filename: string): string {
  return filename
    .replace(/^[\s._-]*[\(\[][^\)\]]{1,40}[\)\]][\s._-]*/g, '')
    .replace(/[\s._-]*[\(\[][^\)\]]{1,40}[\)\]][\s._-]*$/g, '')
    .trim();
}

export function parseSeasonEpisode(
  filename: string,
  patterns?: EpisodePattern[]
): { season: number; episode: number } | null {
  if (!filename) return null;
  const name = filename.replace(/\.(mkv|mp4|avi|mov|webm|m4v|wmv|flv|ts|m3u8)$/i, '');
  const active = (patterns ?? getPatterns()).filter(p => p.enabled);

  for (const pat of active) {
    try {
      const re = new RegExp(pat.regexStr, 'i');
      const m = name.match(re);
      if (!m) continue;
      const eIdx = pat.episodeGroup;
      const sIdx = pat.seasonGroup;
      const e = parseInt(m[eIdx], 10);
      const s = sIdx !== null ? parseInt(m[sIdx], 10) : 1;
      if (e >= 1 && e <= 999 && s >= 0 && s <= 50) {
        return { season: s || 1, episode: e };
      }
    } catch {}
  }
  return null;
}

export function parseEpisodeName(filename: string): string | null {
  if (!filename) return null;
  let name = filename.replace(/\.(mkv|mp4|avi|mov|webm|m4v|wmv|flv|ts|m3u8|m2ts|vob|mpg|mpeg)$/i, '');
  name = stripGroupTags(name);

  const seMatch = name.match(/[SsTt]\d{1,2}[\s._-]*[Ee]\d{1,3}[\s._-]+(.*)/);
  if (seMatch) {
    const afterSE = seMatch[1].replace(QUALITY_RE, '');
    const cleaned = afterSE.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 2) return cleaned;
  }

  const fullCleaned = name.replace(QUALITY_RE, '').replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  return fullCleaned.length >= 2 ? fullCleaned : null;
}
