import React from 'react';
import { motion } from 'motion/react';
import { Shield, RefreshCcw, Settings, TrendingUp, Bookmark, LogOut } from 'lucide-react';

const ProfilePageView = React.memo(({
  profile,
  favorites,
  myList,
  handleSwitchProfile,
  setIsAdminModalOpen,
  handleLogout,
  navigate,
  continueWatching,
  setIsSettingsOpen,
  setIsPlansScreenOpen
}: any) => {
  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="pt-20 px-2 md:px-12 min-h-screen pb-24"
    >
      <div className="flex flex-col md:flex-row items-center gap-5 md:gap-10 mb-8 bg-white/5 p-5 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-900 rounded-[1.5rem] blur opacity-25 group-hover:opacity-75 transition duration-1000" />
          <img
            src={profile?.avatar_url || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
            alt="Avatar"
            className="relative w-20 h-20 md:w-48 md:h-48 rounded-[1rem] md:rounded-[1.5rem] object-cover border-4 border-white/5 shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="text-center md:text-left flex-1 relative z-10">
          <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter italic mb-2">{profile?.name}</h2>
          <p className="text-gray-500 font-bold text-sm md:text-base mb-4 italic">Membro VIP</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="bg-red-600 text-white px-6 py-3 md:px-10 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 transition-all border border-red-600/20 flex items-center gap-2 shadow-xl"
            >
              <Shield size={16} /> Administração
            </button>
            <button
              onClick={handleSwitchProfile}
              className="bg-white text-black px-6 py-3 md:px-10 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all flex items-center gap-2 shadow-xl"
            >
              <RefreshCcw size={16} /> Trocar Perfil
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-white/10 text-white px-6 py-3 md:px-10 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/20 transition-all border border-white/10 flex items-center gap-2 backdrop-blur-md"
            >
              <Settings size={16} /> Configurações
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
        <div className="lg:col-span-1 space-y-6 md:space-y-12">
          <div className="bg-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white/10 backdrop-blur-2xl">
            <h3 className="text-white font-black text-xl md:text-2xl mb-6 md:mb-8 flex items-center gap-3 italic">
              <TrendingUp size={24} className="text-red-600" /> Dashboard
            </h3>
            <div className="space-y-4 md:space-y-6">
              <div className="p-4 md:p-6 bg-black/40 rounded-2xl md:rounded-3xl border border-white/5 flex justify-between items-center group">
                <span className="text-gray-500 font-black text-[10px] uppercase tracking-widest">Assistidos</span>
                <span className="text-white font-black text-xl md:text-3xl italic">{continueWatching.length}</span>
              </div>
              <div className="p-4 md:p-6 bg-black/40 rounded-2xl md:rounded-3xl border border-white/5 flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <Bookmark size={18} className="text-red-600" />
                  <span className="text-gray-500 font-black text-[10px] uppercase tracking-widest">Minha Lista</span>
                </div>
                <span className="text-white font-black text-xl md:text-3xl italic">{myList.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-12">
          <div className="bg-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white/10 backdrop-blur-2xl">
            <h3 className="text-white font-black text-xl md:text-2xl mb-6 flex items-center gap-3 italic">
              <Bookmark size={24} className="text-red-600" /> Minha Lista
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {myList.slice(0, 8).map((movie: any) => (
                <div
                  key={movie.id}
                  className="aspect-[2/3] relative rounded-xl overflow-hidden cursor-pointer group hover:ring-4 hover:ring-red-600 transition-all duration-300 shadow-2xl"
                >
                  <img
                    src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500/${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="mt-20 flex items-center gap-4 text-red-600 font-black uppercase tracking-[0.3em] text-xs italic hover:text-red-500 transition-colors"
      >
        <LogOut size={20} /> Sair do NetPremium
      </button>
    </motion.div>
  );
});

export default ProfilePageView;
