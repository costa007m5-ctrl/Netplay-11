import React, { useState, useEffect } from 'react';
import { Tv2, Key, CheckCircle2, ExternalLink, Save, Trash2, Radio, Trophy, Globe } from 'lucide-react';

export const BETTERFLIX_KEY_STORAGE = 'netplay_betterflix_b2b_key';
const SETTINGS_API_KEY = 'betterflix_b2b_key';

let _globalKeyCache: string | null = null;
let _globalKeyLoaded = false;

export async function loadGlobalBetterFlixKey(): Promise<string> {
  if (_globalKeyLoaded && _globalKeyCache !== null) return _globalKeyCache;
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data: Record<string, string> = await res.json();
      const key = data[SETTINGS_API_KEY] || '';
      _globalKeyCache = key;
      _globalKeyLoaded = true;
      if (key) {
        try { localStorage.setItem(BETTERFLIX_KEY_STORAGE, key); } catch {}
      }
      return key;
    }
  } catch {}
  const local = (() => { try { return localStorage.getItem(BETTERFLIX_KEY_STORAGE) || ''; } catch { return ''; } })();
  _globalKeyCache = local;
  _globalKeyLoaded = true;
  return local;
}

export function getBetterFlixKey(): string {
  if (_globalKeyLoaded && _globalKeyCache !== null) return _globalKeyCache;
  try {
    return localStorage.getItem(BETTERFLIX_KEY_STORAGE)
      || import.meta.env.VITE_BETTERFLIX_API_KEY
      || '';
  } catch { return import.meta.env.VITE_BETTERFLIX_API_KEY || ''; }
}

export async function setBetterFlixKey(key: string) {
  _globalKeyCache = key;
  _globalKeyLoaded = true;
  try {
    if (key) localStorage.setItem(BETTERFLIX_KEY_STORAGE, key);
    else localStorage.removeItem(BETTERFLIX_KEY_STORAGE);
  } catch {}
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [SETTINGS_API_KEY]: key }),
    });
  } catch {}
}

loadGlobalBetterFlixKey();

export function buildBetterFlixUrl(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): string {
  const key = getBetterFlixKey();
  const base = 'https://betterflix.click/api/player';
  const params = new URLSearchParams({ id: String(tmdbId), type });
  if (type === 'tv') {
    params.set('season', String(season ?? 1));
    params.set('episode', String(episode ?? 1));
  }
  if (key) params.set('key', key);
  return `${base}?${params.toString()}`;
}

export function AdminFlixAPITab() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);
  const [channelError, setChannelError] = useState('');
  const [gamesError, setGamesError] = useState('');

  useEffect(() => {
    setKey(getBetterFlixKey());
  }, []);

  const handleSave = async () => {
    await setBetterFlixKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = async () => {
    setKey('');
    await setBetterFlixKey('');
  };

  const fetchChannels = async () => {
    setLoadingChannels(true);
    setChannelError('');
    try {
      const res = await fetch('/api/betterflix/canais');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setChannelError(e.message || 'Erro ao carregar canais');
    } finally {
      setLoadingChannels(false);
    }
  };

  const fetchGames = async () => {
    setLoadingGames(true);
    setGamesError('');
    try {
      const res = await fetch('/api/betterflix/jogos');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGames(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setGamesError(e.message || 'Erro ao carregar jogos');
    } finally {
      setLoadingGames(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-12 pb-12">
      <div className="text-center md:text-left space-y-4">
        <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 tracking-tighter uppercase font-mono">
          <Tv2 className="inline-block w-8 h-8 md:w-12 md:h-12 mr-4 md:mr-6 -mt-2 md:-mt-4 text-orange-400" />
          API Flix
        </h2>
        <p className="text-lg md:text-xl text-gray-400 font-medium max-w-3xl">
          Integração com BetterFlix — player externo via iframe para filmes, séries e canais ao vivo.
        </p>
      </div>

      {/* Endpoints Info */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-3">
            <ExternalLink className="w-5 h-5 text-orange-400" />
            Endpoints do Player
          </h3>
          <div className="space-y-3 font-mono text-sm">
            {[
              { label: 'Filme', url: 'https://betterflix.click/api/player?id=TMDB_ID&type=movie' },
              { label: 'Série', url: 'https://betterflix.click/api/player?id=TMDB_ID&type=tv&season=1&episode=1' },
              { label: 'Canal', url: 'https://betterflix.click/api/player?id=CANAL_ID&type=channel' },
            ].map(({ label, url }) => (
              <div key={label} className="bg-black/30 rounded-xl p-3 border border-white/5 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-orange-400 font-black text-xs uppercase tracking-widest w-14 shrink-0">{label}</span>
                <code className="text-gray-300 text-xs break-all">{url}</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-4 italic">
            O player só funciona via iframe. Acesso direto pela URL é bloqueado automaticamente pelo serviço.
          </p>
        </div>
      </section>

      {/* B2B Key */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-3">
            <Key className="w-5 h-5 text-yellow-400" />
            Chave B2B (Ad-Free)
          </h3>
          <p className="text-gray-500 text-sm mb-5">
            Chave de licença premium vinculada ao seu domínio. Remove 100% dos anúncios para seus usuários. Opcional.
          </p>
          <div className="flex gap-3 flex-col sm:flex-row">
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Cole sua chave B2B aqui..."
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-black/60 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${saved ? 'bg-green-600/80 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}
              >
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Salvo!' : 'Salvar'}
              </button>
              {key && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/20 transition-all"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          {key && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-400 font-bold">
              <CheckCircle2 size={12} />
              Chave configurada — será incluída automaticamente em todas as requisições do player.
            </div>
          )}
          <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400/70 font-bold">
            <Globe size={11} />
            Configuração global — salva no banco e aplicada a todos os dispositivos automaticamente.
          </div>
        </div>
      </section>

      {/* Canais de TV */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-3">
              <Radio className="w-5 h-5 text-blue-400" />
              Canais de TV
            </h3>
            <button
              onClick={fetchChannels}
              disabled={loadingChannels}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/20 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loadingChannels ? 'Carregando...' : 'Carregar Canais'}
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Lista de canais fixos de TV disponíveis via <code className="text-gray-400">betterflix.click/api/canais.json</code>
          </p>
          {channelError && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3 border border-red-500/20 mb-3">{channelError}</div>
          )}
          {channels.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
              {channels.map((ch: any, i: number) => (
                <div key={i} className="bg-black/30 rounded-xl p-3 border border-white/5 flex flex-col items-center gap-2 text-center">
                  {ch.imagem && (
                    <img src={ch.imagem} alt={ch.nome} className="w-10 h-10 object-contain rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <span className="text-white text-xs font-bold truncate w-full">{ch.nome || ch.name}</span>
                  {ch.categoria && <span className="text-gray-600 text-[10px] uppercase tracking-widest">{ch.categoria}</span>}
                  <span className="text-gray-700 text-[10px] font-mono">ID: {ch.id}</span>
                </div>
              ))}
            </div>
          )}
          {!loadingChannels && channels.length === 0 && !channelError && (
            <p className="text-gray-600 text-sm italic">Clique em "Carregar Canais" para visualizar a lista.</p>
          )}
        </div>
      </section>

      {/* Jogos ao Vivo */}
      <section className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-3">
              <Trophy className="w-5 h-5 text-green-400" />
              Jogos ao Vivo
            </h3>
            <button
              onClick={fetchGames}
              disabled={loadingGames}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/20 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loadingGames ? 'Carregando...' : 'Carregar Jogos'}
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Partidas e eventos esportivos disponíveis via <code className="text-gray-400">betterflix.click/api/jogos.json</code>
          </p>
          {gamesError && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3 border border-red-500/20 mb-3">{gamesError}</div>
          )}
          {games.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {games.map((g: any, i: number) => (
                <div key={i} className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                  {g.imagem && (
                    <img src={g.imagem} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{g.nome || g.title || g.name}</p>
                    {g.categoria && <p className="text-gray-500 text-xs">{g.categoria}</p>}
                  </div>
                  <span className="text-gray-700 text-[10px] font-mono shrink-0">ID: {g.id}</span>
                </div>
              ))}
            </div>
          )}
          {!loadingGames && games.length === 0 && !gamesError && (
            <p className="text-gray-600 text-sm italic">Clique em "Carregar Jogos" para visualizar a lista.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminFlixAPITab;
