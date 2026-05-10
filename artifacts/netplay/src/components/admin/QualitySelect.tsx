import React, { useEffect, useState } from 'react';
import { isDynamicRef, isDynamicRefV2, isDynamicRefV3, parseDynamicRef } from '../../services/terabox';

const qualityCache = new Map<string, { qualities: string[]; hasDirect: boolean }>();
const inflight = new Map<string, Promise<{ qualities: string[]; hasDirect: boolean }>>();

function looksLikeTerabox(url: string): boolean {
  return /terabox|1024tera|teraboxapp|dubox|momerybox|4funbox|mirrobox/i.test(url);
}

interface ResolvedTarget {
  api: '/api/terabox-pro' | '/api/terabox-v2' | '/api/terabox-v3';
  folderUrl: string;
  filename?: string;
}

function resolveTarget(url: string): ResolvedTarget | null {
  if (!url) return null;
  if (isDynamicRef(url)) {
    const { folderUrl, filename, v2, v3 } = parseDynamicRef(url);
    const api = v3 ? '/api/terabox-v3' : v2 ? '/api/terabox-v2' : '/api/terabox-pro';
    return { api, folderUrl, filename };
  }
  if (looksLikeTerabox(url)) {
    return { api: '/api/terabox-pro', folderUrl: url };
  }
  return null;
}

async function fetchQualities(target: ResolvedTarget): Promise<{ qualities: string[]; hasDirect: boolean }> {
  const cacheKey = `${target.api}|${target.folderUrl}|${target.filename || ''}`;
  const cached = qualityCache.get(cacheKey);
  if (cached) return cached;
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(`${target.api}?url=${encodeURIComponent(target.folderUrl)}`);
      if (!res.ok) return { qualities: [], hasDirect: false };
      const data = await res.json();
      const list: any[] = Array.isArray(data?.list) ? data.list : (data?.fast_stream_url ? [data] : []);
      let item: any = null;
      if (target.filename) {
        item = list.find(x => (x.filename || x.name) === target.filename) || list[0];
      } else {
        item = list[0];
      }
      const fs = item?.fast_stream_url || {};
      const qs = Object.keys(fs).filter(k => /^\d+p$/.test(k));
      const hasDirect = !!(item?.normal_dlink || item?.dlink);
      const result = { qualities: qs, hasDirect };
      qualityCache.set(cacheKey, result);
      return result;
    } catch {
      return { qualities: [], hasDirect: false };
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

interface Props {
  url: string | undefined;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  longLabels?: boolean;
  title?: string;
}

const ORDER = ['1080p', '720p', '480p', '360p', '240p'];
const SHORT_LABELS: Record<string, string> = {
  '1080p': '1080p', '720p': '720p', '480p': '480p', '360p': '360p', '240p': '240p',
};
const LONG_LABELS: Record<string, string> = {
  '1080p': '1080p — Full HD', '720p': '720p — HD', '480p': '480p — SD',
  '360p': '360p — Baixa', '240p': '240p — Muito Baixa',
};

const QualitySelect: React.FC<Props> = ({ url, value, onChange, className, longLabels, title }) => {
  const [available, setAvailable] = useState<string[] | null>(null);
  const [hasDirect, setHasDirect] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const target = resolveTarget(url || '');
    if (!target) { setAvailable(null); setHasDirect(false); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchQualities(target).then(result => {
      if (cancelled) return;
      setAvailable(result.qualities);
      setHasDirect(result.hasDirect);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [url]);

  const labels = longLabels ? LONG_LABELS : SHORT_LABELS;
  const list = available && available.length
    ? ORDER.filter(q => available.includes(q))
    : ORDER.slice(0, 4);

  const autoLabel = longLabels
    ? 'Automática (usa stream principal)'
    : 'Auto (Stream)';

  const directLabel = longLabels ? 'Link Direto (download direto)' : 'Link Direto';

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
      title={title}
    >
      <option value="auto">{autoLabel}{loading ? ' (detectando...)' : ''}</option>
      {list.map(q => <option key={q} value={q}>{labels[q]}</option>)}
      {hasDirect && <option value="direct">{directLabel}</option>}
    </select>
  );
};

export default QualitySelect;
