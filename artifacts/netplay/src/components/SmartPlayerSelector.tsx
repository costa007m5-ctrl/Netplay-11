import React from 'react';
import { motion } from 'motion/react';
import { Play, X, Server, RefreshCcw, Zap, Star, Clock, Tv2 } from 'lucide-react';
import { Movie } from '../types';
import { isDynamicRef, parseDynamicRef, makeDynamicRef, makeDynamicRefV2, makeDynamicRefV3 } from '../services/terabox';
import { buildBetterFlixUrl } from './admin/AdminFlixAPITab';

export const NATIVE_API_STORAGE_KEY = 'netplay_native_terabox_api';

export function getNativeTeraboxApi(): 'v1' | 'v3' {
  try {
    const stored = localStorage.getItem(NATIVE_API_STORAGE_KEY);
    if (stored === 'v1' || stored === 'v3') return stored;
  } catch {}
  return 'v3';
}

export function setNativeTeraboxApi(api: 'v1' | 'v3') {
  try { localStorage.setItem(NATIVE_API_STORAGE_KEY, api); } catch {}
}

export function convertTeraboxToApi(url: string, api: 'v1' | 'v2' | 'v3'): string {
  if (!isDynamicRef(url)) return url;
  const { folderUrl, filename } = parseDynamicRef(url);
  if (api === 'v3') return makeDynamicRefV3(folderUrl, filename);
  if (api === 'v2') return makeDynamicRefV2(folderUrl, filename);
  return makeDynamicRef(folderUrl, filename);
}

export const SELECTED_SERVER_KEY = 'netplay_selected_server_mode';

export interface SelectedServerPreference {
  id: 'admin' | 'alternative' | 'auto';
  playerStyle: string;
  altApi: 'v1' | 'v3';
  nativeApi: 'v1' | 'v3';
}

export function getSelectedServer(): SelectedServerPreference | null {
  try {
    const raw = localStorage.getItem(SELECTED_SERVER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SelectedServerPreference;
  } catch { return null; }
}

export function saveSelectedServer(data: SelectedServerPreference) {
  try { localStorage.setItem(SELECTED_SERVER_KEY, JSON.stringify(data)); } catch {}
}

interface SmartPlayerSelectorProps {
  movie: Movie;
  episodeUrl?: string;
  startTime?: number;
  logoUrl?: string;
  onClose: () => void;
  onPlay: (url: string, startTime: number, playerStyle: string) => void;
}

const SmartPlayerSelector: React.FC<SmartPlayerSelectorProps> = ({
  movie,
  episodeUrl,
  startTime = 0,
  logoUrl,
  onClose,
  onPlay,
}) => {
  const nativeApi = getNativeTeraboxApi();
  const altApi: 'v1' | 'v3' = nativeApi === 'v1' ? 'v3' : 'v1';

  const currentUrl = episodeUrl || movie.videoUrl || '';
  const hasTeraboxUrl = isDynamicRef(currentUrl);

  // Para episódios: hasAdminUrl só é verdadeiro se o episódio específico tem videoUrl2 próprio.
  // Isso evita usar o videoUrl2 da série (nível global) como URL do episódio errado.
  const hasAdminUrl = (() => {
    if (episodeUrl && movie.type === 'series' && movie.episodes) {
      const ep = (movie.episodes as any[]).find(
        (e: any) => e.videoUrl === episodeUrl || e.videoUrl2 === episodeUrl
      );
      // Só considera admin se o episódio tem videoUrl2 diferente do episodeUrl em si
      return !!(ep?.videoUrl2 && ep.videoUrl2 !== episodeUrl);
    }
    return !!movie.videoUrl2;
  })();

  const backdropUrl = movie.backdrop_path?.startsWith('http')
    ? movie.backdrop_path
    : `https://image.tmdb.org/t/p/original/${movie.backdrop_path}`;

  const posterUrl = movie.poster_path?.startsWith('http')
    ? movie.poster_path
    : movie.poster_path
    ? `https://image.tmdb.org/t/p/w342/${movie.poster_path}`
    : null;

  const year = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : movie.first_air_date
    ? new Date(movie.first_air_date).getFullYear()
    : null;

  const nativeLabel = nativeApi === 'v3' ? 'API 03' : 'API 01';
  const altLabel = altApi === 'v3' ? 'API 03' : 'API 01';
  const isResuming = startTime > 5;

  // Retorna o URL admin do episódio específico (nunca cai no videoUrl2 da série)
  const getAdminUrl = (): string => {
    if (episodeUrl && movie.type === 'series' && movie.episodes) {
      const ep = (movie.episodes as any[]).find(
        (e: any) => e.videoUrl === episodeUrl || e.videoUrl2 === episodeUrl
      );
      if (ep?.videoUrl2 && ep.videoUrl2 !== episodeUrl) return ep.videoUrl2;
      // Episódio sem videoUrl2 próprio → usa o próprio episodeUrl convertido para a API nativa
      return convertTeraboxToApi(episodeUrl, nativeApi);
    }
    return movie.videoUrl2 || convertTeraboxToApi(currentUrl, nativeApi);
  };

  const defaultAvailable = hasAdminUrl || hasTeraboxUrl;
  const defaultDesc = hasAdminUrl
    ? 'Link configurado manualmente pelo admin. Melhor estabilidade garantida.'
    : `Reproduz com a API nativa (${nativeLabel}) e a qualidade configurada ao adicionar o título.`;

  const getDefaultUrl = (): string => {
    return getAdminUrl();
  };

  const hasTmdbId = !!movie.id;

  const getBetterFlixPlayerUrl = (): string => {
    const isMovie = movie.type !== 'series';
    if (isMovie) {
      return buildBetterFlixUrl(movie.id, 'movie');
    }
    // For series, find the current episode's season/episode numbers
    const ep = episodeUrl && movie.episodes
      ? (movie.episodes as any[]).find((e: any) => e.videoUrl === episodeUrl || e.videoUrl2 === episodeUrl)
      : null;
    const season = ep?.season ?? 1;
    const episode = ep?.episode ?? 1;
    return buildBetterFlixUrl(movie.id, 'tv', season, episode);
  };

  const options = [
    {
      id: 'admin',
      num: '01',
      title: 'Servidor Padrão',
      subtitle: hasAdminUrl ? 'Administrativo' : `Nativo: ${nativeLabel}`,
      desc: defaultDesc,
      icon: Server,
      gradient: 'from-blue-600/12 to-blue-900/5',
      border: 'border-blue-500/20 hover:border-blue-400/50',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/20',
      badgeColor: 'text-blue-300',
      badge: hasAdminUrl ? 'ADMIN' : nativeLabel,
      glowColor: 'shadow-blue-500/10',
      available: defaultAvailable,
      unavailableMsg: 'Nenhum link configurado para este título.',
      action: () => {
        saveSelectedServer({ id: 'admin', playerStyle: 'netflix', altApi, nativeApi });
        onPlay(getDefaultUrl(), startTime, 'netflix');
      },
    },
    {
      id: 'alternative',
      num: '02',
      title: `Servidor API 01`,
      subtitle: 'Cascata Automática',
      desc: `Testa cada qualidade da API 01 (Pro) em cascata. Se todas falharem, muda automaticamente para API 3.0.`,
      icon: RefreshCcw,
      gradient: 'from-purple-600/12 to-purple-900/5',
      border: 'border-purple-500/20 hover:border-purple-400/50',
      iconBg: 'bg-purple-500/15',
      iconColor: 'text-purple-400',
      badgeBg: 'bg-purple-500/20',
      badgeColor: 'text-purple-300',
      badge: 'CASCATA',
      glowColor: 'shadow-purple-500/10',
      available: hasTeraboxUrl,
      unavailableMsg: 'Não disponível para este tipo de link.',
      action: () => {
        saveSelectedServer({ id: 'alternative', playerStyle: 'netflix-cascade', altApi, nativeApi });
        const converted = convertTeraboxToApi(currentUrl, 'v1');
        onPlay(converted, startTime, 'netflix-cascade');
      },
    },
    {
      id: 'auto',
      num: '03',
      title: 'Modo Automático',
      subtitle: `${nativeLabel} + Fallback`,
      desc: 'Testa qualidades e APIs automaticamente. Se uma falhar, troca para a próxima sem intervenção.',
      icon: Zap,
      gradient: 'from-red-600/12 to-red-900/5',
      border: 'border-red-500/20 hover:border-red-400/50',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      badgeBg: 'bg-red-500/20',
      badgeColor: 'text-red-300',
      badge: 'AUTO',
      glowColor: 'shadow-red-500/10',
      available: hasTeraboxUrl,
      unavailableMsg: 'Não disponível para este tipo de link.',
      action: () => {
        saveSelectedServer({ id: 'auto', playerStyle: 'netflix-cascade', altApi, nativeApi });
        const nativeUrl = convertTeraboxToApi(currentUrl, nativeApi);
        onPlay(nativeUrl, startTime, 'netflix-cascade');
      },
    },
    {
      id: 'betterflix',
      num: '04',
      title: 'API Flix',
      subtitle: 'BetterFlix · Player Externo',
      desc: 'Reproduz via player externo BetterFlix. Ideal quando os servidores internos falham. Suporta filmes, séries e canais.',
      icon: Tv2,
      gradient: 'from-orange-600/12 to-red-900/5',
      border: 'border-orange-500/20 hover:border-orange-400/50',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-400',
      badgeBg: 'bg-orange-500/20',
      badgeColor: 'text-orange-300',
      badge: 'FLIX',
      glowColor: 'shadow-orange-500/10',
      available: hasTmdbId,
      unavailableMsg: 'ID TMDB não disponível para este título.',
      action: () => {
        const bfUrl = getBetterFlixPlayerUrl();
        onPlay(bfUrl, 0, 'betterflix');
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[350] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black overflow-hidden">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover opacity-20 scale-110 blur-[6px]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
      </div>

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 bg-white/10 backdrop-blur-md text-white p-2 rounded-xl hover:bg-red-600/80 transition-all border border-white/10"
        >
          <X size={15} />
        </button>

        <div className="mb-5 flex items-center gap-3">
          {posterUrl && (
            <img
              src={posterUrl}
              alt=""
              className="w-10 h-[60px] rounded-xl object-cover border border-white/10 shadow-2xl shrink-0"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="flex-1 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={movie.title || movie.name}
                className="h-9 md:h-12 object-contain drop-shadow-2xl mb-1 max-w-[200px]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <h2 className="text-lg md:text-xl font-black text-white uppercase italic tracking-tighter leading-none mb-1 truncate">
                {movie.title || movie.name}
              </h2>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {year && <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{year}</span>}
              {movie.vote_average ? (
                <span className="flex items-center gap-1 text-yellow-500 text-[10px] font-black">
                  <Star size={8} fill="currentColor" />
                  {movie.vote_average.toFixed(1)}
                </span>
              ) : null}
              {movie.runtime ? (
                <span className="flex items-center gap-1 text-gray-600 text-[10px] font-bold">
                  <Clock size={8} />
                  {movie.runtime}min
                </span>
              ) : null}
              {isResuming && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/10 rounded-full text-gray-400 italic">
                  Retomando
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] italic">
            Como deseja assistir?
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            <span className="text-gray-600 text-[9px] font-black uppercase tracking-widest">
              Nativo: {nativeLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {options.map((option, idx) => {
            const Icon = option.icon;
            return (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 + idx * 0.07, duration: 0.28 }}
                onClick={option.available ? option.action : undefined}
                disabled={!option.available}
                className={`
                  relative w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left group
                  bg-gradient-to-r ${option.gradient}
                  backdrop-blur-xl border ${option.border}
                  transition-all duration-200 shadow-lg ${option.glowColor}
                  ${option.available
                    ? 'hover:scale-[1.012] active:scale-[0.988] cursor-pointer hover:shadow-xl'
                    : 'opacity-30 cursor-not-allowed'}
                `}
              >
                <span className="absolute top-2 right-2.5 text-[8px] font-black text-white/8 tracking-widest select-none">
                  {option.num}
                </span>

                <div className={`w-10 h-10 rounded-xl ${option.iconBg} border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-200 ${option.available ? 'group-hover:scale-110' : ''}`}>
                  <Icon size={18} className={option.iconColor} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-white font-black uppercase italic tracking-tight text-sm leading-none">
                      {option.title}
                    </span>
                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${option.badgeBg} ${option.badgeColor}`}>
                      {option.badge}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 leading-snug">
                    <span className="text-gray-600 font-bold">{option.subtitle}</span>
                    {' — '}
                    {option.available ? option.desc : option.unavailableMsg}
                  </p>
                </div>

                {option.available && (
                  <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-all">
                    <Play size={11} fill="white" className="text-white ml-0.5" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        <p className="text-center text-gray-700 text-[9px] font-bold uppercase tracking-widest mt-4 italic">
          Pressione Esc ou clique fora para fechar
        </p>
      </motion.div>
    </motion.div>
  );
};

export default SmartPlayerSelector;
