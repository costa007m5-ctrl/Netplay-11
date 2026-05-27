import { Movie } from '../types';

export const cleanTitle = (fileName: string) => {
  let name = fileName.replace(/\.[^/.]+$/, '');
  name = name.replace(/[._]/g, ' ');
  name = name.replace(/S\d+E\d+/gi, '');
  name = name.replace(/1080p|720p|4k|2160p|h264|h265|x264|x265|web-dl|bluray|dual|audio|dublado/gi, '');
  name = name.replace(/\(\d{4}\)/g, '');
  name = name.replace(/\[.*?\]/g, '');
  return name.trim();
};

export const MOVIE_COLS_BROWSE = 'id,title,type,poster_path,backdrop_path,release_date,first_air_date,release_year,rating,vote_average,runtime,genres,genre,video_url,video_url_2,preferred_quality,logo_path,watch_providers,is_hidden,last_rescanned_at,collection_id,collection_name,collection_poster_path,collection_backdrop_path,collection_logo_path,created_at,updated_at';

export const MOVIE_COLS_SEARCH = 'id,title,type,poster_path,backdrop_path,release_date,first_air_date,release_year,rating,vote_average,runtime,genres,genre,video_url,video_url_2,preferred_quality,logo_path,watch_providers,is_hidden,last_rescanned_at,collection_id,collection_name,collection_poster_path,collection_backdrop_path,collection_logo_path,actors,overview,episodes,created_at,updated_at';

export const fmtMovieRow = (m: any): Movie => ({
  ...m,
  videoUrl: m.video_url,
  videoUrl2: m.video_url_2,
  preferredQuality: m.preferred_quality || undefined,
  vote_average: m.vote_average || m.rating || 0,
  rating: m.rating || m.vote_average || 0,
  release_date: m.release_date || '',
  release_year: m.release_year || (m.release_date ? new Date(m.release_date).getFullYear() : 0),
  runtime: m.runtime || 0,
  actors: m.actors || '',
  is_hidden: m.is_hidden || false,
  watch_providers: m.watch_providers || '',
});
