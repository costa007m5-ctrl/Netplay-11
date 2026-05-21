import React, { useState, useEffect } from 'react';
import { Tv2, Film, Play, ExternalLink, RefreshCw, Globe, List, CheckCircle2, Copy, ChevronRight } from 'lucide-react';

export const VIDSRC_DOMAIN_KEY = 'netplay_vidsrc_domain';
export const VIDSRC_DOMAINS = [
  'vidsrc-embed.ru',
  'vidsrc-embed.su',
  'vidsrcme.su',
  'vsrc.su',
];

export function getVidsrcDomain(): string {
  try {
    return localStorage.getItem(VIDSRC_DOMAIN_KEY) || VIDSRC_DOMAINS[0];
  } catch {
    return VIDSRC_DOMAINS[0];
  }
}

export function setVidsrcDomain(domain: string) {
  try {
    localStorage.setItem(VIDSRC_DOMAIN_KEY, domain);
  } catch {}
}

export function buildVidsrcMovieUrl(tmdbId: number | string, dsLang = 'pt-BR'): string {
  const domain = getVidsrcDomain();
  return `https://${domain}/embed/movie?tmdb=${tmdbId}&ds_lang=${dsLang}&autoplay=1`;
}

export function buildVidsrcTvUrl(tmdbId: number | string, season: number, episode: number, dsLang = 'pt-BR'): string {
  const domain = getVidsrcDomain();
  return `https://${domain}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&ds_lang=${dsLang}&autoplay=1&autonext=1`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
      title="Copiar"
    >
      {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

export function AdminNet2Tab() {
  const [domain, setDomainState] = useState(getVidsrcDomain());
  const [domainSaved, setDomainSaved] = useState(false);

  const [previewType, setPreviewType] = useState<'movie' | 'tv'>('movie');
  const [previewTmdb, setPreviewTmdb] = useState('');
  const [previewSeason, setPreviewSeason] = useState('1');
  const [previewEpisode, setPreviewEpisode] = useState('1');
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [latestType, setLatestType] = useState<'movies' | 'tvshows' | 'episodes'>('movies');
  const [latestPage, setLatestPage] = useState(1);
  const [latestData, setLatestData] = useState<any[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestError, setLatestError] = useState('');

  const handleSaveDomain = () => {
    setVidsrcDomain(domain);
    setDomainSaved(true);
    setTimeout(() => setDomainSaved(false), 2000);
  };

  const handlePreview = () => {
    if (!previewTmdb.trim()) return;
    let url: string;
    if (previewType === 'movie') {
      url = buildVidsrcMovieUrl(previewTmdb.trim());
    } else {
      url = buildVidsrcTvUrl(previewTmdb.trim(), Number(previewSeason) || 1, Number(previewEpisode) || 1);
    }
    setPreviewUrl(url);
    setShowPreview(true);
  };

  const fetchLatest = async () => {
    setLatestLoading(true);
    setLatestError('');
    setLatestData([]);
    try {
      const params = new URLSearchParams({ type: latestType, page: String(latestPage), domain });
      const res = await fetch(`/api/vidsrc/latest?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLatestData(data.results || []);
    } catch (e: any) {
      setLatestError(e.message || 'Erro ao carregar dados');
    } finally {
      setLatestLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestType, latestPage]);

  const endpointExamples = [
    {
      label: 'Filme (TMDB)',
      color: 'blue',
      url: `https://${domain}/embed/movie?tmdb=385687&ds_lang=pt-BR&autoplay=1`,
    },
    {
      label: 'Série (TMDB)',
      color: 'purple',
      url: `https://${domain}/embed/tv?tmdb=1399&ds_lang=pt-BR`,
    },
    {
      label: 'Episódio (TMDB)',
      color: 'green',
      url: `https://${domain}/embed/tv?tmdb=1399&season=1&episode=1&ds_lang=pt-BR&autoplay=1&autonext=1`,
    },
    {
      label: 'Filme (IMDB)',
      color: 'orange',
      url: `https://${domain}/embed/movie?imdb=tt5433140&ds_lang=pt-BR&autoplay=1`,
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-12">

      {/* Header */}
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 tracking-tighter uppercase font-mono">
          <Tv2 className="inline-block w-8 h-8 md:w-12 md:h-12 mr-4 md:mr-6 -mt-2 md:-mt-4 text-red-500" />
          Net 2.0
        </h2>
        <p className="text-lg md:text-xl text-gray-400 font-medium max-w-3xl">
          Integração com Vidsrc — player embed via TMDB/IMDB para filmes, séries e episódios.
        </p>
      </div>

      {/* Domain selector */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-3">
            <Globe className="w-5 h-5 text-red-400" />
            Domínio Ativo
          </h3>
          <p className="text-gray-500 text-sm mb-5">
            Escolha qual servidor Vidsrc será usado para gerar os embed URLs.
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            {VIDSRC_DOMAINS.map(d => (
              <button
                key={d}
                onClick={() => setDomainState(d)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                  domain === d
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={handleSaveDomain}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
              domainSaved ? 'bg-green-600/80 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {domainSaved ? <CheckCircle2 size={15} /> : <Globe size={15} />}
            {domainSaved ? 'Salvo!' : 'Salvar Domínio'}
          </button>
        </div>
      </section>

      {/* Endpoint examples */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-3">
            <ExternalLink className="w-5 h-5 text-blue-400" />
            Endpoints do Player
          </h3>
          <p className="text-gray-500 text-sm mb-5">
            Formatos de URL aceitos pelo Vidsrc. Use <code className="text-gray-400">tmdb=</code> ou <code className="text-gray-400">imdb=</code> como identificador.
          </p>
          <div className="space-y-3 font-mono text-sm">
            {endpointExamples.map(({ label, color, url }) => (
              <div key={label} className={`rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center gap-2 ${colorMap[color]}`}>
                <span className={`font-black text-xs uppercase tracking-widest w-28 shrink-0 ${colorMap[color].split(' ')[0]}`}>{label}</span>
                <code className="text-gray-300 text-xs break-all flex-1">{url}</code>
                <CopyBtn text={url} />
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
            <div className="bg-black/30 rounded-xl p-3 border border-white/5">
              <p className="text-gray-400 font-bold mb-1">Parâmetros opcionais</p>
              <ul className="space-y-1">
                <li><code className="text-gray-500">ds_lang=pt-BR</code> — Legenda padrão (Português Brasil)</li>
                <li><code className="text-gray-500">autoplay=1</code> — Reprodução automática</li>
                <li><code className="text-gray-500">autonext=1</code> — Próximo episódio automático</li>
                <li><code className="text-gray-500">sub_url=...</code> — URL de legenda externa (.srt/.vtt)</li>
              </ul>
            </div>
            <div className="bg-black/30 rounded-xl p-3 border border-white/5">
              <p className="text-gray-400 font-bold mb-1">Domínios disponíveis</p>
              <ul className="space-y-1">
                {VIDSRC_DOMAINS.map(d => (
                  <li key={d} className="flex items-center gap-1">
                    <ChevronRight size={10} className="text-red-500" />
                    <code className="text-gray-500">{d}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Player tester */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-red-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-3">
            <Play className="w-5 h-5 text-pink-400" />
            Testar Player
          </h3>
          <p className="text-gray-500 text-sm mb-5">
            Digite um ID do TMDB e visualize o embed do Vidsrc diretamente aqui.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            {(['movie', 'tv'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setPreviewType(t); setShowPreview(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
                  previewType === t
                    ? 'bg-pink-600 border-pink-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {t === 'movie' ? <Film size={14} /> : <Tv2 size={14} />}
                {t === 'movie' ? 'Filme' : 'Série/Episódio'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={previewTmdb}
              onChange={e => { setPreviewTmdb(e.target.value); setShowPreview(false); }}
              placeholder="TMDB ID (ex: 385687)"
              className="flex-1 min-w-[180px] bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-pink-500/50 transition-all"
            />
            {previewType === 'tv' && (
              <>
                <input
                  type="number"
                  value={previewSeason}
                  onChange={e => setPreviewSeason(e.target.value)}
                  placeholder="Temporada"
                  min={1}
                  className="w-28 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-pink-500/50 transition-all"
                />
                <input
                  type="number"
                  value={previewEpisode}
                  onChange={e => setPreviewEpisode(e.target.value)}
                  placeholder="Episódio"
                  min={1}
                  className="w-28 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-pink-500/50 transition-all"
                />
              </>
            )}
            <button
              onClick={handlePreview}
              disabled={!previewTmdb.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-pink-600 hover:bg-pink-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              Testar
            </button>
          </div>

          {previewUrl && (
            <div className="flex items-center gap-2 mb-4 bg-black/30 rounded-xl p-3 border border-white/5">
              <code className="text-gray-400 text-xs break-all flex-1">{previewUrl}</code>
              <CopyBtn text={previewUrl} />
              <a href={previewUrl} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                <ExternalLink size={13} />
              </a>
            </div>
          )}

          {showPreview && previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={previewUrl}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture"
                title="Vidsrc Player Preview"
                referrerPolicy="origin"
              />
            </div>
          )}
        </div>
      </section>

      {/* Latest content from Vidsrc */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-3">
              <List className="w-5 h-5 text-orange-400" />
              Últimos Adicionados
            </h3>
            <button
              onClick={fetchLatest}
              disabled={latestLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/40 text-orange-300 border border-orange-500/20 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={latestLoading ? 'animate-spin' : ''} />
              {latestLoading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {([
              { key: 'movies', label: 'Filmes', icon: Film },
              { key: 'tvshows', label: 'Séries', icon: Tv2 },
              { key: 'episodes', label: 'Episódios', icon: Play },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setLatestType(key); setLatestPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
                  latestType === key
                    ? 'bg-orange-600 border-orange-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {latestError && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3 border border-red-500/20 mb-4">{latestError}</div>
          )}

          {latestLoading && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <RefreshCw size={20} className="animate-spin mr-3" />
              Carregando...
            </div>
          )}

          {!latestLoading && latestData.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {latestData.map((item: any, i: number) => {
                const tmdbId = item.tmdb_id || item.tmdbId || item.id;
                const title = item.title || item.name || item.show_name || '—';
                const type = latestType === 'movies' ? 'movie' : 'tv';
                const season = item.season;
                const episode = item.episode;
                const embedUrl = type === 'movie'
                  ? buildVidsrcMovieUrl(tmdbId)
                  : buildVidsrcTvUrl(tmdbId, season || 1, episode || 1);

                return (
                  <div key={i} className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{title}</p>
                      <div className="flex items-center gap-2 text-gray-500 text-xs mt-0.5 flex-wrap">
                        {tmdbId && <span>TMDB: <code className="text-gray-400">{tmdbId}</code></span>}
                        {season != null && <span>T{season} E{episode}</span>}
                        {item.quality && <span className="text-yellow-500">{item.quality}</span>}
                      </div>
                    </div>
                    {tmdbId && (
                      <div className="flex items-center gap-1 shrink-0">
                        <CopyBtn text={embedUrl} />
                        <a
                          href={embedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-600/40 text-gray-400 hover:text-white transition-all"
                          title="Abrir player"
                        >
                          <Play size={13} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!latestLoading && latestData.length === 0 && !latestError && (
            <p className="text-gray-600 text-sm italic text-center py-8">Nenhum resultado encontrado.</p>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => setLatestPage(p => Math.max(1, p - 1))}
              disabled={latestPage === 1 || latestLoading}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-sm font-bold disabled:opacity-30 transition-all"
            >
              ← Anterior
            </button>
            <span className="text-gray-500 text-sm font-mono">Pág. {latestPage}</span>
            <button
              onClick={() => setLatestPage(p => p + 1)}
              disabled={latestLoading || latestData.length === 0}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-sm font-bold disabled:opacity-30 transition-all"
            >
              Próxima →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminNet2Tab;
