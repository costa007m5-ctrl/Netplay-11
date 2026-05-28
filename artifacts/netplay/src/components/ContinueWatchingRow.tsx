import React, { useRef } from 'react';
import { Movie } from '../types';
import { ChevronLeft, ChevronRight, Play, Clock, Info, Tv2, Cpu, Globe, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface ContinueWatchingRowProps {
  title: string;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie, episodeUrl?: string, startTime?: number, playerStyle?: string) => void;
  profileName: string;
}

type PlayerBadgeInfo = {
  label: string;
  bg: string;
  text: string;
  border: string;
  Icon: React.ElementType;
};

const PLAYER_BADGES: Record<string, PlayerBadgeInfo> = {
  redeflix:    { label: 'Flix 3.0',  bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', Icon: Tv2 },
  betterflix:  { label: 'API Flix',  bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/40',  Icon: Zap },
  vidsrc:      { label: 'Net 2.0',   bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40',    Icon: Globe },
  admin:       { label: 'Nativo',    bg: 'bg-gray-500/20',    text: 'text-gray-300',    border: 'border-gray-500/40',    Icon: Cpu },
  alternative: { label: 'Nativo',    bg: 'bg-gray-500/20',    text: 'text-gray-300',    border: 'border-gray-500/40',    Icon: Cpu },
  auto:        { label: 'Auto',      bg: 'bg-gray-500/20',    text: 'text-gray-300',    border: 'border-gray-500/40',    Icon: Cpu },
  netflix:     { label: 'Nativo',    bg: 'bg-gray-500/20',    text: 'text-gray-300',    border: 'border-gray-500/40',    Icon: Cpu },
  'netflix-cascade': { label: 'Auto', bg: 'bg-gray-500/20',   text: 'text-gray-300',    border: 'border-gray-500/40',    Icon: Cpu },
  special:     { label: 'Especial',  bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/40',  Icon: Tv2 },
};

const ContinueCard = React.memo(({ movie, onSelectMovie, onPlayMovie }: {
  movie: Movie;
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie, episodeUrl?: string, startTime?: number, playerStyle?: string) => void;
}) => {
  const duration = movie.runtime ? movie.runtime * 60 : 7200;
  const position = movie.last_position || 0;
  const progress = Math.min(100, (position / duration) * 100);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const resolvedEpisodeUrl = movie.type === 'series'
    ? (movie.savedEpisodeUrl
        || localStorage.getItem(`netplay_progress_url_${movie.id}`)
        || (movie.episodes && movie.episodes.length > 0 ? movie.episodes[0].videoUrl : undefined))
    : undefined;

  const savedEpisodeObj = (movie.type === 'series' && resolvedEpisodeUrl && movie.episodes)
    ? movie.episodes.find(e => e.videoUrl === resolvedEpisodeUrl || e.videoUrl2 === resolvedEpisodeUrl)
    : null;

  let savedPlayerStyle: string | undefined;
  try {
    const prefRaw = localStorage.getItem(`netplay_server_pref_${movie.id}`);
    if (prefRaw) savedPlayerStyle = prefRaw;
  } catch {}

  const playerBadge = savedPlayerStyle ? PLAYER_BADGES[savedPlayerStyle] : null;

  const handleClick = () => {
    if (movie.type === 'series') {
      onPlayMovie(movie, resolvedEpisodeUrl, position, savedPlayerStyle);
    } else {
      onPlayMovie(movie, movie.videoUrl, position, savedPlayerStyle);
    }
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectMovie(movie);
  };

  const backdropSrc = movie.backdrop_path?.startsWith('http')
    ? movie.backdrop_path
    : `https://image.tmdb.org/t/p/w780/${movie.backdrop_path}`;

  const logoSrc = movie.logo_path
    ? (movie.logo_path.startsWith('http') ? movie.logo_path : `https://image.tmdb.org/t/p/original/${movie.logo_path}`)
    : null;

  return (
    <div
      className="relative flex-none snap-start w-[260px] md:w-[420px] aspect-video rounded-xl overflow-hidden group/cw cursor-pointer bg-[#111] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 shadow-2xl border border-white/[0.06]"
      onClick={handleClick}
    >
      {/* Backdrop */}
      <img
        src={backdropSrc}
        className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover/cw:opacity-90 group-hover/cw:scale-105 transition-all duration-400"
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
      />

      {/* Top gradient */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />

      {/* Player badge — top left */}
      {playerBadge && (
        <div className={`absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1 rounded-full border backdrop-blur-md ${playerBadge.bg} ${playerBadge.border}`}>
          <playerBadge.Icon size={10} className={playerBadge.text} />
          <span className={`text-[9px] font-black uppercase tracking-widest ${playerBadge.text}`}>{playerBadge.label}</span>
        </div>
      )}

      {/* Info button — top right (visible on hover) */}
      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover/cw:opacity-100 transition-opacity">
        <button
          onClick={handleInfoClick}
          className="p-2 bg-black/50 hover:bg-black/80 backdrop-blur-xl rounded-full border border-white/20 text-white transition-all"
        >
          <Info size={14} />
        </button>
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 md:px-4 pt-4 pb-3 md:pb-4 flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          {/* Content logo / title */}
          <div className="flex-1 min-w-0">
            {logoSrc ? (
              <img
                src={logoSrc}
                className="h-7 md:h-10 object-contain mb-1 drop-shadow-[0_2px_12px_rgba(0,0,0,1)] max-w-[70%]"
                referrerPolicy="no-referrer"
                alt={movie.title || movie.name}
              />
            ) : (
              <h3 className="text-white font-black uppercase tracking-tight text-sm md:text-xl leading-tight truncate mb-1 drop-shadow-lg">
                {movie.title || movie.name}
              </h3>
            )}
            <div className="flex items-center gap-2">
              <Clock size={9} className="text-red-500 shrink-0" />
              <span className="text-gray-400 font-mono text-[9px] md:text-[10px] tracking-wider uppercase truncate">
                {savedEpisodeObj
                  ? `T${savedEpisodeObj.season} E${savedEpisodeObj.episode} · Restam ${formatTime(duration - position)}`
                  : `Restam ${formatTime(duration - position)}`}
              </span>
            </div>
          </div>

          {/* Play button */}
          <div className="relative shrink-0">
            <div className="absolute -inset-2 bg-red-600/30 rounded-full blur-lg opacity-0 group-hover/cw:opacity-100 transition-opacity" />
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center text-black shadow-xl relative z-10 transition-transform group-hover/cw:scale-110">
              <Play fill="currentColor" size={16} className="ml-0.5 md:ml-1" />
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
              {savedPlayerStyle ? (playerBadge?.label || savedPlayerStyle) : 'Progresso'}
            </span>
            <span className="text-[8px] font-mono text-red-500 font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-700 to-red-500 shadow-[0_0_8px_rgba(220,38,38,0.5)] transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

const ContinueWatchingRow = ({ title, movies, onSelectMovie, onPlayMovie, profileName }: ContinueWatchingRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const amount = clientWidth * 0.8;
      scrollRef.current.scrollTo({ left: dir === 'left' ? scrollLeft - amount : scrollLeft + amount, behavior: 'smooth' });
    }
  };

  if (!movies.length) return null;

  return (
    <div className="relative py-4 md:py-6 group">
      <div className="px-4 md:px-12 flex items-center justify-between mb-3 md:mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.4em]">Em Reprodução</span>
          </div>
          <h2 className="text-xl md:text-4xl font-black text-white uppercase tracking-tighter italic leading-none">
            {title}
          </h2>
        </div>

        <div className="flex gap-2">
          <button onClick={() => scroll('left')} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-all">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => scroll('right')} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-all">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide gap-3 md:gap-5 px-4 md:px-12 snap-x snap-mandatory pb-2"
      >
        {movies.map(movie => (
          <ContinueCard key={movie.id} movie={movie} onSelectMovie={onSelectMovie} onPlayMovie={onPlayMovie} />
        ))}
      </div>
    </div>
  );
};

export default ContinueWatchingRow;
