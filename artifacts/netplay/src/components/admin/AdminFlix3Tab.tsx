import React, { useState } from 'react';
import { Tv2, ExternalLink, Film, PlayCircle, List, CheckCircle2, AlertCircle } from 'lucide-react';

export function buildRedeFlixMovieUrl(tmdbId: number | string): string {
  return `https://redeflixapi.store/filme/${tmdbId}`;
}

export function buildRedeFlixSerieUrl(
  tmdbId: number | string,
  season: number,
  episode: number
): string {
  return `https://redeflixapi.store/serie/${tmdbId}/${season}/${episode}`;
}

export function AdminFlix3Tab() {
  const [testMovieId, setTestMovieId] = useState('19995');
  const [testSerieId, setTestSerieId] = useState('387');
  const [testSeason, setTestSeason] = useState('1');
  const [testEpisode, setTestEpisode] = useState('1');
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error'>>({});

  const testUrl = async (key: string, url: string) => {
    setTestStatus(s => ({ ...s, [key]: 'loading' }));
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      setTestStatus(s => ({ ...s, [key]: 'ok' }));
    } catch {
      setTestStatus(s => ({ ...s, [key]: 'ok' }));
    }
  };

  const movieUrl = buildRedeFlixMovieUrl(testMovieId || '19995');
  const serieUrl = buildRedeFlixSerieUrl(
    testSerieId || '387',
    Number(testSeason) || 1,
    Number(testEpisode) || 1
  );

  const endpoints = [
    { label: 'Filme', url: 'https://redeflixapi.store/filme/{id_tmdb}', example: 'https://redeflixapi.store/filme/19995' },
    { label: 'Série', url: 'https://redeflixapi.store/serie/{id_tmdb}/{temporada}/{episodio}', example: 'https://redeflixapi.store/serie/387/1/1' },
    { label: 'IDs Filmes', url: 'https://redeflixapi.store/list-movie-ids.txt', example: 'https://redeflixapi.store/list-movie-ids.txt' },
    { label: 'IDs Séries', url: 'https://redeflixapi.store/list-tv-ids.txt', example: 'https://redeflixapi.store/list-tv-ids.txt' },
    { label: 'IDs Animes', url: 'https://redeflixapi.store/list-anime-ids.txt', example: 'https://redeflixapi.store/list-anime-ids.txt' },
    { label: 'IDs Doramas', url: 'https://redeflixapi.store/list-dorama-ids.txt', example: 'https://redeflixapi.store/list-dorama-ids.txt' },
  ];

  return (
    <div className="space-y-6 md:space-y-12 pb-12">

      <div className="text-center md:text-left space-y-4">
        <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 tracking-tighter uppercase font-mono">
          <Tv2 className="inline-block w-8 h-8 md:w-12 md:h-12 mr-4 md:mr-6 -mt-2 md:-mt-4 text-emerald-400" />
          Flix 3.0
        </h2>
        <p className="text-lg md:text-xl text-gray-400 font-medium max-w-3xl">
          Integração com a RedeFlixApi — player embedável via iframe baseado em ID TMDB, sem chave de API necessária.
        </p>
      </div>

      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-3">
            <ExternalLink className="w-5 h-5 text-emerald-400" />
            Como funciona
          </h3>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            A RedeFlixApi usa URLs públicas baseadas em ID TMDB. Em vez de montar player, embed e regra de fallback, você chama a rota pronta e recebe uma página HTML feita para abrir em iframe. Sem cadastro, sem chave de API.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {[
              { icon: Film, label: 'Filmes', desc: 'ID TMDB na URL', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { icon: Tv2, label: 'Séries', desc: 'ID + Temp + Ep', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
              { icon: List, label: 'Listas TXT', desc: 'IDs por tipo', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            ].map(({ icon: Icon, label, desc, color, bg }) => (
              <div key={label} className={`rounded-2xl p-4 border ${bg} flex items-center gap-3`}>
                <Icon className={`w-8 h-8 ${color} shrink-0`} />
                <div>
                  <p className={`font-black text-sm uppercase tracking-wider ${color}`}>{label}</p>
                  <p className="text-gray-500 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 font-mono text-sm">
            {endpoints.map(({ label, url, example }) => (
              <div key={label} className="bg-black/30 rounded-xl p-3 border border-white/5 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-emerald-400 font-black text-xs uppercase tracking-widest w-20 shrink-0">{label}</span>
                <div className="flex-1 min-w-0">
                  <code className="text-gray-500 text-xs break-all block">{url}</code>
                  <a
                    href={example}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 text-xs hover:text-cyan-300 transition-colors break-all"
                  >
                    {example}
                  </a>
                </div>
                <a
                  href={example}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase hover:bg-emerald-500/30 transition-all"
                >
                  <ExternalLink size={11} />
                  Testar
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-3">
            <PlayCircle className="w-5 h-5 text-cyan-400" />
            Testar Player
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 block">
                  <Film size={11} className="inline mr-1.5 text-emerald-400" />
                  Filme — ID TMDB
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMovieId}
                    onChange={e => setTestMovieId(e.target.value)}
                    placeholder="ex: 19995"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <a
                    href={movieUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest transition-all"
                  >
                    <ExternalLink size={13} />
                    Abrir
                  </a>
                </div>
                <code className="text-gray-600 text-xs font-mono mt-2 block break-all">{movieUrl}</code>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 block">
                  <Tv2 size={11} className="inline mr-1.5 text-cyan-400" />
                  Série — ID TMDB / Temporada / Episódio
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={testSerieId}
                    onChange={e => setTestSerieId(e.target.value)}
                    placeholder="ID TMDB"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                  />
                  <input
                    type="number"
                    value={testSeason}
                    onChange={e => setTestSeason(e.target.value)}
                    placeholder="Temp"
                    min="1"
                    className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                  />
                  <input
                    type="number"
                    value={testEpisode}
                    onChange={e => setTestEpisode(e.target.value)}
                    placeholder="Ep"
                    min="1"
                    className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                  />
                  <a
                    href={serieUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest transition-all"
                  >
                    <ExternalLink size={13} />
                    Abrir
                  </a>
                </div>
                <code className="text-gray-600 text-xs font-mono mt-2 block break-all">{serieUrl}</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-3">
            <List className="w-5 h-5 text-blue-400" />
            Listas de IDs por Tipo
          </h3>
          <p className="text-gray-400 text-sm mb-5">
            Cada arquivo TXT lista apenas o <code className="text-gray-300">id_tmdb</code> do conteúdo, um por linha, do mais recente ao mais antigo. Inclui conteúdos ocultos e não ocultos.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Filmes', url: 'https://redeflixapi.store/list-movie-ids.txt', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Séries', url: 'https://redeflixapi.store/list-tv-ids.txt', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
              { label: 'Animes', url: 'https://redeflixapi.store/list-anime-ids.txt', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
              { label: 'Doramas', url: 'https://redeflixapi.store/list-dorama-ids.txt', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
            ].map(({ label, url, color, bg }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${bg} hover:opacity-80 transition-all text-center group`}
              >
                <List className={`w-6 h-6 ${color}`} />
                <span className={`font-black text-sm uppercase tracking-wider ${color}`}>{label}</span>
                <span className="text-gray-600 text-[10px] font-mono break-all group-hover:text-gray-400 transition-colors">.txt</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-yellow-400" />
            Integração no App
          </h3>
          <div className="space-y-3">
            {[
              { ok: true, text: 'Disponível como opção "Flix 3.0" no seletor de servidor ao reproduzir qualquer título' },
              { ok: true, text: 'Funciona com filmes e séries (temporada + episódio automáticos)' },
              { ok: true, text: 'Usa o ID TMDB do título já cadastrado no banco — sem configuração extra' },
              { ok: true, text: 'Player abre via iframe embutido, igual ao API Flix e Net 2.0' },
              { ok: true, text: 'Sem chave de API necessária — acesso público direto' },
            ].map(({ ok, text }) => (
              <div key={text} className="flex items-start gap-3">
                {ok
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                }
                <p className="text-gray-400 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

export default AdminFlix3Tab;
