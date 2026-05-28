import React, { useEffect, useState } from 'react';
import { Settings, User, LogOut, ChevronDown, Search, Bell, Play, ChevronLeft, X, Home, Film, Tv, Bookmark, Tv2 } from 'lucide-react';
import AdminModal from './AdminModal';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface NavbarProps {
  onOpenCustomUrl: () => void;
  onRefresh?: () => void;
  onSwitchProfile?: () => void;
  activeProfile?: Profile;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onStartReScan?: (movies: any[]) => void;
  scannerState?: any;
  reScannerState?: any;
  onOpenSettings?: () => void;
  showBack?: boolean;
  onBack?: () => void;
  isAdminModalOpen?: boolean;
  setIsAdminModalOpen?: (open: boolean) => void;
}

const Navbar = React.memo(({ 
  onOpenCustomUrl, 
  onRefresh, 
  onSwitchProfile, 
  activeProfile,
  activeTab = 'home',
  onTabChange = () => {},
  searchQuery = '',
  onSearchChange = () => {},
  onStartReScan,
  scannerState,
  reScannerState,
  onOpenSettings,
  showBack,
  onBack,
  isAdminModalOpen = false,
  setIsAdminModalOpen = () => {}
}: NavbarProps) => {
  const [show, handleShow] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const handleScroll = () => {
      handleShow(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchClick = () => {
    setIsSearchOpen(true);
    navigate('/search');
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v) {
      setSearchParams({ q: v }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    if (onSearchChange) onSearchChange(v);
  };

  const currentQuery = searchParams.get('q') || searchQuery || '';
  const isOnSearchPage = window.location.pathname === '/search';
  
  useEffect(() => {
    setIsSearchOpen(isOnSearchPage);
  }, [isOnSearchPage]);

  const desktopNavItems = [
    { id: 'home', label: 'Início', icon: Home, path: '/menu' },
    { id: 'filmes', label: 'Filmes', icon: Film, path: '/filmes' },
    { id: 'series', label: 'Séries', icon: Tv, path: '/series' },
    { id: 'canais', label: 'Canais', icon: Tv2, path: '/canais' },
    { id: 'novos-eps', label: 'Novos Ep.', icon: Bell, path: '/novos-episodios' },
  ];

  const mobileNavItems = [
    { id: 'home', label: 'Início', icon: Home, path: '/menu' },
    { id: 'canais', label: 'Canais', icon: Tv2, path: '/canais' },
    { id: 'search', label: 'Buscar', icon: Search, path: '/search' },
    { id: 'mylist', label: 'Lista', icon: Bookmark, path: '/mylist' },
    { id: 'profile', label: 'Perfil', icon: User, path: '/perfil', isProfile: true },
  ];

  return (
    <>
      {/* Top Navbar */}
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 w-full h-16 md:h-20 px-4 md:px-10 flex justify-between items-center z-50 transition-all duration-500 ease-in-out ${
          show || isOnSearchPage 
            ? "bg-black/90 backdrop-blur-[40px] shadow-[0_2px_30px_rgba(0,0,0,0.9)] border-b border-white/[0.04]" 
            : "bg-gradient-to-b from-black/70 via-black/20 to-transparent"
        }`}
      >
        <div className="flex items-center gap-4 md:gap-12 w-full max-w-[2000px] mx-auto">
          <AnimatePresence mode="wait">
            {showBack && !isOnSearchPage ? (
              <motion.button
                key="back-button"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={onBack}
                className="flex items-center gap-2 text-white font-black uppercase tracking-tighter italic group bg-white/8 hover:bg-white hover:text-black px-5 py-2 rounded-xl border border-white/10 transition-all shadow-xl whitespace-nowrap text-sm"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:inline">Voltar</span>
              </motion.button>
            ) : (
              <motion.div
                key="logo"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { navigate('/'); onTabChange('home'); }}
                className={`flex items-center gap-2.5 cursor-pointer group flex-shrink-0 ${isOnSearchPage && isSearchOpen ? 'hidden md:flex' : 'flex'}`}
              >
                <div className="w-9 h-9 md:w-11 md:h-11 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/50 group-hover:shadow-red-500/70 transition-all border border-red-400/20 group-hover:scale-105">
                  <Play size={18} fill="white" className="text-white ml-1 md:w-5 md:h-5" />
                </div>
                <span className="text-[22px] md:text-[32px] font-black text-white uppercase tracking-tighter italic font-display leading-none drop-shadow-xl">
                  NET<span className="text-red-500 animate-neon-flicker">PLAY</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Desktop Navigation */}
          <ul className={`hidden md:flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.07] shadow-2xl backdrop-blur-2xl ${isOnSearchPage ? 'md:hidden lg:flex' : ''}`}>
            {desktopNavItems.map((item) => {
              const isActive = activeTab === item.id && !isOnSearchPage;
              return (
                <li 
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    onTabChange(item.id);
                  }}
                  className={`cursor-pointer transition-all flex items-center gap-2 relative px-5 py-2.5 rounded-full group ${
                    isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill-desktop"
                      className="absolute inset-0 bg-white/10 rounded-full border border-white/10 -z-10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <item.icon 
                    size={14} 
                    className={isActive ? 'text-red-500' : 'group-hover:text-red-400 transition-colors'} 
                  />
                  <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.15em]">{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_8px_rgba(255,26,26,0.8)]" />
                  )}
                </li>
              );
            })}
          </ul>

          {/* Right side: Search + Profile */}
          <div className="flex-1 flex justify-end items-center gap-3">
            {!isOnSearchPage && (
              !isSearchOpen ? (
                <motion.button 
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSearchClick}
                  className="p-2.5 text-white bg-white/[0.06] hover:bg-white/12 rounded-full transition-all border border-white/[0.08] shadow-lg"
                >
                  <Search size={18} className="text-gray-300" />
                </motion.button>
              ) : (
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '100%', opacity: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="relative flex items-center w-full max-w-xl bg-black/70 backdrop-blur-2xl border border-white/15 rounded-full overflow-hidden shadow-2xl h-11 md:h-12"
                >
                  <Search size={16} className="text-gray-500 absolute left-4 pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar filmes, séries, episódios..."
                    value={currentQuery}
                    onChange={handleSearchInput}
                    className="w-full bg-transparent text-white font-medium placeholder-gray-500 outline-none h-full text-sm pl-10 pr-10"
                  />
                  {currentQuery && (
                    <button 
                      onClick={() => {
                        setSearchParams({});
                        onSearchChange('');
                        setIsSearchOpen(false);
                      }}
                      className="p-2 mr-2 text-gray-400 hover:text-white transition-colors absolute right-1"
                    >
                      <X size={16} />
                    </button>
                  )}
                </motion.div>
              )
            )}

            {/* Profile avatar */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { navigate('/perfil'); onTabChange('profile'); }}
              className="hidden md:flex flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-white/15 hover:border-red-500/60 transition-all shadow-lg"
            >
              <img
                src={activeProfile?.avatar_url || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                alt="Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Bottom Navigation — Floating Dock */}
      <div className="fixed bottom-4 left-4 right-4 h-[64px] floating-navbar rounded-[24px] flex justify-around items-center z-50 md:hidden px-2 select-none">
        {mobileNavItems.map((item) => {
          const isSearch = item.id === 'search';
          const isActive = isSearch ? isOnSearchPage : (activeTab === item.id && !isOnSearchPage);
          
          return (
            <button 
              key={item.id}
              onClick={() => {
                navigate(item.path);
                onTabChange(item.id);
              }}
              className="flex flex-col items-center justify-center relative w-14 h-14 rounded-2xl transition-all duration-300 active:scale-90"
            >
              {/* Active background glow */}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-bg"
                  className="absolute inset-0 rounded-2xl tab-active-indicator"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                />
              )}

              {/* Icon container */}
              <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? '-translate-y-0.5' : ''}`}>
                {item.isProfile ? (
                  <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all duration-300 ${isActive ? 'border-red-500 shadow-[0_0_12px_rgba(255,26,26,0.6)]' : 'border-white/20'}`}>
                    <img
                      src={activeProfile?.avatar_url || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                      alt="Perfil"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <item.icon 
                    size={22} 
                    className={`transition-all duration-300 ${
                      isActive 
                        ? 'text-red-500 drop-shadow-[0_0_10px_rgba(255,26,26,0.8)]' 
                        : 'text-white/45'
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                )}
              </div>

              {/* Label */}
              <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 transition-all duration-300 leading-none ${
                isActive ? 'text-red-500 opacity-100' : 'text-white/35 opacity-100'
              }`}>
                {item.label}
              </span>

              {/* Active dot indicator */}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-dot"
                  className="absolute -bottom-2.5 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_8px_rgba(255,26,26,0.9)]"
                  transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {isAdminModalOpen && (
        <AdminModal 
          onClose={() => setIsAdminModalOpen(false)} 
          onRefresh={onRefresh}
          onOpenCustomUrl={() => {
            setIsAdminModalOpen(false);
            onOpenCustomUrl();
          }}
          onStartReScan={onStartReScan}
          scannerState={scannerState}
          reScannerState={reScannerState}
        />
      )}
    </>
  );
});

export default Navbar;
