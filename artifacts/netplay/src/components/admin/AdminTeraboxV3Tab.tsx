import React, { useState, useRef, useEffect } from 'react';
import { Database, Link as LinkIcon, CheckCircle2, ShieldCheck, Play, Video, RefreshCw, FolderSearch, Save, Zap, Tv, Settings2 } from 'lucide-react';
import Hls from 'hls.js';
import { Movie, PreferredQuality, PreferredAudioLanguage } from '../../types';
import tmdb, { fetchSeasonDetailsWithFallback } from '../../services/tmdb';
import { makeDynamicRefV3, isDynamicRef } from '../../services/terabox';

const QUALITY_OPTIONS: { value: PreferredQuality; label: string }[] = [
  { value: 'auto',            label: 'Auto — HLS adaptativo (recomendado)' },
  { value: 'stream',          label: 'Stream HLS — HLS direto' },
  { value: '1080p',           label: '1080p — Full HD' },
  { value: '720p',            label: '720p — HD' },
  { value: '480p',            label: '480p — SD' },
  { value: '360p',            label: '360p — Baixa' },
  { value: '240p',            label: '240p — Mínima' },
  { value: 'direct',          label: 'Link Direto (Worker Proxy)' },
  { value: 'stream_download', label: 'Download Direto (API)' },
];

const AUDIO_LANGUAGE_OPTIONS: { value: PreferredAudioLanguage; label: string }[] = [
  { value: 'auto',  label: 'Auto (idioma padrão do arquivo)' },
  { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
  { value: 'pt-PT', label: '🇵🇹 Português (Portugal)' },
  { value: 'en',    label: '🇺🇸 Inglês' },
  { value: 'es',    label: '🇪🇸 Espanhol' },
  { value: 'fr',    label: '🇫🇷 Francês' },
  { value: 'de',    label: '🇩🇪 Alemão' },
  { value: 'it',    label: '🇮🇹 Italiano' },
  { value: 'ja',    label: '🇯🇵 Japonês' },
  { value: 'ko',    label: '🇰🇷 Coreano' },
  { value: 'zh',    label: '🇨🇳 Chinês' },
];

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|webm|m4v|wmv|flv|ts|m2ts|vob|mpg|mpeg|3gp|rmvb|rm)$/i;

async function scanFolderRecursive(
  url: string,
  dirPath: string = '',
  depth: number = 0,
  onStatus: (msg: string) => void,
): Promise<any[]> {
  if (depth > 4) return [];
  const allFiles: any[] = [];
  const seenNamesHere = new Set<string>();
  let page = 1;
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const label = dirPath ? `"${dirPath.split('/').pop()}"` : 'pasta raiz';
    onStatus(`Escaneando ${label} — pág ${page} (${allFiles.length} arqs até agora)...`);
    const params = new URLSearchParams({ url, page: String(page) });
    if (dirPath) params.set('dir_path', dirPath);
    let res: Response;
    let data: any;
    try {
      res = await fetch(`/api/terabox-v3?${params}`);
      data = await res.json();
    } catch {
      break;
    }
    if (!res.ok) break;
    const list: any[] = data.list || [];
    let newCount = 0;
    for (const item of list) {
      const name = item.filename || item.server_filename || item.name;
      if (!name || seenNamesHere.has(name)) continue;
      seenNamesHere.add(name);
      newCount++;
      const isDir = item.is_dir === '1' || item.is_dir === 1 || item.is_dir === true;
      if (isDir) {
        // Recurse into subfolder
        const subPath = item.dir_path || item.path || (dirPath ? `${dirPath}/${name}` : name);
        const subFiles = await scanFolderRecursive(url, subPath, depth + 1, onStatus);
        allFiles.push(...subFiles);
      } else {
        // Only include actual video files (skip images, subtitles, etc.)
        if (!VIDEO_EXTENSIONS.test(name) && allFiles.length === 0 && depth === 0) {
          // At root level with no videos yet: include everything (let user filter)
          allFiles.push(item);
        } else if (VIDEO_EXTENSIONS.test(name)) {
          allFiles.push(item);
        }
      }
    }
    if (newCount === 0) break;
    if (list.length < 5) break;
    page++;
  }
  return allFiles;
}

export default function AdminTeraboxV3Tab({ movies, onUpdateMovie, onAddMovie }: { movies: Movie[], onUpdateMovie: Function, onAddMovie: Function }) {
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSelectedQuality, setTestSelectedQuality] = useState<string | null>(null);

  const [folderUrl, setFolderUrl] = useState('');
  const [folderScanning, setFolderScanning] = useState(false);
  const [folderResults, setFolderResults] = useState<any[]>([]);
  const [scanningStatus, setScanningStatus] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [dynamicLinkMode, setDynamicLinkMode] = useState(true);

  const [seriesSearchTitle, setSeriesSearchTitle] = useState('');
  const [seriesSearchResults, setSeriesSearchResults] = useState<any[]>([]);
  const [seriesSearching, setSeriesSearching] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<any>(null);
  const [seasonFolders, setSeasonFolders] = useState<{ season: number; folderUrl: string }[]>([{ season: 1, folderUrl: '' }]);
  const [seasonScanResults, setSeasonScanResults] = useState<Record<number, any[]>>({});
  const [seasonScanning, setSeasonScanning] = useState(false);
  const [seasonSaveLoading, setSeasonSaveLoading] = useState(false);
  const [enrichingTmdb, setEnrichingTmdb] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState('');
  const [seasonScanStatus, setSeasonScanStatus] = useState('');
  const [autoDetectStatus, setAutoDetectStatus] = useState('');

  const [updatingMode, setUpdatingMode] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [globalMovieQuality, setGlobalMovieQuality] = useState<PreferredQuality>('auto');
  const [globalSeriesQuality, setGlobalSeriesQuality] = useState<PreferredQuality>('auto');
  const [globalMovieAudio, setGlobalMovieAudio] = useState<PreferredAudioLanguage>('pt-BR');
  const [globalSeriesAudio, setGlobalSeriesAudio] = useState<PreferredAudioLanguage>('pt-BR');

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTest = async () => {
    if (!testUrl) return;
    setLoading(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch(`/api/terabox-v3?url=${encodeURIComponent(testUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(`${data.error}: ${data.details || ''}`);
      setTestResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testVid = React.useMemo(() => {
    if (!testResult) return null;
    return testResult.list && testResult.list.length > 0 ? testResult.list[0] : testResult;
  }, [testResult]);

  const testQualities = React.useMemo(() => {
    if (!testVid) return [] as { id: string; label: string; url: string; desc: string }[];
    const fs = testVid.fast_stream_url || {};
    const order = [
      { k: '1080p', label: '1080p (Full HD)',  desc: 'HLS M3U8 — qualidade máxima' },
      { k: '720p',  label: '720p (HD)',         desc: 'HLS M3U8 — HD' },
      { k: '480p',  label: '480p (SD)',         desc: 'HLS M3U8 — SD' },
      { k: '360p',  label: '360p',             desc: 'HLS M3U8 — baixa' },
      { k: '240p',  label: '240p',             desc: 'HLS M3U8 — mínima' },
    ];
    const list: { id: string; label: string; url: string; desc: string }[] = [];
    const seen = new Set<string>();
    for (const o of order) {
      if (fs[o.k] && typeof fs[o.k] === 'string' && !seen.has(fs[o.k])) {
        seen.add(fs[o.k]);
        list.push({ id: o.k, label: o.label, url: fs[o.k], desc: o.desc });
      }
    }
    // fast_stream_url.auto — HLS adaptativo (melhor compatibilidade, áudio completo)
    if (fs['auto'] && !seen.has(fs['auto'])) {
      seen.add(fs['auto']);
      list.push({ id: 'auto', label: 'Auto (Stream)', url: fs['auto'], desc: 'HLS M3U8 adaptativo — melhor para streaming, áudio garantido' });
    }
    // stream_url — pode ser igual ao auto ou um HLS diferente
    const streamFallback = testVid.stream_url;
    if (streamFallback && !seen.has(streamFallback)) {
      seen.add(streamFallback);
      list.push({ id: 'stream', label: 'Stream HLS', url: streamFallback, desc: 'HLS M3U8 direto — usar se Auto Stream não funcionar' });
    }
    // normal_dlink — proxy via Cloudflare Worker (fallback quando HLS falha)
    const direct = testVid.normal_dlink || testVid.direct_link;
    if (direct && !seen.has(direct)) {
      seen.add(direct);
      list.push({ id: 'direct', label: 'Link Direto (Worker)', url: direct, desc: 'Proxy via Cloudflare Worker — usar quando HLS não carrega. Compatível com MP4.' });
    }
    // stream_download_url — download direto via servidor API (alta compatibilidade)
    const dlUrl = testVid.stream_download_url || testResult?._v3_raw?.list?.[0]?.stream_download_url;
    if (dlUrl && !seen.has(dlUrl)) {
      seen.add(dlUrl);
      list.push({ id: 'stream_download', label: 'Download Direto', url: dlUrl, desc: 'Link direto via servidor API — máxima compatibilidade, ideal para download. Testar no player.' });
    }
    return list;
  }, [testVid, testResult]);

  const videoUrlToPlay = React.useMemo(() => {
    if (!testQualities.length) return null;
    if (testSelectedQuality) {
      const found = testQualities.find(q => q.id === testSelectedQuality);
      if (found) return found.url;
    }
    return testQualities[0].url;
  }, [testQualities, testSelectedQuality]);

  React.useEffect(() => { setTestSelectedQuality(null); }, [testResult]);

  useEffect(() => {
    if (!videoUrlToPlay || !videoRef.current) return;
    let hls: Hls | null = null;
    if (videoUrlToPlay.includes('.m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(videoUrlToPlay);
        hls.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = videoUrlToPlay;
      }
    } else {
      videoRef.current.src = videoUrlToPlay;
    }
    return () => { if (hls) hls.destroy(); };
  }, [videoUrlToPlay]);

  const handleScanFolder = async () => {
    if (!folderUrl) return;
    setFolderScanning(true);
    setScanningStatus('Iniciando varredura recursiva da pasta...');
    setFolderResults([]);
    try {
      const allItems = await scanFolderRecursive(folderUrl, '', 0, setScanningStatus);

      if (!allItems.length) {
        setScanningStatus('Nenhum arquivo de vídeo encontrado na pasta.');
        return;
      }

      setScanningStatus(`Rastreando ${allItems.length} arquivo(s) no TMDB...`);
      const mapped = [];
      for (const item of allItems) {
        const filename = item.filename || item.server_filename || item.name || 'Desconhecido';
        let searchName = filename.replace(/\.(mp4|mkv|avi|webm|ts|m2ts|vob|mpg|mpeg)$/i, '');
        searchName = searchName.replace(/[\(\[]\d{4}[\)\]]/g, '');
        searchName = searchName.replace(/720p|1080p|4k|2160p/gi, '');
        searchName = searchName.replace(/WEB-DL|WEBRip|BluRay|HDRip|x264|x265|HEVC/gi, '');
        searchName = searchName.replace(/[\.\-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const resSearch = await tmdb.get(`/search/multi?query=${encodeURIComponent(searchName)}`);
        const searchRes = resSearch.data.results || [];
        const bestMatch = searchRes.length > 0 ? searchRes[0] : null;
        mapped.push({
          imported_filename: filename,
          url: folderUrl,
          tmdb_match: bestMatch,
          selected: true,
          availableQualities: [],
          searchName,
          searching: false,
          preferredQuality: globalMovieQuality,
          preferredAudioLanguage: globalMovieAudio,
        });
      }
      setFolderResults(mapped);
      setScanningStatus(`Concluído: ${allItems.length} arquivo(s) encontrado(s) (com subpastas). Revise e adicione.`);
    } catch (err: any) {
      alert('Erro na varredura: ' + err.message);
      setScanningStatus('Erro na varredura.');
    } finally {
      setFolderScanning(false);
    }
  };

  const handleResearchTmdb = async (index: number) => {
    const item = folderResults[index];
    if (!item) return;
    const copy = [...folderResults];
    copy[index] = { ...copy[index], searching: true };
    setFolderResults(copy);
    try {
      const res = await tmdb.get(`/search/multi?query=${encodeURIComponent(item.searchName)}`);
      const results = res.data.results || [];
      const copy2 = [...folderResults];
      copy2[index] = { ...copy2[index], tmdb_match: results[0] || null, searching: false };
      setFolderResults(copy2);
    } catch {
      const copy2 = [...folderResults];
      copy2[index] = { ...copy2[index], searching: false };
      setFolderResults(copy2);
    }
  };

  const handleSaveScanned = async () => {
    const GENRE_MAP: { [key: number]: string } = {
      28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime",
      99: "Documentário", 18: "Drama", 10751: "Família", 14: "Fantasia",
      36: "História", 27: "Terror", 10402: "Música", 9648: "Mistério",
      10749: "Romance", 878: "Ficção Científica", 10770: "Cinema TV",
      53: "Suspense", 10752: "Guerra", 37: "Faroeste",
      10759: "Action & Adventure", 10762: "Kids", 10763: "News",
      10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
      10767: "Talk", 10768: "War & Politics"
    };
    const toSave = folderResults.filter(r => r.selected);
    if (!toSave.length) return alert('Nenhum item selecionado.');
    setSaveLoading(true);
    let errorCount = 0;
    try {
      for (const item of toSave) {
        const t = item.tmdb_match;
        const type = t ? (t.media_type === 'tv' ? 'series' : 'movie') : 'movie';
        let genreNames = 'Outros';
        if (t && t.genre_ids) {
          genreNames = t.genre_ids.map((id: number) => GENRE_MAP[id]).filter(Boolean).join(', ') || 'Outros';
        }
        const titleOrName = t ? (t.title || t.name) : item.imported_filename.replace(/\.(mp4|mkv|avi|webm|ts)$/i, '');
        const existingMovie = movies.find(m => (t && m.id === t.id) || m.title === titleOrName);
        const videoUrlToSave = dynamicLinkMode
          ? makeDynamicRefV3(folderUrl, item.imported_filename)
          : folderUrl;
        const qualityToSave: PreferredQuality = item.preferredQuality || 'auto';
        const audioToSave: PreferredAudioLanguage = item.preferredAudioLanguage || 'pt-BR';
        if (existingMovie) {
          try {
            await onUpdateMovie({ ...existingMovie, videoUrl: videoUrlToSave, videoUrl2: videoUrlToSave, file_name: item.imported_filename, preferredQuality: qualityToSave, preferredAudioLanguage: audioToSave });
          } catch { errorCount++; }
        } else {
          try {
            await onAddMovie({
              id: t ? t.id : Date.now() + Math.random(),
              title: titleOrName, name: titleOrName,
              original_name: t ? (t.original_name || t.original_title) : undefined,
              overview: t ? t.overview : 'Adicionado via Terabox 3.0',
              backdrop_path: t?.backdrop_path ? `https://image.tmdb.org/t/p/original${t.backdrop_path}` : 'https://picsum.photos/seed/terabox/1920/1080',
              poster_path: t?.poster_path ? `https://image.tmdb.org/t/p/original${t.poster_path}` : 'https://picsum.photos/seed/terabox/500/750',
              type, genres: genreNames, videoUrl: videoUrlToSave, videoUrl2: videoUrlToSave, file_name: item.imported_filename, preferredQuality: qualityToSave, preferredAudioLanguage: audioToSave,
            });
          } catch { errorCount++; }
        }
      }
      if (errorCount === 0) {
        alert('Conteúdos adicionados com sucesso!');
        setFolderResults([]);
        setFolderUrl('');
      } else {
        alert(`${toSave.length - errorCount} adicionados, ${errorCount} erros.`);
      }
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSearchSeries = async () => {
    if (!seriesSearchTitle.trim()) return;
    setSeriesSearching(true);
    try {
      const res = await tmdb.get(`/search/tv?query=${encodeURIComponent(seriesSearchTitle)}`);
      setSeriesSearchResults(res.data.results || []);
    } catch (e: any) {
      alert('Erro ao buscar série: ' + e.message);
    } finally {
      setSeriesSearching(false);
    }
  };

  const parseSeasonEpisode = (filename: string): { season: number; episode: number } | null => {
    if (!filename) return null;
    const name = filename.replace(/\.(mkv|mp4|avi|mov|webm|m4v|wmv|flv|ts|m3u8)$/i, '');
    const patterns: RegExp[] = [
      /[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})/,
      /(?:^|[^\dA-Za-z])(\d{1,2})\s*[x×X]\s*(\d{1,3})(?=[^\d]|$)/,
      /[Tt](\d{1,2})[\s._-]*[Ee](\d{1,3})/,
      /[Tt]emp(?:orada)?[\s._-]*(\d{1,2})[\s._-]+(?:[Ee]p(?:is[oó]dio)?|EP)[\s._-]*(\d{1,3})/i,
      /[Ss]eason[\s._-]*(\d{1,2})[\s._-]+[Ee]pisode[\s._-]*(\d{1,3})/i,
      /(?:^|[\s\-_\[(])(\d{1,2})\.(\d{2,3})(?=[\s\-_\])])/,
    ];
    for (const re of patterns) {
      const m = name.match(re);
      if (m) {
        const s = parseInt(m[1], 10);
        const e = parseInt(m[2], 10);
        if (s >= 0 && s <= 50 && e >= 1 && e <= 999) return { season: s || 1, episode: e };
      }
    }
    return null;
  };

  // Remove tags de grupo de lançamento do início/fim do filename
  // Ex: "(AnimesTotais) Series.S01E65..." → "Series.S01E65..."
  //     "[SubGrupo] Series.S01E65..."  → "Series.S01E65..."
  const stripGroupTags = (filename: string): string =>
    filename
      // Remove tags entre parênteses ou colchetes no início
      .replace(/^[\s._-]*[\(\[][^\)\]]{1,40}[\)\]][\s._-]*/g, '')
      // Remove tags entre parênteses ou colchetes no final
      .replace(/[\s._-]*[\(\[][^\)\]]{1,40}[\)\]][\s._-]*$/g, '')
      .trim();

  // Extrai o nome do episódio do filename após o padrão SxxExx
  // Ex: "(AnimesTotais) Series.S01E65.Star.Warners.1080p.WEB-DL.mkv" → "Star Warners"
  const parseEpisodeName = (filename: string): string | null => {
    if (!filename) return null;
    // Remove extensão e tags de grupo antes de processar
    let name = filename.replace(/\.(mkv|mp4|avi|mov|webm|m4v|wmv|flv|ts|m3u8|m2ts|vob|mpg|mpeg)$/i, '');
    name = stripGroupTags(name);
    const seMatch = name.match(/[SsTt]\d{1,2}[\s._-]*[Ee]\d{1,3}[\s._-]+(.*)/);
    if (!seMatch) return null;
    let afterSE = seMatch[1];
    afterSE = afterSE.replace(
      /[\s._-]*(4K|2160p|1080p|720p|480p|360p|240p|UHD|FHD|HDR10?|SDR|HMAX|DSNP|AMZN|PCOK|NF|ATVP|WEB[-.]?DL|WEBRip|BluRay|Blu[-.]?Ray|HDTV|PDTV|DVDRip|BDRip|BRRip|WEB|DD[\d.]+|DDP[\d.]+|AAC[\d.]*|AC3|MP3|DTS[-\w]*|TrueHD|FLAC|x26[45]|H\.?26[45]|HEVC|AVC|REMUX|REPACK|PROPER|DUAL|MULTI|EXTENDED|DIRECTORS|UNRATED|REMASTERED|INTERNAL|RETAIL|LIMITED|COMPLETE|HYBRID).*/i,
      ''
    );
    const cleaned = afterSE.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.length >= 2 ? cleaned : null;
  };

  // Normaliza nome de episódio para comparação
  const normalizeEpName = (s: string): string =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  // Compara dois nomes de episódio por sobreposição de palavras (retorna 0–1)
  const epNameScore = (a: string, b: string): number => {
    const wa = normalizeEpName(a).split(' ').filter(w => w.length > 1);
    const wb = normalizeEpName(b).split(' ').filter(w => w.length > 1);
    if (!wa.length || !wb.length) return 0;
    const overlap = wa.filter(w => wb.includes(w)).length;
    return overlap / Math.max(wa.length, wb.length);
  };

  const getExistingEpisodesKey = (): Set<string> => {
    const set = new Set<string>();
    if (!selectedSeries) return set;
    const existing = movies.find(m => m.id === selectedSeries.id || m.title === (selectedSeries.name || selectedSeries.original_name));
    if (!existing || !Array.isArray((existing as any).episodes)) return set;
    for (const ep of (existing as any).episodes) {
      const s = Number(ep.season);
      const e = Number(ep.episode);
      if (s >= 0 && e >= 1 && (ep.videoUrl || ep.video_url)) set.add(`${s}-${e}`);
    }
    return set;
  };

  const handleScanAllSeasons = async () => {
    if (!selectedSeries) return alert('Selecione uma série primeiro.');
    const validFolders = seasonFolders.filter(sf => sf.folderUrl.trim());
    if (!validFolders.length) return alert('Adicione pelo menos um link de pasta de temporada.');
    setSeasonScanning(true);
    setSeasonScanResults({});
    const results: Record<number, any[]> = {};
    for (const sf of validFolders) {
      try {
        setSeasonScanStatus(`Iniciando varredura recursiva da T${sf.season}...`);
        const allItems = await scanFolderRecursive(
          sf.folderUrl, '', 0,
          (msg) => setSeasonScanStatus(`T${sf.season}: ${msg}`)
        );
        allItems.sort((a, b) => {
          const an = (a.filename || a.server_filename || a.name || '').toLowerCase();
          const bn = (b.filename || b.server_filename || b.name || '').toLowerCase();
          return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
        });
        results[sf.season] = allItems.map((item: any, idx: number) => ({
          filename: item.filename || item.server_filename || item.name || `arquivo_${idx + 1}`,
          season: sf.season,
          episode: idx + 1,
          folderUrl: sf.folderUrl,
          selected: true,
          availableQualities: [],
          preferredQuality: globalSeriesQuality,
          preferredAudioLanguage: globalSeriesAudio,
        }));
        setSeasonScanStatus(`T${sf.season}: ${allItems.length} episódio(s) encontrado(s).`);
      } catch (e: any) {
        setSeasonScanStatus(`Erro na Temporada ${sf.season}: ${e.message}`);
        results[sf.season] = [];
      }
    }
    setSeasonScanResults(results);
    setSeasonScanStatus('Varredura completa. Revise os episódios e salve.');
    setSeasonScanning(false);
  };

  const handleAutoDetectSE = () => {
    if (!Object.keys(seasonScanResults).length) return;
    const allFiles: any[] = [];
    for (const seasonStr of Object.keys(seasonScanResults)) {
      for (const f of seasonScanResults[Number(seasonStr)]) allFiles.push(f);
    }
    const existingKeys = getExistingEpisodesKey();
    let detected = 0;
    let detectedByName = 0;
    let unmatched = 0;
    let skippedDup = 0;
    const newGrouped: Record<number, any[]> = {};
    const fallbackBySeason: Record<number, any[]> = {};
    for (const file of allFiles) {
      const parsed = parseSeasonEpisode(file.filename);
      // Sempre tenta extrair o nome do episódio do filename
      const detectedEpisodeName = parseEpisodeName(file.filename);
      if (parsed) {
        if (existingKeys.has(`${parsed.season}-${parsed.episode}`)) { skippedDup++; continue; }
        if (!newGrouped[parsed.season]) newGrouped[parsed.season] = [];
        newGrouped[parsed.season].push({
          ...file,
          season: parsed.season,
          episode: parsed.episode,
          detectedEpisodeName: detectedEpisodeName || undefined,
        });
        if (detectedEpisodeName) detectedByName++;
        detected++;
      } else {
        const fallback = file.season || 1;
        if (!fallbackBySeason[fallback]) fallbackBySeason[fallback] = [];
        fallbackBySeason[fallback].push({
          ...file,
          detectedEpisodeName: detectedEpisodeName || undefined,
        });
        unmatched++;
      }
    }
    for (const seasonStr of Object.keys(fallbackBySeason)) {
      const sNum = Number(seasonStr);
      if (!newGrouped[sNum]) newGrouped[sNum] = [];
      const startEp = newGrouped[sNum].length ? Math.max(...newGrouped[sNum].map(x => x.episode || 0)) + 1 : 1;
      fallbackBySeason[sNum].forEach((f, idx) => { newGrouped[sNum].push({ ...f, season: sNum, episode: startEp + idx }); });
    }
    for (const s of Object.keys(newGrouped)) {
      newGrouped[Number(s)].sort((a, b) => (a.episode || 0) - (b.episode || 0));
    }
    setSeasonScanResults(newGrouped);
    setAutoDetectStatus(
      `Detectado: ${detected} arquivo${detected === 1 ? '' : 's'} em ${Object.keys(newGrouped).length} temporada${Object.keys(newGrouped).length === 1 ? '' : 's'}` +
      (detectedByName ? ` • ${detectedByName} com nome de episódio extraído do filename` : '') +
      (skippedDup ? ` • ${skippedDup} já salvo${skippedDup === 1 ? '' : 's'} no banco (removido${skippedDup === 1 ? '' : 's'})` : '') +
      (unmatched ? ` • ${unmatched} sem padrão (mantido${unmatched === 1 ? '' : 's'} no fim)` : '') + '.'
    );
    setTimeout(() => setAutoDetectStatus(''), 10000);
  };

  const handleRemoveAlreadySaved = () => {
    if (!Object.keys(seasonScanResults).length) return;
    if (!selectedSeries) { setAutoDetectStatus('Selecione uma série primeiro.'); setTimeout(() => setAutoDetectStatus(''), 5000); return; }
    const existingKeys = getExistingEpisodesKey();
    if (!existingKeys.size) { setAutoDetectStatus('Nenhum episódio dessa série salvo ainda.'); setTimeout(() => setAutoDetectStatus(''), 5000); return; }
    let removed = 0;
    const cleaned: Record<number, any[]> = {};
    for (const seasonStr of Object.keys(seasonScanResults)) {
      const sNum = Number(seasonStr);
      const kept = (seasonScanResults[sNum] as any[]).filter(f => { if (existingKeys.has(`${f.season}-${f.episode}`)) { removed++; return false; } return true; });
      if (kept.length) cleaned[sNum] = kept;
    }
    setSeasonScanResults(cleaned);
    setAutoDetectStatus(`${removed} episódio${removed === 1 ? '' : 's'} já salvo${removed === 1 ? '' : 's'} removido${removed === 1 ? '' : 's'}.`);
    setTimeout(() => setAutoDetectStatus(''), 8000);
  };

  const handleEnrichTmdbSynopses = async () => {
    if (!selectedSeries) return alert('Selecione uma série primeiro.');
    if (!Object.keys(seasonScanResults).length) return;
    setEnrichingTmdb(true);
    try {
      const updated = { ...seasonScanResults };
      let totalFilled = 0;
      let matchedByName = 0;
      for (const seasonStr of Object.keys(updated)) {
        const seasonNum = Number(seasonStr);
        setEnrichStatus(`Buscando sinopses da Temporada ${seasonNum}...`);
        try {
          const seasonData = await fetchSeasonDetailsWithFallback(selectedSeries.id, seasonNum);
          const tmdbEps: any[] = Array.isArray(seasonData?.data?.episodes) ? seasonData.data.episodes : [];
          if (!tmdbEps.length) continue;

          // Mapa por número de episódio (busca primária)
          const byNum = new Map<number, any>();
          for (const e of tmdbEps) byNum.set(Number(e.episode_number), e);

          // Mapa por nome normalizado (busca secundária via nome do episódio)
          const byName = new Map<string, any>();
          for (const e of tmdbEps) {
            if (e.name) byName.set(normalizeEpName(e.name), e);
          }

          updated[seasonNum] = (updated[seasonNum] as any[]).map(file => {
            // 1ª tentativa: match pelo número do episódio
            let match = byNum.get(Number(file.episode));
            let usedNameMatch = false;

            // 2ª tentativa: match pelo nome do episódio extraído do filename
            if (!match && file.detectedEpisodeName) {
              const normalizedDetected = normalizeEpName(file.detectedEpisodeName);
              match = byName.get(normalizedDetected);
              if (!match) {
                let bestScore = 0;
                let bestMatch: any = null;
                for (const [key, ep] of byName) {
                  const score = epNameScore(normalizedDetected, key);
                  if (score > bestScore && score >= 0.5) { bestScore = score; bestMatch = ep; }
                }
                if (bestMatch) match = bestMatch;
              }
              if (match) usedNameMatch = true;
            }

            // 3ª tentativa: busca pelo nome do arquivo completo (threshold mais alto)
            if (!match) {
              const fileNameNorm = normalizeEpName(file.filename || '');
              let bestScore = 0;
              let bestMatch: any = null;
              for (const [key, ep] of byName) {
                const score = epNameScore(fileNameNorm, key);
                if (score > bestScore && score >= 0.65) { bestScore = score; bestMatch = ep; }
              }
              if (bestMatch) { match = bestMatch; usedNameMatch = true; }
            }

            if (!match) return file;
            totalFilled++;
            if (usedNameMatch) matchedByName++;
            return {
              ...file,
              tmdbTitle: match.name || '',
              tmdbOverview: match.overview || '',
              tmdbStillPath: match.still_path ? `https://image.tmdb.org/t/p/w300${match.still_path}` : undefined,
              // Se o match foi por nome, corrige o número do episódio para o do TMDB
              ...(usedNameMatch ? { episode: match.episode_number, season: match.season_number ?? seasonNum } : {}),
            };
          });
        } catch (e: any) { console.warn(`[TMDB V3] Falha na Temporada ${seasonNum}:`, e.message); }
      }
      setSeasonScanResults(updated);
      setEnrichStatus(
        `${totalFilled} episódios enriquecidos com info do TMDB` +
        (matchedByName ? ` (${matchedByName} encontrado${matchedByName === 1 ? '' : 's'} pelo nome do episódio)` : '') +
        '.'
      );
    } catch (e: any) {
      setEnrichStatus(`Erro: ${e.message}`);
    } finally {
      setEnrichingTmdb(false);
    }
  };

  const handleSaveSeasonEpisodes = async () => {
    if (!selectedSeries) return;
    setSeasonSaveLoading(true);
    const GENRE_MAP: Record<number, string> = {
      28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime",
      99: "Documentário", 18: "Drama", 10751: "Família", 14: "Fantasia",
      36: "História", 27: "Terror", 10402: "Música", 9648: "Mistério",
      10749: "Romance", 878: "Ficção Científica", 10770: "Cinema TV",
      53: "Suspense", 10752: "Guerra", 37: "Faroeste",
      10759: "Action & Adventure", 10762: "Kids", 10765: "Sci-Fi & Fantasy",
      10766: "Soap", 10768: "War & Politics"
    };
    try {
      const selectedSeasons = Array.from(new Set(
        Object.entries(seasonScanResults)
          .flatMap(([s, files]) => (files as any[]).filter(f => f.selected).map(() => Number(s)))
      ));
      const tmdbBySeason: Record<number, Map<number, any>> = {};
      for (const s of selectedSeasons) {
        try {
          setEnrichStatus(`Buscando informações da Temporada ${s} no TMDB...`);
          const seasonData = await fetchSeasonDetailsWithFallback(selectedSeries.id, s);
          const map = new Map<number, any>();
          for (const e of (seasonData?.data?.episodes || [])) map.set(Number(e.episode_number), e);
          tmdbBySeason[s] = map;
        } catch (e: any) {
          console.warn(`[TMDB enrich V3] Falha na Temporada ${s}:`, e.message);
          tmdbBySeason[s] = new Map();
        }
      }
      setEnrichStatus('');
      const allEpisodes: any[] = [];
      for (const [seasonStr, files] of Object.entries(seasonScanResults)) {
        for (const file of (files as any[])) {
          if (!file.selected) continue;
          const tmdbEp = tmdbBySeason[Number(seasonStr)]?.get(Number(file.episode));
          const stillFromTmdb = tmdbEp?.still_path
            ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path.startsWith('/') ? '' : '/'}${tmdbEp.still_path}`
            : undefined;
          allEpisodes.push({
            id: `s${file.season}e${file.episode}-${Date.now()}-${Math.random()}`,
            title: tmdbEp?.name || file.tmdbTitle || `Episódio ${file.episode}`,
            season: file.season,
            episode: file.episode,
            videoUrl: makeDynamicRefV3(file.folderUrl, file.filename),
            overview: tmdbEp?.overview || file.tmdbOverview || '',
            still_path: stillFromTmdb || file.tmdbStillPath || (selectedSeries.backdrop_path ? `https://image.tmdb.org/t/p/w300${selectedSeries.backdrop_path}` : undefined),
            ...(tmdbEp?.air_date ? { release_date: tmdbEp.air_date } : {}),
            ...(tmdbEp?.runtime ? { runtime: tmdbEp.runtime } : {}),
            ...(tmdbEp?.vote_average !== undefined && tmdbEp?.vote_average !== null ? { rating: tmdbEp.vote_average } : {}),
            ...(file.preferredQuality && file.preferredQuality !== 'auto' ? { preferredQuality: file.preferredQuality } : {}),
            ...(file.preferredAudioLanguage && file.preferredAudioLanguage !== 'auto' ? { preferredAudioLanguage: file.preferredAudioLanguage } : {}),
          });
        }
      }
      if (!allEpisodes.length) return alert('Nenhum episódio selecionado.');
      const genreNames = selectedSeries.genre_ids
        ? selectedSeries.genre_ids.map((id: number) => GENRE_MAP[id]).filter(Boolean).join(', ')
        : 'Série';
      const existingMovie = movies.find(m => m.id === selectedSeries.id || m.title === (selectedSeries.name || selectedSeries.original_name));
      if (existingMovie) {
        const mergedEpisodes = [...(existingMovie.episodes || [])];
        for (const ep of allEpisodes) {
          const idx = mergedEpisodes.findIndex(e => e.season === ep.season && e.episode === ep.episode);
          if (idx >= 0) mergedEpisodes[idx] = { ...mergedEpisodes[idx], ...ep };
          else mergedEpisodes.push(ep);
        }
        mergedEpisodes.sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);
        await onUpdateMovie({ ...existingMovie, episodes: mergedEpisodes, type: 'series' });
        alert(`Série atualizada com ${allEpisodes.length} episódios via Terabox 3.0!`);
      } else {
        await onAddMovie({
          id: selectedSeries.id,
          title: selectedSeries.name || selectedSeries.original_name,
          name: selectedSeries.name || selectedSeries.original_name,
          original_name: selectedSeries.original_name,
          overview: selectedSeries.overview || '',
          backdrop_path: selectedSeries.backdrop_path ? `https://image.tmdb.org/t/p/original${selectedSeries.backdrop_path}` : 'https://picsum.photos/seed/series/1920/1080',
          poster_path: selectedSeries.poster_path ? `https://image.tmdb.org/t/p/w500${selectedSeries.poster_path}` : 'https://picsum.photos/seed/series/500/750',
          type: 'series' as const,
          genres: genreNames,
          vote_average: selectedSeries.vote_average || 0,
          first_air_date: selectedSeries.first_air_date,
          episodes: allEpisodes,
        });
        alert(`Série adicionada com ${allEpisodes.length} episódios via Terabox 3.0!`);
      }
      setSelectedSeries(null);
      setSeasonFolders([{ season: 1, folderUrl: '' }]);
      setSeasonScanResults({});
      setSeriesSearchResults([]);
      setSeriesSearchTitle('');
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSeasonSaveLoading(false);
    }
  };

  const teraboxMovies = movies.filter(m => {
    const isV3 = (url?: string) => !!url && url.startsWith('terabox-folder-v3://');
    return isV3(m.videoUrl) || m.episodes?.some(ep => isV3(ep.videoUrl));
  });

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-violet-400">
          <Database size={36} /> Terabox 3.0
        </h2>
        <p className="text-gray-400 text-sm mt-2">
          Nova API Terabox com autenticação HMAC-SHA256 — <span className="text-violet-400 font-bold">api.teraboxdl.site/v1/api</span>
        </p>
      </div>

      <div className="bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/30 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="text-violet-400" size={24} />
          <h3 className="text-xl font-bold">Status da Configuração</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <div className="w-2 h-2 rounded-full bg-violet-400"></div>
            <span>Endpoint: <span className="text-violet-300 font-mono">POST https://api.teraboxdl.site/v1/api</span></span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <div className="w-2 h-2 rounded-full bg-violet-400"></div>
            <span>Autenticação: <span className="text-violet-300 font-bold">HMAC-SHA256 (X-API-Key + X-Signature)</span></span>
          </div>
          <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold mt-3">
            <span>⚠ Configure TERABOX_V3_API_KEY e TERABOX_V3_API_SECRET nos segredos do servidor.</span>
          </div>
        </div>
      </div>

      {/* Importador de Séries por Temporada */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-violet-400">
          <Tv size={20} />
          Importar Série por Temporada
        </h3>
        <p className="text-xs text-gray-400 mb-4">Busque a série no TMDB, adicione pastas por temporada e escaneie com a API 3.0.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={seriesSearchTitle}
            onChange={e => setSeriesSearchTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearchSeries(); }}
            placeholder="Nome da série no TMDB..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleSearchSeries}
            disabled={seriesSearching || !seriesSearchTitle.trim()}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            {seriesSearching ? <RefreshCw size={14} className="animate-spin" /> : <FolderSearch size={14} />}
            Buscar
          </button>
        </div>

        {seriesSearchResults.length > 0 && !selectedSeries && (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
            {seriesSearchResults.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedSeries(s); setSeriesSearchResults([]); }}
                className="flex items-center gap-3 bg-black/40 rounded-xl p-3 border border-white/5 cursor-pointer hover:border-violet-500 transition-colors"
              >
                {s.poster_path && <img src={`https://image.tmdb.org/t/p/w92${s.poster_path}`} className="w-10 h-14 object-cover rounded-lg" alt="" />}
                <div>
                  <div className="text-sm font-bold text-white">{s.name || s.original_name}</div>
                  <div className="text-xs text-gray-400">{s.first_air_date?.slice(0, 4)} • {s.vote_average?.toFixed(1)} ★</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedSeries && (
          <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-4">
            {selectedSeries.poster_path && <img src={`https://image.tmdb.org/t/p/w92${selectedSeries.poster_path}`} className="w-10 h-14 object-cover rounded-lg" alt="" />}
            <div className="flex-1">
              <div className="text-sm font-bold text-violet-300">{selectedSeries.name || selectedSeries.original_name}</div>
              <div className="text-xs text-gray-400">{selectedSeries.first_air_date?.slice(0, 4)}</div>
            </div>
            <button onClick={() => { setSelectedSeries(null); setSeasonScanResults({}); }} className="text-gray-500 hover:text-red-400 transition-colors text-xs font-bold">✕ Remover</button>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {seasonFolders.map((sf, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-violet-400 font-bold w-6">T{sf.season}</span>
              <input
                type="number"
                value={sf.season}
                min={0}
                onChange={e => { const c = [...seasonFolders]; c[i].season = Number(e.target.value); setSeasonFolders(c); }}
                className="w-14 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs"
              />
              <input
                type="text"
                value={sf.folderUrl}
                onChange={e => { const c = [...seasonFolders]; c[i].folderUrl = e.target.value; setSeasonFolders(c); }}
                placeholder="Link da pasta Terabox..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
              {seasonFolders.length > 1 && (
                <button onClick={() => setSeasonFolders(seasonFolders.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-400 text-xs font-bold px-2">✕</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setSeasonFolders([...seasonFolders, { season: seasonFolders.length + 1, folderUrl: '' }])}
            className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 mt-1"
          >
            + Adicionar temporada
          </button>
        </div>

        {/* Global quality + audio selectors for series */}
        <div className="flex items-center gap-3 mb-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <Settings2 size={14} className="text-violet-400 shrink-0" />
          <span className="text-xs text-violet-300 font-bold whitespace-nowrap">Qualidade:</span>
          <select
            value={globalSeriesQuality}
            onChange={e => setGlobalSeriesQuality(e.target.value as PreferredQuality)}
            className="flex-1 bg-black/60 border border-violet-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-400"
          >
            {QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Settings2 size={14} className="text-blue-400 shrink-0" />
          <span className="text-xs text-blue-300 font-bold whitespace-nowrap">Áudio padrão:</span>
          <select
            value={globalSeriesAudio}
            onChange={e => setGlobalSeriesAudio(e.target.value as PreferredAudioLanguage)}
            className="flex-1 bg-black/60 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
          >
            {AUDIO_LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleScanAllSeasons}
            disabled={seasonScanning || !selectedSeries}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
          >
            {seasonScanning ? <RefreshCw size={14} className="animate-spin" /> : <FolderSearch size={14} />}
            {seasonScanning ? seasonScanStatus || 'Escaneando...' : 'Escanear Pastas (V3)'}
          </button>
          {Object.keys(seasonScanResults).length > 0 && (
            <button onClick={handleAutoDetectSE} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2">
              <Zap size={14} /> Auto-detectar S/E
            </button>
          )}
          {Object.keys(seasonScanResults).length > 0 && (
            <button onClick={handleRemoveAlreadySaved} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2">
              <CheckCircle2 size={14} /> Remover já salvos
            </button>
          )}
          {Object.keys(seasonScanResults).length > 0 && (
            <button onClick={handleEnrichTmdbSynopses} disabled={enrichingTmdb || !selectedSeries} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2">
              {enrichingTmdb ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
              Buscar Sinopses TMDB
            </button>
          )}
          {Object.keys(seasonScanResults).length > 0 && (
            <button onClick={handleSaveSeasonEpisodes} disabled={seasonSaveLoading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2">
              {seasonSaveLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar Episódios
            </button>
          )}
        </div>
        {seasonScanStatus && !seasonScanning && <div className="mt-3 text-xs text-violet-400 font-bold">{seasonScanStatus}</div>}
        {enrichStatus && <div className="mt-1 text-xs text-blue-400 font-bold">{enrichStatus}</div>}
        {autoDetectStatus && <div className="mt-1 text-xs text-amber-400 font-bold">{autoDetectStatus}</div>}

        {Object.keys(seasonScanResults).length > 0 && (
          <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-1">
            {Object.entries(seasonScanResults).map(([season, files]) => (
              <div key={season}>
                <div className="text-xs font-black uppercase tracking-widest text-violet-400 mb-2">Temporada {season} ({(files as any[]).length} episódios)</div>
                <div className="space-y-1">
                  {(files as any[]).map((file, i) => (
                    <div key={i} className="bg-black/40 px-3 py-2 rounded-lg border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={file.selected}
                          onChange={e => { const copy = { ...seasonScanResults }; (copy[Number(season)] as any[])[i].selected = e.target.checked; setSeasonScanResults(copy); }}
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="text-violet-400 font-bold text-xs min-w-[24px] shrink-0">E{file.episode}</span>
                        <input
                          type="number"
                          value={file.episode}
                          onChange={e => { const copy = { ...seasonScanResults }; (copy[Number(season)] as any[])[i].episode = Number(e.target.value); setSeasonScanResults(copy); }}
                          className="w-14 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white shrink-0"
                          min={1}
                        />
                        <select
                          value={file.preferredQuality || 'auto'}
                          onChange={e => { const copy = { ...seasonScanResults }; (copy[Number(season)] as any[])[i].preferredQuality = e.target.value; setSeasonScanResults(copy); }}
                          className="bg-black/60 border border-violet-500/30 rounded px-1.5 py-0.5 text-[10px] text-violet-300 font-bold focus:outline-none focus:border-violet-400 shrink-0"
                          title="Qualidade preferida para este episódio"
                        >
                          {QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select
                          value={file.preferredAudioLanguage || 'pt-BR'}
                          onChange={e => { const copy = { ...seasonScanResults }; (copy[Number(season)] as any[])[i].preferredAudioLanguage = e.target.value; setSeasonScanResults(copy); }}
                          className="bg-black/60 border border-blue-500/30 rounded px-1.5 py-0.5 text-[10px] text-blue-300 font-bold focus:outline-none focus:border-blue-400 shrink-0"
                          title="Idioma de áudio preferido para este episódio"
                        >
                          {AUDIO_LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <span className="text-[10px] text-violet-500 font-bold shrink-0 flex items-center gap-1 ml-auto"><Zap size={10} /> V3</span>
                      </div>
                      <div className="text-gray-300 text-[11px] break-all leading-snug pl-6" title={file.filename}>{file.filename}</div>
                      {file.detectedEpisodeName && !file.tmdbTitle && (
                        <div className="pl-6 pt-0.5">
                          <span className="text-[10px] text-amber-400/80 font-semibold flex items-center gap-1">
                            <Tv size={9} /> Nome detectado: {file.detectedEpisodeName}
                          </span>
                        </div>
                      )}
                      {(file.tmdbTitle || file.tmdbOverview) && (
                        <div className="pl-6 pt-1 border-t border-white/5 space-y-0.5">
                          {file.tmdbTitle && (
                            <div className="text-[11px] text-blue-300 font-bold flex items-center gap-1">
                              <Database size={10} /> {file.tmdbTitle}
                              {file.detectedEpisodeName && (
                                <span className="text-[9px] text-amber-400/60 font-normal ml-1">(via nome: {file.detectedEpisodeName})</span>
                              )}
                            </div>
                          )}
                          {file.tmdbOverview && <div className="text-[10px] text-gray-400 leading-relaxed line-clamp-3">{file.tmdbOverview}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scanner de Filmes */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-green-400">
          <FolderSearch size={20} />
          Rastreio de Filmes (Pasta)
        </h3>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setDynamicLinkMode(v => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${dynamicLinkMode ? 'bg-green-500' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dynamicLinkMode ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className="text-xs text-gray-400 font-bold">
            {dynamicLinkMode ? <span className="text-green-400 flex items-center gap-1"><Zap size={10} /> Link Dinâmico V3 (recomendado)</span> : 'Link Direto (pode expirar)'}
          </span>
        </div>
        {/* Global quality + audio selectors for movies */}
        <div className="flex items-center gap-3 mb-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <Settings2 size={14} className="text-green-400 shrink-0" />
          <span className="text-xs text-green-300 font-bold whitespace-nowrap">Qualidade:</span>
          <select
            value={globalMovieQuality}
            onChange={e => setGlobalMovieQuality(e.target.value as PreferredQuality)}
            className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-green-400"
          >
            {QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Settings2 size={14} className="text-blue-400 shrink-0" />
          <span className="text-xs text-blue-300 font-bold whitespace-nowrap">Áudio padrão:</span>
          <select
            value={globalMovieAudio}
            onChange={e => setGlobalMovieAudio(e.target.value as PreferredAudioLanguage)}
            className="flex-1 bg-black/60 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
          >
            {AUDIO_LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderUrl}
            onChange={e => setFolderUrl(e.target.value)}
            placeholder="Link da Pasta Terabox..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleScanFolder}
            disabled={folderScanning || !folderUrl}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            {folderScanning ? <RefreshCw size={14} className="animate-spin" /> : <FolderSearch size={14} />}
            Escanear
          </button>
        </div>
        {scanningStatus && <div className="mt-3 text-xs text-green-400 font-bold">{scanningStatus}</div>}
      </div>

      {folderResults.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-green-400">Resultados da Varredura ({folderResults.length})</h3>
            <button onClick={handleSaveScanned} disabled={saveLoading} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2">
              {saveLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Adicionar Selecionados
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {folderResults.map((res, i) => (
              <div key={i} className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                <input type="checkbox" checked={res.selected} onChange={e => { const copy = [...folderResults]; copy[i].selected = e.target.checked; setFolderResults(copy); }} className="w-4 h-4 rounded mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{res.imported_filename}</div>
                  <div className="text-xs text-gray-400 truncate mt-1">
                    Match: {res.tmdb_match ? <span className="text-green-400">{res.tmdb_match.title || res.tmdb_match.name}</span> : <span className="text-red-400">Não encontrado</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <input
                      type="text"
                      value={res.searchName || ''}
                      onChange={e => { const copy = [...folderResults]; copy[i].searchName = e.target.value; setFolderResults(copy); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleResearchTmdb(i); }}
                      placeholder="Editar nome para buscar novamente..."
                      className="flex-1 bg-black/60 border border-white/10 rounded-lg py-1 px-2 text-[11px] text-white"
                    />
                    <button onClick={() => handleResearchTmdb(i)} disabled={res.searching} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg text-[10px] font-bold">
                      {res.searching ? '...' : 'Buscar'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Settings2 size={11} className="text-green-400 shrink-0" />
                    <span className="text-[10px] text-green-300 font-bold whitespace-nowrap">Qualidade:</span>
                    <select
                      value={res.preferredQuality || 'auto'}
                      onChange={e => { const copy = [...folderResults]; copy[i].preferredQuality = e.target.value as PreferredQuality; setFolderResults(copy); }}
                      className="flex-1 bg-black/60 border border-green-500/30 rounded px-1.5 py-0.5 text-[10px] text-green-300 font-bold focus:outline-none focus:border-green-400 min-w-[100px]"
                    >
                      {QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <span className="text-[10px] text-blue-300 font-bold whitespace-nowrap">Áudio:</span>
                    <select
                      value={res.preferredAudioLanguage || 'pt-BR'}
                      onChange={e => { const copy = [...folderResults]; copy[i].preferredAudioLanguage = e.target.value as PreferredAudioLanguage; setFolderResults(copy); }}
                      className="flex-1 bg-black/60 border border-blue-500/30 rounded px-1.5 py-0.5 text-[10px] text-blue-300 font-bold focus:outline-none focus:border-blue-400 min-w-[100px]"
                    >
                      {AUDIO_LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filmes usando V3 */}
      {updatingMode && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-violet-400 mb-3">Conteúdos com Link V3 ({teraboxMovies.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {teraboxMovies.map((m, i) => (
              <div key={i} className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                <img src={m.backdrop_path || m.poster_path} className="w-16 h-10 object-cover rounded" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{m.title || m.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">{m.videoUrl}</div>
                </div>
              </div>
            ))}
            {teraboxMovies.length === 0 && <div className="text-sm text-gray-500 p-4">Nenhum conteúdo com Link V3.</div>}
          </div>
        </div>
      )}
      <button onClick={() => setUpdatingMode(v => !v)} className="text-xs text-violet-400 hover:text-violet-300 font-bold mb-8">
        {updatingMode ? '▲ Ocultar' : '▼ Ver conteúdos com Link V3'} ({teraboxMovies.length})
      </button>

      {/* Testador Rápido de Link */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <LinkIcon className="text-gray-400" size={20} />
          Testador Rápido de Link
        </h3>
        <p className="text-sm text-gray-400 mb-4">Teste extrair e reproduzir um vídeo usando a API Terabox 3.0.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={testUrl}
            onChange={e => setTestUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleTest(); }}
            placeholder="Ex: https://terabox.com/s/..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleTest}
            disabled={loading || !testUrl}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={18} />}
            Testar
          </button>
        </div>
        {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
        {testQualities.length > 0 && (
          <div className="mt-6 bg-black/40 border border-violet-500/20 rounded-xl p-4 space-y-3">
            <div className="text-xs font-black uppercase tracking-widest text-violet-400">
              Rotas Disponíveis ({testQualities.length}) — clique para testar no player
            </div>
            <div className="space-y-2">
              {testQualities.map(q => {
                const isActive = (testSelectedQuality || testQualities[0].id) === q.id;
                const typeColor: Record<string, string> = {
                  auto: 'text-green-400', stream: 'text-blue-400', stream_url: 'text-blue-300',
                  direct: 'text-yellow-400', stream_download: 'text-orange-400',
                  '1080p': 'text-purple-400', '720p': 'text-purple-300', '480p': 'text-gray-400',
                  '360p': 'text-gray-500', '240p': 'text-gray-600',
                };
                const typeIcon: Record<string, string> = {
                  auto: '📡', stream: '🎞️', stream_url: '🎞️', direct: '🔗', stream_download: '⬇️',
                  '1080p': '🎬', '720p': '🎬', '480p': '📺', '360p': '📺', '240p': '📺',
                };
                return (
                  <div
                    key={q.id}
                    onClick={() => setTestSelectedQuality(q.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-violet-500/20 border-violet-500/50' : 'bg-white/3 border-white/5 hover:bg-white/8 hover:border-white/15'}`}
                  >
                    <span className="text-lg">{typeIcon[q.id] || '▶️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-black ${typeColor[q.id] || 'text-white'}`}>{q.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{(q as any).desc || ''}</div>
                    </div>
                    <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${isActive ? 'bg-violet-500 text-white border-violet-400' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                      <Play size={10} /> {isActive ? 'Testando' : 'Testar'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {videoUrlToPlay && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black">
            <div className="bg-white/5 p-3 flex items-center gap-2 border-b border-white/10">
              <Video size={16} className="text-violet-400" />
              <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">Preview do Vídeo {testSelectedQuality && <span className="text-violet-400 ml-2">— {testSelectedQuality}</span>}</span>
            </div>
            <video ref={videoRef} controls className="w-full aspect-video outline-none" autoPlay />
          </div>
        )}
        {testResult && (
          <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl overflow-x-auto">
            <h4 className="font-bold text-gray-300 mb-2 text-sm uppercase">Resultado Bruto da API</h4>
            <pre className="text-xs text-violet-400 whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
