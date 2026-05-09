const DYNAMIC_REF_PREFIX = 'terabox-folder://';
const SEPARATOR = '###';

export function isDynamicRef(url: string | undefined): boolean {
  return !!url && url.startsWith(DYNAMIC_REF_PREFIX);
}

export function makeDynamicRef(folderUrl: string, filename: string): string {
  return `${DYNAMIC_REF_PREFIX}${folderUrl}${SEPARATOR}${filename}`;
}

export function parseDynamicRef(url: string): { folderUrl: string; filename: string } {
  const raw = url.slice(DYNAMIC_REF_PREFIX.length);
  const sepIdx = raw.indexOf(SEPARATOR);
  if (sepIdx === -1) return { folderUrl: raw, filename: '' };
  return {
    folderUrl: raw.slice(0, sepIdx),
    filename: raw.slice(sepIdx + SEPARATOR.length),
  };
}

export function getDynamicRefFilename(url: string): string {
  return parseDynamicRef(url).filename;
}

function pickBestUrl(file: any): string | null {
  return (
    file?.fast_stream_url?.['1080p'] ||
    file?.fast_stream_url?.['720p'] ||
    file?.fast_stream_url?.['480p'] ||
    file?.fast_stream_url?.['360p'] ||
    file?.normal_dlink ||
    file?.stream_url ||
    file?.dlink ||
    null
  );
}

export async function resolveTeraboxUrl(url: string): Promise<string> {
  if (!url || !isDynamicRef(url)) return url;

  const { folderUrl, filename } = parseDynamicRef(url);
  const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(folderUrl)}`);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do servidor Terabox (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Failed to resolve Terabox link (${res.status})`);
  }

  const list: any[] = Array.isArray(data.list) ? data.list : [];

  let file: any = null;
  if (filename) {
    file =
      list.find((f: any) => f.filename === filename) ||
      list.find((f: any) => f.name === filename) ||
      list.find((f: any) =>
        (f.filename || f.name || '').toLowerCase() === filename.toLowerCase()
      );
  }
  if (!file && list.length > 0) file = list[0];

  if (!file) {
    throw new Error(`Arquivo "${filename}" não encontrado na pasta do Terabox.`);
  }

  const resolved = pickBestUrl(file);
  if (!resolved) {
    throw new Error(`Nenhum link de stream encontrado para o arquivo "${filename}".`);
  }

  return resolved;
}
