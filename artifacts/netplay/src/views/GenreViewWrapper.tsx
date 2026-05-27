import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, Search, Plus } from 'lucide-react';
import { FRANCHISES } from '../lib/franchiseConstants';
import { CATEGORIES } from '../constants';

const GenreViewWrapper = ({ myMovies, moviesByGenre, handleSelectMovie, navigate, toggleMyList, myList }: any) => {
  const { genreName } = useParams();
  const genreMovies = useMemo(() => {
    if (!genreName) return [];
    if (genreName === 'Adicionados Recentemente') return myMovies;
    return moviesByGenre[genreName] || [];
  }, [genreName, myMovies, moviesByGenre]);

  const theme = useMemo(() => {
    return FRANCHISES.find(f => f.name.toLowerCase() === genreName?.toLowerCase() || f.id === genreName?.toLowerCase());
  }, [genreName]);

  const category = useMemo(() => {
    return CATEGORIES.find((c: any) => c.name.toLowerCase() === genreName?.toLowerCase());
  }, [genreName]);

  const heroMovie = genreMovies[0];

  return (
    <div
      key="genre-view"
      className="min-h-screen pb-40 relative overflow-hidden animate-fade-in"
    >
      {/* Dynamic Background Banner */}
      <div className="absolute top-0 left-0 w-full h-[60vh] md:h-screen transition-all duration-1000">
        <img
          src={theme?.backdrop || heroMovie?.backdrop_path || 'https://picsum.photos/seed/genre/1920/1080'}
          className="w-full h-full object-cover opacity-30 blur-sm scale-105"
          alt=""
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>
      </div>

      <div className="relative z-10 pt-32 px-4 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-8 rounded-full ${theme?.accent || 'bg-red-600'} shadow-lg`}></div>
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Explorar Categoria</span>
            </div>
            <div className="flex items-center gap-6">
               {category && (
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                    <category.icon size={48} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
                 </div>
               )}
               <h2 className="text-5xl md:text-[10rem] font-black text-white uppercase tracking-tighter italic leading-none drop-shadow-2xl">
                 {genreName}
               </h2>
            </div>
            {theme?.description && (
              <p className="text-gray-400 font-bold italic max-w-2xl text-xs md:text-sm uppercase tracking-widest leading-relaxed opacity-60">
                {theme.description}
              </p>
            )}
          </div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-3 text-white font-black uppercase tracking-widest text-[10px] italic bg-white/5 px-8 py-4 rounded-2xl border border-white/10 hover:bg-red-600 hover:border-red-600 transition-all shadow-2xl backdrop-blur-3xl group self-start md:self-auto">
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Voltar
          </button>
        </div>

        {genreMovies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white/[0.02] rounded-[4rem] border-2 border-dashed border-white/5 backdrop-blur-3xl">
            <Search className="text-gray-800 mb-8 animate-float" size={80} />
            <h3 className="text-3xl font-black text-white italic uppercase mb-2">Sem resultados</h3>
            <p className="text-gray-500 font-bold max-w-sm text-center italic text-xs uppercase tracking-widest">A biblioteca deste universo ainda está sendo mapeada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-10">
            {genreMovies.map((movie: any, idx: number) => (
              <div
                key={movie.id}
                className="relative cursor-pointer rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-2xl group hover:ring-4 hover:ring-red-600 transition-all aspect-[2/3] animate-fade-in hover:-translate-y-2 hover:scale-[1.02]"
                style={{ animationDelay: `${idx * 0.05}s` }}
                onClick={() => handleSelectMovie(movie)}
              >
                <img
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500/${movie.poster_path}`}
                  alt={movie.title || movie.name}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 md:p-6">
                  <p className="text-white font-black text-sm md:text-lg uppercase tracking-tighter truncate italic leading-none">{movie.title || movie.name}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMyList(movie);
                      }}
                      className={`p-2 md:p-3 rounded-xl transition-all ${myList.some((m: any) => m.id === movie.id) ? 'bg-red-600 text-white' : 'bg-white/10 text-white backdrop-blur-md border border-white/20 hover:bg-white/20'}`}
                    >
                      <Plus size={16} className={myList.some((m: any) => m.id === movie.id) ? 'rotate-45' : ''} />
                    </button>
                    <div className="text-[8px] md:text-[10px] font-black uppercase text-white/60 italic tracking-widest">{movie.release_date?.split('-')[0] || '2024'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GenreViewWrapper;
