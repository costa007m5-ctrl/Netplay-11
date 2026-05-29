import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, useDeferredValue, startTransition } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Login';
import ProfileSelection from './components/ProfileSelection';
// Lazy-load heavy components only when actually needed (huge initial bundle savings)
const VideoPlayer = React.lazy(() => import('./components/VideoPlayer'));
const CustomUrlModal = React.lazy(() => import('./components/CustomUrlModal'));
const MovieDetailsModal = React.lazy(() => import('./components/MovieDetailsModal'));
const WatchPartyModal = React.lazy(() => import('./components/WatchPartyModal'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const IntroVignette = React.lazy(() => import('./components/IntroVignette'));
const FlixNovitiesPage = React.lazy(() => import('./pages/FlixNovitiesPage'));
const AppInfo = React.lazy(() => import('./components/AppInfo'));
const OnboardingFlow = React.lazy(() => import('./components/OnboardingFlow'));
const AdminPanel = React.lazy(() => import('./components/admin/AdminPanel'));
const CanaisTVPage = React.lazy(() => import('./pages/CanaisTVPage'));
const ProfileDashboard = React.lazy(() => import('./components/ProfileDashboard'));
const AdvancedSearch = React.lazy(() => import('./components/AdvancedSearch'));
const DiscoverySearchView = React.lazy(() => import('./views/DiscoverySearchView'));
const SmartPlayerSelector = React.lazy(() => import('./components/SmartPlayerSelector'));
const Admin2Page = React.lazy(() => import('./pages/Admin2Page'));
const Admin3Page = React.lazy(() => import('./pages/Admin3Page'));
const SyncIsland = React.lazy(() => import('./components/SyncIsland'));
import { CATEGORIES } from './constants';
import { isDynamicRef, parseDynamicRef } from './services/terabox';
import { getSelectedServer, convertTeraboxToApi } from './components/SmartPlayerSelector';
import tmdb, { requests, getMovieLogo } from './services/tmdb';
import { notificationService } from './services/notificationService';
import { Movie, Profile, WatchHistory, ScannerState, ReScannerState, CollectionScannerState, LogoScannerState, LogoScanScope, LogoScanMode, MyList, AppSettings, Episode, StreamingProvider } from './types';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { loadGlobalPlayerApiSettings } from './services/playerApiSettings';
import { motion, AnimatePresence } from 'motion/react';
import { FRANCHISES } from './lib/franchiseConstants';
import { ThemeContext } from './contexts/ThemeContext';
import { cleanTitle, fmtMovieRow, MOVIE_COLS_BROWSE, MOVIE_COLS_SEARCH } from './lib/movieUtils';
import PlansScreen from './components/PlansScreen';
import HomeView from './views/HomeView';
import GenreViewWrapper from './views/GenreViewWrapper';
import ContentFilteredPage from './views/ContentFilteredPage';
import NewEpisodesView from './views/NewEpisodesView';
import UniverseTabView from './views/UniverseTabView';
import MyListView from './views/MyListView';
import MinhaListaPremiumView from './views/MinhaListaPremiumView';
import NovidadesView from './views/NovidadesView';
import TrendingView from './views/TrendingView';
import ProviderViewWrapper from './views/ProviderViewWrapper';
import { MovieDetailRouteWrapper, PlayerRouteWrapper } from './views/RouteWrappers';
import { Loader2, Play, Pause, Square, Sparkles, Settings, List } from 'lucide-react';

const MAIN_TABS = ['menu', 'novidades', 'filmes', 'series', 'novos-episodios', 'perfil'];

function InviteRedirect() {
  const { inviteId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteId) {
      localStorage.setItem('netplay_referral_code', inviteId);
    }
    navigate('/', { replace: true });
  }, [inviteId, navigate]);

  return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;
  const [currentTheme, setCurrentTheme] = useState('default');
  const [providerData, setProviderData] = useState<any>(null);

  useEffect(() => {
    loadGlobalPlayerApiSettings();
  }, []);

  useEffect(() => {
    // Defer OneSignal init until browser is idle (after first paint) — saves ~150kb on initial render
    const initOneSignal = () => {
      import('react-onesignal').then(({ default: OneSignal }) => {
        try {
          OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID || "581f23c1-2b57-4646-8780-6cd2ccbba30e",
            allowLocalhostAsSecureOrigin: true,
          }).then(() => {
            OneSignal.Slidedown.promptPush();
          });
        } catch (e) {
          console.warn("OneSignal init error:", e);
        }
      });
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(initOneSignal, { timeout: 3000 });
    } else {
      setTimeout(initOneSignal, 2000);
    }
  }, []);

  // Mostra a vinheta apenas na primeira entrada da sessão — reloads de página não reapresentam
  const [showIntro, setShowIntro] = useState(() => {
    try { return !sessionStorage.getItem('netplay_intro_shown'); } catch { return true; }
  });
  const [showAppInfo, setShowAppInfo] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [initialLoginMode, setInitialLoginMode] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [viewingMovie, setViewingMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isPlansScreenOpen, setIsPlansScreenOpen] = useState(false);
  const [myMovies, setMyMovies] = useState<Movie[]>(() => {
    try {
      const raw = localStorage.getItem('cached_my_movies_v6');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [isLoadingMovies, setIsLoadingMovies] = useState(() => {
    try {
      const raw = localStorage.getItem('cached_my_movies_v6');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch {}
    return true;
  });
  const [loadingMoreCount, setLoadingMoreCount] = useState(0);
  const [totalMoviesCount, setTotalMoviesCount] = useState<number | null>(() => {
    try { const c = localStorage.getItem('cached_counts_v1'); if (c) return JSON.parse(c).movies ?? null; } catch {}
    return null;
  });
  const [totalSeriesCount, setTotalSeriesCount] = useState<number | null>(() => {
    try { const c = localStorage.getItem('cached_counts_v1'); if (c) return JSON.parse(c).series ?? null; } catch {}
    return null;
  });
  const [newOnPlatformMovies, setNewOnPlatformMovies] = useState<Movie[]>([]);
  const [newOnPlatformSeries, setNewOnPlatformSeries] = useState<Movie[]>([]);
  // useDeferredValue: computações pesadas (franquias, gêneros, etc.) só recomputam
  // quando o browser estiver ocioso — evita travar a UI durante o carregamento em fundo
  const deferredMyMovies = useDeferredValue(myMovies);
  const [continueWatching, setContinueWatching] = useState<Movie[]>([]);
  const [watchHistory, setWatchHistory] = useState<Record<number, number>>({});
  const [personalizedMovies, setPersonalizedMovies] = useState<Movie[]>([]);
  
  // Novos estados para Abas e Pesquisa
  const activeTab = useMemo(() => {
    const path = location.pathname.split('/')[1] || 'menu';
    if (path === 'menu') return 'home';
    if (path === 'perfil') return 'profile';
    if (path === 'provider') return 'home';
    return path as any;
  }, [location.pathname]);

  // Caminho primário — quando um modal de filme está aberto, preserva o path de fundo
  // backgroundLocation pode ser string (pathname) ou objeto Location — trata ambos
  const activePrimaryPath = useMemo(() => {
    const bgLoc = state?.backgroundLocation;
    const primaryPath = bgLoc
      ? (typeof bgLoc === 'string' ? bgLoc : (bgLoc.pathname ?? location.pathname))
      : location.pathname;
    return (primaryPath || location.pathname).split('/')[1] || 'menu';
  }, [location.pathname, state?.backgroundLocation]);

  // Lazy-mount: cada tab monta só na primeira visita, depois fica sempre na memória
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([activePrimaryPath || 'menu']));
  useEffect(() => {
    if (MAIN_TABS.includes(activePrimaryPath)) {
      setMountedTabs(prev => {
        if (prev.has(activePrimaryPath)) return prev;
        const next = new Set(prev);
        next.add(activePrimaryPath);
        return next;
      });
    }
  }, [activePrimaryPath]);

  const [activeFranchise, setActiveFranchise] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalDbSearchResults, setGlobalDbSearchResults] = useState<Movie[]>([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [smartPlayState, setSmartPlayState] = useState<{ movie: any; episodeUrl: string; episodeIndex: number } | null>(null);
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('netplay_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((p: any) => {
          const original = CATEGORIES.find(c => c.id === p.id);
          return { ...p, icon: original?.icon || CATEGORIES[0].icon };
        });
      } catch (e) {
        return CATEGORIES;
      }
    }
    return CATEGORIES;
  });
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [watchPartyMovie, setWatchPartyMovie] = useState<Movie | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myList, setMyList] = useState<Movie[]>([]);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [streamingProviders, setStreamingProviders] = useState<StreamingProvider[]>([]);

  // Hoist isAdmin before its use in useMemo hooks
  const [isAdmin, setIsAdmin] = useState(false);

  const effectiveAppSettings = useMemo(() => {
    if (isAdmin) {
      if (appSettings) {
        return {
          ...appSettings,
          subscription_plan: 'max',
          subscription_status: 'active'
        } as AppSettings;
      } else {
        return {
          id: 'admin-mock',
          user_id: user?.id || 'admin',
          subscription_plan: 'max',
          subscription_status: 'active',
          theme: 'default',
          language: 'pt-BR',
          autoplay_next: true,
          show_logos: true,
          category_backdrops: {},
          updated_at: new Date().toISOString()
        } as unknown as AppSettings;
      }
    }
    return appSettings;
  }, [appSettings, isAdmin, user]);

  const [scannerState, setScannerState] = useState<ScannerState | null>(() => {
    const saved = localStorage.getItem('scanner_state');
    return saved ? JSON.parse(saved) : null;
  });

  const [reScannerState, setReScannerState] = useState<ReScannerState | null>(() => {
    const saved = localStorage.getItem('rescanner_state');
    return saved ? JSON.parse(saved) : null;
  });

  const [collectionAutomationState, setCollectionAutomationState] = useState<CollectionScannerState | null>(() => {
    const saved = localStorage.getItem('collection_automation_state');
    return saved ? JSON.parse(saved) : null;
  });

  const [logoScannerState, setLogoScannerState] = useState<LogoScannerState | null>(null);
  const logoScannerCancelRef = useRef(false);

  const hasTmdbKey = true;
  const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/');
  };

  const handleLogoutAll = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setUser(null);
    setProfile(null);
    navigate('/');
  };

  const refreshCategoryImages = async (categoryId?: number) => {
    const newCategories = await Promise.all(categories.map(async (cat: any) => {
      if (categoryId && cat.id !== categoryId) return cat;
      
      try {
        const res = await tmdb.get(requests.fetchMoviesByGenre(cat.id));
        const movies = res.data.results;
        if (movies && movies.length > 0) {
          const validBackdrops = movies.filter((m: any) => m.backdrop_path).slice(0, 10);
          if (validBackdrops.length > 0) {
            const randomMovie = validBackdrops[Math.floor(Math.random() * validBackdrops.length)];
            return { ...cat, backdrop: `https://image.tmdb.org/t/p/original${randomMovie.backdrop_path}` };
          }
        }
      } catch (e) {
        console.error("Erro ao atualizar imagem da categoria:", e);
      }
      return cat;
    }));
    setCategories(newCategories);
    localStorage.setItem('netplay_categories', JSON.stringify(newCategories));
    
    // Save to settings in Supabase as well
    if (appSettings) {
      const backdrops: Record<number, string> = {};
      newCategories.forEach((c: any) => {
        backdrops[c.id] = c.backdrop;
      });
      updateAppSettings({ ...appSettings, category_backdrops: backdrops });
    }
  };

  const updateCategoryImage = async (categoryId: number, backdrop: string) => {
    const newCategories = categories.map((cat: any) => 
      cat.id === categoryId ? { ...cat, backdrop } : cat
    );
    setCategories(newCategories);
    localStorage.setItem('netplay_categories', JSON.stringify(newCategories));
    
    if (appSettings) {
      const backdrops = { ...(appSettings.category_backdrops || {}) };
      backdrops[categoryId] = backdrop;
      updateAppSettings({ ...appSettings, category_backdrops: backdrops });
    }
  };

  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.id)), [favorites]);
  const myListIds = useMemo(() => new Set(myList.map(m => m.id)), [myList]);

  const heroMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    const heroKeywords = ['marvel', 'dc comics', 'batman', 'spider-man', 'spiderman', 'superman', 'avengers', 'vingadores', 'liga da justiça', 'justice league', 'x-men', 'herói', 'hero', 'super-herói'];
    return deferredMyMovies.filter(m => {
      const t = (m.title || '').toLowerCase();
      const g = (m.genres || '').toLowerCase();
      return heroKeywords.some(k => t.includes(k)) || g.includes('fantasia') || g.includes('ação');
    });
  }, [deferredMyMovies, loadingMoreCount]);

  const collectionMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    // Usa conjunto de palavras-chave indexado por franquia para evitar quadratic matching
    const allKeywords = FRANCHISES.flatMap(f => f.keywords);
    return deferredMyMovies.filter(m => {
      const t = (m.title || '').toLowerCase();
      return allKeywords.some(k => t.includes(k));
    }).sort((a, b) => {
      const dateA = String(a.release_date || (a as any).release_year || '0');
      const dateB = String(b.release_date || (b as any).release_year || '0');
      return dateA.localeCompare(dateB);
    });
  }, [deferredMyMovies, loadingMoreCount]);

  const dynamicFranchises = useMemo(() => {
    // Não recalcula enquanto ainda há dados carregando em background
    if (loadingMoreCount > 0) return [] as any[];

    const list: any[] = [];
    const coveredMovieIds = new Set<number>();

    // Pré-computa string de busca por filme para evitar concatenação repetida por franquia
    const movieSearchStr = new Map<number, string>();
    deferredMyMovies.forEach(m => {
      movieSearchStr.set(m.id, [
        m.title, (m as any).name, m.overview, m.genres, m.actors, m.collection_name
      ].map(s => (s || '').toLowerCase()).join(' '));
    });

    // Matcha filmes de uma franquia usando string pré-computada
    const matchesFranchise = (m: Movie, keywords: string[]) => {
      const str = movieSearchStr.get(m.id) || '';
      return keywords.some(k => str.includes(k));
    };

    // 1. Franquias definidas (Marvel, DC, Disney, etc.)
    FRANCHISES.forEach(f => {
      const movies = deferredMyMovies.filter(m => matchesFranchise(m, f.keywords));
      
      if (movies.length > 0) {
        const logoFromMovie = movies.find(m => m.logo_path)?.logo_path;
        movies.forEach(m => coveredMovieIds.add(m.id));
        list.push({
          ...f,
          movies: movies.sort((a, b) => (a.release_year || 0) - (b.release_year || 0)),
          poster: f.poster || movies[0].poster_path,
          backdrop: f.backdrop || movies[0].backdrop_path,
          logo: f.logo || logoFromMovie
        });
      }
    });

    // 2a. Coleções TMDB por collection_id
    const collectionsById: Record<number, Movie[]> = {};
    deferredMyMovies.forEach(m => {
      if (m.collection_id && !coveredMovieIds.has(m.id)) {
        if (!collectionsById[m.collection_id]) collectionsById[m.collection_id] = [];
        collectionsById[m.collection_id].push(m);
      }
    });

    Object.entries(collectionsById).forEach(([id, movies]) => {
      if (movies.length < 2) return;
      const collectionName = movies[0].collection_name || 'Coleção';
      movies.forEach(m => coveredMovieIds.add(m.id));
      list.push({
        id: `tmdb-${id}`,
        name: collectionName,
        keywords: [collectionName.toLowerCase()],
        color: '#ffffff',
        bg: 'bg-[#121212]',
        accent: 'text-gray-400',
        icon: List,
        description: `Coleção: ${collectionName}.`,
        movies: movies.sort((a, b) => (a.release_year || 0) - (b.release_year || 0)),
        poster: movies[0].collection_poster_path || movies[0].poster_path,
        backdrop: movies[0].collection_backdrop_path || movies[0].backdrop_path,
        logo: movies[0].collection_logo_path,
        tmdb_collection_id: parseInt(id)
      });
    });

    // 2b. Coleções por collection_name (filmes que têm nome mas ainda não têm collection_id)
    const collectionsByName: Record<string, Movie[]> = {};
    deferredMyMovies.forEach(m => {
      const name = (m.collection_name || '').trim();
      if (name && !coveredMovieIds.has(m.id)) {
        if (!collectionsByName[name]) collectionsByName[name] = [];
        collectionsByName[name].push(m);
      }
    });

    Object.entries(collectionsByName).forEach(([name, movies]) => {
      if (movies.length < 2) return;
      // Evita duplicar com coleções já adicionadas pelo id
      const alreadyAdded = list.some(f => f.name.toLowerCase() === name.toLowerCase());
      if (alreadyAdded) return;
      movies.forEach(m => coveredMovieIds.add(m.id));
      list.push({
        id: `name-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        keywords: [name.toLowerCase()],
        color: '#ffffff',
        bg: 'bg-[#121212]',
        accent: 'text-gray-400',
        icon: List,
        description: `Coleção: ${name}.`,
        movies: movies.sort((a, b) => (a.release_year || 0) - (b.release_year || 0)),
        poster: movies[0].collection_poster_path || movies[0].poster_path,
        backdrop: movies[0].collection_backdrop_path || movies[0].backdrop_path,
        logo: movies[0].collection_logo_path,
      });
    });

    return list;
  }, [deferredMyMovies, loadingMoreCount]);

  // Enriquece filmes sem collection_id consultando o TMDB em background
  const enrichCollectionsInBackground = React.useCallback(async (movies: Movie[]) => {
    if (!hasSupabase) return;
    const toEnrich = movies.filter(m => 
      !m.collection_id && 
      m.type !== 'series' && 
      (m.title || '').trim().length > 0
    ).slice(0, 20); // Processa até 20 filmes por vez

    if (toEnrich.length === 0) return;

    const CONCURRENCY = 4;
    for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
      const batch = toEnrich.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (movie) => {
        try {
          const q = encodeURIComponent(movie.title || '');
          const yr = (movie as any).release_year || '';
          const searchRes = await fetch(`/api/tmdb/search/movie?query=${q}${yr ? `&year=${yr}` : ''}&language=pt-BR`);
          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const tmdbId = searchData.results?.[0]?.id;
          if (!tmdbId) return;

          const detailRes = await fetch(`/api/tmdb/movie/${tmdbId}?language=pt-BR`);
          if (!detailRes.ok) return;
          const details = await detailRes.json();
          const col = details.belongs_to_collection;
          if (!col?.id) return;

          const posterPath = col.poster_path ? `https://image.tmdb.org/t/p/w500${col.poster_path}` : null;
          const backdropPath = col.backdrop_path ? `https://image.tmdb.org/t/p/w780${col.backdrop_path}` : null;

          await supabase.from('movies').update({
            collection_id: col.id,
            collection_name: col.name,
            ...(posterPath ? { collection_poster_path: posterPath } : {}),
            ...(backdropPath ? { collection_backdrop_path: backdropPath } : {}),
          }).eq('id', movie.id);
        } catch {
          // silencioso
        }
      }));
      await new Promise(r => setTimeout(r, 300)); // respeita rate limit
    }
    // Enriquecimento salvo no Supabase — o cache local será atualizado na próxima sessão
    // Não recarrega todos os filmes para evitar o custo de desempenho
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSupabase]);

  // Dispara enriquecimento uma vez por sessão quando os filmes carregam
  const enrichedRef = React.useRef(false);
  useEffect(() => {
    if (myMovies.length > 0 && !enrichedRef.current) {
      enrichedRef.current = true;
      const timer = setTimeout(() => enrichCollectionsInBackground(myMovies), 20000);
      return () => clearTimeout(timer);
    }
  }, [myMovies, enrichCollectionsInBackground]);

  const getTop10 = (movieList: Movie[]) => {
    return [...movieList]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 10);
  };

  const selectedProviderTop10 = useMemo(() => {
    if (!selectedProvider) return [];
    const providersMovies = myMovies.filter(m => {
      if (m.watch_providers) {
        return m.watch_providers.toLowerCase().includes(selectedProvider.toLowerCase());
      }
      return false;
    });
    return getTop10(providersMovies);
  }, [selectedProvider, myMovies]);

  // Memoize sets to prevent unnecessary re-renders of Row components

  const fetchStreamingProviders = async () => {
    const { data, error } = await supabase
      .from('streaming_providers')
      .select('*')
      .order('priority', { ascending: true });
    
    if (!error && data) {
      setStreamingProviders(data);
      // Se estiver vazio, podemos sugerir ou auto-popular com os padrões
      if (data.length === 0) {
        seedDefaultProviders();
      }
    }
  };

  const seedDefaultProviders = async () => {
    const defaults = [
      { name: 'Netflix', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', priority: 1 },
      { name: 'Disney+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', priority: 2 },
      { name: 'Max', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg', priority: 3 },
      { name: 'Prime Video', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png', priority: 4 },
      { name: 'Apple TV+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg', priority: 5 },
      { name: 'Paramount+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg', priority: 6 },
      { name: 'Globoplay', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Globoplay_logo.svg', priority: 7 },
      { name: 'Hulu', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg', priority: 8 }
    ];

    const { error } = await supabase.from('streaming_providers').insert(defaults);
    if (!error) fetchStreamingProviders();
  };

  useEffect(() => {
    fetchStreamingProviders();
  }, []);

  const handleAddStreamingProvider = async (provider: Partial<StreamingProvider>) => {
    const { error } = await supabase.from('streaming_providers').insert([provider]);
    if (!error) fetchStreamingProviders();
  };

  const handleUpdateStreamingProvider = async (provider: StreamingProvider) => {
    const { error } = await supabase.from('streaming_providers').update(provider).eq('id', provider.id);
    if (!error) fetchStreamingProviders();
  };

  const handleDeleteStreamingProvider = async (id: string) => {
    const { error } = await supabase.from('streaming_providers').delete().eq('id', id);
    if (!error) fetchStreamingProviders();
  };

  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);

  const fetchDriveFiles = async () => {
    if (!appSettings?.google_drive_token) return;
    setIsFetchingDrive(true);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType+contains+'video/'&fields=files(id,name,mimeType,size)&access_token=${appSettings.google_drive_token}`);
      const data = await response.json();
      setDriveFiles(data.files || []);
    } catch (error) {
      console.error('Erro ao buscar arquivos do Drive:', error);
    } finally {
      setIsFetchingDrive(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' && appSettings?.google_drive_token) {
      fetchDriveFiles();
    }
  }, [activeTab, appSettings?.google_drive_token]);

  const addDriveFileToLibrary = async (file: any) => {
    const videoUrl = `https://drive.google.com/file/d/${file.id}/view`;
    
    // Verificar se já existe
    if (myMovies.some(m => m.videoUrl === videoUrl)) {
      alert('Este vídeo já está na sua biblioteca!');
      return;
    }

    const cleanName = await cleanTitle(file.name);
    
    const movieData: Partial<Movie> = {
      title: cleanName,
      videoUrl: videoUrl,
      backdrop_path: 'https://picsum.photos/seed/drive/1920/1080',
      poster_path: 'https://picsum.photos/seed/drive/500/750',
      overview: `Vídeo adicionado do seu Google Drive: ${file.name}`,
      genres: 'Drive',
      type: 'movie'
    };

    const { error } = await supabase.from('movies').insert([movieData]);
    if (!error) {
      fetchMyMovies();
      notificationService.notifyNewMovie(movieData.title || 'Novo Filme', movieData.poster_path);
      alert('Vídeo adicionado com sucesso!');
    }
  };

  // Salvar estado do scanner
  useEffect(() => {
    if (scannerState) {
      localStorage.setItem('scanner_state', JSON.stringify(scannerState));
    } else {
      localStorage.removeItem('scanner_state');
    }
  }, [scannerState]);

  // Salvar estado do re-scanner
  useEffect(() => {
    if (reScannerState) {
      localStorage.setItem('rescanner_state', JSON.stringify(reScannerState));
    } else {
      localStorage.removeItem('rescanner_state');
    }
  }, [reScannerState]);

  useEffect(() => {
    // Only basic syncing, prevent annoying offline redirects entirely.
    const handlePopState = () => {};
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Salvar estado da automação de coleções
  useEffect(() => {
    const handleOpenCollection = (e: any) => {
      const { id, name } = e.detail;
      const franchise = dynamicFranchises.find(f => f.id === id || f.name.toLowerCase() === name.toLowerCase());
      if (franchise) {
        setActiveFranchise(franchise);
        navigate(`/universe/${franchise.id}`);
      }
    };

    window.addEventListener('open-collection', handleOpenCollection);

    const handleOpenProvider = (e: any) => {
      navigate(`/provider/${e.detail}`);
    };
    window.addEventListener('open-provider' as any, handleOpenProvider);

    return () => {
      window.removeEventListener('open-collection', handleOpenCollection);
      window.removeEventListener('open-provider' as any, handleOpenProvider);
    };
  }, [dynamicFranchises, navigate]);

  useEffect(() => {
    if (collectionAutomationState) {
      localStorage.setItem('collection_automation_state', JSON.stringify(collectionAutomationState));
    } else {
      localStorage.removeItem('collection_automation_state');
    }
  }, [collectionAutomationState]);

  const stopScanner = () => {
    setScannerState(null);
  };

  const stopReScanner = () => {
    setReScannerState(null);
  };

  const pauseScanner = () => {
    setScannerState(prev => prev ? { ...prev, isPaused: true, status: 'Pausado' } : null);
  };

  const pauseReScanner = () => {
    setReScannerState(prev => prev ? { ...prev, isPaused: true, status: 'Pausado' } : null);
  };

  const resumeScanner = () => {
    if (!scannerState) return;
    setScannerState(prev => prev ? { ...prev, isPaused: false, status: 'Retomando...' } : null);
    if (scannerState.pendingFiles) {
      processFiles(scannerState.pendingFiles, scannerState.current);
    }
  };

  const resumeReScanner = () => {
    if (!reScannerState) return;
    setReScannerState(prev => prev ? { ...prev, isPaused: false, status: 'Retomando...' } : null);
    if (reScannerState.pendingMovies) {
      processReScan(reScannerState.pendingMovies, reScannerState.current);
    }
  };

  const processFiles = async (files: any[], startIndex: number = 0, options?: { type?: 'movie' | 'series', folderName?: string }) => {
    const driveApiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
    if (!driveApiKey) return;

    const { data: existingMovies } = await supabase.from('movies').select('video_url');
    const existingUrls = new Set(existingMovies?.map(m => m.video_url) || []);

    // Se for série, vamos agrupar por pasta ou nome limpo
    if (options?.type === 'series' && files.length > 0) {
      setScannerState(prev => prev ? { ...prev, status: 'Organizando episódios...' } : null);
      
      // Usar o nome da pasta se disponível, senão o nome do primeiro arquivo
      const rawSeriesName = (options.folderName || files[0].name)
        .replace(/^\w+\s\(\d{4}\)\s?/, '')
        .replace(/\(\d{4}\)/g, '')
        .replace(/\[\d{4}\]/g, '')
        .trim();

      const seriesCleanName = await cleanTitle(rawSeriesName);
      
      // Buscar info da série no TMDB
      let searchRes = await tmdb.get(requests.searchTv, { params: { query: seriesCleanName } });
      
      if (searchRes.data.results.length === 0 && seriesCleanName !== rawSeriesName) {
        searchRes = await tmdb.get(requests.searchTv, { params: { query: rawSeriesName } });
      }

      const result = searchRes.data.results[0];
      
      let seriesData: any = null;
      if (result) {
        const detailsRes = await tmdb.get(requests.tvDetails(result.id));
        const providersRes = await tmdb.get(requests.tvWatchProviders(result.id)).catch(() => ({ data: { results: {} } }));
        const details = detailsRes.data;
        const providers = providersRes.data.results?.BR?.flatrate?.map((p: any) => p.provider_name).join(', ') || '';

        // Mapear arquivos para temporadas e episódios
        const mappedEpisodes = files.map((f) => {
          const name = f.name;
          // Tentar extrair temporada: S01, Season 1, 1x01, ou apenas o número da pasta pai
          const seMatch = name.match(/(\d+)x(\d+)/);
          const sMatch = seMatch ? { 1: seMatch[1] } : (name.match(/[Ss](\d+)/) || 
                         (f.parentFolderName?.match(/(?:Temporada|Season|T|S)\s*(\d+)/i)) ||
                         (f.parentFolderName?.match(/^(\d+)$/)));
          
          // Tentar extrair episódio: E01, Ep01, 1x01, ou número isolado
          const eMatch = seMatch ? { 1: seMatch[2] } : (name.match(/[Ee](\d+)/) || 
                         name.match(/[Ee]p(?:isódio)?\s*(\d+)/i));
          
          let episodeNum = 1;
          if (eMatch) {
            episodeNum = parseInt(eMatch[1]);
          } else {
            // Se não achou padrão E01, tenta pegar o primeiro número que aparece no nome
            // Mas evita pegar o mesmo número da temporada se ele aparecer no nome
            const seasonNum = sMatch ? parseInt(sMatch[1]) : 1;
            const numbers = name.match(/\d+/g);
            if (numbers) {
              const found = numbers.find(n => parseInt(n) !== seasonNum);
              episodeNum = found ? parseInt(found) : parseInt(numbers[0]);
            }
          }
          
          return {
            id: f.id,
            title: name.replace(/\.[^/.]+$/, ""),
            season: sMatch ? parseInt(sMatch[1]) : 1,
            episode: episodeNum,
            videoUrl: `https://drive.google.com/file/d/${f.id}/view`
          } as Episode;
        });

        // Resolver colisões de S/E (se aparecer S01E01 duas vezes, transforma o segundo em S02E01)
        const resolvedEpisodes: Episode[] = [];
        const seenSE = new Set<string>();

        // Ordenar por nome de arquivo para consistência
        const sortedMapped = [...mappedEpisodes].sort((a, b) => a.title.localeCompare(b.title));

        for (const ep of sortedMapped) {
          let currentS = ep.season;
          let key = `${currentS}-${ep.episode}`;
          
          while (seenSE.has(key)) {
            currentS++;
            key = `${currentS}-${ep.episode}`;
          }
          
          seenSE.add(key);
          resolvedEpisodes.push({
            ...ep,
            season: currentS
          });
        }

        // Buscar detalhes de cada temporada para pegar stills e overviews
        const uniqueSeasons = Array.from(new Set(resolvedEpisodes.map(e => e.season)));
        const seasonDetails: Record<number, any[]> = {};
        
        setScannerState(prev => prev ? { ...prev, status: 'Buscando detalhes dos episódios...' } : null);
        
        for (const s of uniqueSeasons) {
          try {
            const { fetchSeasonDetailsWithFallback } = await import('./services/tmdb');
            const res = await fetchSeasonDetailsWithFallback(result.id, s);
            let episodes = res.data.episodes;
            
            seasonDetails[s] = episodes;
          } catch (e) {
            console.error(`Erro ao buscar temporada ${s}:`, e);
          }
        }

        // Mesclar dados do TMDB com os arquivos do Drive
        const finalEpisodes = resolvedEpisodes.map(ep => {
          const tmdbEp = seasonDetails[ep.season]?.find(te => te.episode_number === ep.episode);
          return {
            ...ep,
            title: tmdbEp?.name || ep.title,
            overview: tmdbEp?.overview || '',
            still_path: tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500/${tmdbEp.still_path}` : null
          };
        }).sort((a, b) => (a.season - b.season) || (a.episode - b.episode));

        seriesData = {
          title: details.name,
          backdrop_path: details.backdrop_path ? `https://image.tmdb.org/t/p/original/${details.backdrop_path}` : 'https://picsum.photos/seed/series/1920/1080',
          poster_path: details.poster_path ? `https://image.tmdb.org/t/p/w500/${details.poster_path}` : 'https://picsum.photos/seed/series/500/750',
          overview: details.overview || 'Série adicionada via pasta do Drive.',
          genres: details.genres?.map((g: any) => g.name).join(', ') || '',
          type: 'series',
          watch_providers: providers,
          episodes: finalEpisodes
        };
      } else {
        const mappedEpisodes = files.map((f) => {
          const name = f.name;
          const seMatch = name.match(/(\d+)x(\d+)/);
          const sMatch = seMatch ? { 1: seMatch[1] } : (name.match(/[Ss](\d+)/) || 
                         (f.parentFolderName?.match(/(?:Temporada|Season|T|S)\s*(\d+)/i)) ||
                         (f.parentFolderName?.match(/^(\d+)$/)));
          
          const eMatch = seMatch ? { 1: seMatch[2] } : (name.match(/[Ee](\d+)/) || 
                         name.match(/[Ee]p(?:isódio)?\s*(\d+)/i));
          
          let episodeNum = 1;
          if (eMatch) {
            episodeNum = parseInt(eMatch[1]);
          } else {
            const seasonNum = sMatch ? parseInt(sMatch[1]) : 1;
            const numbers = name.match(/\d+/g);
            if (numbers) {
              const found = numbers.find(n => parseInt(n) !== seasonNum);
              episodeNum = found ? parseInt(found) : parseInt(numbers[0]);
            }
          }
          
          return {
            id: f.id,
            title: name.replace(/\.[^/.]+$/, ""),
            season: sMatch ? parseInt(sMatch[1]) : 1,
            episode: episodeNum,
            videoUrl: `https://drive.google.com/file/d/${f.id}/view`
          } as Episode;
        });

        // Resolver colisões de S/E no fallback também
        const resolvedEpisodes: Episode[] = [];
        const seenSE = new Set<string>();
        const sortedMapped = [...mappedEpisodes].sort((a, b) => a.title.localeCompare(b.title));

        for (const ep of sortedMapped) {
          let currentS = ep.season;
          let key = `${currentS}-${ep.episode}`;
          while (seenSE.has(key)) {
            currentS++;
            key = `${currentS}-${ep.episode}`;
          }
          seenSE.add(key);
          resolvedEpisodes.push({ ...ep, season: currentS });
        }

        seriesData = {
          title: seriesCleanName,
          backdrop_path: 'https://picsum.photos/seed/series/1920/1080',
          poster_path: 'https://picsum.photos/seed/series/500/750',
          overview: 'Série adicionada via pasta do Drive (Informações não encontradas).',
          genres: 'Outros',
          type: 'series',
          episodes: resolvedEpisodes.sort((a, b) => (a.season - b.season) || (a.episode - b.episode))
        };
      }

      await supabase.from('movies').insert([seriesData]);
      notificationService.notifyNewMovie(seriesData.title || 'Nova Série', seriesData.poster_path);
      setScannerState(prev => prev ? { ...prev, added: 1, current: files.length, isScanning: false, status: 'Concluído' } : null);
      setTimeout(() => setScannerState(null), 5000);
      return;
    }

    for (let i = startIndex; i < files.length; i++) {
      const file = files[i];
      const videoUrl = `https://drive.google.com/file/d/${file.id}/view`;

      // Pular duplicados IMEDIATAMENTE
      if (existingUrls.has(videoUrl)) {
        setScannerState(prev => prev ? { 
          ...prev, 
          current: i + 1,
          skipped: prev.skipped + 1,
          status: `Pulando duplicado: ${file.name}`
        } : null);
        continue;
      }

      // Pequeno delay para permitir que o React atualize a UI
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verificar se foi pausado ou parado
      let isPaused = false;
      setScannerState(prev => {
        if (!prev || prev.isPaused) isPaused = true;
        return prev;
      });
      
      if (isPaused) return;

      setScannerState(prev => prev ? { 
        ...prev, 
        current: i + 1, 
        status: `Processando: ${file.name}`,
        pendingFiles: files 
      } : null);

      try {
        const rawFileName = file.name
          .replace(/^\w+\s\(\d{4}\)\s?/, '')
          .replace(/\(\d{4}\)/g, '')
          .replace(/\[\d{4}\]/g, '')
          .trim();

        const cleanName = await cleanTitle(rawFileName);
        let searchRes = await tmdb.get(requests.searchMulti, { params: { query: cleanName } });
        
        if (searchRes.data.results.length === 0 && cleanName !== rawFileName) {
          searchRes = await tmdb.get(requests.searchMulti, { params: { query: rawFileName } });
        }

        const result = searchRes.data.results[0];

        let movieData: any = null;
        if (result) {
          const detailsPath = result.media_type === 'tv' ? requests.tvDetails(result.id) : requests.movieDetails(result.id);
          const providersPath = result.media_type === 'tv' ? requests.tvWatchProviders(result.id) : requests.movieWatchProviders(result.id);
          const imagesPath = result.media_type === 'tv' ? requests.tvImages(result.id) : requests.movieImages(result.id);
          
          const [detailsRes, providersRes, imagesRes] = await Promise.all([
            tmdb.get(detailsPath),
            tmdb.get(providersPath).catch(() => ({ data: { results: {} } })),
            tmdb.get(imagesPath, { params: { language: 'null', include_image_language: 'pt,en,null' } }).catch(() => ({ data: { logos: [] } }))
          ]);

          const details = detailsRes.data;
          const providers = providersRes.data.results?.BR?.flatrate?.map((p: any) => p.provider_name).join(', ') || '';
          const logos = imagesRes.data.logos || [];
          const logo = logos.find((l: any) => l.iso_639_1 === 'pt') || logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
          const logoPath = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : null;

          let collectionPoster = null;
          if (details.belongs_to_collection?.id) {
            try {
              const collRes = await tmdb.get(requests.fetchCollection(details.belongs_to_collection.id));
              if (collRes.data.poster_path) {
                collectionPoster = `https://image.tmdb.org/t/p/w500${collRes.data.poster_path}`;
              }
            } catch (err) {
              console.error('Erro ao buscar poster da coleção:', err);
            }
          }

          movieData = {
            title: details.title || details.name,
            video_url: videoUrl,
            backdrop_path: details.backdrop_path ? `https://image.tmdb.org/t/p/original/${details.backdrop_path}` : 'https://picsum.photos/seed/movie/1920/1080',
            poster_path: details.poster_path ? `https://image.tmdb.org/t/p/w500/${details.poster_path}` : 'https://picsum.photos/seed/movie/500/750',
            logo_path: logoPath,
            overview: details.overview || 'Adicionado via pasta do Drive.',
            genres: details.genres?.map((g: any) => g.name).join(', ') || '',
            type: result.media_type === 'tv' ? 'series' : 'movie',
            runtime: details.runtime || (details.episode_run_time ? details.episode_run_time[0] : 0),
            rating: details.vote_average,
            release_year: details.release_date ? new Date(details.release_date).getFullYear() : (details.first_air_date ? new Date(details.first_air_date).getFullYear() : 0),
            watch_providers: providers,
            file_name: file.name,
            collection_id: details.belongs_to_collection?.id || null,
            collection_name: details.belongs_to_collection?.name || null,
            collection_poster_path: collectionPoster
          };
        } else {
          movieData = {
            title: cleanName,
            video_url: videoUrl,
            backdrop_path: 'https://picsum.photos/seed/movie/1920/1080',
            poster_path: 'https://picsum.photos/seed/movie/500/750',
            overview: 'Adicionado via pasta do Drive (Informações não encontradas).',
            genres: 'Outros',
            type: 'movie',
            file_name: file.name
          };
        }

        const { error: insertError } = await supabase.from('movies').insert([movieData]);
        if (!insertError) {
          setScannerState(prev => prev ? { ...prev, added: prev.added + 1 } : null);
          notificationService.notifyNewMovie(movieData.title || 'Novo Filme', movieData.poster_path);
        } else if (insertError.code === '23505') {
          setScannerState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
        }
      } catch (err) {
        console.error(`Erro ao processar arquivo ${file.name}:`, err);
      }
    }

    setScannerState(prev => prev ? { ...prev, isScanning: false, status: 'Concluído' } : null);
    setTimeout(() => setScannerState(null), 5000);
  };

  const processReScan = async (moviesToScan: Movie[], startIndex: number = 0) => {
    setReScannerState({
      isScanning: true,
      current: startIndex,
      total: moviesToScan.length,
      status: 'Iniciando Re-scan...',
      updated: 0,
      skipped: 0,
      pendingMovies: moviesToScan
    });

    for (let i = startIndex; i < moviesToScan.length; i++) {
      const movie = moviesToScan[i];

      // Pequeno delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verificar se foi pausado ou parado
      let isPaused = false;
      setReScannerState(prev => {
        if (!prev || prev.isPaused) isPaused = true;
        return prev;
      });
      
      if (isPaused) return;

      setReScannerState(prev => prev ? { 
        ...prev, 
        current: i + 1, 
        status: `Corrigindo: ${movie.title}`,
        pendingMovies: moviesToScan 
      } : null);

      try {
        const rawTitle = (movie.title || "")
          .replace(/^\w+\s\(\d{4}\)\s?/, '')
          .replace(/\(\d{4}\)/g, '')
          .replace(/\[\d{4}\]/g, '')
          .trim();

        const cleanName = await cleanTitle(rawTitle);
        let searchRes = await tmdb.get(requests.searchMulti, { params: { query: cleanName } });
        
        if (searchRes.data.results.length === 0 && cleanName !== rawTitle) {
          searchRes = await tmdb.get(requests.searchMulti, { params: { query: rawTitle } });
        }

        const result = searchRes.data.results[0];

        if (result) {
          const detailsPath = result.media_type === 'tv' ? requests.tvDetails(result.id) : requests.movieDetails(result.id);
          const providersPath = result.media_type === 'tv' ? requests.tvWatchProviders(result.id) : requests.movieWatchProviders(result.id);
          const imagesPath = result.media_type === 'tv' ? requests.tvImages(result.id) : requests.movieImages(result.id);
          const creditsPath = result.media_type === 'tv' ? requests.tvCredits(result.id) : requests.movieCredits(result.id);
          
          const [detailsRes, providersRes, imagesRes, creditsRes] = await Promise.all([
            tmdb.get(detailsPath),
            tmdb.get(providersPath).catch(() => ({ data: { results: {} } })),
            tmdb.get(imagesPath, { params: { language: 'null', include_image_language: 'pt,en,null' } }).catch(() => ({ data: { logos: [] } })),
            tmdb.get(creditsPath).catch(() => ({ data: { cast: [] } }))
          ]);

          const details = detailsRes.data;
          const providers = providersRes.data.results?.BR?.flatrate?.map((p: any) => p.provider_name).join(', ') || '';
          const logos = imagesRes.data.logos || [];
          const logo = logos.find((l: any) => l.iso_639_1 === 'pt') || logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
          const logoPath = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : movie.logo_path;
          const actors = creditsRes.data.cast?.slice(0, 10).map((c: any) => c.name).join(', ');

          let collectionPoster = movie.collection_poster_path;
          if (details.belongs_to_collection?.id) {
            try {
              const collRes = await tmdb.get(requests.fetchCollection(details.belongs_to_collection.id));
              if (collRes.data.poster_path) {
                collectionPoster = `https://image.tmdb.org/t/p/w500${collRes.data.poster_path}`;
              }
            } catch (err) {
              console.error('Erro ao buscar poster da coleção no re-scan:', err);
            }
          }

          // Se for série, atualizar também os metadados dos episódios
          let updatedEpisodes = movie.episodes;
          if (result.media_type === 'tv' && movie.episodes) {
            const uniqueSeasons = Array.from(new Set(movie.episodes.map(e => e.season)));
            const seasonDetails: Record<number, any[]> = {};
            
            for (const s of uniqueSeasons) {
              try {
                const { fetchSeasonDetailsWithFallback } = await import('./services/tmdb');
                const res = await fetchSeasonDetailsWithFallback(result.id, s);
                let episodes = res.data.episodes;

                seasonDetails[s] = episodes;
              } catch (e) {
                console.error(`Erro ao buscar temporada ${s} no re-scan:`, e);
              }
            }

            updatedEpisodes = movie.episodes.map(ep => {
              const tmdbEp = seasonDetails[ep.season]?.find(te => te.episode_number === ep.episode);
              const stillPath = tmdbEp?.still_path
                ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path.startsWith('/') ? '' : '/'}${tmdbEp.still_path}`
                : ep.still_path;
              const merged: any = { ...ep };
              if (tmdbEp?.name) merged.title = tmdbEp.name;
              if (tmdbEp?.overview) merged.overview = tmdbEp.overview;
              if (stillPath !== undefined) merged.still_path = stillPath;
              return merged;
            });
          }

          const _bd = details.backdrop_path as string | undefined;
          const _ps = details.poster_path as string | undefined;
          await supabase.from('movies').update({
            title: details.title || details.name,
            backdrop_path: _bd ? `https://image.tmdb.org/t/p/original${_bd.startsWith('/') ? '' : '/'}${_bd}` : movie.backdrop_path,
            poster_path: _ps ? `https://image.tmdb.org/t/p/w500${_ps.startsWith('/') ? '' : '/'}${_ps}` : movie.poster_path,
            logo_path: logoPath,
            overview: details.overview || movie.overview,
            genres: details.genres?.map((g: any) => g.name).join(', ') || movie.genres,
            type: result.media_type === 'tv' ? 'series' : 'movie',
            runtime: details.runtime || (details.episode_run_time ? details.episode_run_time[0] : 0),
            actors: actors,
            rating: details.vote_average,
            release_date: details.release_date || details.first_air_date,
            release_year: details.release_date ? new Date(details.release_date).getFullYear() : (details.first_air_date ? new Date(details.first_air_date).getFullYear() : 0),
            watch_providers: providers,
            episodes: updatedEpisodes,
            file_name: movie.file_name || movie.title, 
            last_rescanned_at: new Date().toISOString(),
            collection_id: details.belongs_to_collection?.id || null,
            collection_name: details.belongs_to_collection?.name || null,
            collection_poster_path: collectionPoster,
            collection_logo_path: movie.collection_logo_path // Pre-initialize or keep existing if not fetched
          }).eq('id', movie.id);

          // If we have a collection but don't have its logo yet, we should try to fetch it
          if (details.belongs_to_collection?.id) {
            try {
              const imagesRes = await tmdb.get(`/collection/${details.belongs_to_collection.id}/images`, { params: { include_image_language: 'pt,en,null' } });
              const logos = imagesRes.data.logos || [];
              const bestLogo = logos.find((l: any) => l.iso_639_1 === 'pt') || 
                               logos.find((l: any) => l.iso_639_1 === 'en') || 
                               logos[0];
              
              if (bestLogo) {
                const collectionLogo = `https://image.tmdb.org/t/p/original${bestLogo.file_path}`;
                await supabase.from('movies').update({ collection_logo_path: collectionLogo }).eq('id', movie.id);
              }
            } catch (err) {
              console.error('Erro ao buscar logo da coleção no re-scan:', err);
            }
          }
          
          setReScannerState(prev => prev ? { ...prev, updated: prev.updated + 1 } : null);
        } else {
          setReScannerState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
        }
      } catch (err) {
        console.error(`Erro no re-scan de ${movie.title}:`, err);
      }
    }

    setReScannerState(prev => prev ? { ...prev, isScanning: false, status: 'Re-scan Concluído' } : null);
    setTimeout(() => setReScannerState(null), 5000);
  };

  const processCollectionAutomation = async (moviesToScan: Movie[], startIndex: number = 0) => {
    setCollectionAutomationState({
      isScanning: true,
      current: startIndex,
      total: moviesToScan.length,
      status: 'Iniciando Automação...',
      updated: 0,
      skipped: 0,
      pendingMovies: moviesToScan
    });

    for (let i = startIndex; i < moviesToScan.length; i++) {
      const movie = moviesToScan[i];

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if paused
      let isPaused = false;
      setCollectionAutomationState(prev => {
        if (!prev || prev.isPaused) isPaused = true;
        return prev;
      });
      if (isPaused) return;

      setCollectionAutomationState(prev => prev ? { 
        ...prev, 
        current: i + 1, 
        status: `Analisando: ${movie.title}`,
        pendingMovies: moviesToScan 
      } : null);

      try {
        // 1. Search for specific details
        const searchRes = await tmdb.get(requests.searchMulti, { params: { query: movie.title || movie.name } });
        const firstResult = searchRes.data.results?.[0];
        
        if (firstResult) {
          const isTv = firstResult.media_type === 'tv' || !firstResult.title;
          const detailsPath = isTv ? requests.tvDetails(firstResult.id) : requests.movieDetails(firstResult.id);
          const detailsRes = await tmdb.get(detailsPath);
          const details = detailsRes.data;

          if (details.belongs_to_collection) {
            const collInfo = details.belongs_to_collection;
            
            // 2. Fetch the collection details and images
            let collectionPoster = null;
            let collectionLogo = null;
            try {
              const collRes = await tmdb.get(requests.fetchCollection(collInfo.id));
              const collData = collRes.data;
              
              if (collData.poster_path) {
                collectionPoster = `https://image.tmdb.org/t/p/original${collData.poster_path}`;
              }

              // Fetch logos for collection
              const imagesRes = await tmdb.get(`/collection/${collInfo.id}/images`, { params: { include_image_language: 'pt,en,null' } });
              const logos = imagesRes.data.logos || [];
              const bestLogo = logos.find((l: any) => l.iso_639_1 === 'pt') || 
                               logos.find((l: any) => l.iso_639_1 === 'en') || 
                               logos[0];
              
              if (bestLogo) {
                collectionLogo = `https://image.tmdb.org/t/p/original${bestLogo.file_path}`;
              }
            } catch (collErr) {
              console.error(`Erro ao buscar assets para coleção ${collInfo.name}:`, collErr);
            }

            // 3. Update movie with collection data
            await handleUpdateMovie({
              ...movie,
              collection_id: collInfo.id,
              collection_name: collInfo.name,
              collection_poster_path: collectionPoster,
              collection_logo_path: collectionLogo
            } as Movie);
            
            setCollectionAutomationState(prev => prev ? { ...prev, updated: prev.updated + 1 } : null);
          } else {
            setCollectionAutomationState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
          }
        } else {
          setCollectionAutomationState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
        }
      } catch (err) {
        console.error(`Erro ao automatizar coleção para ${movie.title}:`, err);
      }
    }

    setCollectionAutomationState(prev => prev ? { ...prev, isScanning: false, status: 'Automação Concluída' } : null);
    setTimeout(() => setCollectionAutomationState(null), 5000);
  };

  const startCollectionAutomation = (moviesToScan: Movie[]) => {
    processCollectionAutomation(moviesToScan);
  };

  const startReScanner = (moviesToScan: Movie[]) => {
    setReScannerState({
      isScanning: true,
      current: 0,
      total: moviesToScan.length,
      status: 'Iniciando Re-scan...',
      updated: 0,
      skipped: 0,
      pendingMovies: moviesToScan
    });
    processReScan(moviesToScan);
  };

  const listAllFilesRecursive = async (folderId: string, driveApiKey: string, parentName?: string): Promise<any[]> => {
    let allFiles: any[] = [];
    
    try {
      // 1. Listar vídeos nesta pasta com paginação completa
      let fileToken = '';
      do {
        const query = `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${driveApiKey}&fields=nextPageToken,files(id,name,mimeType)&pageSize=100${fileToken ? `&pageToken=${fileToken}` : ''}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.files) {
          const videoFiles = data.files.filter((f: any) => 
            f.mimeType.includes('video/') || 
            /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(f.name)
          );
          allFiles = [...allFiles, ...videoFiles.map((f: any) => ({ ...f, parentFolderName: parentName }))];
        }
        fileToken = data.nextPageToken;
      } while (fileToken);

      // 2. Listar subpastas com paginação completa
      let folderToken = '';
      do {
        const query = `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${driveApiKey}&fields=nextPageToken,files(id,name)&pageSize=100${folderToken ? `&pageToken=${folderToken}` : ''}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.files) {
          for (const subfolder of data.files) {
            const subfolderFiles = await listAllFilesRecursive(subfolder.id, driveApiKey, subfolder.name);
            allFiles = [...allFiles, ...subfolderFiles];
          }
        }
        folderToken = data.nextPageToken;
      } while (folderToken);
    } catch (error) {
      console.error('Erro na recursão do Drive:', error);
    }

    return allFiles;
  };

  const startScanner = async (folderId: string, folderUrl: string, options?: { type?: 'movie' | 'series' }) => {
    const driveApiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
    if (!driveApiKey) return;

    setScannerState({
      isScanning: true,
      current: 0,
      total: 0,
      status: 'Buscando informações da pasta...',
      added: 0,
      skipped: 0,
      folderUrl
    });

    try {
      // Buscar nome da pasta raiz
      const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?key=${driveApiKey}&fields=name`);
      const folderData = await folderRes.json();
      const folderName = folderData.name || '';

      setScannerState(prev => prev ? { ...prev, status: 'Listando arquivos (incluindo subpastas)...' } : null);
      const allFiles = await listAllFilesRecursive(folderId, driveApiKey);
      
      // Atualizar o total real após a recursão completa
      setScannerState(prev => prev ? { ...prev, total: allFiles.length } : null);

      if (allFiles.length === 0) {
        setScannerState(null);
        alert('Nenhum vídeo encontrado na pasta ou subpastas.');
        return;
      }

      processFiles(allFiles, 0, { ...options, folderName });
    } catch (error) {
      console.error('Erro ao iniciar scanner:', error);
      setScannerState(null);
    }
  };

  // Retomar scanner ao carregar se necessário
  useEffect(() => {
    const savedScanner = localStorage.getItem('scanner_state');
    if (savedScanner) {
      const state = JSON.parse(savedScanner) as ScannerState;
      if (state.isScanning && !state.isPaused && state.pendingFiles) {
        processFiles(state.pendingFiles, state.current);
      }
    }

    const savedReScanner = localStorage.getItem('rescanner_state');
    if (savedReScanner) {
      const state = JSON.parse(savedReScanner) as ReScannerState;
      if (state.isScanning && !state.isPaused && state.pendingMovies) {
        processReScan(state.pendingMovies, state.current);
      }
    }

    const savedCollectionScanner = localStorage.getItem('collection_automation_state');
    if (savedCollectionScanner) {
      const state = JSON.parse(savedCollectionScanner) as CollectionScannerState;
      if (state.isScanning && !state.isPaused && state.pendingMovies) {
        processCollectionAutomation(state.pendingMovies, state.current);
      }
    }
  }, []);

  const handleUpdateCollectionLogos = async (specificCollectionId?: number) => {
    // Agrupar primeiro por ID de coleção para evitar requests repetidos para o mesmo multiverso
    const collectionsMap: Record<number, Movie[]> = {};
    myMovies.forEach(m => {
      if (m.collection_id) {
        if (!collectionsMap[m.collection_id]) collectionsMap[m.collection_id] = [];
        collectionsMap[m.collection_id].push(m);
      }
    });

    const collectionIds = specificCollectionId ? [specificCollectionId] : Object.keys(collectionsMap).map(Number);
    
    if (collectionIds.length === 0) {
      alert('Nenhuma coleção encontrada para atualizar.');
      return;
    }

    const msg = specificCollectionId 
      ? `Atualizar identidade visual da coleção "${collectionsMap[specificCollectionId]?.[0]?.collection_name || 'selecionada'}"?`
      : `Deseja fazer um Check-up Geral em ${collectionIds.length} Coleções? (Isso irá sobrescrever posters e logos pelos oficiais TMDB)`;

    if (!window.confirm(msg)) return;

    setCollectionAutomationState({
      isScanning: true,
      current: 0,
      total: collectionIds.length,
      status: 'Sincronizando Identidade de Coleções...',
      updated: 0,
      skipped: 0,
      pendingMovies: []
    });

    for (let i = 0; i < collectionIds.length; i++) {
      const collId = collectionIds[i];
      const moviesInColl = collectionsMap[collId] || [];
      const firstMovie = moviesInColl[0];
      
      setCollectionAutomationState(prev => prev ? { 
        ...prev, 
        current: i + 1, 
        status: `Processando Nexus: ${firstMovie?.collection_name || 'Coleção'}`
      } : null);

      try {
        const collRes = await tmdb.get(requests.fetchCollection(collId));
        const collection = collRes.data;

        // Procurar Logo Oficial da Coleção
        let logoPath = firstMovie.collection_logo_path;
        
        try {
          // 1. Tentar buscar logos da própria coleção (embora a API de coleção seja limitada, algumas retornam)
          const collImagesRes = await tmdb.get(`/collection/${collId}/images`, { params: { include_image_language: 'pt,en,null' } }).catch(() => null);
          const collLogos = collImagesRes?.data?.logos || [];
          
          let bestLogo = collLogos.find((l: any) => l.iso_639_1 === 'pt') || 
                         collLogos.find((l: any) => l.iso_639_1 === 'en') || 
                         collLogos[0];

          // 2. Se não achou na coleção, buscar nos filmes da coleção (geralmente trazem a logo da saga)
          if (!bestLogo) {
             const imagesPath = firstMovie.type === 'series' ? requests.tvImages(firstMovie.id) : requests.movieImages(firstMovie.id);
             const imagesRes = await tmdb.get(imagesPath, { params: { include_image_language: 'pt,en,null' } });
             const logos = imagesRes.data.logos || [];
             bestLogo = logos.find((l: any) => l.iso_639_1 === 'pt') || 
                        logos.find((l: any) => l.iso_639_1 === 'en') || 
                        logos[0];
          }
          
          if (bestLogo) {
            logoPath = `https://image.tmdb.org/t/p/original${bestLogo.file_path}`;
          } else if (firstMovie.logo_path) {
            logoPath = firstMovie.logo_path;
          }
        } catch (e) {
          console.error("Erro ao buscar logo para a coleção:", e);
        }

        const posterPath = collection.poster_path ? `https://image.tmdb.org/t/p/original${collection.poster_path}` : firstMovie.collection_poster_path;
        
        // Super fallback logic for backdrops: 
        // 1. Collection official backdrop
        // 2. Collection official poster (better than nothing/empty)
        // 3. First movie official backdrop
        // 4. First movie official poster
        const backdropPath = collection.backdrop_path 
          ? `https://image.tmdb.org/t/p/original${collection.backdrop_path}` 
          : (collection.poster_path 
              ? `https://image.tmdb.org/t/p/original${collection.poster_path}` 
              : (firstMovie.collection_backdrop_path || firstMovie.backdrop_path || firstMovie.poster_path)
            );

        // Atualizar todos os filmes desta coleção
        for (const movie of moviesInColl) {
          await handleUpdateMovie({
            ...movie,
            collection_name: collection.name || movie.collection_name,
            collection_logo_path: logoPath,
            collection_poster_path: posterPath,
            collection_backdrop_path: backdropPath
          } as Movie, true);
        }

        setCollectionAutomationState(prev => prev ? { ...prev, updated: prev.updated + 1 } : null);
      } catch (err) {
        console.error(`Erro ao atualizar coleção ID ${collId}:`, err);
        setCollectionAutomationState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setCollectionAutomationState(prev => prev ? { ...prev, isScanning: false, status: 'Identidades Sincronizadas!' } : null);
    setTimeout(() => setCollectionAutomationState(null), 3000);
  };

  const handleLogoScan = async (scope: LogoScanScope, mode: LogoScanMode) => {
    // Cancela qualquer scan em andamento
    if (logoScannerCancelRef.current) return;
    logoScannerCancelRef.current = false;

    const items: Array<{ id: number; label: string; mediaType: 'movie' | 'tv' } | { id: string; label: string; mediaType: 'collection'; collectionId: number; movieIds: number[] }> = [];

    const hasMissingLogo = (m: Movie) => !m.logo_path || m.logo_path === '' || m.logo_path.includes('placeholder');

    // Filmes
    if (scope === 'movies' || scope === 'all') {
      const pool = myMovies.filter(m => m.type !== 'series');
      const toAdd = mode === 'missing' ? pool.filter(hasMissingLogo) : pool;
      for (const m of toAdd) items.push({ id: m.id, label: m.title || m.name || `#${m.id}`, mediaType: m.name ? 'tv' : 'movie' });
    }

    // Séries
    if (scope === 'series' || scope === 'all') {
      const pool = myMovies.filter(m => m.type === 'series');
      const toAdd = mode === 'missing' ? pool.filter(hasMissingLogo) : pool;
      for (const m of toAdd) items.push({ id: m.id, label: m.title || m.name || `#${m.id}`, mediaType: m.name ? 'tv' : 'movie' });
    }

    // Coleções
    if (scope === 'collections' || scope === 'all') {
      const collMap: Map<number, { name: string; movieIds: number[]; hasLogo: boolean }> = new Map();
      for (const m of myMovies) {
        if (!m.collection_id) continue;
        if (!collMap.has(m.collection_id)) {
          collMap.set(m.collection_id, { name: m.collection_name || `Coleção ${m.collection_id}`, movieIds: [], hasLogo: false });
        }
        const entry = collMap.get(m.collection_id)!;
        entry.movieIds.push(m.id);
        if (m.collection_logo_path) entry.hasLogo = true;
      }
      for (const [collId, info] of collMap.entries()) {
        if (mode === 'missing' && info.hasLogo) continue;
        items.push({ id: `coll-${collId}`, label: info.name, mediaType: 'collection', collectionId: collId, movieIds: info.movieIds });
      }
    }

    if (items.length === 0) {
      setLogoScannerState({ isScanning: false, scope, mode, current: 0, total: 0, status: 'Nenhum item para processar!', updated: 0, skipped: 0, done: true });
      setTimeout(() => setLogoScannerState(null), 4000);
      return;
    }

    setLogoScannerState({ isScanning: true, scope, mode, current: 0, total: items.length, status: 'Iniciando scanner de logos...', updated: 0, skipped: 0, done: false });

    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < items.length; i++) {
      if (logoScannerCancelRef.current) break;
      const item = items[i];

      setLogoScannerState(prev => prev ? { ...prev, current: i + 1, status: `Buscando: ${item.label}`, updated, skipped } : null);

      try {
        if (item.mediaType === 'collection') {
          const res = await tmdb.get(`/collection/${(item as any).collectionId}/images`, { params: { include_image_language: 'pt,en,null' } });
          const logos: any[] = res.data.logos || [];
          const best = logos.find((l: any) => l.iso_639_1 === 'pt') || logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
          if (best) {
            const logoUrl = `https://image.tmdb.org/t/p/w500${best.file_path}`;
            await supabase.from('movies').update({ collection_logo_path: logoUrl }).eq('collection_id', (item as any).collectionId);
            setMyMovies(prev => prev.map(m => m.collection_id === (item as any).collectionId ? { ...m, collection_logo_path: logoUrl } : m));
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Busca direta no TMDB (sem cache) tentando ambos os endpoints em paralelo
          const tmdbId = item.id as number;
          const [movieRes, tvRes] = await Promise.allSettled([
            tmdb.get(`/movie/${tmdbId}/images`, { params: { include_image_language: 'en,pt,null' } }),
            tmdb.get(`/tv/${tmdbId}/images`, { params: { include_image_language: 'en,pt,null' } }),
          ]);
          const allLogos: any[] = [
            ...(movieRes.status === 'fulfilled' ? movieRes.value.data.logos || [] : []),
            ...(tvRes.status === 'fulfilled' ? tvRes.value.data.logos || [] : []),
          ];
          const best = allLogos.find((l: any) => l.iso_639_1 === 'en') ||
                       allLogos.find((l: any) => l.iso_639_1 === 'pt') ||
                       allLogos[0];
          const logo = best ? `https://image.tmdb.org/t/p/w500${best.file_path}` : null;
          if (logo) {
            await supabase.from('movies').update({ logo_path: logo }).eq('id', tmdbId);
            setMyMovies(prev => prev.map(m => m.id === tmdbId ? { ...m, logo_path: logo } : m));
            updated++;
          } else {
            skipped++;
          }
        }
      } catch (err) {
        console.error(`[LogoScan] Erro em ${item.label}:`, err);
        skipped++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const cancelled = logoScannerCancelRef.current;
    logoScannerCancelRef.current = false;
    setLogoScannerState(prev => prev ? {
      ...prev,
      isScanning: false,
      status: cancelled ? 'Scanner cancelado.' : `Concluído! ${updated} logo(s) atualizado(s), ${skipped} sem logo.`,
      updated,
      skipped,
      done: true,
    } : null);
    setTimeout(() => setLogoScannerState(null), 6000);
  };

  const handleCancelLogoScan = () => {
    logoScannerCancelRef.current = true;
  };

  const handleSyncMissingMovieLogos = async () => {
    const hasLogos = myMovies.filter(m => m.logo_path && !m.logo_path.includes('placeholder'));
    const missingLogos = myMovies.filter(m => !m.logo_path || m.logo_path === '' || m.logo_path.includes('placeholder'));
    
    let moviesToProcess = missingLogos;
    let mode: 'missing' | 'all' = 'missing';

    if (hasLogos.length > 0) {
      const confirmAll = window.confirm(`Você tem ${hasLogos.length} logos já configuradas e ${missingLogos.length} faltando. \n\nDeseja fazer um "Check-up Geral" (sobrescrever logos antigas pelas oficiais TMDB) ou apenas buscar as que faltam?\n\n[OK] = Check-up Geral (Sobrescrever)\n[Cancelar] = Apenas as que faltam`);
      if (confirmAll) {
        moviesToProcess = myMovies;
        mode = 'all';
      }
    }

    if (moviesToProcess.length === 0) {
      alert('Todos os filmes e séries já possuem logo!');
      return;
    }

    setReScannerState({
      isScanning: true,
      current: 0,
      total: moviesToProcess.length,
      status: mode === 'all' ? 'Iniciando Check-up Geral de Logos...' : 'Buscando logos na nuvem...',
      updated: 0,
      skipped: 0,
    });

    for (let i = 0; i < moviesToProcess.length; i++) {
      const movie = moviesToProcess[i];
      
      setReScannerState(prev => prev ? { 
        ...prev, 
        current: i + 1, 
        status: `Analisando: ${movie.title || movie.name}`
      } : null);

      try {
        const logo = await getMovieLogo(movie.id, (movie as any).name ? 'tv' : 'movie');
        
        if (logo) {
          await handleUpdateMovie({
            ...movie,
            logo_path: logo
          } as Movie, true);
          setReScannerState(prev => prev ? { ...prev, updated: prev.updated + 1 } : null);
        } else {
          setReScannerState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
        }
      } catch (err) {
        console.error(`Erro ao sincronizar logo de ${movie.title}:`, err);
        setReScannerState(prev => prev ? { ...prev, skipped: prev.skipped + 1 } : null);
      }

      // Pequeno delay para evitar rate limit do TMDB
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setReScannerState(prev => prev ? { ...prev, isScanning: false, status: 'Check-up de Logos Concluído!' } : null);
    setTimeout(() => setReScannerState(null), 3000);
  };

  const handleUpdateMovie = async (movie: Movie, silent: boolean = false) => {
    try {
      // Salvar configurações de cascata no localStorage (sem necessidade de colunas no banco)
      if (movie.id && (movie.qualityCascadeDelay !== undefined || movie.cascadeToV3OnPenultimate !== undefined)) {
        try {
          const existing = JSON.parse(localStorage.getItem(`netplay_cascade_${movie.id}`) || '{}');
          localStorage.setItem(`netplay_cascade_${movie.id}`, JSON.stringify({
            ...existing,
            qualityCascadeDelay: movie.qualityCascadeDelay ?? existing.qualityCascadeDelay ?? 10,
            cascadeToV3OnPenultimate: movie.cascadeToV3OnPenultimate !== undefined ? movie.cascadeToV3OnPenultimate : (existing.cascadeToV3OnPenultimate !== undefined ? existing.cascadeToV3OnPenultimate : true),
          }));
        } catch {}
      }

      const updateData = {
        title: movie.title || movie.name,
        video_url: movie.videoUrl || (movie as any).video_url,
        video_url_2: movie.videoUrl2 || (movie as any).video_url_2,
        release_date: movie.release_date,
        release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : movie.release_year,
        runtime: movie.runtime,
        rating: movie.rating || movie.vote_average,
        actors: movie.actors,
        is_hidden: movie.is_hidden,
        watch_providers: movie.watch_providers,
        overview: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        logo_path: movie.logo_path,
        genres: movie.genres,
        type: movie.type,
        episodes: movie.episodes,
        file_name: movie.file_name,
        collection_id: movie.collection_id,
        collection_name: movie.collection_name,
        collection_poster_path: movie.collection_poster_path,
        collection_logo_path: movie.collection_logo_path,
        preferred_quality: (movie as any).preferredQuality || (movie as any).preferred_quality || null,
        updated_at: new Date().toISOString()
      };

      if (movie.type === 'series' && Array.isArray(movie.episodes)) {
        console.log('[handleUpdateMovie] Salvando série, primeira ep:', JSON.stringify(movie.episodes[0], null, 2));
        const semVideoUrl = movie.episodes.filter((e: any) => !e.videoUrl && !e.video_url);
        if (semVideoUrl.length) console.warn('[handleUpdateMovie] ATENÇÃO! Episódios sem videoUrl:', semVideoUrl.length, semVideoUrl);
      }
      const { error } = await supabase.from('movies').update(updateData).eq('id', movie.id);
      
      if (error) {
        console.error('Erro detalhado do Supabase na atualização:', error);
        if (!silent) alert(`Erro ao salvar alterações: ${error.message}`);
        throw error;
      }

      fetchMyMovies();
    } catch (err) {
      console.error('Erro ao atualizar filme:', err);
      if (!silent) alert('Ocorreu um erro ao atualizar o conteúdo.');
      throw err;
    }
  };

  const handleRequestMovie = async (movie: Partial<Movie>) => {
    try {
      const titleLower = (movie.title || movie.name || '').toLowerCase();
      
      const alreadyInLibrary = myMovies.some(m => 
        m.videoUrl !== 'REQUESTED' && 
        (m.title?.toLowerCase() === titleLower || (m as any).name?.toLowerCase() === titleLower)
      );

      if (alreadyInLibrary) {
        alert('Este título já está disponível na plataforma! Procure na busca ou navegue pelas categorias.');
        return;
      }

      const isAlreadyRequested = myMovies.some(m => 
        m.videoUrl === 'REQUESTED' && 
        (m.title?.toLowerCase() === titleLower || (m as any).name?.toLowerCase() === titleLower)
      );

      if (isAlreadyRequested) {
        alert('Paciência, Jovem Padawan! Este título já foi solicitado e nossa equipe está trabalhando para trazê-lo.');
        return;
      }

      await handleCreateMovie({
        ...movie,
        videoUrl: 'REQUESTED',
        is_hidden: false
      });
      alert('Entendido! Sua indicação foi enviada aos comandantes. Fique de olho nas novidades!');
    } catch (err) {
      console.error('Erro ao indicar:', err);
    }
  };

  const handleCreateMovie = async (movie: Partial<Movie>) => {
    try {
      const movieData = {
        created_at: new Date().toISOString(),
        title: movie.title || movie.name,
        video_url: movie.videoUrl || (movie as any).video_url,
        video_url_2: movie.videoUrl2 || (movie as any).video_url_2,
        release_date: movie.release_date,
        release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : movie.release_year,
        runtime: movie.runtime,
        rating: movie.rating || movie.vote_average,
        actors: movie.actors,
        is_hidden: movie.is_hidden,
        watch_providers: movie.watch_providers,
        overview: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        logo_path: movie.logo_path,
        genres: movie.genres,
        type: movie.type,
        episodes: movie.episodes,
        file_name: movie.file_name,
        collection_id: movie.collection_id,
        collection_name: movie.collection_name,
        collection_poster_path: movie.collection_poster_path,
        collection_logo_path: movie.collection_logo_path,
        preferred_quality: (movie as any).preferredQuality || (movie as any).preferred_quality || null
      };

      const { error } = await supabase.from('movies').insert([movieData]);
      
      if (error) {
        console.error('Erro detalhado do Supabase na criação:', error);
        alert(`Erro ao cadastrar novo conteúdo: ${error.message}`);
        throw error;
      }

      fetchMyMovies();
    } catch (err) {
      console.error('Erro ao criar filme:', err);
      throw err;
    }
  };

  const handleDeleteMovies = async (ids: number[]) => {
    const { error } = await supabase.from('movies').delete().in('id', ids);
    if (!error) {
      fetchMyMovies();
    }
  };

  const handleToggleHideMovies = async (ids: number[], hide: boolean) => {
    const { error } = await supabase.from('movies').update({ is_hidden: hide }).in('id', ids);
    if (!error) {
      fetchMyMovies();
    }
  };

  // Verificação de chaves de API

  useEffect(() => {
    if (!hasSupabase) {
      setLoading(false);
      return;
    }

    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      // Tentar recuperar perfil salvo no localStorage
      const savedProfile = localStorage.getItem('active_profile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
      
      setLoading(false);

      // Verificar se há uma sala no URL
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get('room');
      const movieId = params.get('movie');

      if (roomId && movieId) {
        // O filme será carregado quando o usuário selecionar o perfil
      }
    }).catch(err => {
      console.error('Erro ao verificar sessão Supabase:', err);
      setLoading(false);
    });

    // Ouvir mudanças na autenticação (login/logout após a verificação inicial)
    // NÃO controla o loading — apenas o getSession() acima faz isso,
    // para evitar que o onAuthStateChange dispare com null antes da sessão ser lida
    // e mostre a tela de boas-vindas incorretamente ao usuário já logado.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        localStorage.removeItem('active_profile');
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [hasSupabase]);

  useEffect(() => {
    const checkAdmin = async () => {
       if (user) {
          // Hardlock para o email principal caso a tabela ainda não exista
          if (user.email === 'costachristopher31@gmail.com') {
             setIsAdmin(true);
             return;
          }
          
          // Verificação na tabela SQL
          try {
            console.log('Verificando status de admin para:', user.email);
            const { data, error } = await supabase.from('admin_users').select('email').eq('email', user.email).single();
            if (data) {
               console.log('Status de Admin CONFIRMADO');
               setIsAdmin(true);
            } else {
               console.log('Usuário não é admin na base SQL');
               setIsAdmin(false);
            }
          } catch (e) {
            console.error('Erro na verificação de admin:', e);
            setIsAdmin(false);
          }
       } else {
          setIsAdmin(false);
       }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (profile && activeRoomId && myMovies.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const movieId = params.get('movie');
      
      if (movieId) {
        // Buscar o filme para entrar na sala
        const movie = myMovies.find(m => m.id.toString() === movieId);
        if (movie) {
          setSelectedMovie(movie);
          setViewingMovie(null);
        }
      }
    }
  }, [profile, activeRoomId, myMovies]);

  const fetchMyMovies = async () => {
    // Mostra cache imediatamente enquanto busca dados frescos (v6)
    const cached = localStorage.getItem('cached_my_movies_v6');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setMyMovies(parsed);
          setIsLoadingMovies(false);
        }
      } catch {
        localStorage.removeItem('cached_my_movies_v6');
      }
    }

    // Não bloqueia por hasSupabase — igual ao fetchMyList que funciona sem essa verificação
    if (!user) {
      setIsLoadingMovies(false);
      return;
    }

    // Campos mínimos para exibição nos carrosséis — reduz drasticamente o tamanho do cache
    const SLIM_FIELDS = ['id','title','type','poster_path','backdrop_path','logo_path','genres','genre','video_url','video_url_2','rating','vote_average','release_date','first_air_date','release_year','runtime','is_hidden','created_at','updated_at'] as const;
    const toSlim = (m: any) => Object.fromEntries(SLIM_FIELDS.filter(k => k in m).map(k => [k, (m as any)[k]]));

    const saveCache = (movies: Movie[]) => {
      try {
        if (movies.length === 0) return;
        // Limpa versões antigas para liberar espaço
        ['cached_my_movies_v5','cached_my_movies_v4','cached_my_movies_v3','cached_my_movies_v2'].forEach(k => { try { localStorage.removeItem(k); } catch {} });
        // Versão slim: só campos de display
        const slim = movies.map(toSlim);
        const str = JSON.stringify(slim);
        if (str.length < 4 * 1024 * 1024) {
          localStorage.setItem('cached_my_movies_v6', str);
          return;
        }
        // Fallback: salva mistura balanceada — 1500 filmes + 1500 séries
        const slimMovies = slim.filter((m: any) => m.type === 'movie').slice(0, 1500);
        const slimSeries = slim.filter((m: any) => m.type === 'series').slice(0, 1500);
        const partial = JSON.stringify([...slimMovies, ...slimSeries]);
        localStorage.setItem('cached_my_movies_v6', partial);
      } catch {
        // Quota excedida — salva versão mínima balanceada
        try {
          ['cached_my_movies_v6','cached_my_movies_v5','cached_my_movies_v4'].forEach(k => { try { localStorage.removeItem(k); } catch {} });
          const slim = movies.map(toSlim);
          const slimMovies = slim.filter((m: any) => m.type === 'movie').slice(0, 300);
          const slimSeries = slim.filter((m: any) => m.type === 'series').slice(0, 300);
          localStorage.setItem('cached_my_movies_v6', JSON.stringify([...slimMovies, ...slimSeries]));
        } catch {}
      }
    };

    // Nível 1: colunas otimizadas (rápido, payload leve)
    const COLS_LEVEL1 = MOVIE_COLS_BROWSE;
    // Nível 2: colunas básicas garantidas (sem colunas que podem não existir)
    const COLS_LEVEL2 = 'id,title,type,poster_path,backdrop_path,release_date,rating,vote_average,genres,video_url,video_url_2,logo_path,is_hidden,created_at,updated_at';
    // Nível 3: seleciona tudo (exatamente como fetchMyList faz com movies(*)) e filtra no cliente
    const COLS_LEVEL3 = '*';

    // Busca paginada com streaming: emite a 1ª página imediatamente e carrega o resto em background
    const PAGE_SIZE = 500;

    const fetchFirstPage = async (cols: string, type: string) => {
      const { data, error } = await supabase
        .from('movies')
        .select(cols)
        .eq('type', type)
        .order('updated_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      return { data: data || [], error, hasMore: (data || []).length >= PAGE_SIZE };
    };

    const fetchRemainingPages = async (cols: string, type: string, onPage: (data: any[]) => void) => {
      let from = PAGE_SIZE;
      while (true) {
        const { data, error } = await supabase
          .from('movies')
          .select(cols)
          .eq('type', type)
          .order('updated_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        onPage(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    };

    const fetchPaginated = async (cols: string, type: string) => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('movies')
          .select(cols)
          .eq('type', type)
          .order('updated_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) return { data: null, error };
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return { data: all, error: null };
    };

    const stripHeavyFields = (rows: any[]): any[] =>
      rows.map(({ episodes, actors, ...rest }) => rest);

    try {
      // Só mostra skeleton se ainda não tiver nenhum conteúdo (primeira visita sem cache)
      setMyMovies(existing => {
        if (existing.length === 0) setIsLoadingMovies(true);
        return existing;
      });

      // Fase 1: busca a 1ª página de filmes + séries em paralelo para aparecer rápido
      const [firstM, firstS] = await Promise.all([
        fetchFirstPage(COLS_LEVEL1, 'movie'),
        fetchFirstPage(COLS_LEVEL1, 'series'),
      ]);

      const firstPageError = firstM.error || firstS.error;

      if (!firstPageError) {
        // Mostra conteúdo da 1ª página imediatamente
        const firstItems = [...firstM.data, ...firstS.data].map(fmtMovieRow);
        if (firstItems.length > 0) {
          setMyMovies(firstItems);
          setIsLoadingMovies(false);
        }

        // Fase 2: carrega páginas restantes em background sem bloquear a UI
        if (firstM.hasMore || firstS.hasMore) {
          let allM = [...firstM.data];
          let allS = [...firstS.data];
          let hasNewData = false;

          const flushBatch = () => {
            if (!hasNewData) return;
            hasNewData = false;
            const merged = [...allM, ...allS].map(fmtMovieRow);
            setMyMovies(merged);
          };

          await Promise.all([
            firstM.hasMore ? fetchRemainingPages(COLS_LEVEL1, 'movie', (page) => {
              allM = allM.concat(page);
              hasNewData = true;
              flushBatch();
            }) : Promise.resolve(),
            firstS.hasMore ? fetchRemainingPages(COLS_LEVEL1, 'series', (page) => {
              allS = allS.concat(page);
              hasNewData = true;
              flushBatch();
            }) : Promise.resolve(),
          ]);

          // Garante que último batch foi emitido
          const finalItems = [...allM, ...allS].map(fmtMovieRow);
          setMyMovies(finalItems);
          setLoadingMoreCount(0);
          saveCache(finalItems);
        } else {
          const finalItems = [...firstM.data, ...firstS.data].map(fmtMovieRow);
          setLoadingMoreCount(0);
          saveCache(finalItems);
        }
        return;
      }

      // Fallback: colunas básicas
      console.warn('[fetchMyMovies] Tentativa 1 falhou, usando colunas básicas:', firstM.error?.message || firstS.error?.message);
      let [resM, resS] = await Promise.all([
        fetchPaginated(COLS_LEVEL2, 'movie'),
        fetchPaginated(COLS_LEVEL2, 'series'),
      ]);

      // Tentativa 3: select(*) com strip client-side (idêntico ao movies(*) do fetchMyList)
      if (resM.error || resS.error) {
        console.warn('[fetchMyMovies] Tentativa 2 falhou, usando select(*) como fetchMyList:', resM.error?.message || resS.error?.message);
        [resM, resS] = await Promise.all([
          fetchPaginated(COLS_LEVEL3, 'movie'),
          fetchPaginated(COLS_LEVEL3, 'series'),
        ]);
        if (!resM.error && resM.data) resM = { ...resM, data: stripHeavyFields(resM.data) };
        if (!resS.error && resS.data) resS = { ...resS, data: stripHeavyFields(resS.data) };
      }

      if (resM.error) throw resM.error;
      if (resS.error) throw resS.error;

      const items = [...(resM.data || []), ...(resS.data || [])].map(fmtMovieRow);
      setMyMovies(items);
      setLoadingMoreCount(0);
      saveCache(items);

      // Busca contagem real em background (sem bloquear UI)
      Promise.all([
        supabase.from('movies').select('*', { count: 'exact', head: true }).eq('type', 'movie'),
        supabase.from('movies').select('*', { count: 'exact', head: true }).eq('type', 'series'),
      ]).then(([cntM, cntS]) => {
        if (cntM.count !== null) setTotalMoviesCount(cntM.count);
        if (cntS.count !== null) setTotalSeriesCount(cntS.count);
        // Persiste contagens para carregar instantaneamente no próximo acesso
        try {
          localStorage.setItem('cached_counts_v1', JSON.stringify({ movies: cntM.count, series: cntS.count }));
        } catch {}
      }).catch(() => {});
    } catch (error: any) {
      console.error('[fetchMyMovies] Todas as tentativas falharam:', error?.message || error);
    } finally {
      setIsLoadingMovies(false);
    }
  };

  // Busca os 20 conteúdos adicionados hoje para o carrossel "Novos na Plataforma"
  const fetchNewOnPlatform = async () => {
    if (!hasSupabase) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const COLS_NEW = 'id,title,type,poster_path,backdrop_path,release_date,rating,vote_average,video_url,video_url_2,logo_path,genres,is_hidden,created_at';
      const [resM, resS] = await Promise.all([
        supabase.from('movies').select(COLS_NEW).eq('type', 'movie').gte('created_at', today.toISOString()).order('created_at', { ascending: false }).limit(20),
        supabase.from('movies').select(COLS_NEW).eq('type', 'series').gte('created_at', today.toISOString()).order('created_at', { ascending: false }).limit(20),
      ]);
      const COLS_NEW_SAFE = 'id,title,type,poster_path,backdrop_path,release_date,rating,vote_average,video_url,video_url_2,logo_path,genres,is_hidden,created_at';
      const moviesData = resM.error
        ? (await supabase.from('movies').select(COLS_NEW_SAFE).eq('type', 'movie').gte('created_at', today.toISOString()).order('created_at', { ascending: false }).limit(20)).data
        : resM.data;
      const seriesData = resS.error
        ? (await supabase.from('movies').select(COLS_NEW_SAFE).eq('type', 'series').gte('created_at', today.toISOString()).order('created_at', { ascending: false }).limit(20)).data
        : resS.data;
      setNewOnPlatformMovies((moviesData || []).map(fmtMovieRow));
      setNewOnPlatformSeries((seriesData || []).map(fmtMovieRow));
    } catch (e) {
      console.error('Erro ao buscar novidades na plataforma:', e);
    }
  };

  const fetchContinueWatching = async () => {
    if (!profile) return;

    // Tentar carregar do cache primeiro
    const cached = localStorage.getItem(`cached_continue_${profile.id}`);
    if (cached) {
      setContinueWatching(JSON.parse(cached));
    }

    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select('*, movie:movies(*)')
        .eq('profile_id', profile.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const historyMap: Record<number, number> = {};
        const formatted: Movie[] = data
          .filter(h => h.movie)
          .map(h => {
            historyMap[h.movie_id] = h.last_position;
            // Sync episode_url into localStorage so MovieDetailsModal finds it
            if (h.episode_url && h.movie_id) {
              const lsKey = `netplay_progress_url_${h.movie_id}`;
              if (!localStorage.getItem(lsKey)) {
                localStorage.setItem(lsKey, h.episode_url);
              }
            }
            return {
              ...h.movie,
              id: h.movie.id,
              title: h.movie.title,
              backdrop_path: h.movie.backdrop_path,
              poster_path: h.movie.poster_path,
              logo_path: h.movie.logo_path,
              videoUrl: h.movie.video_url,
              videoUrl2: h.movie.video_url_2,
              last_position: h.last_position,
              savedEpisodeUrl: h.episode_url || localStorage.getItem(`netplay_progress_url_${h.movie_id}`) || undefined,
              release_date: h.movie.release_date,
              runtime: h.movie.runtime,
              rating: h.movie.rating || h.movie.vote_average,
              actors: h.movie.actors
            };
          });
        setWatchHistory(historyMap);
        setContinueWatching(formatted);
        localStorage.setItem(`cached_continue_${profile.id}`, JSON.stringify(formatted));
      }
    } catch (error) {
      console.error('Erro ao buscar continuar assistindo:', error);
    }
  };

  // Personalização: reordena myMovies conforme gêneros mais assistidos pelo usuário
  const hasPersonalizedRef = React.useRef(false);
  useEffect(() => {
    if (hasPersonalizedRef.current || continueWatching.length === 0 || myMovies.length === 0) return;
    const genreScores: Record<string, number> = {};
    continueWatching.forEach(m => {
      const genres = (m.genres || '').split(',').map((g: string) => g.trim().toLowerCase()).filter(Boolean);
      genres.forEach(g => { genreScores[g] = (genreScores[g] || 0) + 1; });
    });
    if (Object.keys(genreScores).length === 0) return;
    hasPersonalizedRef.current = true;
    const scoreMovie = (m: Movie) => {
      const genres = (m.genres || '').split(',').map((g: string) => g.trim().toLowerCase()).filter(Boolean);
      return genres.reduce((sum, g) => sum + (genreScores[g] || 0), 0);
    };
    startTransition(() => {
      setMyMovies(prev => {
        const movies = prev.filter(m => m.type === 'movie' || !m.type);
        const series = prev.filter(m => m.type === 'series');
        const sortByScore = (arr: Movie[]) => [...arr].sort((a, b) => scoreMovie(b) - scoreMovie(a));
        return [...sortByScore(movies), ...sortByScore(series)];
      });
    });
  }, [continueWatching]);

  // Personalização avançada: busca mais conteúdo do banco baseado nos top gêneros assistidos
  const hasFetchedPersonalizedRef = React.useRef(false);
  useEffect(() => {
    if (hasFetchedPersonalizedRef.current || !user || continueWatching.length === 0 || myMovies.length === 0) return;

    const fetchPersonalizedByGenre = async () => {
      hasFetchedPersonalizedRef.current = true;

      // Detecta top 3 gêneros do histórico
      const genreCount: Record<string, number> = {};
      continueWatching.forEach(m => {
        const genres = (m.genres || '').split(',').map((g: string) => g.trim()).filter(Boolean);
        genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
      });
      const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);

      if (topGenres.length === 0) return;

      const existingIds = new Set(myMovies.map(m => m.id));
      const COLS = 'id,title,type,poster_path,backdrop_path,release_date,rating,vote_average,genres,video_url,video_url_2,logo_path,is_hidden,created_at,updated_at';

      // Busca até 80 títulos por gênero que ainda não estão carregados
      const results = await Promise.all(
        topGenres.map(genre =>
          supabase.from('movies')
            .select(COLS)
            .ilike('genres', `%${genre}%`)
            .order('rating', { ascending: false })
            .limit(80)
        )
      );

      const newItems: Movie[] = [];
      for (const res of results) {
        if (res.data) {
          for (const m of res.data) {
            if (!existingIds.has(m.id)) {
              newItems.push(fmtMovieRow(m));
              existingIds.add(m.id);
            }
          }
        }
      }

      if (newItems.length > 0) {
        startTransition(() => {
          setPersonalizedMovies(newItems.slice(0, 30));
          setMyMovies(prev => [...prev, ...newItems]);
        });
      }
    };

    fetchPersonalizedByGenre();
  }, [continueWatching, user, myMovies.length]);

  useEffect(() => {
    if (user) {
      fetchMyMovies();
      fetchContinueWatching();
      fetchNewOnPlatform();

      // Adicionar listener em tempo real — debounced para não re-fetchar em cascata
      let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
      const channel = supabase
        .channel('public:movies')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, () => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => fetchMyMovies(), 4000);
        })
        .subscribe();

      // Adicionar listener em tempo real para a tabela de minha lista
      const listChannel = supabase
        .channel('public:my_list')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'my_list' }, () => {
          fetchMyList();
        })
        .subscribe();

      return () => {
        if (realtimeTimer) clearTimeout(realtimeTimer);
        supabase.removeChannel(channel);
        supabase.removeChannel(listChannel);
      };
    } else {
      setMyMovies([]);
    }
  }, [user]);

  const fetchMyList = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('my_list')
        .select('*, movie:movies(*)')
        .eq('profile_id', profile.id);
      
      if (error) throw error;
      if (data) {
        setMyList(data.map((item: any) => ({
          ...item.movie,
          id: item.movie.id,
          videoUrl: item.movie.video_url,
          videoUrl2: item.movie.video_url_2
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar minha lista:', error);
    }
  };

  const fetchAppSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setAppSettings(data);
        if (data.category_backdrops) {
          setCategories(prev => prev.map(c => data.category_backdrops[c.id] ? { ...c, backdrop: data.category_backdrops[c.id] } : c));
        }
      } else {
        // Criar configurações padrão se não existirem
        const { data: newData, error: createError } = await supabase
          .from('app_settings')
          .insert([{ user_id: user.id, subscription_status: 'inactive' }])
          .select()
          .single();
        if (!createError) setAppSettings(newData);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  };

  const fetchFavorites = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('movie_data')
        .eq('profile_id', profile.id);
      
      if (error) throw error;
      setFavorites(data?.map(d => d.movie_data) || []);
    } catch (error) {
      console.error('Erro ao buscar favoritos:', error);
    }
  };

  const toggleFavorite = async (movie: Movie) => {
    if (!profile?.id) return;

    const isFavorite = favorites.some(m => m.id === movie.id);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('profile_id', profile.id)
          .eq('movie_id', movie.id);
        
        if (error) throw error;
        setFavorites(prev => prev.filter(m => m.id !== movie.id));
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            profile_id: profile.id,
            movie_id: movie.id,
            movie_data: movie
          });
        
        if (error) throw error;
        setFavorites(prev => [...prev, movie]);
      }
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
      alert('Tivemos um problema ao atualizar os Favoritos. Verifique a conexão e tente novamente.');
    }
  };

  const toggleMyList = async (movie: Movie) => {
    if (!profile) return;
    const isInList = myList.some(m => m.id === movie.id);
    
    try {
      if (isInList) {
        const { error } = await supabase
          .from('my_list')
          .delete()
          .eq('profile_id', profile.id)
          .eq('movie_id', movie.id);
          
        if (error) throw error;
        setMyList(prev => prev.filter(m => m.id !== movie.id));
      } else {
        const { error } = await supabase
          .from('my_list')
          .insert([{ profile_id: profile.id, movie_id: movie.id }]);
          
        if (error) throw error;
        setMyList(prev => [...prev, movie]);
      }
    } catch (error) {
      console.error('Erro ao alternar minha lista:', error);
      alert('Tivemos um problema ao atualizar a Minha Lista. Verifique a conexão e tente novamente.');
    }
  };

  useEffect(() => {
    if (profile) {
      fetchContinueWatching();
      fetchMyList();
      fetchFavorites();
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchAppSettings();
    }
  }, [user]);

  const updateAppSettings = async (newSettings: Partial<AppSettings>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update(newSettings)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      if (data) setAppSettings(data);
    } catch (error) {
      console.error('Error updating app settings:', error);
    }
  };

  const visibleMovies = useMemo(() => {
    return deferredMyMovies.filter(m => !m.is_hidden);
  }, [deferredMyMovies]);

  // Filtrar filmes para Lançamentos (2025-2026)
  const newMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    return visibleMovies.filter(movie => {
      const year = movie.release_year || (movie.release_date ? new Date(movie.release_date).getFullYear() : 0);
      return year === 2025 || year === 2026;
    });
  }, [visibleMovies, loadingMoreCount]);

  // Filtrar filmes para Fresquinho do Cinema (2026 e <= 5 meses)
  const cinemaMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    const now = new Date();
    // Prioridade 1: filmes lançados em 2024-2026 (recentes, em cartaz)
    const recent = visibleMovies.filter(movie => {
      if (!movie.release_date) return false;
      const year = new Date(movie.release_date).getFullYear();
      return year >= 2024 && year <= 2026;
    });
    if (recent.length >= 4) return recent.slice(0, 20);
    // Fallback: top-rated filmes com backdrop disponível
    return visibleMovies
      .filter(m => m.backdrop_path && m.type === 'movie')
      .sort((a, b) => (b.vote_average || b.rating || 0) - (a.vote_average || a.rating || 0))
      .slice(0, 20);
  }, [visibleMovies, loadingMoreCount]);

  // Top 10 Filmes
  const top10Movies = useMemo(() => {
    return visibleMovies
      .filter(m => m.type === 'movie' || !m.type)
      .slice(0, 10);
  }, [visibleMovies]);

  // Top 10 Séries
  const top10Series = useMemo(() => {
    return visibleMovies
      .filter(m => m.type === 'series')
      .slice(0, 10);
  }, [visibleMovies]);

  // Cara Nova (Recém re-scaneados)
  const caraNovaMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    const now = new Date().getTime();
    return visibleMovies.filter(movie => {
      if (movie.last_rescanned_at) {
        const rescanDate = new Date(movie.last_rescanned_at).getTime();
        const diffHours = (now - rescanDate) / (1000 * 60 * 60);
        return diffHours <= 24;
      }
      return false;
    });
  }, [visibleMovies, loadingMoreCount]);

  // Conteúdo TeraBox
  const teraboxMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    return visibleMovies.filter(m => 
      m.videoUrl?.includes('terabox') || 
      m.videoUrl?.includes('1024terabox') || 
      m.videoUrl?.includes('teraboxapp')
    ).slice(0, 10);
  }, [visibleMovies, loadingMoreCount]);

  // Conteúdo TARAPLAY (KingX/TeraDL)
  const taraplayMovies = useMemo(() => {
    if (loadingMoreCount > 0) return [] as Movie[];
    return visibleMovies.filter(m => 
      m.videoUrl?.includes('player.kingx.dev') || 
      m.videoUrl?.includes('teradl.kingx.dev') ||
      m.videoUrl?.includes('gdplayer.to') ||
      m.videoUrl?.includes('gdplayer.org')
    );
  }, [visibleMovies, loadingMoreCount]);

  // Função auxiliar para agrupar por gênero — capado para performance com 22k filmes
  const parseGenreString = (g: any): string[] => {
    if (!g) return [];
    if (Array.isArray(g)) return g.map((s: any) => String(s).trim()).filter(Boolean);
    if (typeof g === 'string') return g.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const groupByGenre = (movies: Movie[]) => {
    const counts: Record<string, number> = {};
    const grouped: { [key: string]: Movie[] } = {};
    movies.forEach(movie => {
      const genres = parseGenreString(movie.genres);
      if (!genres.length) { counts['Outros'] = (counts['Outros'] || 0) + 1; return; }
      genres.forEach(genre => { if (genre) counts[genre] = (counts[genre] || 0) + 1; });
    });
    const topGenres = new Set(
      Object.entries(counts)
        .filter(([, c]) => c >= 5)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([g]) => g)
    );
    movies.forEach(movie => {
      const genres = parseGenreString(movie.genres);
      const genreList = genres.length
        ? genres.filter(g => topGenres.has(g))
        : (topGenres.has('Outros') ? ['Outros'] : []);
      genreList.forEach(genre => {
        if (!grouped[genre]) grouped[genre] = [];
        if (grouped[genre].length < 30) grouped[genre].push(movie);
      });
    });
    return Object.keys(grouped).sort().reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {} as { [key: string]: Movie[] });
  };

  const moviesByGenre = useMemo(() => {
    if (loadingMoreCount > 0) return {} as { [key: string]: Movie[] };
    return groupByGenre(visibleMovies);
  }, [visibleMovies, loadingMoreCount]);
  const newMoviesByGenre = useMemo(() => {
    if (loadingMoreCount > 0) return {} as { [key: string]: Movie[] };
    return groupByGenre(newMovies);
  }, [newMovies, loadingMoreCount]);

  // Busca no Supabase quando a query tem 2+ caracteres (pega conteúdo fora dos 1600 em memória)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setGlobalDbSearchResults([]);
      setIsGlobalSearching(false);
      return;
    }
    setIsGlobalSearching(true);
    const timer = setTimeout(async () => {
      try {
        const COLS = 'id,title,type,poster_path,backdrop_path,release_date,first_air_date,rating,vote_average,runtime,genres,video_url,video_url_2,logo_path,watch_providers,is_hidden,created_at,updated_at';
        // Busca por título OU nome (séries)
        const { data } = await supabase
          .from('movies')
          .select(COLS)
          .or(`title.ilike.%${q}%,name.ilike.%${q}%`)
          .or('is_hidden.eq.false,is_hidden.is.null')
          .order('vote_average', { ascending: false })
          .limit(150);
        setGlobalDbSearchResults((data || []).map(fmtMovieRow));
      } catch {
        setGlobalDbSearchResults([]);
      } finally {
        setIsGlobalSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtrar filmes para a pesquisa — combina in-memory + DB completo
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const inMemory = visibleMovies.filter(movie => {
      const title = (movie.title || "").toLowerCase();
      const name = (movie.name || "").toLowerCase();
      const originalName = (movie.original_name || "").toLowerCase();
      const genres = (movie.genres || "").toLowerCase();
      const overview = (movie.overview || "").toLowerCase();
      return title.includes(query) || name.includes(query) || originalName.includes(query) || genres.includes(query) || overview.includes(query);
    });
    // Mescla com resultados do DB, sem duplicatas (prioriza in-memory que tem mais dados)
    const inMemoryIds = new Set(inMemory.map(m => m.id));
    const dbOnly = globalDbSearchResults.filter(m => !inMemoryIds.has(m.id));
    return [...inMemory, ...dbOnly];
  }, [visibleMovies, searchQuery, globalDbSearchResults]);

  const episodeSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: Array<{ movie: any; episode: any; episodeIndex: number }> = [];
    for (const m of visibleMovies) {
      if (m.type !== 'series' || !m.episodes) continue;
      const seriesMatches = (m.title || m.name || '').toLowerCase().includes(query);
      // Sort episodes by season→episode so the index aligns with VideoPlayer's sortedList
      const sortedEps = [...(m.episodes as any[])].sort((a: any, b: any) => {
        const sa = (a.season || 1) - (b.season || 1);
        return sa !== 0 ? sa : (a.episode || 0) - (b.episode || 0);
      });
      sortedEps.forEach((ep: any, idx: number) => {
        const title = (ep.title || '').toLowerCase();
        const overview = (ep.overview || '').toLowerCase();
        if (seriesMatches || title.includes(query) || overview.includes(query)) {
          results.push({ movie: m, episode: ep, episodeIndex: idx });
        }
      });
    }
    return results.slice(0, 30);
  }, [visibleMovies, searchQuery]);

  const handleSelectProfile = (selectedProfile: Profile) => {
    setProfile(selectedProfile);
    localStorage.setItem('active_profile', JSON.stringify(selectedProfile));
    
    // Se havia uma sala pendente no URL, tenta entrar nela agora que o perfil foi selecionado
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const movieId = params.get('movie');
    
    if (roomId && movieId) {
      const movie = myMovies.find(m => m.id.toString() === movieId.toString());
      if (movie) {
        handlePlayMovie(movie);
      }
    }
  };

  useEffect(() => {
    // Auto-join watch party if profile is already loaded and we have movies
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const movieId = params.get('movie');

    if (roomId && movieId && profile && myMovies.length > 0) {
      const isAlreadyInWatch = location.pathname.includes('/watch');
      if (!isAlreadyInWatch) {
        const movie = myMovies.find(m => m.id.toString() === movieId.toString());
        if (movie) {
           // We push to watch with the search params so the player wrapper can get them
           navigate(`/watch/${movie.id}?room=${roomId}`, { 
             state: { movie, backgroundLocation: location.state?.backgroundLocation },
             replace: true 
           });
        }
      }
    }
  }, [profile, myMovies, location.pathname, navigate]);

  const handleSwitchProfile = () => {
    setProfile(null);
    localStorage.removeItem('active_profile');
  };

  const sendTestNotification = async () => {
    await notificationService.sendNotification(
      '🔔 Teste de Notificação',
      'Sua conta NetPremium está configurada corretamente!',
      'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'
    );
  };

  // Use um ref para a localização atual para evitar re-renderizações desnecessárias em handlers que usam a localização apenas para o estado de 'background'
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const updateProgress = useCallback(async (movieId: string | number, time: number, episodeUrl?: string) => {
    if (!profile) return;
    
    // Salva no estado local para reatividades rápida
    setWatchHistory(prev => ({ ...prev, [Number(movieId)]: time }));
    
    // Salva localmente para acesso instantâneo entre sessões (fallback)
    localStorage.setItem(`netplay_progress_${movieId}`, time.toString());
    if (episodeUrl) {
      localStorage.setItem(`netplay_progress_url_${movieId}`, episodeUrl);
    }
    
    // Salva no Supabase para sincronização
    try {
      const upsertData: Record<string, unknown> = {
        profile_id: profile.id,
        movie_id: Number(movieId),
        last_position: time,
        updated_at: new Date().toISOString()
      };
      if (episodeUrl) upsertData.episode_url = episodeUrl;
      await supabase.from('watch_history').upsert(upsertData, { onConflict: 'profile_id,movie_id' });
    } catch (err) {
      console.error('Erro ao atualizar progresso no Supabase:', err);
    }
  }, [profile]);

  // Ref para evitar recriar handleSelectMovie a cada mudança de rota
  // (evita re-render de todos os MovieCards ao navegar)
  const locationPathRef = useRef(location.pathname);
  useEffect(() => { locationPathRef.current = location.pathname; }, [location.pathname]);

  const handleSelectMovie = useCallback((movie: Movie) => {
    // Adiciona o filme ao estado local se não estiver na lista (ex: veio de uma busca)
    // Assim ele aparece nos carrosséis após ser acessado
    setMyMovies(prev => {
      if (prev.some(m => m.id === movie.id)) return prev;
      return [movie, ...prev];
    });
    navigate(`/movie/${movie.id}`, { state: { backgroundLocation: locationPathRef.current, movie } });
  }, [navigate]);

  const handlePlayMovie = useCallback((movie: Movie, episodeUrl?: string, startTime?: number, playerStyle?: string, episodeIndex?: number) => {
    // Travamos a orientação e navegamos de forma síncrona
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen().catch(() => {});
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('median') || ua.includes('gonative')) {
          if ((window as any).median) {
            (window as any).median.screen.setOrientation({orientation: 'landscape'});
          } else if ((window as any).gonative) {
            (window as any).gonative.screen.setOrientation({orientation: 'landscape'});
          } else {
            window.location.href = `median://screen/setOrientation?orientation=landscape`;
          }
        }
      }
    } catch(e) {}
    
    // Navegação síncrona permite que o autoplay passe no browser sem block
    const search = window.location.search;
    navigate(`/watch/${movie.id}${search}`, { state: { movie, episodeUrl, episodeIndex, startTime, playerStyle, backgroundLocation: location.state?.backgroundLocation } });
  }, [navigate, location.state]);

  const handleSmartPlayEpisode = useCallback((movie: any, episodeUrl: string, episodeIndex: number) => {
    // If the URL doesn't need TeraBox APIs, play immediately without showing the server selector modal
    if (!isDynamicRef(episodeUrl)) {
      handlePlayMovie(movie, episodeUrl, 0, undefined, episodeIndex);
      return;
    }

    // If the user already has a saved server preference, honour it automatically
    const savedPref = getSelectedServer();
    if (savedPref) {
      const resolvedUrl = convertTeraboxToApi(episodeUrl, savedPref.altApi);
      handlePlayMovie(movie, resolvedUrl, 0, savedPref.playerStyle, episodeIndex);
      return;
    }

    // Needs TeraBox and no saved preference → show selector
    setSmartPlayState({ movie, episodeUrl, episodeIndex });
  }, [handlePlayMovie]);

  const closeMovieDetails = () => {
    navigate(state?.backgroundLocation?.pathname || '/menu');
  };

  const closePlayer = () => {
    // Set to portrait upon exit
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
        if ((screen.orientation as any).lock) {
          (screen.orientation as any).lock('portrait').catch(() => {});
        }
      }
      
      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('median') || ua.includes('gonative')) {
          if ((window as any).median) {
            (window as any).median.screen.setOrientation({orientation: 'portrait'});
          } else if ((window as any).gonative) {
            (window as any).gonative.screen.setOrientation({orientation: 'portrait'});
          } else {
            window.location.href = `median://screen/setOrientation?orientation=portrait`;
          }
        }
      }
    } catch (e) {}

    navigate(state?.backgroundLocation?.pathname || '/menu');
    // Pequeno delay para garantir que a navegação e o unmount do player salvaram o progresso
    setTimeout(() => {
      fetchContinueWatching();
    }, 300);
  };

  // Efeito para forçar modo paisagem ao abrir o player
  useEffect(() => {
    const isPlaying = location.pathname.includes('/watch') || selectedMovie != null;
    if (isPlaying) {
      const lockOrientation = async () => {
        try {
          if (screen.orientation && (screen.orientation as any).lock) {
            await (screen.orientation as any).lock('landscape').catch(() => {});
          }
        } catch (e) {}
        
        try {
          if (typeof window !== 'undefined') {
            const ua = navigator.userAgent.toLowerCase();
            if (ua.includes('median') || ua.includes('gonative')) {
              if ((window as any).median) {
                (window as any).median.screen.setOrientation({orientation: 'landscape'});
              } else if ((window as any).gonative) {
                (window as any).gonative.screen.setOrientation({orientation: 'landscape'});
              } else {
                window.location.href = `median://screen/setOrientation?orientation=landscape`;
              }
            }
          }
        } catch (e) {}
      };
      lockOrientation();
      
      // Segunda tentativa após um delay
      const timer = setTimeout(lockOrientation, 1000);
      return () => clearTimeout(timer);
    } else {
      // Unlock ao fechar
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
        try {
          if ((screen.orientation as any).lock) {
             (screen.orientation as any).lock('portrait').catch(() => {});
          }
        } catch (e) {}
      }
      
      try {
        if (typeof window !== 'undefined') {
          const ua = navigator.userAgent.toLowerCase();
          if (ua.includes('median') || ua.includes('gonative')) {
            if ((window as any).median) {
              (window as any).median.screen.setOrientation({orientation: 'portrait'});
            } else if ((window as any).gonative) {
              (window as any).gonative.screen.setOrientation({orientation: 'portrait'});
            } else {
              window.location.href = `median://screen/setOrientation?orientation=portrait`;
            }
          }
        }
      } catch (e) {}
    }
  }, [location.pathname, selectedMovie]);

  const handlePlayNextEpisode = (currentMovie: Movie) => {
    if (currentMovie.type !== 'series' || !currentMovie.episodes) return;

    // Usar episódios ordenados por temporada→episódio para "próximo episódio" correto
    const sortedEpsForNext = [...currentMovie.episodes].sort((a: any, b: any) => {
      const sa = (a.season || 1) - (b.season || 1);
      return sa !== 0 ? sa : (a.episode || 0) - (b.episode || 0);
    });
    const mv = currentMovie.videoUrl || '';
    const currentEpIndex = sortedEpsForNext.findIndex((ep: any) => {
      if (ep.videoUrl === mv || ep.videoUrl2 === mv) return true;
      // Correspondência por nome de arquivo para modo cascata (URL convertida não bate direto)
      if (isDynamicRef(mv) && ep.videoUrl && isDynamicRef(ep.videoUrl)) {
        try {
          const { filename: epFn } = parseDynamicRef(ep.videoUrl);
          const { filename: mvFn } = parseDynamicRef(mv);
          if (epFn && mvFn && epFn === mvFn) return true;
        } catch {}
      }
      return false;
    });
    
    if (currentEpIndex !== -1 && currentEpIndex < sortedEpsForNext.length - 1) {
      const nextEp = sortedEpsForNext[currentEpIndex + 1];
      const rawUrl = nextEp.videoUrl || '';
      let nextUrl = rawUrl;
      let nextPlayerStyle: string | undefined = undefined;

      const saved = getSelectedServer();
      if (saved && isDynamicRef(rawUrl)) {
        if (saved.id === 'admin') {
          nextUrl = nextEp.videoUrl2 || rawUrl;
          nextPlayerStyle = 'netflix';
        } else if (saved.id === 'alternative') {
          nextUrl = convertTeraboxToApi(rawUrl, saved.altApi);
          nextPlayerStyle = 'netflix-cascade';
        } else if (saved.id === 'auto') {
          nextUrl = convertTeraboxToApi(rawUrl, saved.nativeApi);
          nextPlayerStyle = 'netflix-cascade';
        }
      }

      handlePlayMovie(currentMovie, nextUrl, 0, nextPlayerStyle);
    }
  };

  const handleClosePlayer = () => {
    setSelectedMovie(null);
    fetchContinueWatching(); // Atualiza a lista ao fechar o player
  };

  const showBack = !!(selectedMovie || watchPartyMovie || viewingMovie || selectedProvider || isSettingsOpen || isModalOpen || isAdminModalOpen || location.pathname !== '/menu');

  const handleBack = useCallback(() => {
    if (selectedMovie) {
      handleClosePlayer();
      return;
    }
    if (watchPartyMovie) {
      setWatchPartyMovie(null);
      return;
    }
    if (viewingMovie) {
      setViewingMovie(null);
      return;
    }
    if (selectedProvider) {
      setSelectedProvider(null);
      return;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }
    if (isModalOpen) {
      setIsModalOpen(false);
      return;
    }
    if (isAdminModalOpen) {
      setIsAdminModalOpen(false);
      return;
    }
    if (location.pathname !== '/menu') {
      navigate(-1);
      return;
    }
  }, [selectedMovie, watchPartyMovie, viewingMovie, selectedProvider, isSettingsOpen, isModalOpen, isAdminModalOpen, location.pathname, navigate]);

  useEffect(() => {
    (window as any).appBack = handleBack;
    // Suporte para botão voltar físico do Android (Median.co / GoNative)
    (window as any).onGoNativeBack = () => {
      if (showBack) {
        handleBack();
        return true; // Bloqueia o fechamento do app
      }
      return false; // Permite o comportamento padrão
    };
  }, [handleBack, showBack]);

  const handlePlayCustomUrl = (url: string) => {
    const customMovie: Movie = {
      id: Date.now(),
      title: "Vídeo Customizado",
      backdrop_path: "",
      poster_path: "",
      overview: "Reproduzindo vídeo de link externo.",
      vote_average: 0,
      videoUrl: url
    };
    setSelectedMovie(customMovie);
    setIsModalOpen(false);
  };

  const getSimilarMovies = useCallback((movie: Movie) => {
    if (!movie.genres) {
      return visibleMovies.filter(m => m.id?.toString() !== movie.id?.toString()).slice(0, 12);
    }

    const parseGenres = (g: any): string[] => {
      if (!g) return [];
      if (Array.isArray(g)) return g.map((s: any) => String(s).trim()).filter(Boolean);
      if (typeof g === 'string') return g.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };

    const currentGenres = parseGenres(movie.genres);
    
    const scoredMovies = visibleMovies
      .filter(m => m.id?.toString() !== movie.id?.toString())
      .map(m => {
        let score = 0;
        if (m.genres) {
          const mGenres = parseGenres(m.genres);
          score = currentGenres.filter(g => mGenres.includes(g)).length;
        }
        return { movie: m, score };
      })
      .sort((a, b) => b.score - a.score);

    return scoredMovies.map(s => s.movie).slice(0, 12);
  }, [visibleMovies]);

  const currentSimilarMovies = useMemo(() => {
    if (!viewingMovie) return [];
    return getSimilarMovies(viewingMovie);
  }, [viewingMovie, getSimilarMovies]);

  const providerMovies = useMemo(() => {
    if (!selectedProvider) return [];
    return visibleMovies.filter(m => {
      // 1. Check explicit watch_providers field if available (contains Name|LogoURL)
      if (m.watch_providers) {
        const providersString = m.watch_providers.toLowerCase();
        // The format is "Name|URL;;Name2|URL2"
        if (providersString.includes(selectedProvider.toLowerCase())) return true;
      }

      // 2. Fallback to keyword matching in title/overview (Legacy or specific original content)
      const t = (m.title || m.name || '').toLowerCase();
      const o = (m.overview || '').toLowerCase();
      
      const keywords: Record<string, string[]> = {
        'Disney+': ['disney+', 'pixar', 'marvel studios', 'star wars'],
        'Netflix': ['netflix original'],
        'Max': ['hbo original', 'max original', 'warner bros'],
        'Prime Video': ['amazon original', 'prime video'],
        'Apple TV+': ['apple original']
      };

      const providerKeywords = keywords[selectedProvider] || [];
      return providerKeywords.some(k => t.includes(k) || o.includes(k));
    }).sort((a, b) => {
      const dateA = String(a.release_date || a.created_at || '');
      const dateB = String(b.release_date || b.created_at || '');
      return dateB.localeCompare(dateA);
    });
  }, [selectedProvider, visibleMovies]);

  useEffect(() => {
    const handleOpenPlans = () => setIsPlansScreenOpen(true);
    document.addEventListener('open-plans', handleOpenPlans);
    return () => document.removeEventListener('open-plans', handleOpenPlans);
  }, []);

  useEffect(() => {
    if (appSettings && !isAdmin) {
      if (appSettings.subscription_status === 'active' && appSettings.subscription_expires_at) {
        const expires = new Date(appSettings.subscription_expires_at);
        if (expires < new Date()) {
          // Expirado!
          updateAppSettings({ subscription_status: 'expired' });
          setIsPlansScreenOpen(true);
        }
      } else {
        // Não tem assinatura ativa
        setIsPlansScreenOpen(true);
      }
    }
  }, [appSettings, isAdmin]);

  const handleUpdatePlan = async (plan: 'hub' | 'plus' | 'max') => {
    const prices = { hub: 15.90, plus: 25.90, max: 35.90 };
    const titles = { hub: 'Netprime Hub', plus: 'Netprime Plus', max: 'Netprime Max' };
    
    try {
      const response = await fetch('/api/payments/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titles[plan],
          price: prices[plan],
          planId: plan,
          userId: user?.id,
          email: user?.email
        })
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        console.error('Mercado Pago Error:', data);
        alert(`Erro Mercado Pago: ${data.error || 'Desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao chamar Mercado Pago:', error);
      alert('Houve um erro ao processar o pagamento. Tente novamente mais tarde.');
    }
  };

  useEffect(() => {
    const checkPaymentSuccess = async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      const planId = params.get('plan');
      
      if (paymentStatus === 'success' && planId) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await updateAppSettings({ 
          subscription_plan: planId as any,
          subscription_status: 'active',
          subscription_expires_at: expiresAt.toISOString()
        });
        setIsPlansScreenOpen(false);
        // Limpar URL após aprovação para não ficar acionando
        window.history.replaceState({}, document.title, window.location.pathname);
        alert(`Obrigado! Seu pagamento foi processado e seu plano foi atualizado para ${planId.toUpperCase()}.`);
      } else if (paymentStatus === 'failure') {
        alert('Houve um problema com seu pagamento no Mercado Pago. Tente novamente.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    checkPaymentSuccess();
  }, [user]); // run when user is authenticated, independently of profile

  if (showIntro) {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
        <IntroVignette
          isLoading={loading}
          onComplete={(mode) => {
            try { sessionStorage.setItem('netplay_intro_shown', '1'); } catch {}
            if (mode) setInitialLoginMode(mode);
            setShowIntro(false);
            setShowAppInfo(false);
          }}
          movies={myMovies}
        />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#ff1a1a]/30 border-t-[#ff1a1a] rounded-full animate-spin" />
          <div className="flex items-baseline gap-0">
            <span className="text-2xl font-black text-white uppercase italic tracking-tighter">NET</span>
            <span className="text-2xl font-black uppercase italic tracking-tighter text-[#ff1a1a]">PLAY</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSupabase) {
    return (
      <div className="bg-[#141414] min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#181818] p-8 rounded-2xl border border-white/10 text-center shadow-2xl">
          <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="text-red-600 animate-spin-slow" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Configuração Necessária</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Para que o aplicativo funcione, você precisa configurar as chaves do <strong>Supabase</strong> no menu de configurações do AI Studio.
          </p>
          <div className="space-y-4 text-left bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-xs mb-8">
            <p className="text-red-500 font-bold">Variáveis faltantes:</p>
            {!import.meta.env.VITE_SUPABASE_URL && <p className="text-gray-500">• VITE_SUPABASE_URL</p>}
            {!import.meta.env.VITE_SUPABASE_ANON_KEY && <p className="text-gray-500">• VITE_SUPABASE_ANON_KEY</p>}
          </div>
          <p className="text-xs text-gray-500 italic">
            Dica: Você também pode me pedir para configurar o <strong>Firebase</strong>, que é o banco de dados padrão do AI Studio.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showAppInfo) {
      return (
        <Suspense fallback={<div className="fixed inset-0 bg-[#050505]" />}>
          <AppInfo onContinue={(mode) => {
            if (mode === 'signup') {
              setShowAppInfo(false);
              setShowOnboarding(true);
            } else {
              if (mode) setInitialLoginMode(mode);
              setShowAppInfo(false);
            }
          }} movies={myMovies} />
        </Suspense>
      );
    }
    if (showOnboarding) {
      return (
        <Suspense fallback={<div className="fixed inset-0 bg-[#050505]" />}>
          <OnboardingFlow
            onComplete={() => {
              setShowOnboarding(false);
              setInitialLoginMode('login');
            }}
            onBack={() => {
              setShowOnboarding(false);
              setShowAppInfo(true);
            }}
          />
        </Suspense>
      );
    }
    return <Login initialMode={initialLoginMode} movies={myMovies} />;
  }

  if (isPlansScreenOpen) {
    return (
      <ThemeContext.Provider value={{ 
        theme: currentTheme, 
        setTheme: setCurrentTheme,
        providerData
      }}>
        <div className={`bg-[#111] min-h-screen w-full font-sans selection:bg-red-600 selection:text-white ${currentTheme !== 'default' ? 'theme-active theme-' + currentTheme.toLowerCase().replace(/[^a-z]/g, '') : ''}`}>
          <PlansScreen 
            appSettings={effectiveAppSettings} 
            onClose={() => setIsPlansScreenOpen(false)} 
            onUpdatePlan={handleUpdatePlan} 
            userEmail={user?.email}
            onLogout={handleLogout}
          />
        </div>
      </ThemeContext.Provider>
    );
  }

  if (!profile && activeTab !== 'admin') {
    return <ProfileSelection onSelect={handleSelectProfile} appSettings={effectiveAppSettings} />;
  }

  if (activeTab === 'admin') {
    if (!isAdmin) return <Navigate to="/menu" replace />;
    return (
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>}>
      <AdminPanel 
        movies={myMovies}
        streamingProviders={streamingProviders}
        onClose={() => navigate('/perfil')}
        onUpdateMovie={handleUpdateMovie}
        onAddMovie={handleCreateMovie}
        onDeleteMovies={handleDeleteMovies}
        onToggleHideMovies={handleToggleHideMovies}
        onStartScanner={startScanner}
        onStartReScanner={processReScan}
        onAddStreamingProvider={handleAddStreamingProvider}
        onUpdateStreamingProvider={handleUpdateStreamingProvider}
        onDeleteStreamingProvider={handleDeleteStreamingProvider}
        onSeedProviders={seedDefaultProviders}
        onStartCollectionAutomation={startCollectionAutomation}
        onUpdateCollectionInfo={handleUpdateCollectionLogos}
        onSyncMissingLogos={handleSyncMissingMovieLogos}
        onStartLogoScan={handleLogoScan}
        onCancelLogoScan={handleCancelLogoScan}
        logoScannerState={logoScannerState}
        collectionAutomationState={collectionAutomationState}
        scannerState={scannerState}
        reScannerState={reScannerState}
        categories={categories}
        onRefreshCategoryImages={refreshCategoryImages}
        onUpdateCategoryImage={updateCategoryImage}
      />
      </Suspense>
    );
  }

  return (
    <ThemeContext.Provider value={{ 
      theme: currentTheme, 
      setTheme: setCurrentTheme,
      providerData
    }}>
      <div className={`bg-[#111] min-h-screen w-full font-sans selection:bg-red-600 selection:text-white overflow-x-hidden pb-16 md:pb-0 relative transition-colors duration-1000 ${currentTheme !== 'default' ? 'theme-active theme-' + currentTheme.toLowerCase().replace(/[^a-z]/g, '') : ''}`}>
      
      {!hasTmdbKey && (
        <div className="bg-red-600 text-white text-center py-2 text-xs font-bold fixed top-0 w-full z-[200]">
          ERRO: VITE_TMDB_API_KEY não configurada nos Secrets.
        </div>
      )}

      {!hasSupabase && (
        <div className="bg-yellow-600 text-white text-center py-1 text-[10px] font-bold fixed top-8 w-full z-[200]">
          AVISO: Supabase não configurado.
        </div>
      )}
      
      <Navbar 
        onOpenCustomUrl={() => setIsModalOpen(true)} 
        onRefresh={fetchMyMovies}
        onSwitchProfile={handleSwitchProfile}
        activeProfile={profile}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'search') setSearchQuery('');
          startTransition(() => {
            if (tab === 'search' && searchQuery) {
              navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
            } else {
              navigate(`/${tab === 'home' ? 'menu' : tab === 'profile' ? 'perfil' : tab === 'novos-eps' ? 'novos-episodios' : tab}`);
            }
          });
        }}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
        }}
        onStartReScan={startReScanner}
        scannerState={scannerState}
        reScannerState={reScannerState}
        onOpenSettings={() => setIsSettingsOpen(true)}
        showBack={location.pathname !== '/menu'}
        onBack={() => navigate(-1)}
        isAdminModalOpen={isAdminModalOpen}
        setIsAdminModalOpen={setIsAdminModalOpen}
      />
      
      <main className="relative pb-20 min-h-screen overscroll-none">
        {/* Views lazy-mount: cada tab monta só na 1ª visita, depois fica sempre na memória */}
        {/* Troca de tab = zero re-mount, zero freeze (padrão Netflix) */}
        {profile && (<>
          {mountedTabs.has('menu') && (
            <div style={{ display: activePrimaryPath === 'menu' ? 'block' : 'none' }}>
              <HomeView
                myMovies={myMovies}
                streamingProviders={streamingProviders}
                continueWatching={continueWatching}
                cinemaMovies={cinemaMovies}
                newMovies={newMovies}
                top10Movies={top10Movies}
                top10Series={top10Series}
                caraNovaMovies={caraNovaMovies}
                moviesByGenre={moviesByGenre}
                handleSelectMovie={handleSelectMovie}
                handlePlayMovie={handlePlayMovie}
                toggleMyList={toggleMyList}
                toggleFavorite={toggleFavorite}
                myListIds={myListIds}
                favoriteIds={favoriteIds}
                setViewAllGenre={(genre: string) => navigate(`/genre/${genre}`)}
                setIsModalOpen={setIsModalOpen}
                profile={profile}
                searchQuery={searchQuery}
                searchResults={searchResults}
                episodeSearchResults={episodeSearchResults}
                onEpisodePlay={handleSmartPlayEpisode}
                categories={categories}
                franchises={dynamicFranchises}
                isGlobalSearching={isGlobalSearching}
                personalizedMovies={personalizedMovies}
              />
            </div>
          )}
          {mountedTabs.has('novidades') && (
            <div style={{ display: activePrimaryPath === 'novidades' ? 'block' : 'none' }}>
              <NovidadesView
                newMovies={newMovies}
                top10Movies={top10Movies}
                top10Series={top10Series}
                myMovies={myMovies}
                handleSelectMovie={handleSelectMovie}
                toggleMyList={toggleMyList}
                myListIds={myListIds}
                profile={profile}
              />
            </div>
          )}
          {mountedTabs.has('filmes') && (
            <div style={{ display: activePrimaryPath === 'filmes' ? 'block' : 'none' }}>
              <ContentFilteredPage myMovies={visibleMovies} type="filmes" onSelectMovie={handleSelectMovie} isLoading={isLoadingMovies} newOnPlatform={newOnPlatformMovies} totalCount={totalMoviesCount} />
            </div>
          )}
          {mountedTabs.has('series') && (
            <div style={{ display: activePrimaryPath === 'series' ? 'block' : 'none' }}>
              <ContentFilteredPage myMovies={visibleMovies} type="series" onSelectMovie={handleSelectMovie} isLoading={isLoadingMovies} newOnPlatform={newOnPlatformSeries} totalCount={totalSeriesCount} />
            </div>
          )}
          {mountedTabs.has('novos-episodios') && (
            <div style={{ display: activePrimaryPath === 'novos-episodios' ? 'block' : 'none' }}>
              <NewEpisodesView myMovies={myMovies} onEpisodeClick={handleSmartPlayEpisode} onSelectMovie={handleSelectMovie} />
            </div>
          )}
          <Suspense fallback={null}>
            {mountedTabs.has('perfil') && (
              <div style={{ display: activePrimaryPath === 'perfil' ? 'block' : 'none' }}>
                <ProfileDashboard
                  profile={profile}
                  favorites={favorites}
                  myList={myList}
                  myMovies={myMovies}
                  handleSwitchProfile={handleSwitchProfile}
                  setIsAdminModalOpen={setIsAdminModalOpen}
                  handleLogout={handleLogout}
                  handleLogoutAll={handleLogoutAll}
                  navigate={navigate}
                  sendTestNotification={sendTestNotification}
                  continueWatching={continueWatching}
                  appSettings={effectiveAppSettings}
                  driveFiles={driveFiles}
                  fetchDriveFiles={fetchDriveFiles}
                  isFetchingDrive={isFetchingDrive}
                  addDriveFileToLibrary={addDriveFileToLibrary}
                  setIsSettingsOpen={setIsSettingsOpen}
                  isAdmin={isAdmin}
                  updateAppSettings={updateAppSettings}
                />
              </div>
            )}
          </Suspense>
        </>)}

        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
          <Routes location={state?.backgroundLocation || location}>
            <Route path="/" element={<Navigate to={`/menu${location.search}`} replace />} />
          
          <Route path="/redefinirsenha" element={<Login initialMode="updatePassword" />} />
          <Route path="/confirmacao" element={<Login initialMode="login" />} />
          <Route path="/invite/:inviteId" element={
            <InviteRedirect />
          } />

          <Route path="/genre/:genreName" element={
             <GenreViewWrapper 
               myMovies={myMovies} 
               moviesByGenre={moviesByGenre} 
               handleSelectMovie={handleSelectMovie} 
               navigate={navigate} 
               toggleMyList={toggleMyList}
               myList={myList}
             />
          } />
          
          <Route path="/search" element={
            <DiscoverySearchView
              onSelectMovie={handleSelectMovie}
              myMovies={myMovies}
              moviesByGenre={moviesByGenre}
              dynamicFranchises={dynamicFranchises}
              onSelectFranchise={setActiveFranchise}
              categories={categories}
              top10Movies={top10Movies}
              newMovies={newMovies}
              continueWatching={continueWatching}
              profile={profile}
              onMovieAdded={(movie) => {
                setMyMovies(prev => {
                  if (prev.some(m => m.id === movie.id)) return prev;
                  const next = [movie as Movie, ...prev];
                  try {
                    const str = JSON.stringify(next);
                    if (str.length < 4 * 1024 * 1024) localStorage.setItem('cached_my_movies_v6', str);
                  } catch {}
                  return next;
                });
              }}
            />
          } />
          <Route path="/universe" element={
            <UniverseTabView
              franchises={dynamicFranchises}
              handleSelectMovie={handleSelectMovie}
              toggleMyList={toggleMyList}
              toggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
            />
          } />
          <Route path="/universe/:franchiseId" element={
            <UniverseTabView
              franchises={dynamicFranchises}
              handleSelectMovie={handleSelectMovie}
              toggleMyList={toggleMyList}
              toggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
            />
          } />
          <Route path="/mylist" element={
            <MinhaListaPremiumView
              myList={myList}
              continueWatching={continueWatching}
              favorites={favorites}
              watchHistory={watchHistory}
              handleSelectMovie={handleSelectMovie}
              toggleMyList={toggleMyList}
              profile={profile}
            />
          } />
          <Route path="/trending" element={
            <TrendingView 
              top10Movies={top10Movies}
              top10Series={top10Series}
              handleSelectMovie={handleSelectMovie}
              toggleMyList={toggleMyList}
              toggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
              continueWatching={continueWatching}
              myMovies={myMovies}
              franchises={dynamicFranchises}
            />
          } />
          <Route path="/provider/:providerId" element={
            <ProviderViewWrapper 
              handleSelectMovie={handleSelectMovie}
              toggleMyList={toggleMyList}
              toggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
              myMovies={myMovies}
            />
          } />
          <Route path="/canais" element={
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}>
              <CanaisTVPage />
            </Suspense>
          } />

          <Route path="/novidades-flix" element={
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
              <FlixNovitiesPage onSelectMovie={handleSelectMovie} />
            </Suspense>
          } />

          <Route path="/admin2" element={
            isAdmin
              ? (
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
                  <Admin2Page navigate={navigate} />
                </Suspense>
              )
              : <Navigate to="/menu" replace />
          } />

          <Route path="/admin3" element={
            isAdmin
              ? (
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
                  <Admin3Page navigate={navigate} />
                </Suspense>
              )
              : <Navigate to="/menu" replace />
          } />

          </Routes>
        </Suspense>

        {/* Modal Routes */}
        <AnimatePresence mode="wait">
        <Suspense fallback={null}>
          <Routes location={location} key={location.pathname}>
            <Route path="/movie/:movieId" element={
              <MovieDetailRouteWrapper 
                myMovies={myMovies}
                watchHistory={watchHistory}
                handlePlayMovie={handlePlayMovie}
                closeMovieDetails={closeMovieDetails}
                toggleMyList={toggleMyList}
                toggleFavorite={toggleFavorite}
                myListIds={myListIds}
                favoriteIds={favoriteIds}
                streamingProviders={streamingProviders}
                onRequestMovie={handleRequestMovie}
                onWatchParty={(m: Movie) => setWatchPartyMovie(m)}
                top10Movies={top10Movies}
                top10Series={top10Series}
                appSettings={effectiveAppSettings}
              />
            } />
            <Route path="/watch/:movieId" element={
              <PlayerRouteWrapper 
                myMovies={myMovies}
                profile={profile}
                closePlayer={closePlayer}
                handleSelectMovie={handleSelectMovie}
                handlePlayMovie={handlePlayMovie}
                onProgress={updateProgress}
                activeRoomId={activeRoomId}
                isAppHost={isHost}
                appSettings={effectiveAppSettings}
              />
            } />
          </Routes>
        </Suspense>
        </AnimatePresence>
      </main>

      <Suspense fallback={null}>
      {isSettingsOpen && (
        <SettingsModal 
          settings={appSettings}
          onClose={() => setIsSettingsOpen(false)}
          onUpdate={setAppSettings}
        />
      )}

      {smartPlayState && (
        <SmartPlayerSelector
          movie={smartPlayState.movie}
          episodeUrl={smartPlayState.episodeUrl}
          startTime={0}
          onClose={() => setSmartPlayState(null)}
          onPlay={(url, startTime, playerStyle) => {
            const { movie, episodeIndex } = smartPlayState;
            setSmartPlayState(null);
            handlePlayMovie(movie, url, startTime, playerStyle, episodeIndex);
          }}
        />
      )}

      {watchPartyMovie && profile && (
        <WatchPartyModal
          movie={watchPartyMovie}
          profile={profile}
          onClose={() => setWatchPartyMovie(null)}
          onRoomCreated={(roomId) => {
            setActiveRoomId(roomId);
            setIsHost(true);
            navigate(`/watch/${watchPartyMovie.id}`, { state: { movie: watchPartyMovie, backgroundLocation: location.state?.backgroundLocation } });
            setWatchPartyMovie(null);
          }}
        />
      )}

      {isModalOpen && (
        <CustomUrlModal 
          onClose={() => setIsModalOpen(false)} 
          onPlay={handlePlayCustomUrl} 
          onSave={fetchMyMovies}
          onStartScanner={startScanner}
          scannerState={scannerState}
        />
      )}
      </Suspense>

        {/* Indicadores de Scanner em Segundo Plano */}
      <div className="fixed bottom-16 right-4 md:bottom-8 md:right-8 z-[150] flex flex-col gap-4 items-end pointer-events-none">
        <AnimatePresence>
        </AnimatePresence>

        {scannerState && (
          <div 
            className="bg-[#181818] border border-red-600/50 p-4 rounded-2xl shadow-2xl cursor-default hover:border-red-600 transition-all group animate-in fade-in slide-in-from-bottom-4 min-w-[280px]"
          >
            <div className="flex items-center gap-4">
              <div className="relative" onClick={() => setIsModalOpen(true)}>
                <div className="w-12 h-12 border-2 border-gray-800 rounded-full flex items-center justify-center cursor-pointer">
                  {scannerState.isScanning && !scannerState.isPaused ? (
                    <Loader2 className="text-red-600 animate-spin" size={20} />
                  ) : (
                    <Pause className="text-yellow-500" size={20} />
                  )}
                </div>
                <svg className="absolute inset-0 w-12 h-12 -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-red-600"
                    strokeDasharray={138}
                    strokeDashoffset={138 - (138 * (scannerState.total > 0 ? scannerState.current / scannerState.total : 0))}
                  />
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                    {scannerState.isScanning ? (scannerState.isPaused ? 'Scanner Pausado' : 'Scanner Drive') : 'Scanner Concluído'}
                  </span>
                  <div className="flex items-center gap-2">
                    {scannerState.isScanning && (
                      <>
                        {scannerState.isPaused ? (
                          <button onClick={resumeScanner} className="text-green-500 hover:text-green-400 transition-colors">
                            <Play size={14} />
                          </button>
                        ) : (
                          <button onClick={pauseScanner} className="text-yellow-500 hover:text-yellow-400 transition-colors">
                            <Pause size={14} />
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={stopScanner} className="text-gray-500 hover:text-white transition-colors">
                      <Square size={12} />
                    </button>
                  </div>
                </div>
                <span className="text-xs text-white font-bold truncate max-w-[180px]">{scannerState.status}</span>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex gap-2">
                    <span className="text-[9px] text-green-500">+{scannerState.added}</span>
                    <span className="text-[9px] text-yellow-500">s{scannerState.skipped}</span>
                    <span className="text-[9px] text-gray-500">{scannerState.current}/{scannerState.total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {reScannerState && (
          <div 
            className="bg-[#181818] border border-blue-600/50 p-4 rounded-2xl shadow-2xl cursor-default hover:border-blue-600 transition-all group animate-in fade-in slide-in-from-bottom-4 min-w-[280px]"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-gray-800 rounded-full flex items-center justify-center">
                  {reScannerState.isScanning && !reScannerState.isPaused ? (
                    <Sparkles className="text-blue-500 animate-pulse" size={20} />
                  ) : (
                    <Pause className="text-yellow-500" size={20} />
                  )}
                </div>
                <svg className="absolute inset-0 w-12 h-12 -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-blue-500"
                    strokeDasharray={138}
                    strokeDashoffset={138 - (138 * (reScannerState.total > 0 ? reScannerState.current / reScannerState.total : 0))}
                  />
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    {reScannerState.isScanning ? (reScannerState.isPaused ? 'Re-scan Pausado' : 'Corrigindo Info') : 'Re-scan Concluído'}
                  </span>
                  <div className="flex items-center gap-2">
                    {reScannerState.isScanning && (
                      <>
                        {reScannerState.isPaused ? (
                          <button onClick={resumeReScanner} className="text-green-500 hover:text-green-400 transition-colors">
                            <Play size={14} />
                          </button>
                        ) : (
                          <button onClick={pauseReScanner} className="text-yellow-500 hover:text-yellow-400 transition-colors">
                            <Pause size={14} />
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={stopReScanner} className="text-gray-500 hover:text-white transition-colors">
                      <Square size={12} />
                    </button>
                  </div>
                </div>
                <span className="text-xs text-white font-bold truncate max-w-[180px]">{reScannerState.status}</span>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex gap-2">
                    <span className="text-[9px] text-blue-400">u{reScannerState.updated}</span>
                    <span className="text-[9px] text-yellow-500">s{reScannerState.skipped}</span>
                    <span className="text-[9px] text-gray-500">{reScannerState.current}/{reScannerState.total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="text-gray-500 text-center py-10 border-t border-gray-800 text-sm mt-10">
        <p>&copy; 2026 Netflix Clone. Desenvolvido para fins educacionais.</p>
        <p className="mt-2">Dados fornecidos por TMDb API.</p>
      </footer>

      {/* Floating sync island — aparece quando há uma sincronização ativa fora do /admin2 */}
      <Suspense fallback={null}>
        <SyncIsland />
      </Suspense>
    </div>
  </ThemeContext.Provider>
  );
}
