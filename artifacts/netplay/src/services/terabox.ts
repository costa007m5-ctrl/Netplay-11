const DYNAMIC_REF_PREFIX = 'terabox-folder://';
const DYNAMIC_REF_PREFIX_V2 = 'terabox-folder-v2://';
const SEPARATOR = '###';

export function isDynamicRef(url: string | undefined): boolean {
  return !!url && (url.startsWith(DYNAMIC_REF_PREFIX) || url.startsWith(DYNAMIC_REF_PREFIX_V2));
}

export function isDynamicRefV2(url: string | undefined): boolean {
  return !!url && url.startsWith(DYNAMIC_REF_PREFIX_V2);
}

export function makeDynamicRef(folderUrl: string, filename: string): string {
  return `${DYNAMIC_REF_PREFIX}${folderUrl}${SEPARATOR}${filename}`;
}

export function makeDynamicRefV2(folderUrl: string, filename: string): string {
  return `${DYNAMIC_REF_PREFIX_V2}${folderUrl}${SEPARATOR}${filename}`;
}

export function parseDynamicRef(url: string): { folderUrl: string; filename: string; v2: boolean } {
  const v2 = url.startsWith(DYNAMIC_REF_PREFIX_V2);
  const prefix = v2 ? DYNAMIC_REF_PREFIX_V2 : DYNAMIC_REF_PREFIX;
  const raw = url.slice(prefix.length);
  const sepIdx = raw.indexOf(SEPARATOR);
  if (sepIdx === -1) return { folderUrl: raw, filename: '', v2 };
  return {
    folderUrl: raw.slice(0, sepIdx),
    filename: raw.slice(sepIdx + SEPARATOR.length),
    v2,
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

  const { folderUrl, filename, v2 } = parseDynamicRef(url);
  const endpoint = v2 ? '/api/terabox-v2' : '/api/terabox-pro';
  const res = await fetch(`${endpoint}?url=${encodeURIComponent(folderUrl)}`);
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

  if (list.length === 0) {
    const totalFiles = typeof data.total_files === 'number' ? data.total_files : 0;
    throw new Error(
      `Terabox não conseguiu ler nenhum arquivo deste link (total: ${totalFiles}). ` +
      `O link pode ter expirado, sido removido pelo dono, ou ser privado. Tente outro link.`
    );
  }

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
