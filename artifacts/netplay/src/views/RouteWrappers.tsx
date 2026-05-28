import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Movie } from '../types';
import tmdb, { requests } from '../services/tmdb';
import { getSelectedServer, convertTeraboxToApi } from '../components/SmartPlayerSelector';
import { isDynamicRef } from '../services/terabox';

const MovieDetailsModal = React.lazy(() => import('../components/MovieDetailsModal'));
const VideoPlayer = React.lazy(() => import('../components/VideoPlayer'));

export const MovieDetailRouteWrapper = ({
  myMovies,
  handlePlayMovie,
  closeMovieDetails,
  toggleMyList,
  toggleFavorite,
  myListIds,
  favoriteIds,
  streamingProviders,
  onRequestMovie,
  watchHistory,
  onWatchParty,
  top10Movies = [],
  top10Series = [],
  appSettings
}: any) => {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [tmdbMovie, setTmdbMovie] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  const movieFromState = location.state?.movie;

  const localMovie = useMemo(() => myMovies.find((m: any) => m.id.toString() === movieId), [movieId, myMovies]);

  const stateMovie = useMemo(() => {
    if (movieFromState && movieFromState.id?.toString() === movieId) {
      const mediaType = movieFromState.media_type || movieFromState.type;
      const normalizedType = movieFromState.type || (mediaType === 'tv' ? 'series' : 'movie');
      return { ...movieFromState, type: normalizedType };
    }
    return null;
  }, [movieFromState, movieId]);

  useEffect(() => {
    if (!localMovie && !stateMovie && movieId && !tmdbMovie && !notFound) {
      const fetchFromTmdb = async () => {
        const hintMediaType = movieFromState?.media_type || movieFromState?.type;
        const isTV = hintMediaType === 'tv' || hintMediaType === 'series';

        const fetchMovie = async () => {
          const res = await tmdb.get(requests.movieDetails(Number(movieId)), { params: { language: 'pt-BR' } });
          setTmdbMovie({
            id: res.data.id,
            title: res.data.title,
            overview: res.data.overview,
            poster_path: res.data.poster_path,
            backdrop_path: res.data.backdrop_path,
            vote_average: res.data.vote_average,
            release_date: res.data.release_date,
            genres: res.data.genres?.map((g: any) => g.name).join(', ') || '',
            type: 'movie',
            videoUrl: ''
          });
        };

        const fetchTV = async () => {
          const res2 = await tmdb.get(requests.tvDetails(Number(movieId)), { params: { language: 'pt-BR' } });
          setTmdbMovie({
            id: res2.data.id,
            title: res2.data.name,
            overview: res2.data.overview,
            poster_path: res2.data.poster_path,
            backdrop_path: res2.data.backdrop_path,
            vote_average: res2.data.vote_average,
            release_date: res2.data.first_air_date,
            genres: res2.data.genres?.map((g: any) => g.name).join(', ') || '',
            type: 'series',
            episodes: [],
            videoUrl: '',
            number_of_seasons: res2.data.number_of_seasons || 1,
          });
        };

        try {
          if (isTV) { await fetchTV(); } else { await fetchMovie(); }
        } catch {
          try {
            if (isTV) { await fetchMovie(); } else { await fetchTV(); }
          } catch {
            setNotFound(true);
          }
        }
      };
      fetchFromTmdb();
    }
  }, [localMovie, stateMovie, movieId, tmdbMovie, notFound]);

  const movie = useMemo(() => {
    const base = localMovie || stateMovie || tmdbMovie;
    if (!base) return null;
    return { ...base, last_position: watchHistory[base.id] || base.last_position || 0 };
  }, [localMovie, stateMovie, tmdbMovie, watchHistory]);

  const movieRank = useMemo(() => {
    if (!movie) return undefined;
    const movieIndex = top10Movies.findIndex((m: any) => m.id === movie.id);
    if (movieIndex !== -1) return movieIndex + 1;
    const seriesIndex = top10Series.findIndex((m: any) => m.id === movie.id);
    if (seriesIndex !== -1) return seriesIndex + 1;
    return undefined;
  }, [movie, top10Movies, top10Series]);

  if (notFound) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4">
        <p className="text-white text-xl font-bold uppercase tracking-widest">Conteúdo Não Localizado</p>
        <button onClick={closeMovieDetails} className="mt-8 px-8 py-3 bg-red-600 font-bold tracking-widest hover:bg-white hover:text-black uppercase text-white rounded-xl transition-all shadow-xl">Voltar</button>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(220,38,38,0.5)]">
          <Play size={40} fill="white" className="text-white ml-2" />
        </div>
        <p className="mt-8 text-white font-black uppercase tracking-[0.3em] text-sm animate-pulse italic">Carregando detalhes...</p>
      </div>
    );
  }

  const genreBasedSimilar = useMemo(() => {
    if (!movie) return [];
    const movieGenres = (movie.genres || movie.genre || '').split(',').map((g: string) => g.trim().toLowerCase()).filter(Boolean);
    const scored = myMovies
      .filter((m: any) => m.id?.toString() !== movie.id?.toString())
      .map((m: any) => {
        const mGenres = (m.genres || m.genre || '').split(',').map((g: string) => g.trim().toLowerCase());
        const shared = mGenres.filter((g: string) => movieGenres.includes(g)).length;
        return { m, shared };
      })
      .filter(({ shared }) => shared > 0)
      .sort((a, b) => b.shared - a.shared || (b.m.rating || 0) - (a.m.rating || 0));
    const top = scored.slice(0, 6).map(({ m }) => m);
    if (top.length < 6) {
      const ids = new Set(top.map((m: any) => m.id?.toString()));
      const rest = myMovies
        .filter((m: any) => m.id?.toString() !== movie.id?.toString() && !ids.has(m.id?.toString()))
        .sort(() => 0.5 - Math.random())
        .slice(0, 6 - top.length);
      return [...top, ...rest];
    }
    return top;
  }, [movie, myMovies]);

  return (
    <MovieDetailsModal
      movie={movie}
      onClose={closeMovieDetails}
      onPlay={(m: any, url: any, time: any, playerStyle: any, episodeIndex: any) => handlePlayMovie(m, url, time, playerStyle, episodeIndex)}
      onToggleMyList={() => toggleMyList(movie)}
      onToggleFavorite={() => toggleFavorite(movie)}
      similarMovies={genreBasedSimilar}
      allMovies={myMovies}
      onSelectSimilar={(similar: any) => navigate(`/movie/${similar.id}`, { state: location.state })}
      onWatchParty={() => onWatchParty(movie)}
      isAddedToMyList={myListIds.has(movie.id)}
      isFavorite={favoriteIds.has(movie.id)}
      streamingProviders={streamingProviders}
      onRequestMovie={onRequestMovie}
      rank={movieRank}
      appSettings={appSettings}
    />
  );
};

export const PlayerRouteWrapper = ({ myMovies, profile, closePlayer, handleSelectMovie, handlePlayMovie, onProgress, activeRoomId, isAppHost, appSettings }: any) => {
  const { movieId } = useParams();
  const location = useLocation();
  const movieFromState = location.state?.movie;
  const startTimeFromState = location.state?.startTime;
  const episodeUrlFromState = location.state?.episodeUrl;
  const episodeIndexFromState: number | undefined = location.state?.episodeIndex;
  const playerStyleFromState = location.state?.playerStyle;

  const searchParams = new URLSearchParams(location.search);
  const urlRoomId = searchParams.get('room');
  const currentRoomId = activeRoomId || urlRoomId;
  const isHost = isAppHost || (activeRoomId ? true : false);

  const movie = useMemo(() => {
    if (movieFromState && movieFromState.id.toString() === movieId) return movieFromState;
    return myMovies.find((m: any) => m.id.toString() === movieId);
  }, [movieId, myMovies, movieFromState]);

  const videoUrl = useMemo(() => {
    if (!movie) return '';
    const firstEpisodeUrl = movie.type === 'series' && movie.episodes && movie.episodes.length > 0
      ? (() => {
          const sorted = [...movie.episodes].sort((a: any, b: any) => {
            const sa = (a.season || 1) - (b.season || 1);
            return sa !== 0 ? sa : (a.episode || 0) - (b.episode || 0);
          });
          return sorted[0]?.videoUrl || sorted[0]?.videoUrl2 || '';
        })()
      : '';
    return episodeUrlFromState || movie.video_url || movie.videoUrl || firstEpisodeUrl || '';
  }, [movie, episodeUrlFromState]);

  const savedProgress = useMemo(() => {
    if (!movieId) return 0;
    const progress = localStorage.getItem(`netplay_progress_${movieId}`);
    return progress ? parseFloat(progress) : 0;
  }, [movieId]);

  const recommendations = useMemo(() => {
    if (!movie || !myMovies) return [];
    const genres = [movie.genre, ...(movie.genres || [])].filter(Boolean);
    const similar = myMovies.filter((m: any) =>
      m.id?.toString() !== movie.id?.toString() &&
      (genres.includes(m.genre) || (Array.isArray(m.genres) && m.genres.some((g: string) => genres.includes(g))))
    );
    const shuffledSimilar = similar.sort(() => 0.5 - Math.random());
    if (shuffledSimilar.length < 10) {
      const others = myMovies
        .filter((m: any) => m.id?.toString() !== movie.id?.toString() && !similar.find((s: any) => s.id === m.id))
        .sort(() => 0.5 - Math.random());
      return [...shuffledSimilar, ...others].slice(0, 10);
    }
    return shuffledSimilar.slice(0, 10);
  }, [movie, myMovies]);

  if (!movie) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center animate-spin shadow-[0_0_50px_rgba(220,38,38,0.5)]">
          <Play size={40} fill="white" className="text-white ml-2" />
        </div>
        <p className="mt-8 text-white font-black uppercase tracking-[0.3em] text-sm animate-pulse italic">Iniciando reprodutor...</p>
      </div>
    );
  }

  return (
    <VideoPlayer
      key={`${movie.id}-${videoUrl}-${episodeIndexFromState ?? ''}`}
      movie={{ ...movie, videoUrl: videoUrl || movie.video_url || movie.videoUrl }}
      onClose={closePlayer}
      profileId={profile?.id}
      profile={profile}
      recommendations={recommendations}
      onProgress={onProgress}
      onPlayNext={(m: any, url: string, idx: number) => {
        if (!handlePlayMovie) return;
        let nextUrl = url;
        let nextPlayerStyle: string | undefined = playerStyleFromState;
        const saved = getSelectedServer();
        if (saved && isDynamicRef(url)) {
          if (saved.id === 'admin') {
            const ep = m.episodes?.find((e: any) => e.videoUrl === url || e.videoUrl2 === url);
            nextUrl = ep?.videoUrl2 || (m as any).videoUrl2 || url;
            nextPlayerStyle = 'netflix';
          } else if (saved.id === 'alternative') {
            nextUrl = convertTeraboxToApi(url, saved.altApi);
            nextPlayerStyle = 'netflix-cascade';
          } else if (saved.id === 'auto') {
            nextUrl = convertTeraboxToApi(url, saved.nativeApi);
            nextPlayerStyle = 'netflix-cascade';
          }
        }
        handlePlayMovie(m, nextUrl, 0, nextPlayerStyle, idx);
      }}
      roomId={currentRoomId}
      isHost={isHost}
      appSettings={appSettings}
      initialTime={startTimeFromState !== undefined ? startTimeFromState : savedProgress}
      initialPlayerStyle={playerStyleFromState}
      initialEpisodeIndex={episodeIndexFromState}
    />
  );
};
