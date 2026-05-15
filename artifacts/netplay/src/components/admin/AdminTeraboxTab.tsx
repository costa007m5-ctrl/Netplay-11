import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Database, Link as LinkIcon, CheckCircle2, ShieldCheck, Play, Video, RefreshCw, FolderSearch, Plus, Save, Layers, Zap, Tv } from 'lucide-react';
import Hls from 'hls.js';
import { Movie } from '../../types';
import tmdb, { fetchSeasonDetailsWithFallback } from '../../services/tmdb';
import { makeDynamicRef, makeDynamicRefV2, isDynamicRef } from '../../services/terabox';
import { parseSeasonEpisode, parseEpisodeName, QUALITY_RE, stripGroupTags } from '../../utils/episodeParser';

export default function AdminTeraboxTab({ movies, onUpdateMovie, onAddMovie }: { movies: Movie[], onUpdateMovie: Function, onAddMovie: Function }) {
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSelectedQuality, setTestSelectedQuality] = useState<string | null>(null);

  // For Mass Import / Scanner (movies)
  const [folderUrl, setFolderUrl] = useState('');
  const [folderScanning, setFolderScanning] = useState(false);
  const [folderResults, setFolderResults] = useState<any[]>([]);
  const [scanningStatus, setScanningStatus] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [dynamicLinkMode, setDynamicLinkMode] = useState(true);

  // For Series Season Import
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
  const [seasonApiVersion, setSeasonApiVersion] = useState<'v1' | 'v2'>('v2');
  const [seasonScanStatus, setSeasonScanStatus] = useState('');
  const [movieApiVersion, setMovieApiVersion] = useState<'v1' | 'v2'>('v2');
  const [autoDetectStatus, setAutoDetectStatus] = useState('');

  // For Mass Update
  const [updatingMode, setUpdatingMode] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTest = async () => {
    if (!testUrl) return;
    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(testUrl)}`);
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
    if (!testVid) return [] as { id: string; label: string; url: string }[];
    const fs = testVid.fast_stream_url || {};
    const native = typeof testVid.quality === 'string' ? testVid.quality : undefined;
    const order = [
      { k:'1080p', label:'1080p (Full HD)' },
      { k:'720p',  label:'720p (HD)' },
      { k:'480p',  label:'480p (SD)' },
      { k:'360p',  label:'360p' },
      { k:'240p',  label:'240p' },
    ];
    const list: { id: string; label: string; url: string }[] = [];
    for (const o of order) {
      if (fs[o.k] && typeof fs[o.k] === 'string') {
        list.push({ id: o.k, label: o.label + (native === o.k ? ' [nativa]' : ''), url: fs[o.k] });
      }
    }
    const direct = testVid.normal_dlink || testVid.stream_url || testVid.url || testVid.video_url || testVid.src || (testVid.data && testVid.data.url) || testVid.dlink;
    if (direct && !list.some(q => q.url === direct)) list.push({ id: 'direct', label: 'Download Direto', url: direct });
    return list;
  }, [testVid]);

  const videoUrlToPlay = React.useMemo(() => {
    if (!testQualities.length) return null;
    if (testSelectedQuality) {
      const found = testQualities.find(q => q.id === testSelectedQuality);
      if (found) return found.url;
    }
    return testQualities[0].url;
  }, [testQualities, testSelectedQuality]);

  // Reset selected quality when test result changes
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
    
    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoUrlToPlay]);

  // Mass Import / Scan Folder (movies)
  const handleScanFolder = async () => {
    if (!folderUrl) return;
    setFolderScanning(true);
    setScanningStatus('Buscando arquivos na pasta...');
    setFolderResults([]);

    try {
      let list: any[] = [];

      if (movieApiVersion === 'v2') {
        // V2 suporta paginação — busca TODOS os arquivos sem limite
        const allItems: any[] = [];
        const seenNames = new Set<string>();
        let page = 1;
        let totalExpected: number | null = null;
        const MAX_PAGES = 50;

        while (page <= MAX_PAGES) {
          setScanningStatus(`Buscando arquivos (V2)... página ${page} — ${allItems.length} encontrados`);
          const res = await fetch(`/api/terabox-v2?url=${encodeURIComponent(folderUrl)}&page=${page}`);
          const data = await res.json();
          if (!res.ok) throw new Error(`${data.error}: ${data.details || ''}`);
          const pageList: any[] = data.list || [];
          if (typeof data.total_files === 'number' && totalExpected == null) totalExpected = data.total_files;
          let newCount = 0;
          for (const item of pageList) {
            const name = item.filename || item.name;
            if (!name || seenNames.has(name)) continue;
            seenNames.add(name);
            allItems.push(item);
            newCount++;
          }
          if (newCount === 0) break;
          if (totalExpected != null && allItems.length >= totalExpected) break;
          if (pageList.length < 5) break;
          page++;
        }
        list = allItems;
      } else {
        // V1 não suporta paginação — retorna até ~20 arquivos por chamada
        const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(folderUrl)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(`${data.error}: ${data.details || ''}`);
        list = data.list || [];
        if (!list.length && data.url) list = [data];
      }

      setScanningStatus(`Rastreando ${list.length} arquivos no TMDB...`);

      const mapped = [];
      for (const item of list) {
        const filename = item.filename || item.name || 'Desconhecido';

        let searchName = filename.replace(/\.(mp4|mkv|avi|webm|ts)$/i, '');
        searchName = searchName.replace(/[\(\[]\d{4}[\)\]]/g, '');
        searchName = searchName.replace(/720p|1080p|4k|2160p/gi, '');
        searchName = searchName.replace(/WEB-DL|WEBRip|BluRay|HDRip|x264|x265|HEVC/gi, '');
        searchName = searchName.replace(/[\.\-_]/g, ' ').replace(/\s+/g, ' ').trim();

        const resSearch = await tmdb.get(`/search/multi?query=${encodeURIComponent(searchName)}`);
        const searchRes = resSearch.data.results || [];
        let bestMatch = searchRes && searchRes.length > 0 ? searchRes[0] : null;

        const availableQualities = item.fast_stream_url && typeof item.fast_stream_url === 'object'
          ? Object.keys(item.fast_stream_url).filter(k => /^\d+p$/.test(k))
          : [];
        mapped.push({
          imported_filename: filename,
          url: folderUrl,
          tmdb_match: bestMatch,
          selected: true,
          availableQualities,
          searchName,
          searching: false,
        });
      }

      setFolderResults(mapped);
      setScanningStatus(`Concluído: ${list.length} arquivo(s) encontrado(s). Revise e adicione.`);
    } catch (err: any) {
      alert("Erro na varredura: " + err.message);
      setScanningStatus('Erro na varredura.');
    } finally {
      setFolderScanning(false);
    }
  };

  // Series Season Import
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

  const handleScanAllSeasons = async () => {
    if (!selectedSeries) return alert('Selecione uma série primeiro.');
    const validFolders = seasonFolders.filter(sf => sf.folderUrl.trim());
    if (!validFolders.length) return alert('Adicione pelo menos um link de pasta de temporada.');

    setSeasonScanning(true);
    setSeasonScanResults({});
    const results: Record<number, any[]> = {};

    const endpoint = seasonApiVersion === 'v2' ? '/api/terabox-v2' : '/api/terabox-pro';
    const MAX_PAGES = 20; // safety cap (~ thousands of files)
    for (const sf of validFolders) {
      try {
        const allItems: any[] = [];
        const seenNames = new Set<string>();
        let page = 1;
        let totalExpected: number | null = null;

        while (page <= MAX_PAGES) {
          setSeasonScanStatus(`Escaneando T${sf.season} (${seasonApiVersion.toUpperCase()}) — página ${page}, ${allItems.length} arquivos...`);
          const pageUrl = `${endpoint}?url=${encodeURIComponent(sf.folderUrl)}${seasonApiVersion === 'v2' ? `&page=${page}` : ''}`;
          const res = await fetch(pageUrl);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Falha página ${page}`);
          const list: any[] = data.list || [];
          if (typeof data.total_files === 'number' && totalExpected == null) totalExpected = data.total_files;

          let newCount = 0;
          for (const item of list) {
            const name = item.filename || item.name;
            if (!name || seenNames.has(name)) continue;
            seenNames.add(name);
            allItems.push(item);
            newCount++;
          }

          // V1 doesn't paginate — stop after 1 page
          if (seasonApiVersion === 'v1') break;
          // No new items → stop
          if (newCount === 0) break;
          // Reached known total → stop
          if (totalExpected != null && allItems.length >= totalExpected) break;
          // Page returned less than ~5 → likely last page
          if (list.length < 5) break;

          page++;
        }

        // Sort naturally so episode numbering is consistent
        allItems.sort((a, b) => {
          const an = (a.filename || a.name || '').toLowerCase();
          const bn = (b.filename || b.name || '').toLowerCase();
          return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
        });

        results[sf.season] = allItems.map((item: any, idx: number) => ({
          filename: item.filename || item.name || `arquivo_${idx + 1}`,
          season: sf.season,
          episode: idx + 1,
          folderUrl: sf.folderUrl,
          selected: true,
          apiVersion: seasonApiVersion,
          availableQualities: item.fast_stream_url && typeof item.fast_stream_url === 'object'
            ? Object.keys(item.fast_stream_url).filter((k: string) => /^\d+p$/.test(k))
            : [],
        }));
      } catch (e: any) {
        setSeasonScanStatus(`Erro na Temporada ${sf.season}: ${e.message}`);
        results[sf.season] = [];
      }
    }

    setSeasonScanResults(results);
    setSeasonScanStatus('Varredura completa. Revise os episódios e salve.');
    setSeasonScanning(false);
  };

  // Parsing de S/E importado do utilitário compartilhado (ver utils/episodeParser.ts)
  // Inclui suporte a: S01E03, 1x03, T01E03, Temporada/Episodio, ABC.002 (código+ep), EP03, etc.

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

  // Retorna o set de "season-episode" já salvos no banco para a série selecionada
  const getExistingEpisodesKey = (): Set<string> => {
    const set = new Set<string>();
    if (!selectedSeries) return set;
    const existing = movies.find(m =>
      m.id === selectedSeries.id ||
      m.title === (selectedSeries.name || selectedSeries.original_name)
    );
    if (!existing || !Array.isArray((existing as any).episodes)) return set;
    for (const ep of (existing as any).episodes) {
      const s = Number(ep.season);
      const e = Number(ep.episode);
      // Considera "já salvo" só se tiver videoUrl (não é placeholder vazio)
      if (s >= 0 && e >= 1 && (ep.videoUrl || ep.video_url)) {
        set.add(`${s}-${e}`);
      }
    }
    return set;
  };

  const handleRemoveAlreadySaved = () => {
    if (!Object.keys(seasonScanResults).length) return;
    if (!selectedSeries) {
      setAutoDetectStatus('Selecione uma série primeiro pra checar o banco.');
      setTimeout(() => setAutoDetectStatus(''), 5000);
      return;
    }
    const existingKeys = getExistingEpisodesKey();
    if (!existingKeys.size) {
      setAutoDetectStatus('Nenhum episódio dessa série salvo no banco ainda — nada pra remover.');
      setTimeout(() => setAutoDetectStatus(''), 5000);
      return;
    }
    let removed = 0;
    const cleaned: Record<number, any[]> = {};
    for (const seasonStr of Object.keys(seasonScanResults)) {
      const sNum = Number(seasonStr);
      const kept = (seasonScanResults[sNum] as any[]).filter((f) => {
        const key = `${f.season}-${f.episode}`;
        if (existingKeys.has(key)) {
          removed++;
          return false;
        }
        return true;
      });
      if (kept.length) cleaned[sNum] = kept;
    }
    setSeasonScanResults(cleaned);
    setAutoDetectStatus(
      `${removed} episódio${removed === 1 ? '' : 's'} removido${removed === 1 ? '' : 's'} (já estava${removed === 1 ? '' : 'm'} salvo${removed === 1 ? '' : 's'} no banco).`
    );
    setTimeout(() => setAutoDetectStatus(''), 8000);
  };

  const handleAutoDetectSE = () => {
    if (!Object.keys(seasonScanResults).length) return;
    const allFiles: any[] = [];
    for (const seasonStr of Object.keys(seasonScanResults)) {
      for (const f of seasonScanResults[Number(seasonStr)]) allFiles.push(f);
    }

    // Episódios já salvos no banco para a série selecionada (se houver)
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
        // Pula se já está salvo no banco
        if (existingKeys.has(`${parsed.season}-${parsed.episode}`)) {
          skippedDup++;
          continue;
        }
        if (!newGrouped[parsed.season]) newGrouped[parsed.season] = [];
        newGrouped[parsed.season].push({
          ...file,
          season: parsed.season,
          episode: parsed.episode,
          detectedEpisodeName: detectedEpisodeName || undefined,
          detectedBySE: true,
        });
        if (detectedEpisodeName) detectedByName++;
        detected++;
      } else {
        const fallback = file.season || 1;
        if (!fallbackBySeason[fallback]) fallbackBySeason[fallback] = [];
        fallbackBySeason[fallback].push({
          ...file,
          detectedEpisodeName: detectedEpisodeName || undefined,
          detectedBySE: false,
        });
        unmatched++;
      }
    }

    // Append unmatched files to the end of their original season, renumbering
    for (const seasonStr of Object.keys(fallbackBySeason)) {
      const sNum = Number(seasonStr);
      if (!newGrouped[sNum]) newGrouped[sNum] = [];
      const startEp = newGrouped[sNum].length
        ? Math.max(...newGrouped[sNum].map(x => x.episode || 0)) + 1
        : 1;
      fallbackBySeason[sNum].forEach((f, idx) => {
        newGrouped[sNum].push({ ...f, season: sNum, episode: startEp + idx });
      });
    }

    // Sort each season by episode number
    for (const s of Object.keys(newGrouped)) {
      newGrouped[Number(s)].sort((a, b) => (a.episode || 0) - (b.episode || 0));
    }

    setSeasonScanResults(newGrouped);
    setAutoDetectStatus(
      `Detectado: ${detected} arquivo${detected === 1 ? '' : 's'} reorganizado${detected === 1 ? '' : 's'} em ${Object.keys(newGrouped).length} temporada${Object.keys(newGrouped).length === 1 ? '' : 's'}` +
      (detectedByName ? ` • ${detectedByName} com nome de episódio extraído do filename` : '') +
      (skippedDup ? ` • ${skippedDup} já salvo${skippedDup === 1 ? '' : 's'} no banco (removido${skippedDup === 1 ? '' : 's'})` : '') +
      (unmatched ? ` • ${unmatched} sem padrão (mantido${unmatched === 1 ? '' : 's'} no fim)` : '') + '.'
    );
    setTimeout(() => setAutoDetectStatus(''), 10000);
  };

  const handleEnrichTmdbSynopses = async () => {
    if (!selectedSeries) return alert('Selecione uma série primeiro.');
    if (!Object.keys(seasonScanResults).length) return;
    setEnrichingTmdb(true);
    try {
      let totalFilled = 0;
      let matchedByName = 0;
      let fixedSeasonEp = 0;

      // 1. Pré-carrega dados TMDB de todas as temporadas presentes
      const allSeasonNums = Object.keys(seasonScanResults).map(Number);
      const tmdbSeasons: Record<number, any[]> = {};
      for (const seasonNum of allSeasonNums) {
        setEnrichStatus(`Carregando Temporada ${seasonNum} do TMDB...`);
        try {
          const seasonData = await fetchSeasonDetailsWithFallback(selectedSeries.id, seasonNum);
          tmdbSeasons[seasonNum] = Array.isArray(seasonData?.data?.episodes) ? seasonData.data.episodes : [];
        } catch (e: any) {
          console.warn(`[TMDB] Falha Temporada ${seasonNum}:`, e.message);
          tmdbSeasons[seasonNum] = [];
        }
      }

      // 2. Mapa cross-season por nome normalizado (para arquivos sem SxxExx)
      const crossByName = new Map<string, { ep: any; seasonNum: number }>();
      for (const [sNum, eps] of Object.entries(tmdbSeasons)) {
        for (const ep of eps) {
          if (ep.name) {
            const key = normalizeEpName(ep.name);
            if (!crossByName.has(key)) crossByName.set(key, { ep, seasonNum: Number(sNum) });
          }
        }
      }

      // 3. Processa arquivos de cada temporada
      const newGrouped: Record<number, any[]> = {};

      for (const [seasonStr, files] of Object.entries(seasonScanResults)) {
        const seasonNum = Number(seasonStr);
        const eps = tmdbSeasons[seasonNum] || [];
        const byNum = new Map<number, any>();
        const byName = new Map<string, any>();
        for (const e of eps) {
          byNum.set(Number(e.episode_number), e);
          if (e.name) byName.set(normalizeEpName(e.name), e);
        }

        for (const file of files as any[]) {
          let match: any = null;
          let usedNameMatch = false;
          let resolvedSeason = seasonNum;

          if (file.detectedBySE !== false) {
            // — Arquivo COM SxxExx detectado —
            // Nome é mais confiável que número (número pode estar errado no arquivo)

            // 1ª: por nome extraído do filename, dentro da temporada
            if (file.detectedEpisodeName) {
              const norm = normalizeEpName(file.detectedEpisodeName);
              match = byName.get(norm);
              if (!match) {
                let best = 0, bestM: any = null;
                for (const [k, ep] of byName) {
                  const s = epNameScore(norm, k);
                  if (s > best && s >= 0.5) { best = s; bestM = ep; }
                }
                if (bestM) match = bestM;
              }
              if (match) usedNameMatch = true;
            }

            // 2ª: por nome extraído, buscando em TODAS as temporadas (número pode estar na temporada errada)
            if (!match && file.detectedEpisodeName) {
              const norm = normalizeEpName(file.detectedEpisodeName);
              const found = crossByName.get(norm);
              if (found) { match = found.ep; resolvedSeason = found.seasonNum; usedNameMatch = true; }
              if (!match) {
                let best = 0, bestM: any = null, bestS = seasonNum;
                for (const [k, { ep, seasonNum: sn }] of crossByName) {
                  const s = epNameScore(norm, k);
                  if (s > best && s >= 0.5) { best = s; bestM = ep; bestS = sn; }
                }
                if (bestM) { match = bestM; resolvedSeason = bestS; usedNameMatch = true; }
              }
            }

            // 3ª: por número de episódio (fallback — pode estar errado no arquivo)
            if (!match) {
              match = byNum.get(Number(file.episode));
            }

            // 4ª: filename completo contra todas as temporadas (último recurso)
            if (!match) {
              const fnorm = normalizeEpName(file.filename || '');
              let best = 0, bestM: any = null, bestS = seasonNum;
              for (const [k, { ep, seasonNum: sn }] of crossByName) {
                const s = epNameScore(fnorm, k);
                if (s > best && s >= 0.65) { best = s; bestM = ep; bestS = sn; }
              }
              if (bestM) { match = bestM; resolvedSeason = bestS; usedNameMatch = true; }
            }
          } else {
            // — Arquivo SEM SxxExx — busca por nome em TODAS as temporadas —
            const candidate = file.detectedEpisodeName || '';
            if (candidate) {
              const norm = normalizeEpName(candidate);
              // Exato cross-season
              const found = crossByName.get(norm);
              if (found) { match = found.ep; resolvedSeason = found.seasonNum; usedNameMatch = true; }

              // Fuzzy cross-season (threshold menor pois é o único critério)
              if (!match) {
                let best = 0, bestM: any = null, bestS = seasonNum;
                for (const [k, { ep, seasonNum: sn }] of crossByName) {
                  const s = epNameScore(norm, k);
                  if (s > best && s >= 0.4) { best = s; bestM = ep; bestS = sn; }
                }
                if (bestM) { match = bestM; resolvedSeason = bestS; usedNameMatch = true; }
              }
            }

            // Filename completo cross-season (threshold médio)
            if (!match) {
              const fnorm = normalizeEpName(file.filename || '');
              let best = 0, bestM: any = null, bestS = seasonNum;
              for (const [k, { ep, seasonNum: sn }] of crossByName) {
                const s = epNameScore(fnorm, k);
                if (s > best && s >= 0.55) { best = s; bestM = ep; bestS = sn; }
              }
              if (bestM) { match = bestM; resolvedSeason = bestS; usedNameMatch = true; }
            }
          }

          const didFix = match && (resolvedSeason !== seasonNum || (usedNameMatch && match.episode_number !== file.episode));
          const enriched = match ? {
            ...file,
            season: resolvedSeason,
            episode: match.episode_number,
            tmdbTitle: match.name || '',
            tmdbOverview: match.overview || '',
            tmdbStillPath: match.still_path ? `https://image.tmdb.org/t/p/w300${match.still_path}` : undefined,
          } : file;

          if (match) { totalFilled++; if (usedNameMatch) matchedByName++; if (didFix) fixedSeasonEp++; }
          const targetSeason = match ? resolvedSeason : seasonNum;
          if (!newGrouped[targetSeason]) newGrouped[targetSeason] = [];
          newGrouped[targetSeason].push(enriched);
        }
      }

      // Ordena cada temporada por número de episódio
      for (const s of Object.keys(newGrouped)) {
        (newGrouped[Number(s)] as any[]).sort((a, b) => (a.episode || 0) - (b.episode || 0));
      }

      setSeasonScanResults(newGrouped);
      setEnrichStatus(
        `${totalFilled} episódios enriquecidos com info do TMDB` +
        (matchedByName ? ` • ${matchedByName} encontrado${matchedByName === 1 ? '' : 's'} pelo nome` : '') +
        (fixedSeasonEp ? ` • ${fixedSeasonEp} temporada/episódio corrigido${fixedSeasonEp === 1 ? '' : 's'} automaticamente` : '') +
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
      // Enriquecimento automático: busca metadados TMDB de todas as temporadas
      // selecionadas (sinopse, nome, data, runtime, nota, banner) antes de salvar.
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
          console.warn(`[TMDB enrich] Falha na Temporada ${s}:`, e.message);
          tmdbBySeason[s] = new Map();
        }
      }
      setEnrichStatus('');

      // Build episodes array from scan results (já enriquecido)
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
            videoUrl: file.apiVersion === 'v2'
              ? makeDynamicRefV2(file.folderUrl, file.filename)
              : makeDynamicRef(file.folderUrl, file.filename),
            overview: tmdbEp?.overview || file.tmdbOverview || '',
            still_path: stillFromTmdb || file.tmdbStillPath || (selectedSeries.backdrop_path
              ? `https://image.tmdb.org/t/p/w300${selectedSeries.backdrop_path}`
              : undefined),
            ...(tmdbEp?.air_date ? { release_date: tmdbEp.air_date } : {}),
            ...(tmdbEp?.runtime ? { runtime: tmdbEp.runtime } : {}),
            ...(tmdbEp?.vote_average !== undefined && tmdbEp?.vote_average !== null ? { rating: tmdbEp.vote_average } : {}),
            ...(file.preferredQuality && file.preferredQuality !== 'auto' ? { preferredQuality: file.preferredQuality } : {}),
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
          if (idx >= 0) {
            mergedEpisodes[idx] = { ...mergedEpisodes[idx], ...ep };
          } else {
            mergedEpisodes.push(ep);
          }
        }
        mergedEpisodes.sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);
        await onUpdateMovie({ ...existingMovie, episodes: mergedEpisodes, type: 'series' });
        alert(`Série atualizada com ${allEpisodes.length} episódios!`);
      } else {
        const newSeries = {
          id: selectedSeries.id,
          title: selectedSeries.name || selectedSeries.original_name,
          name: selectedSeries.name || selectedSeries.original_name,
          original_name: selectedSeries.original_name,
          overview: selectedSeries.overview || '',
          backdrop_path: selectedSeries.backdrop_path
            ? `https://image.tmdb.org/t/p/original${selectedSeries.backdrop_path}`
            : 'https://picsum.photos/seed/series/1920/1080',
          poster_path: selectedSeries.poster_path
            ? `https://image.tmdb.org/t/p/w500${selectedSeries.poster_path}`
            : 'https://picsum.photos/seed/series/500/750',
          type: 'series' as const,
          genres: genreNames,
          vote_average: selectedSeries.vote_average || 0,
          first_air_date: selectedSeries.first_air_date,
          episodes: allEpisodes,
        };
        await onAddMovie(newSeries);
        alert(`Série adicionada com ${allEpisodes.length} episódios via Link Dinâmico!`);
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

  const handleResearchTmdb = async (idx: number) => {
    const item = folderResults[idx];
    if (!item || !item.searchName?.trim()) return;
    const copy = [...folderResults];
    copy[idx].searching = true;
    setFolderResults(copy);
    try {
      const r = await tmdb.get(`/search/multi?query=${encodeURIComponent(item.searchName.trim())}`);
      const results = r.data.results || [];
      const next = [...folderResults];
      next[idx].tmdb_match = results.length > 0 ? results[0] : null;
      next[idx].searching = false;
      setFolderResults(next);
    } catch (e: any) {
      const next = [...folderResults];
      next[idx].searching = false;
      setFolderResults(next);
      alert('Erro ao buscar: ' + e.message);
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

        // Busca detalhes COMPLETOS do TMDB (runtime, gêneros, watch providers, etc.)
        let fullDetails: any = null;
        if (t?.id) {
          try {
            setScanningStatus(`Buscando detalhes completos: ${t.title || t.name}...`);
            const endpoint = type === 'series' ? `/tv/${t.id}` : `/movie/${t.id}`;
            const detRes = await tmdb.get(endpoint, {
              params: { language: 'pt-BR', append_to_response: 'watch/providers,content_ratings,release_dates' },
            });
            fullDetails = detRes.data;
          } catch (e: any) {
            console.warn(`[TMDB details] falhou para ${t.id}:`, e.message);
          }
        }

        // Gêneros: prioriza fullDetails.genres (nomes prontos) sobre genre_ids
        let genreNames = 'Outros';
        if (fullDetails?.genres?.length) {
          genreNames = fullDetails.genres.map((g: any) => g.name).filter(Boolean).join(', ') || 'Outros';
        } else if (t?.genre_ids) {
          genreNames = t.genre_ids.map((id: number) => GENRE_MAP[id]).filter(Boolean).join(', ') || 'Outros';
        }

        // Provedores de streaming (BR)
        let watchProvidersStr: string | undefined;
        const wp = fullDetails?.['watch/providers']?.results?.BR;
        if (wp) {
          const list = [...(wp.flatrate || []), ...(wp.buy || []), ...(wp.rent || [])];
          const names = Array.from(new Set(list.map((p: any) => p.provider_name).filter(Boolean)));
          if (names.length) watchProvidersStr = names.join(', ');
        }

        // Idade / classificação indicativa (BR)
        let ageRating: string | undefined;
        if (type === 'series') {
          const br = fullDetails?.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'BR');
          ageRating = br?.rating || undefined;
        } else {
          const brR = fullDetails?.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'BR');
          ageRating = brR?.release_dates?.find((d: any) => d.certification)?.certification || undefined;
        }

        const titleOrName = fullDetails?.title || fullDetails?.name || (t ? (t.title || t.name) : item.imported_filename.replace(/\.(mp4|mkv|avi|webm|ts)$/i, ''));
        const existingMovie = movies.find(m => (t && m.id === t.id) || m.title === titleOrName || m.name === titleOrName);

        // In dynamic link mode, store a stable folder+filename reference; otherwise store folder URL directly
        const videoUrlToSave = dynamicLinkMode
          ? makeDynamicRef(folderUrl, item.imported_filename)
          : folderUrl;

        const chosenQuality = (item.preferredQuality && item.preferredQuality !== 'auto') ? item.preferredQuality : undefined;

        if (existingMovie) {
          try {
            await onUpdateMovie({
              ...existingMovie,
              videoUrl: videoUrlToSave,
              videoUrl2: videoUrlToSave,
              file_name: item.imported_filename,
              ...(chosenQuality ? { preferredQuality: chosenQuality } : {}),
              // Atualiza metadata se o TMDB trouxe algo novo
              ...(fullDetails?.overview ? { overview: fullDetails.overview } : {}),
              ...(fullDetails?.runtime ? { runtime: fullDetails.runtime } : {}),
              ...(fullDetails?.episode_run_time?.[0] ? { runtime: fullDetails.episode_run_time[0] } : {}),
              ...(fullDetails?.release_date ? { release_date: fullDetails.release_date } : {}),
              ...(fullDetails?.first_air_date ? { first_air_date: fullDetails.first_air_date } : {}),
              ...(fullDetails?.vote_average !== undefined ? { vote_average: fullDetails.vote_average } : {}),
              ...(genreNames !== 'Outros' ? { genres: genreNames } : {}),
              ...(watchProvidersStr ? { watch_providers: watchProvidersStr } : {}),
              ...(ageRating ? { age_rating: ageRating } : {}),
              ...(fullDetails?.original_language ? { original_language: fullDetails.original_language } : {}),
            });
          } catch(e) {
            errorCount++;
          }
        } else {
          const newMovie: Partial<Movie> = {
            id: t ? t.id : Date.now() + Math.random(),
            title: titleOrName,
            name: titleOrName,
            original_name: fullDetails?.original_name || fullDetails?.original_title || (t ? (t.original_name || t.original_title) : undefined),
            overview: fullDetails?.overview || (t ? t.overview : 'Adicionado via Terabox API (Info não encontrada)'),
            backdrop_path: (fullDetails?.backdrop_path || t?.backdrop_path) ? `https://image.tmdb.org/t/p/original${fullDetails?.backdrop_path || t.backdrop_path}` : 'https://picsum.photos/seed/terabox/1920/1080',
            poster_path: (fullDetails?.poster_path || t?.poster_path) ? `https://image.tmdb.org/t/p/original${fullDetails?.poster_path || t.poster_path}` : 'https://picsum.photos/seed/terabox/500/750',
            type,
            genres: genreNames,
            videoUrl: videoUrlToSave,
            videoUrl2: videoUrlToSave,
            file_name: item.imported_filename,
            ...(chosenQuality ? { preferredQuality: chosenQuality as any } : {}),
            ...(fullDetails?.runtime ? { runtime: fullDetails.runtime } : {}),
            ...(fullDetails?.episode_run_time?.[0] ? { runtime: fullDetails.episode_run_time[0] } : {}),
            ...(fullDetails?.release_date ? { release_date: fullDetails.release_date } : {}),
            ...(fullDetails?.first_air_date ? { first_air_date: fullDetails.first_air_date } : {}),
            ...(fullDetails?.vote_average !== undefined ? { vote_average: fullDetails.vote_average } : (t?.vote_average !== undefined ? { vote_average: t.vote_average } : {})),
            ...(watchProvidersStr ? { watch_providers: watchProvidersStr } : {}),
            ...(ageRating ? { age_rating: ageRating } : {}),
            ...(fullDetails?.original_language ? { original_language: fullDetails.original_language } : {}),
          } as any;
          try {
            await onAddMovie(newMovie);
          } catch(e) {
            errorCount++;
          }
        }
      }
      if (errorCount === 0) {
        alert("Conteúdos adicionados com sucesso!");
        setFolderResults([]);
        setFolderUrl('');
      } else {
        alert(`${toSave.length - errorCount} adicionados, ${errorCount} erros (alguns podem ser duplicados).`);
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // Mass Update Links
  const teraboxMovies = movies.filter(m => {
    const isRawTerabox = (url: string | undefined): boolean => {
      return !!url && (url.includes('terabox.com') || url.includes('teraboxapp.com') || url.includes('dubox.com') || url.includes('nephobox.com') || url.includes('1024terabox.com') || url.includes('freeterabox.com') || url.includes('4funbox.com') || url.includes('mirrobox.com') || url.includes('momerybox.com') || url.includes('teraboxlink.com') || url.includes('terafileshare.com'));
    };
    const isTera = isRawTerabox(m.videoUrl);
    const hasTeraEpisodes = m.episodes?.some(ep => isRawTerabox(ep.videoUrl));
    return isTera || hasTeraEpisodes;
  });

  const getDirectLinkFromApi = async (url: string) => {
    const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`${data.error}: ${data.details || ''}`);
    let vid = data.list && data.list.length > 0 ? data.list[0] : data;
    return vid.fast_stream_url?.['1080p'] || vid.fast_stream_url?.['720p'] || vid.fast_stream_url?.['480p'] || vid.fast_stream_url?.['360p'] || vid.normal_dlink || vid.url || vid.stream_url || vid.dlink || url;
  };

  const processUpdateSingle = async (movie: Movie) => {
    try {
      let needsUpdate = false;
      let newVideoUrl = movie.videoUrl;
      let newEpisodes = movie.episodes ? [...movie.episodes] : [];
      let updatedCount = 0;

      const isRawTerabox = (url: string | undefined): boolean => {
        return !!url && (url.includes('terabox.com') || url.includes('teraboxapp.com') || url.includes('dubox.com') || url.includes('nephobox.com') || url.includes('1024terabox.com') || url.includes('freeterabox.com') || url.includes('4funbox.com') || url.includes('mirrobox.com') || url.includes('momerybox.com') || url.includes('teraboxlink.com') || url.includes('terafileshare.com'));
      };

      if (isRawTerabox(movie.videoUrl)) {
         try {
           const newUrl = await getDirectLinkFromApi(movie.videoUrl!);
           if (newUrl && newUrl !== movie.videoUrl) {
              newVideoUrl = newUrl;
              needsUpdate = true;
              updatedCount++;
           }
         } catch(e: any) {
           console.log(`Pulo (Filme): ${movie.title} - ${e.message}`);
         }
      }

      if (movie.episodes) {
         for (let i = 0; i < newEpisodes.length; i++) {
           const ep = newEpisodes[i];
           if (isRawTerabox(ep.videoUrl)) {
              try {
                const newUrl = await getDirectLinkFromApi(ep.videoUrl!);
                if (newUrl && newUrl !== ep.videoUrl) {
                    newEpisodes[i] = { ...ep, videoUrl: newUrl };
                    needsUpdate = true;
                    updatedCount++;
                }
              } catch(e: any) {
                console.log(`Pulo (Ep ${ep.episode}): ${movie.title} - ${e.message}`);
              }
           }
         }
      }

      if (needsUpdate) {
         await onUpdateMovie({ ...movie, videoUrl: newVideoUrl, episodes: newEpisodes });
         setUpdateLog(prev => [`[OK] ${movie.title || movie.name} atualizado (${updatedCount} links).`, ...prev]);
      } else {
         setUpdateLog(prev => [`[Ignorado] ${movie.title || movie.name} (Links inalterados)`, ...prev]);
      }
    } catch (e: any) {
      setUpdateLog(prev => [`[ERRO] ${movie.title || movie.name}: ${e.message}`, ...prev]);
    }
  };

  const handleUpdateAll = async () => {
    if (!confirm(`Tem certeza que deseja processar ${teraboxMovies.length} filmes usando a API XAPIverse? Esta ação irá converter os links de origem para links diretos.`)) return;
    
    setUpdating(true);
    setUpdateLog([]);
    for (const movie of teraboxMovies) {
       await processUpdateSingle(movie);
       // Add a delay to avoid rate limiting
       await new Promise(r => setTimeout(r, 2500));
    }
    setUpdating(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-cyan-400">
          <Database size={36} /> Terabox Pro API
        </h2>
        <p className="text-gray-400 text-sm mt-2">
          Integração automática para links Terabox e KingX usando a API XAPIverse.
        </p>
      </div>

      <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/30 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="text-cyan-400" size={24} />
            <h3 className="text-xl font-bold">Status da Configuração</h3>
        </div>
        <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div> Ativo e Configurado no Servidor
        </div>
        <p className="text-sm text-gray-400 mt-2">
          O servidor está configurado para utilizar a chave de API <code>xAPIverse-Key</code>.
          O endpoint local <code>/api/terabox-pro</code> processará os links automaticamente no player e ferramentas abaixo.
        </p>
      </div>

      {/* === SERIES SEASON IMPORT === */}
      <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-purple-400">
          <Tv size={20} /> Importar Série por Temporada (Link Dinâmico)
        </h3>
        <p className="text-xs text-gray-400 mb-5">
          Para cada temporada, informe o link da pasta do Terabox. Os episódios serão salvos como referências estáveis — ao assistir, o link fresco é obtido automaticamente.
        </p>

        {/* Search series on TMDB */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={seriesSearchTitle}
            onChange={e => setSeriesSearchTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchSeries()}
            placeholder="Buscar série no TMDB (ex: Breaking Bad)..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSearchSeries}
            disabled={seriesSearching || !seriesSearchTitle.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            {seriesSearching ? <RefreshCw size={14} className="animate-spin" /> : <FolderSearch size={14} />}
            Buscar
          </button>
        </div>

        {/* TMDB results */}
        {seriesSearchResults.length > 0 && !selectedSeries && (
          <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
            {seriesSearchResults.slice(0, 8).map((s: any) => (
              <button
                key={s.id}
                onClick={() => { setSelectedSeries(s); setSeriesSearchResults([]); }}
                className="w-full flex items-center gap-3 bg-black/40 hover:bg-purple-600/20 border border-white/5 hover:border-purple-500/40 p-3 rounded-xl text-left transition-all"
              >
                {s.poster_path && (
                  <img src={`https://image.tmdb.org/t/p/w92${s.poster_path}`} className="w-10 h-14 object-cover rounded-lg" alt="" />
                )}
                <div>
                  <div className="text-white font-bold text-sm">{s.name || s.original_name}</div>
                  <div className="text-gray-500 text-xs">{s.first_air_date?.split('-')[0]} · {s.vote_average?.toFixed(1)}⭐</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected series info */}
        {selectedSeries && (
          <div className="flex items-center gap-4 bg-purple-600/10 border border-purple-500/30 rounded-xl p-3 mb-4">
            {selectedSeries.poster_path && (
              <img src={`https://image.tmdb.org/t/p/w92${selectedSeries.poster_path}`} className="w-12 h-16 object-cover rounded-lg" alt="" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold">{selectedSeries.name}</div>
              <div className="text-gray-400 text-xs">{selectedSeries.first_air_date?.split('-')[0]}</div>
            </div>
            <button onClick={() => { setSelectedSeries(null); setSeasonScanResults({}); }} className="text-gray-500 hover:text-red-400 text-xs font-bold transition-colors">Trocar</button>
          </div>
        )}

        {/* Season folder inputs */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-300">Pastas por Temporada</span>
            <button
              onClick={() => setSeasonFolders(prev => [...prev, { season: prev.length + 1, folderUrl: '' }])}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus size={12} /> Adicionar Temporada
            </button>
          </div>
          {seasonFolders.map((sf, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-300 font-bold text-xs min-w-[80px] text-center">
                T{sf.season}
              </div>
              <input
                type="text"
                value={sf.folderUrl}
                onChange={e => {
                  const copy = [...seasonFolders];
                  copy[idx].folderUrl = e.target.value;
                  setSeasonFolders(copy);
                }}
                placeholder={`Link da pasta da Temporada ${sf.season}...`}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
              {seasonFolders.length > 1 && (
                <button
                  onClick={() => setSeasonFolders(prev => prev.filter((_, i) => i !== idx))}
                  className="text-gray-600 hover:text-red-400 transition-colors px-2"
                >✕</button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3 bg-black/30 rounded-xl p-2 border border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">API:</span>
          <button
            type="button"
            onClick={() => setSeasonApiVersion('v1')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${seasonApiVersion === 'v1' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            title="API antiga (xapiverse). Limite ~5 arquivos por pasta."
          >V1 (limite 5)</button>
          <button
            type="button"
            onClick={() => setSeasonApiVersion('v2')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${seasonApiVersion === 'v2' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            title="API nova (teraboxdl). Sem limite de arquivos. Recomendada para pastas grandes."
          >V2 (sem limite) ⭐</button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleScanAllSeasons}
            disabled={seasonScanning || !selectedSeries}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
          >
            {seasonScanning ? <RefreshCw size={14} className="animate-spin" /> : <Layers size={14} />}
            {seasonScanning ? seasonScanStatus : `Escanear Temporadas (${seasonApiVersion.toUpperCase()})`}
          </button>
          {Object.keys(seasonScanResults).length > 0 && (
            <button
              onClick={handleAutoDetectSE}
              title="Lê o nome de cada arquivo (1x03, S01E03, Temp 1 Ep 3, etc), move pra temporada/episódio certo e remove os que já estão salvos no banco"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
            >
              <Zap size={14} />
              Auto-detectar S/E
            </button>
          )}
          {Object.keys(seasonScanResults).length > 0 && (
            <button
              onClick={handleRemoveAlreadySaved}
              title="Verifica no banco e remove da lista os episódios que já foram salvos antes pra essa série"
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
            >
              <CheckCircle2 size={14} />
              Remover já salvos
            </button>
          )}
          {Object.keys(seasonScanResults).length > 0 && (
            <button
              onClick={handleEnrichTmdbSynopses}
              disabled={enrichingTmdb || !selectedSeries}
              title="Busca título e sinopse de cada episódio no TMDB pela série selecionada"
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
            >
              {enrichingTmdb ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
              Buscar Sinopses TMDB
            </button>
          )}
          {Object.keys(seasonScanResults).length > 0 && (
            <button
              onClick={handleSaveSeasonEpisodes}
              disabled={seasonSaveLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
            >
              {seasonSaveLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar Episódios
            </button>
          )}
        </div>
        {seasonScanStatus && !seasonScanning && <div className="mt-3 text-xs text-purple-400 font-bold">{seasonScanStatus}</div>}
        {enrichStatus && <div className="mt-1 text-xs text-blue-400 font-bold">{enrichStatus}</div>}
        {autoDetectStatus && <div className="mt-1 text-xs text-amber-400 font-bold">{autoDetectStatus}</div>}

        {/* Season scan results */}
        {Object.keys(seasonScanResults).length > 0 && (
          <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-1">
            {Object.entries(seasonScanResults).map(([season, files]) => (
              <div key={season}>
                <div className="text-xs font-black uppercase tracking-widest text-purple-400 mb-2">Temporada {season} ({(files as any[]).length} episódios)</div>
                <div className="space-y-1">
                  {(files as any[]).map((file, i) => (
                    <div key={i} className="bg-black/40 px-3 py-2 rounded-lg border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={file.selected}
                          onChange={e => {
                            const copy = { ...seasonScanResults };
                            (copy[Number(season)] as any[])[i].selected = e.target.checked;
                            setSeasonScanResults(copy);
                          }}
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="text-purple-400 font-bold text-xs min-w-[24px] shrink-0">E{file.episode}</span>
                        <input
                          type="number"
                          value={file.episode}
                          onChange={e => {
                            const copy = { ...seasonScanResults };
                            (copy[Number(season)] as any[])[i].episode = Number(e.target.value);
                            setSeasonScanResults(copy);
                          }}
                          className="w-14 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white shrink-0"
                          min={1}
                          title="Número do episódio"
                        />
                        <select
                          value={file.preferredQuality || 'auto'}
                          onChange={e => {
                            const copy = { ...seasonScanResults };
                            (copy[Number(season)] as any[])[i].preferredQuality = e.target.value;
                            setSeasonScanResults(copy);
                          }}
                          className="bg-black/60 border border-white/10 rounded-md py-0.5 px-1.5 text-[10px] font-bold text-white shrink-0"
                          title="Qualidade fixa pra esse episódio (auto = melhor disponível)"
                        >
                          <option value="auto">Auto</option>
                          {(() => {
                            const order = ['1080p','720p','480p','360p','240p'];
                            const avail: string[] = (file as any).availableQualities || [];
                            const list = avail.length ? order.filter(q => avail.includes(q)) : order.slice(0, 4);
                            return list.map(q => <option key={q} value={q}>{q}</option>);
                          })()}
                        </select>
                        <span className="text-[10px] text-green-500 font-bold shrink-0 flex items-center gap-1 ml-auto"><Zap size={10} /> Dinâmico</span>
                      </div>
                      <div
                        className="text-gray-300 text-[11px] break-all leading-snug pl-6"
                        title={file.filename}
                      >
                        {file.filename}
                      </div>
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
                          {file.tmdbOverview && (
                            <div className="text-[10px] text-gray-400 leading-relaxed line-clamp-3" title={file.tmdbOverview}>
                              {file.tmdbOverview}
                            </div>
                          )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Scanner de Pastas (Movies) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-green-400">
            <FolderSearch size={20} />
            Rastreio de Filmes
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setDynamicLinkMode(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${dynamicLinkMode ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dynamicLinkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-xs text-gray-400 font-bold">
              {dynamicLinkMode ? <span className="text-green-400 flex items-center gap-1"><Zap size={10} /> Link Dinâmico (recomendado)</span> : 'Link Direto (expira)'}
            </span>
          </div>
          {/* API version selector for movie folder scan */}
          <div className="flex items-center gap-1 mb-3 bg-black/30 rounded-xl p-1 w-fit">
            <button
              onClick={() => setMovieApiVersion('v2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${movieApiVersion === 'v2' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              V2 — Sem limite
            </button>
            <button
              onClick={() => setMovieApiVersion('v1')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${movieApiVersion === 'v1' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              V1 — ~20 arquivos
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {movieApiVersion === 'v2'
              ? 'V2 pagina automaticamente e busca TODOS os arquivos da pasta, sem limite.'
              : 'V1 retorna até ~20 arquivos por chamada (sem paginação).'}
            {' '}{dynamicLinkMode ? 'Links salvos como referências estáveis.' : 'Links salvos como pasta compartilhada (pode expirar).'}
          </p>
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

        {/* Atualizador em Massa */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-400">
            <RefreshCw size={20} />
            Atualizar Links Antigos
          </h3>
          <p className="text-xs text-gray-400 mb-4">
             Converta links do KingX/Terabox no seu catálogo para os novos links diretos gerados pela API XAPIverse.
             <strong> {teraboxMovies.length} itens encontados.</strong>
          </p>
          <button
            onClick={() => setUpdatingMode(!updatingMode)}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
          >
            Abrir Ferramenta de Atualização
          </button>
        </div>
      </div>

      {folderResults.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-green-400">Resultados da Varredura ({folderResults.length})</h3>
             <button
                onClick={handleSaveScanned}
                disabled={saveLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2"
             >
                {saveLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Adicionar Selecionados ao Catálogo
             </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
             {folderResults.map((res, i) => (
                <div key={i} className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                   <input 
                     type="checkbox" 
                     checked={res.selected}
                     onChange={(e) => {
                        const copy = [...folderResults];
                        copy[i].selected = e.target.checked;
                        setFolderResults(copy);
                     }}
                     className="w-4 h-4 rounded"
                   />
                   <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{res.imported_filename}</div>
                      <div className="text-xs text-gray-400 truncate mt-1">Match TMDB: {res.tmdb_match ? <span className="text-green-400">{res.tmdb_match.title || res.tmdb_match.name} {res.tmdb_match.release_date || res.tmdb_match.first_air_date ? `(${(res.tmdb_match.release_date || res.tmdb_match.first_air_date).slice(0,4)})` : ''}</span> : <span className="text-red-400">Não encontrado</span>}</div>
                      <div className="flex items-center gap-1 mt-2">
                        <input
                          type="text"
                          value={res.searchName || ''}
                          onChange={(e) => {
                            const copy = [...folderResults];
                            copy[i].searchName = e.target.value;
                            setFolderResults(copy);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleResearchTmdb(i); }}
                          placeholder="Editar nome para buscar novamente..."
                          className="flex-1 bg-black/60 border border-white/10 rounded-lg py-1 px-2 text-[11px] text-white"
                        />
                        <button
                          onClick={() => handleResearchTmdb(i)}
                          disabled={res.searching}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg text-[10px] font-bold"
                        >
                          {res.searching ? '...' : 'Buscar'}
                        </button>
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-1 shrink-0">
                      <label className="text-[8px] font-black text-gray-500 uppercase">Qualidade</label>
                      <select
                        value={res.preferredQuality || 'auto'}
                        onChange={(e) => {
                          const copy = [...folderResults];
                          copy[i].preferredQuality = e.target.value;
                          setFolderResults(copy);
                        }}
                        className="bg-black/60 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-bold text-white"
                        title="Qualidade fixa pra esse item (auto = sistema escolhe a melhor que funciona)"
                      >
                        <option value="auto">Auto</option>
                        {(() => {
                          const order = ['1080p','720p','480p','360p','240p'];
                          const avail: string[] = (res as any).availableQualities || [];
                          const list = avail.length ? order.filter(q => avail.includes(q)) : order.slice(0, 4);
                          return list.map(q => <option key={q} value={q}>{q}</option>);
                        })()}
                      </select>
                   </div>
                </div>
             ))}
          </div>
        </div>
      )}

      {updatingMode && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-yellow-500">Filmes/Séries com Terabox</h3>
             <button
                onClick={handleUpdateAll}
                disabled={updating || teraboxMovies.length === 0}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2"
             >
                {updating ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Otimizar Todos os Links
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
               {teraboxMovies.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                     <img src={m.backdrop_path || m.poster_path} className="w-16 h-10 object-cover rounded" alt="" />
                     <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{m.title || m.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{m.videoUrl}</div>
                     </div>
                     <button
                        onClick={async () => {
                          setUpdating(true);
                          await processUpdateSingle(m);
                          setUpdating(false);
                        }}
                        disabled={updating}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all"
                        title="Atualizar link Individual"
                     >
                        <RefreshCw size={14} className="text-yellow-500" />
                     </button>
                  </div>
               ))}
               {teraboxMovies.length === 0 && <div className="text-sm text-gray-500 p-4">Nenhum conteúdo com Terabox/KingX.</div>}
            </div>
            <div className="bg-black/60 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-gray-300 h-96 overflow-y-auto">
               <div className="text-yellow-500 font-bold mb-2 uppercase">Log de Operações</div>
               {updateLog.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.includes('[ERRO]') ? 'text-red-400' : log.includes('Ignorado') ? 'text-gray-500' : 'text-green-400'}`}>{log}</div>
               ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 mt-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <LinkIcon className="text-gray-400" size={20} />
          Testador Rápido de Player
        </h3>
        <p className="text-sm text-gray-400 mb-4">Teste extrair e rodar um vídeo diretamente nesta tela.</p>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={testUrl}
            onChange={e => setTestUrl(e.target.value)}
            placeholder="Ex: https://terabox.com/..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleTest}
            disabled={loading || !testUrl}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={18} />}
            Testar
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {testQualities.length > 0 && (
          <div className="mt-6 bg-black/40 border border-cyan-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-cyan-400">
                Qualidades Disponíveis ({testQualities.length})
              </div>
              {testVid?.quality && (
                <div className="text-[10px] text-gray-400">
                  Resolução nativa do arquivo: <span className="text-green-400 font-bold">{testVid.quality}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {testQualities.map(q => (
                <button
                  key={q.id}
                  onClick={() => setTestSelectedQuality(q.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    (testSelectedQuality || testQualities[0].id) === q.id
                      ? 'bg-cyan-500 text-black'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                  }`}
                  title={q.url}
                >
                  <Play size={12} />
                  {q.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-3">
              Clique em uma qualidade pra testar o link dela direto no preview abaixo.
            </p>
          </div>
        )}

        {videoUrlToPlay && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black">
            <div className="bg-white/5 p-3 flex items-center gap-2 border-b border-white/10">
              <Video size={16} className="text-cyan-400" />
              <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                Preview do Vídeo {testSelectedQuality && <span className="text-cyan-400 ml-2">— {testSelectedQuality}</span>}
              </span>
            </div>
            <video 
              ref={videoRef}
              controls 
              className="w-full aspect-video outline-none"
              autoPlay
            />
          </div>
        )}

        {testResult && (
          <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl overflow-x-auto">
            <h4 className="font-bold text-gray-300 mb-2 text-sm uppercase">Resultado da Extração Bruto</h4>
            <pre className="text-xs text-green-400 whitespace-pre-wrap">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
}

