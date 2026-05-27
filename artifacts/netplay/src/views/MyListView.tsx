import React from 'react';
import { motion } from 'motion/react';
import { List, Plus } from 'lucide-react';

const MyListView = React.memo(({ myList, handleSelectMovie, navigate }: any) => {
  return (
    <motion.div
      key="mylist"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.3 }}
      className="pt-24 px-4 md:px-12 min-h-screen"
    >
      <h2 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter italic mb-12">Minha Lista</h2>

      {myList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[4rem] bg-white/[0.02]">
          <div className="p-10 bg-white/5 rounded-[3rem] border border-white/10 mb-8 animate-pulse text-gray-600">
            <List size={64} />
          </div>
          <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic mb-4">Lista Vazia</h3>
          <p className="text-gray-500 font-bold mb-8">Nenhum título adicionado à sua lista pessoal ainda.</p>
          <button
            onClick={() => navigate('/home')}
            className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase italic tracking-widest hover:scale-105 transition-all shadow-xl"
          >
            Explorar Catálogo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {myList.map((movie: any) => (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group cursor-pointer"
              onClick={() => handleSelectMovie(movie)}
            >
              <div className="aspect-[2/3] rounded-[2.5rem] overflow-hidden border border-white/10 group-hover:border-red-600 transition-all shadow-2xl">
                <img
                  src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500/${movie.poster_path}`}
                  alt={movie.title || movie.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-white font-black text-lg uppercase tracking-tighter truncate leading-none">{movie.title || movie.name}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
});

export default MyListView;
