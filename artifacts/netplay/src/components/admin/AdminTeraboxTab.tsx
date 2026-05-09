import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Database, Link as LinkIcon, CheckCircle2, ShieldCheck, Play, Video, RefreshCw, FolderSearch, Plus, Save, Layers, Zap, Tv } from 'lucide-react';
import Hls from 'hls.js';
import { Movie } from '../../types';
import tmdb from '../../services/tmdb';
import { makeDynamicRef, isDynamicRef } from '../../services/terabox';

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
  const [seasonScanStatus, setSeasonScanStatus] = useState('');

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
    const rank: Record<string, number> = { '240p':1, '360p':2, '480p':3, '720p':4, '1080p':5 };
    const nativeR = native && rank[native] ? rank[native] : 99;
    const order = [
      { k:'1080p', label:'1080p (Full HD)' },
      { k:'720p',  label:'720p (HD)' },
      { k:'480p',  label:'480p (SD)' },
      { k:'360p',  label:'360p' },
      { k:'240p',  label:'240p' },
    ];
    const list: { id: string; label: string; url: string }[] = [];
    for (const o of order) {
      if (fs[o.k] && typeof fs[o.k] === 'string' && (rank[o.k] || 0) <= nativeR) {
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
    setScanningStatus('Extraindo lista da pasta...');
    setFolderResults([]);
    
    try {
      const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(folderUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(`${data.error}: ${data.details || ''}`);
      
      let list = data.list || [];
      if (!list.length && data.url) {
        list = [data]; // single file fallback
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

        mapped.push({
          imported_filename: filename,
          url: folderUrl,
          tmdb_match: bestMatch,
          selected: true
        });
      }

      setFolderResults(mapped);
      setScanningStatus('Concluído. Revise os itens e adicione ou atualize.');
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

    for (const sf of validFolders) {
      setSeasonScanStatus(`Escaneando Temporada ${sf.season}...`);
      try {
        const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(sf.folderUrl)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao escanear pasta');
        const list: any[] = data.list || [];
        results[sf.season] = list.map((item: any, idx: number) => ({
          filename: item.filename || item.name || `arquivo_${idx + 1}`,
          season: sf.season,
          episode: idx + 1,
          folderUrl: sf.folderUrl,
          selected: true,
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
      // Build episodes array from scan results
      const allEpisodes: any[] = [];
      for (const [seasonStr, files] of Object.entries(seasonScanResults)) {
        const season = Number(seasonStr);
        for (const file of (files as any[])) {
          if (!file.selected) continue;
          allEpisodes.push({
            id: `s${file.season}e${file.episode}-${Date.now()}-${Math.random()}`,
            title: `Episódio ${file.episode}`,
            season: file.season,
            episode: file.episode,
            videoUrl: makeDynamicRef(file.folderUrl, file.filename),
            overview: '',
            still_path: selectedSeries.backdrop_path
              ? `https://image.tmdb.org/t/p/w300${selectedSeries.backdrop_path}`
              : undefined,
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
            });
          } catch(e) {
            errorCount++;
          }
        } else {
          const newMovie: Partial<Movie> = {
            id: t ? t.id : Date.now() + Math.random(),
            title: titleOrName,
            name: titleOrName,
            original_name: t ? (t.original_name || t.original_title) : undefined,
            overview: t ? t.overview : 'Adicionado via Terabox API (Info não encontrada)',
            backdrop_path: t?.backdrop_path ? `https://image.tmdb.org/t/p/original${t.backdrop_path}` : 'https://picsum.photos/seed/terabox/1920/1080',
            poster_path: t?.poster_path ? `https://image.tmdb.org/t/p/original${t.poster_path}` : 'https://picsum.photos/seed/terabox/500/750',
            type,
            genres: genreNames,
            videoUrl: videoUrlToSave,
            videoUrl2: videoUrlToSave,
            file_name: item.imported_filename,
            ...(chosenQuality ? { preferredQuality: chosenQuality as any } : {}),
          };
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

        <div className="flex gap-3">
          <button
            onClick={handleScanAllSeasons}
            disabled={seasonScanning || !selectedSeries}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2"
          >
            {seasonScanning ? <RefreshCw size={14} className="animate-spin" /> : <Layers size={14} />}
            {seasonScanning ? seasonScanStatus : 'Escanear Temporadas'}
          </button>
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

        {/* Season scan results */}
        {Object.keys(seasonScanResults).length > 0 && (
          <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-1">
            {Object.entries(seasonScanResults).map(([season, files]) => (
              <div key={season}>
                <div className="text-xs font-black uppercase tracking-widest text-purple-400 mb-2">Temporada {season} ({(files as any[]).length} episódios)</div>
                <div className="space-y-1">
                  {(files as any[]).map((file, i) => (
                    <div key={i} className="flex items-center gap-3 bg-black/40 px-3 py-2 rounded-lg border border-white/5">
                      <input
                        type="checkbox"
                        checked={file.selected}
                        onChange={e => {
                          const copy = { ...seasonScanResults };
                          (copy[Number(season)] as any[])[i].selected = e.target.checked;
                          setSeasonScanResults(copy);
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-purple-400 font-bold text-xs min-w-[24px]">E{file.episode}</span>
                      <input
                        type="number"
                        value={file.episode}
                        onChange={e => {
                          const copy = { ...seasonScanResults };
                          (copy[Number(season)] as any[])[i].episode = Number(e.target.value);
                          setSeasonScanResults(copy);
                        }}
                        className="w-14 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white"
                        min={1}
                        title="Número do episódio"
                      />
                      <span className="text-gray-300 text-xs truncate flex-1">{file.filename}</span>
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
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
                      </select>
                      <span className="text-[10px] text-green-500 font-bold shrink-0 flex items-center gap-1"><Zap size={10} /> Dinâmico</span>
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
          <p className="text-xs text-gray-400 mb-4">
            Cole um link de pasta do Terabox. {dynamicLinkMode ? 'Links serão salvos como referências estáveis e resolvidos na hora do play.' : 'Links serão salvos como pasta compartilhada (pode expirar).'}
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
                      <div className="text-xs text-gray-400 truncate mt-1">Match TMDB: {res.tmdb_match ? (res.tmdb_match.title || res.tmdb_match.name) : <span className="text-red-400">Não encontrado</span>}</div>
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
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
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

