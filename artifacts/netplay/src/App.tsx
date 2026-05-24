import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Banner from './components/Banner';
import Row from './components/Row';
import Login from './components/Login';
import ProfileSelection from './components/ProfileSelection';
// Lazy-load heavy components only when actually needed (huge initial bundle savings)
const VideoPlayer = React.lazy(() => import('./components/VideoPlayer'));
const CustomUrlModal = React.lazy(() => import('./components/CustomUrlModal'));
const MovieDetailsModal = React.lazy(() => import('./components/MovieDetailsModal'));
const WatchPartyModal = React.lazy(() => import('./components/WatchPartyModal'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const IntroVignette = React.lazy(() => import('./components/IntroVignette'));
const StreamingHub = React.lazy(() => import('./components/StreamingHub'));
const CollectionsCarousel = React.lazy(() => import('./components/CollectionsCarousel'));
const ContinueWatchingRow = React.lazy(() => import('./components/ContinueWatchingRow'));
const NewReleasesRow = React.lazy(() => import('./components/NewReleasesRow'));
const FlixLatestRow = React.lazy(() => import('./components/FlixLatestRow'));
const FlixNovitiesPage = React.lazy(() => import('./pages/FlixNovitiesPage'));
const CinemaRow = React.lazy(() => import('./components/CinemaRow'));
const Top10Row = React.lazy(() => import('./components/Top10Row'));
const AppInfo = React.lazy(() => import('./components/AppInfo'));
const UniverseView = React.lazy(() => import('./components/UniverseView'));
import { CATEGORIES } from './constants';
import { isDynamicRef, parseDynamicRef } from './services/terabox';
import { getSelectedServer, convertTeraboxToApi } from './components/SmartPlayerSelector';
import tmdb, { requests, getMovieLogo } from './services/tmdb';
import { notificationService } from './services/notificationService';
import { Movie, Profile, WatchHistory, ScannerState, ReScannerState, CollectionScannerState, LogoScannerState, LogoScanScope, LogoScanMode, MyList, AppSettings, Episode, StreamingProvider } from './types';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';

const AdminPanel = React.lazy(() => import('./components/admin/AdminPanel'));
const CanaisTVPage = React.lazy(() => import('./pages/CanaisTVPage'));
const ProfileDashboard = React.lazy(() => import('./components/ProfileDashboard'));
const ProviderPage = React.lazy(() => import('./components/ProviderPage'));
const AdvancedSearch = React.lazy(() => import('./components/AdvancedSearch'));
const SmartPlayerSelector = React.lazy(() => import('./components/SmartPlayerSelector'));
const TMDBCategoryCarousels = React.lazy(() => import('./components/TMDBCategoryCarousels'));
const FranchiseCarousels = React.lazy(() => import('./components/FranchiseCarousels'));

import { Loader2, Play, Pause, Square, RefreshCcw, RotateCcw, Sparkles, ChevronLeft, Plus, Search, Calendar, Heart, Settings, Cloud, TrendingUp, Home, User as UserIcon, List, ThumbsUp, Send, Bookmark, Shield, ArrowLeft, History, Zap, Ghost, CheckCircle2, ShieldCheck, LogOut, X, Star, Clock, Check, LayoutGrid, Activity, ArrowRight, UserCircle, Map as MapIcon, ListPlus, Shuffle, Info, Trophy, Tv2 } from 'lucide-react';

// Basic title cleaner to replace AI cleaning
const cleanTitle = (fileName: string) => {
  let name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
  name = name.replace(/[._]/g, ' '); // Replace dots and underscores with spaces
  name = name.replace(/S\d+E\d+/gi, ''); // Remove S01E01 etc
  name = name.replace(/1080p|720p|4k|2160p|h264|h265|x264|x265|web-dl|bluray|dual|audio|dublado/gi, ''); // Remove common torrent tags
  name = name.replace(/\(\d{4}\)/g, ''); // Remove year in parenthesis
  name = name.replace(/\[.*?\]/g, ''); // Remove everything in brackets
  return name.trim();
};

const PROVIDER_COLORS: Record<string, string> = {
  'Netflix': '#e50914',
  'Disney+': '#006e99',
  'Max': '#0047ff',
  'Prime Video': '#00a8e1',
  'Apple TV+': '#ffffff',
  'Globoplay': '#fb0d1b',
  'Paramount+': '#0064ff'
};

const FRANCHISES: { 
  id: string, 
  name: string, 
  keywords: string[], 
  color: string, 
  bg: string, 
  accent: string, 
  icon: any, 
  description: string, 
  poster?: string, 
  backdrop?: string,
  logo?: string,
  logoMovieId?: number,
  tmdbCollectionId?: number,
}[] = [
  {
    id: 'marvel', name: 'Marvel', color: '#e62429', bg: 'bg-[#0f0f0f]', accent: 'text-red-600', icon: Zap,
    description: 'O Universo Cinematográfico mais épico da história. Uma saga interligada de heróis lutando pela sobrevivência da humanidade.',
    backdrop: 'https://images.unsplash.com/photo-1534809027769-b00d750a6bac?w=1920&q=80&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Marvel_Logo.svg', logoMovieId: 299534,
    keywords: [
      'marvel', 'mcu',
      'avengers', 'vingadores', 'infinity war', 'guerra infinita', 'endgame',
      'spider-man', 'spiderman', 'homem-aranha', 'homem aranha', 'peter parker',
      'iron man', 'homem de ferro', 'tony stark',
      'thor', 'asgard', 'ragnarok', 'amor e trovão',
      'captain america', 'capitão américa', 'capitão america', 'steve rogers', 'guerra civil',
      'black panther', 'pantera negra', 'wakanda',
      'guardians of the galaxy', 'guardiões da galáxia', 'guardioes da galaxia',
      'x-men', 'x men', 'mutantes', 'xavier',
      'doctor strange', 'doutor estranho', 'multiverse',
      'black widow', 'viúva negra', 'viuda negra', 'natasha',
      'hawkeye', 'gavião arqueiro', 'olho de falcão',
      'ant-man', 'homem-formiga', 'homem formiga', 'scott lang',
      'eternals', 'eternos',
      'shang-chi', 'shang chi',
      'loki', 'wandavision', 'wanda', 'scarlet witch', 'feiticeira escarlate',
      'moon knight', 'cavaleiro da lua',
      'she-hulk', 'ms. marvel', 'ms marvel',
      'deadpool', 'wolverine',
      'hulk', 'bruce banner',
      'nick fury', 'shield', 's.h.i.e.l.d.',
      'thor: ragnarok', 'thor: o mundo sombrio', 'thor: amor',
      'pantera negra: wakanda', 'doutor estranho no multiverso',
      'captain marvel', 'capitã marvel',
      'what if', 'secret invasion',
    ],
  },
  {
    id: 'star-wars', name: 'Star Wars', color: '#ffe81f', bg: 'bg-black', accent: 'text-yellow-400', icon: Ghost,
    description: 'Uma galáxia muito, muito distante... A eterna luta entre a Luz e o Lado Sombrio.',
    backdrop: 'https://images.unsplash.com/photo-1506443432602-ac2fcd6f54e0?w=1920&q=90&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Star_Wars_Logo.svg', logoMovieId: 11, tmdbCollectionId: 10,
    keywords: [
      'star wars', 'guerra nas estrelas',
      'mandalorian', 'the mandalorian',
      'obi-wan', 'obi wan', 'kenobi',
      'skywalker', 'jedi', 'sith',
      'andor', 'rogue one',
      'darth vader', 'dark vader', 'palpatine',
      'yoda', 'clone wars', 'the clone wars',
      'bad batch', 'ahsoka', 'ashoka',
      'force awakens', 'despertar da força',
      'last jedi', 'últimos jedi',
      'rise of skywalker', 'ascensão skywalker',
      'phantom menace', 'ameaça fantasma',
      'attack of the clones', 'ataque dos clones',
      'revenge of the sith', 'vingança dos sith',
    ],
  },
  {
    id: 'dc', name: 'DC Comics', color: '#0476f2', bg: 'bg-[#000d1a]', accent: 'text-blue-500', icon: Shield,
    description: 'Onde nascem as lendas. De Gotham a Metrópolis, os maiores vigilantes do multiverso protegem a justiça.',
    backdrop: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=1920&q=80&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/DC_Comics_logo.svg', logoMovieId: 297762,
    keywords: [
      'dc comics', 'dc universe', 'dceu',
      'batman', 'bruce wayne', 'gotham', 'knight', 'cavaleiro',
      'superman', 'clark kent', 'metropolis', 'homem de aço', 'man of steel',
      'wonder woman', 'mulher-maravilha', 'mulher maravilha', 'diana prince',
      'justice league', 'liga da justiça',
      'aquaman', 'arthur curry',
      'the flash', 'o flash', 'flash', 'barry allen',
      'joker', 'coringa',
      'shazam',
      'suicide squad', 'esquadrão suicida', 'esquadrao suicida',
      'birds of prey', 'aves de rapina',
      'cyborg', 'green lantern', 'lanterna verde',
      'black adam', 'adão negro',
      'blue beetle', 'besouro azul',
      'harley quinn',
    ],
  },
  {
    id: 'harry-potter', name: 'Harry Potter', color: '#ffd700', bg: 'bg-[#0a0a0c]', accent: 'text-yellow-500', icon: Sparkles,
    description: 'A magia vive aqui. Entre no mundo bruxo e descubra os segredos de Hogwarts.',
    backdrop: 'https://images.unsplash.com/photo-1481026469463-66327c86e544?w=1920&q=80&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Harry_Potter_wordmark.svg', logoMovieId: 671, tmdbCollectionId: 1241,
    keywords: [
      'harry potter', 'hogwarts',
      'pedra filosofal', 'philosopher\'s stone', 'sorcerer\'s stone',
      'câmara secreta', 'chamber of secrets',
      'prisioneiro de azkaban', 'prisoner of azkaban', 'azkaban',
      'cálice de fogo', 'goblet of fire',
      'ordem da fênix', 'order of the phoenix',
      'enigma do príncipe', 'half-blood prince',
      'relíquias da morte', 'deathly hallows',
      'animais fantásticos', 'fantastic beasts',
      'voldemort', 'hermione', 'dumbledore', 'malfoy', 'sirius', 'snape',
    ],
  },
  {
    id: 'lord-of-the-rings', name: 'Terra Média', color: '#9d7b3c', bg: 'bg-[#0f0e0d]', accent: 'text-[#d4af37]', icon: History,
    description: 'A jornada épica de Tolkien pela Terra Média. Três anéis para os Reis-Elfos...',
    backdrop: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=90&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/22/The_Lord_of_the_Rings_logo.svg', logoMovieId: 120, tmdbCollectionId: 119,
    keywords: [
      'senhor dos anéis', 'lord of the rings',
      'hobbit', 'shire', 'anel do poder', 'rings of power',
      'sociedade do anel', 'fellowship',
      'duas torres', 'two towers',
      'retorno do rei', 'return of the king',
      'tolkien', 'gandalf', 'frodo', 'aragorn', 'legolas', 'bilbo',
    ],
  },
  {
    id: 'fast-furious', name: 'Velozes & Furiosos', color: '#d00', bg: 'bg-[#0a0a0a]', accent: 'text-red-700', icon: Zap,
    description: 'Velocidade, família e adrenalina pura.',
    backdrop: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=90&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Fast_%26_Furious_logo.png', logoMovieId: 168259, tmdbCollectionId: 9485,
    keywords: [
      'velozes e furiosos', 'velozes & furiosos',
      'fast & furious', 'fast and furious', 'furious',
      'toretto', 'vin diesel', 'hobbs', 'shaw',
      'fast five', 'fast six', 'fast seven', 'f9',
      'velocidade furiosa',
    ],
  },
  {
    id: 'jurassic', name: 'Jurassic Park', color: '#22c55e', bg: 'bg-[#051a05]', accent: 'text-green-400', icon: Zap,
    description: 'A vida encontra um jeito. Dinossauros voltam a dominar a Terra.',
    backdrop: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=90&fit=crop',
    logo: undefined, logoMovieId: 329, tmdbCollectionId: 328,
    keywords: [
      'jurassic park', 'jurassic world', 'jurassic',
      'parque dos dinossauros', 'mundo dos dinossauros',
      'dinossauro', 'dinosaur',
      'velociraptor', 't-rex',
    ],
  },
  {
    id: 'mission-impossible', name: 'Missão Impossível', color: '#ff4500', bg: 'bg-[#1a0500]', accent: 'text-orange-500', icon: Zap,
    description: 'A missão, caso decida aceitá-la...',
    backdrop: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&q=80&fit=crop',
    logo: undefined, logoMovieId: 954, tmdbCollectionId: 87359,
    keywords: [
      'missão impossível', 'mission impossible', 'mission: impossible',
      'ethan hunt', 'imf',
    ],
  },
  {
    id: 'john-wick', name: 'John Wick', color: '#ffd700', bg: 'bg-[#0a0a00]', accent: 'text-yellow-400', icon: Zap,
    description: 'O boogey man. Ninguém escapa de John Wick.',
    backdrop: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&q=80&fit=crop',
    logo: undefined, logoMovieId: 245891, tmdbCollectionId: 404609,
    keywords: ['john wick', 'baba yaga', 'high table', 'keanu reeves'],
  },
  {
    id: 'transformers', name: 'Transformers', color: '#f59e0b', bg: 'bg-[#1a1000]', accent: 'text-yellow-500', icon: Zap,
    description: 'Autobots, rollout!',
    backdrop: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=90&fit=crop',
    logo: undefined, logoMovieId: 1858, tmdbCollectionId: 8650,
    keywords: ['transformers', 'autobots', 'decepticons', 'optimus prime', 'megatron', 'bumblebee'],
  },
  {
    id: 'matrix', name: 'Matrix', color: '#00ff41', bg: 'bg-[#000a00]', accent: 'text-green-400', icon: Sparkles,
    description: 'Bem-vindo ao deserto do real.',
    backdrop: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=90&fit=crop',
    logo: undefined, logoMovieId: 603, tmdbCollectionId: 2344,
    keywords: ['matrix', 'neo', 'morpheus', 'trinity', 'agente smith', 'the one', 'o escolhido', 'ressurreições'],
  },
  {
    id: 'pirates', name: 'Piratas do Caribe', color: '#8b6914', bg: 'bg-[#0a0800]', accent: 'text-yellow-700', icon: MapIcon,
    description: 'Por quê é o rum que acaba sempre?',
    backdrop: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=90&fit=crop',
    logo: undefined, logoMovieId: 22, tmdbCollectionId: 295,
    keywords: ['piratas do caribe', 'pirates of the caribbean', 'jack sparrow', 'davy jones', 'black pearl'],
  },
  {
    id: 'indiana-jones', name: 'Indiana Jones', color: '#d4a017', bg: 'bg-[#1a1000]', accent: 'text-yellow-600', icon: MapIcon,
    description: 'Aventuras arqueológicas no limite da história.',
    backdrop: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=90&fit=crop',
    logo: undefined, logoMovieId: 89, tmdbCollectionId: 84,
    keywords: ['indiana jones', 'indy', 'dr. jones', 'raiders of the lost ark', 'em busca da arca perdida', 'templo da perdição', 'última cruzada'],
  },
  {
    id: 'disney', name: 'Disney Clássicos', color: '#009dff', bg: 'bg-[#000a1a]', accent: 'text-blue-300', icon: Sparkles,
    description: 'Onde os sonhos se tornam realidade. Clássicos atemporais que moldaram gerações.',
    backdrop: 'https://images.unsplash.com/photo-1605487903301-a1e109c44e53?w=1920&q=90&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', logoMovieId: 109445,
    keywords: [
      'rei leão', 'lion king', 'simba', 'mufasa',
      'aladdin', 'genio',
      'pequena sereia', 'little mermaid', 'ariel',
      'bela e a fera', 'beauty and the beast', 'belle',
      'cinderela', 'cinderella',
      'branca de neve', 'snow white',
      'pinóquio', 'pinocchio',
      'frozen', 'elsa', 'anna', 'olaf',
      'moana', 'vaiana',
      'encanto',
      'raya', 'luca',
      'bambi', 'dumbo',
      'mulan', 'hua mulan',
      'pocahontas',
      'hercules', 'hércules',
      'tarzan',
      'fantasia',
      'alice no país', 'alice in wonderland',
      'peter pan',
      'a bela adormecida', 'sleeping beauty',
    ],
  },
  {
    id: 'pixar', name: 'Pixar', color: '#00aae4', bg: 'bg-[#00121a]', accent: 'text-blue-400', icon: Sparkles,
    description: 'Imaginação sem limites em cada frame. Histórias que tocam o coração.',
    backdrop: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=90&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Pixar_logo.svg', logoMovieId: 862,
    keywords: [
      'toy story', 'woody', 'buzz lightyear',
      'procurando nemo', 'finding nemo', 'procurando dory', 'finding dory',
      'monstros s.a', 'monstros sa', 'monsters inc', 'monsters university',
      'carros', 'cars', 'mcqueen', 'lightning mcqueen',
      'divertida mente', 'inside out',
      'coco', 'viva a vida',
      'up: altas aventuras', 'up altas', 'carl e russell',
      'wall-e', 'wall·e', 'eve',
      'ratatouille', 'remy',
      'valente', 'brave', 'merida',
      'os incríveis', 'the incredibles', 'família parr',
      'soul', 'joe gardner',
      'luca',
      'turning red', 'eu me transformo em panda', 'virada vermelha',
      'lightyear',
      'elemental',
    ],
  },
  {
    id: 'dreamworks', name: 'DreamWorks', color: '#a3c9f7', bg: 'bg-[#00091a]', accent: 'text-blue-200', icon: Sparkles,
    description: 'Animações para todas as idades.',
    backdrop: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=90&fit=crop',
    logo: undefined, logoMovieId: 809,
    keywords: [
      'shrek', 'fiona', 'burro', 'donkey', 'puss in boots', 'gato de botas',
      'kung fu panda', 'po',
      'como treinar seu dragão', 'how to train your dragon', 'soluço',
      'madagascar', 'alex o leão',
      'bee movie', 'megamente', 'megamind',
      'a origem dos guardiões', 'rise of the guardians',
      'abominável', 'abominable',
      'bad guys',
    ],
  },
  {
    id: 'horror', name: 'Terror & Horror', color: '#ff0000', bg: 'bg-[#050000]', accent: 'text-red-600', icon: Ghost,
    description: 'Enfrente seus maiores medos.',
    backdrop: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1920&q=90&fit=crop', logoMovieId: 436270,
    keywords: [
      'halloween', 'pânico', 'scream',
      'invocação do mal', 'conjuring', 'annabelle', 'nun', 'irmã',
      'it a coisa', 'it: a coisa', 'pennywise',
      'sexta-feira 13', 'friday the 13th', 'jason',
      'terror', 'horror', 'sobrenatural', 'supernatural',
      'saw', 'jogos mortais',
      'sinister', 'oculus',
      'paranormal activity', 'atividade paranormal',
      'insidious', 'insidiosa',
      'the ring', 'o chamado',
      'freddy krueger', 'nightmare',
      'chucky', 'brinquedo assassino',
    ],
  },
  {
    id: 'anime', name: 'Anime & Mangá', color: '#ff6600', bg: 'bg-[#1a0f00]', accent: 'text-orange-500', icon: Zap,
    description: 'A arte e a cultura japonesa em sua forma mais vibrante.',
    backdrop: 'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1920&q=90&fit=crop',
    keywords: [
      'dragon ball', 'goku', 'vegeta', 'super sayajin',
      'naruto', 'sasuke', 'kakashi', 'hokage', 'boruto',
      'one piece', 'luffy', 'pirata', 'chapéu de palha',
      'bleach', 'ichigo', 'shinigami',
      'attack on titan', 'ataque dos titãs',
      'demon slayer', 'kimetsu no yaiba', 'caçador de demônios',
      'fullmetal alchemist', 'alquimista de aço',
      'death note',
      'my hero academia', 'boku no hero',
      'jujutsu kaisen',
      'sword art online', 'sao',
      'evangelion', 'neon genesis',
      'hunter x hunter',
      'fairy tail',
      'black clover',
      'anime', 'mangá', 'manga',
    ],
  },
  {
    id: 'national', name: 'National Geographic', color: '#ffcc00', bg: 'bg-[#1a1600]', accent: 'text-yellow-500', icon: Sparkles,
    description: 'Explorando nosso mundo misterioso e as maravilhas da natureza.',
    backdrop: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=90&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/National_Geographic_logo_text.svg',
    keywords: ['cosmos', 'natureza', 'ocean', 'oceano', 'planeta', 'national geographic', 'vida selvagem', 'wildlife'],
  },
  {
    id: 'adventure', name: 'Aventura', color: '#22c55e', bg: 'bg-[#061a0f]', accent: 'text-green-500', icon: MapIcon,
    description: 'Grandes jornadas em terras desconhecidas.',
    backdrop: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=90&fit=crop', logoMovieId: 89,
    keywords: ['aventura', 'adventure', 'exploração', 'expedition', 'journey', 'jumanji', 'zathura'],
  },
];

// Theme Context for immersive provider experience
const ThemeContext = createContext<{ 
  theme: string; 
  setTheme: (t: string) => void; 
  providerData: any;
}>({ 
  theme: 'default', 
  setTheme: () => {}, 
  providerData: null 
});

export const useAppTheme = () => useContext(ThemeContext);

const NewEpisodesView = React.memo(({ myMovies, onEpisodeClick, onSelectMovie }: any) => {
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const [heroIdx, setHeroIdx] = React.useState(0);
  const [expandedCard, setExpandedCard] = React.useState<number | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('Todos');
  const heroTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const dynamicScrollRef = React.useRef<HTMLDivElement>(null);

  const formatRelativeDate = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = now - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (hours < 1) return 'Agora';
    if (hours < 24) return `Há ${hours}h`;
    if (days === 1) return 'Ontem';
    return `Há ${days}d`;
  };

  const getBackdropUrl = (movie: any, w = 500) =>
    movie.backdrop_path
      ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w${w}/${movie.backdrop_path}`)
      : movie.poster_path
        ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w${w}/${movie.poster_path}`)
        : '';

  const getPosterUrl = (movie: any) =>
    movie.poster_path
      ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`)
      : '';

  const getLogoUrl = (movie: any) =>
    movie.logo_path
      ? (movie.logo_path.startsWith('http') ? movie.logo_path : `https://image.tmdb.org/t/p/w185/${movie.logo_path}`)
      : null;

  const getRecentDate = (m: any): number => {
    const c = m.created_at ? new Date(m.created_at).getTime() : 0;
    const u = m.updated_at ? new Date(m.updated_at).getTime() : 0;
    return Math.max(c, u);
  };

  const allRecent = useMemo(() =>
    myMovies
      .filter((m: any) => (now - getRecentDate(m)) <= SIXTY_DAYS_MS)
      .sort((a: any, b: any) => getRecentDate(b) - getRecentDate(a)),
    [myMovies]);

  const latestSeries = useMemo(() => allRecent.filter((m: any) => m.type === 'series'), [allRecent]);
  const latestMovies = useMemo(() => allRecent.filter((m: any) => m.type !== 'series'), [allRecent]);

  // Destaques: mix of series + movies, top 6
  const destaques = useMemo(() => allRecent.slice(0, 6), [allRecent]);

  // Story circles: top 10 from all recent (prefer series)
  const storyItems = useMemo(() => allRecent.slice(0, 10), [allRecent]);

  // Dynamic cards: series only, sorted by most recent
  const dynamicItems = useMemo(() => latestSeries.slice(0, 20), [latestSeries]);

  // Recomendados: movies, sorted randomly-ish
  const recomendados = useMemo(() => latestMovies.slice(0, 12), [latestMovies]);

  // Saindo em breve: oldest items (simulate)
  const saiindoBreve = useMemo(() =>
    [...myMovies].sort((a: any, b: any) => getRecentDate(a) - getRecentDate(b)).slice(0, 8),
    [myMovies]);

  // Search + filter
  const FILTERS = ['Todos', 'Séries', 'Filmes', 'Animes', 'Ação', 'Drama'];
  const filteredSearch = useMemo(() => {
    if (!searchText && activeFilter === 'Todos') return [];
    return allRecent.filter((m: any) => {
      const name = (m.title || m.name || '').toLowerCase();
      const matchSearch = !searchText || name.includes(searchText.toLowerCase());
      const matchFilter = activeFilter === 'Todos' ? true
        : activeFilter === 'Séries' ? m.type === 'series'
        : activeFilter === 'Filmes' ? m.type !== 'series'
        : (m.genres || m.genre || '').toLowerCase().includes(activeFilter.toLowerCase());
      return matchSearch && matchFilter;
    });
  }, [searchText, activeFilter, allRecent]);

  // Hero rotation
  React.useEffect(() => {
    if (destaques.length <= 1) return;
    heroTimerRef.current = setInterval(() => setHeroIdx(i => (i + 1) % Math.min(destaques.length, 6)), 5000);
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [destaques.length]);

  const goHero = (i: number) => {
    setHeroIdx(i);
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => setHeroIdx(x => (x + 1) % Math.min(destaques.length, 6)), 5000);
  };

  const heroItem = destaques[heroIdx] as any;

  if (myMovies.length === 0) return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-2">
        <Sparkles size={28} className="text-white/20" />
      </div>
      <p className="text-white font-black text-lg uppercase tracking-widest">Nenhuma novidade</p>
      <p className="text-gray-600 text-xs max-w-xs">Filmes e séries novos aparecerão aqui assim que forem adicionados ao catálogo.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-32">

      {/* ── DESTAQUES ── */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-white font-black text-base tracking-tight mb-3">Destaques</h2>

        {heroItem && (
          <div className="relative rounded-2xl overflow-hidden">
            {/* Card carousel */}
            <AnimatePresence mode="wait">
              <motion.div
                key={heroItem.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative aspect-video cursor-pointer"
                onClick={() => onSelectMovie && onSelectMovie(heroItem)}
              >
                <img
                  src={getBackdropUrl(heroItem, 780)}
                  alt={heroItem.title || heroItem.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {/* Top row */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                  <span className="bg-red-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-widest shadow">
                    {heroItem.type === 'series' ? 'Nova Série' : 'Novo Filme'}
                  </span>
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-white/70 text-[8px] font-bold">Disponível</span>
                  </div>
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12">
                  {getLogoUrl(heroItem) ? (
                    <img src={getLogoUrl(heroItem)!} alt="" className="h-10 object-contain object-left drop-shadow-2xl mb-2 max-w-[180px]" referrerPolicy="no-referrer" decoding="async" />
                  ) : (
                    <p className="text-white font-black text-lg leading-tight drop-shadow-2xl mb-2 line-clamp-1">{heroItem.title || heroItem.name}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {heroItem.vote_average > 0 && (
                      <span className="text-yellow-400 text-[10px] font-black">★ {heroItem.vote_average.toFixed(1)}</span>
                    )}
                    {heroItem.type === 'series' && heroItem.episodes?.length > 0 && (
                      <span className="text-white/50 text-[9px] font-bold">{heroItem.episodes.length} ep.</span>
                    )}
                    <span className="text-white/40 text-[9px] font-bold">{formatRelativeDate(heroItem.updated_at || heroItem.created_at)}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dot indicators */}
            {destaques.length > 1 && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                {destaques.slice(0, 6).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goHero(i)}
                    className={`rounded-full transition-all duration-300 ${i === heroIdx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thumbnail strip below hero */}
        {destaques.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
            {destaques.slice(0, 6).map((m: any, i: number) => (
              <button
                key={m.id}
                onClick={() => goHero(i)}
                className={`flex-none relative rounded-xl overflow-hidden transition-all duration-200 ${i === heroIdx ? 'ring-2 ring-red-600 opacity-100' : 'opacity-40 hover:opacity-70'}`}
                style={{ width: 72, height: 44 }}
              >
                <img
                  src={getBackdropUrl(m, 300)}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                {m.title || m.name ? null : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── STORY STYLE ── */}
      {storyItems.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div className="mb-3">
            <h2 className="text-white font-black text-base tracking-tight">Atualizado Recentemente</h2>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">Últimas adições ao catálogo</p>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {storyItems.map((m: any, i: number) => (
              <button
                key={m.id}
                onClick={() => onSelectMovie && onSelectMovie(m)}
                className="flex-none flex flex-col items-center gap-1.5"
              >
                <div className={`w-[62px] h-[62px] rounded-2xl overflow-hidden border-2 ${i < 3 ? 'border-red-600' : 'border-white/10'} shadow-lg`}>
                  <img
                    src={getPosterUrl(m) || getBackdropUrl(m, 185)}
                    alt={m.title || m.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
                <span className="text-[8px] text-gray-400 font-bold w-[62px] text-center truncate leading-tight">
                  {(m.title || m.name || '').split(':')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── DYNAMIC SERIES ── */}
      {dynamicItems.length > 0 && (
        <div className="pt-4 pb-2">
          <div className="px-4 mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-white font-black text-base tracking-tight">Séries em Destaque</h2>
              <p className="text-gray-500 text-[10px] font-medium mt-0.5">Séries com novos episódios</p>
            </div>
            <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">{dynamicItems.length} séries</span>
          </div>
          <div
            ref={dynamicScrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2"
          >
            {dynamicItems.map((movie: any, i: number) => {
              const maxSeason = movie.episodes?.reduce((mx: number, ep: any) => Math.max(mx, ep.season || 0), 0) || 0;
              const epCount = movie.episodes?.length || 0;
              const isExpanded = expandedCard === movie.id;
              const hoursAgo = Math.floor((now - getRecentDate(movie)) / (60 * 60 * 1000));
              const relDate = formatRelativeDate(movie.updated_at || movie.created_at);
              return (
                <div
                  key={movie.id}
                  className={`flex-none transition-all duration-300 ${isExpanded ? 'w-[240px]' : 'w-[140px]'}`}
                >
                  {/* Card image */}
                  <div
                    className="relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border border-white/[0.06] hover:border-white/20 transition-all"
                    onClick={() => setExpandedCard(isExpanded ? null : movie.id)}
                  >
                    <img
                      src={getPosterUrl(movie) || getBackdropUrl(movie)}
                      alt={movie.title || movie.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    {/* NOVO badge */}
                    <div className="absolute top-2 left-2">
                      <span className="bg-red-600 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest">NOVO</span>
                    </div>

                    {/* Time badge */}
                    <div className="absolute top-2 right-2">
                      <span className="bg-[#1a2a3a] text-sky-300 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wide border border-sky-900/40">{relDate}</span>
                    </div>

                    {/* Rating */}
                    {movie.vote_average > 0 && (
                      <div className="absolute bottom-2 right-2">
                        <span className="bg-black/70 backdrop-blur-sm text-yellow-400 text-[8px] font-black px-1.5 py-0.5 rounded-lg">
                          {movie.vote_average.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info below card */}
                  <div className="mt-2 px-0.5">
                    {getLogoUrl(movie) ? (
                      <img src={getLogoUrl(movie)!} alt="" className="h-4 object-contain object-left mb-1 max-w-[120px]" referrerPolicy="no-referrer" decoding="async" />
                    ) : (
                      <p className="text-white font-black text-[11px] leading-tight line-clamp-1 mb-0.5">{movie.title || movie.name}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-bold mb-1.5">
                      {maxSeason > 0 && <span>{maxSeason} TEMP.</span>}
                      {epCount > 0 && <span>{epCount} EP.</span>}
                    </div>

                    {/* Expanded info */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {movie.overview && (
                          <p className="text-gray-400 text-[9px] leading-relaxed line-clamp-3 mb-2">{movie.overview}</p>
                        )}
                        <button
                          onClick={() => { onSelectMovie && onSelectMovie(movie); setExpandedCard(null); }}
                          className="w-full flex items-center justify-center gap-1.5 bg-white/8 hover:bg-white/15 border border-white/10 hover:border-white/25 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl transition-all"
                        >
                          <Play size={10} fill="white" /> Ver Episódios
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RECOMENDADOS ── */}
      {recomendados.length > 0 && (
        <div className="pt-4 pb-2">
          <div className="px-4 mb-3">
            <h2 className="text-white font-black text-base tracking-tight">Filmes Recentes</h2>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">Adicionados ao catálogo</p>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
            {recomendados.map((movie: any, i: number) => (
              <div
                key={movie.id}
                className="flex-none w-[110px] cursor-pointer"
                onClick={() => onEpisodeClick(movie, movie.videoUrl || '', 0)}
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-red-600/40 transition-all">
                  <img
                    src={getPosterUrl(movie) || getBackdropUrl(movie)}
                    alt={movie.title || movie.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-2 left-2">
                    <span className="bg-red-600 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest">NOVO</span>
                  </div>
                  {movie.vote_average > 0 && (
                    <div className="absolute bottom-2 right-2">
                      <span className="bg-black/70 text-yellow-400 text-[7px] font-black px-1 py-0.5 rounded">★ {movie.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 px-0.5">
                  <p className="text-white text-[9px] font-black leading-tight line-clamp-1">{movie.title || movie.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base">🔥</span>
                    <span className="text-base">❤️</span>
                    <span className="text-base">👍</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SEARCH + FILTERS ── */}
      <div className="px-4 pt-5 pb-2">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-2xl pl-9 pr-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                activeFilter === f
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Search results */}
      {(searchText || activeFilter !== 'Todos') && (
        <div className="px-4 pt-3 pb-2">
          {filteredSearch.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8 font-bold uppercase tracking-widest">Nenhum resultado</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredSearch.slice(0, 18).map((movie: any) => (
                <div
                  key={movie.id}
                  className="cursor-pointer"
                  onClick={() => onSelectMovie && onSelectMovie(movie)}
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/[0.06]">
                    <img
                      src={getPosterUrl(movie) || getBackdropUrl(movie)}
                      alt={movie.title || movie.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <p className="text-white/80 text-[9px] font-bold mt-1 line-clamp-1 leading-tight">{movie.title || movie.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SAINDO EM BREVE ── */}
      {saiindoBreve.length > 0 && !searchText && activeFilter === 'Todos' && (
        <div className="pt-4 pb-2">
          <div className="px-4 mb-3">
            <h2 className="text-white font-black text-base tracking-tight">Saindo em Breve</h2>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">Última chance de assistir</p>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
            {saiindoBreve.map((movie: any, i: number) => (
              <div
                key={movie.id}
                className="flex-none w-[140px] cursor-pointer"
                onClick={() => onSelectMovie && onSelectMovie(movie)}
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/[0.06] hover:border-orange-500/40 transition-all">
                  <img
                    src={getBackdropUrl(movie) || getPosterUrl(movie)}
                    alt={movie.title || movie.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute top-2 left-2">
                    <span className="bg-red-600/90 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wide border border-red-400/30">
                      {`${Math.max(3, 7 - i)} dias restantes`}
                    </span>
                  </div>
                  <p className="absolute bottom-2 left-2 right-2 text-white text-[8px] font-black line-clamp-1 leading-tight">{movie.title || movie.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const ContentFilteredPage = React.memo(({ myMovies, type, onSelectMovie, isLoading }: { myMovies: Movie[]; type: 'filmes' | 'series'; onSelectMovie: (m: Movie) => void; isLoading?: boolean }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedGenre, setSelectedGenre] = React.useState('');

  const filtered = React.useMemo(() => {
    let items = type === 'series'
      ? myMovies.filter((m: any) => m.type === 'series')
      : myMovies.filter((m: any) => m.type === 'movie' || (!m.type && m.type !== 'series'));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((m: any) => ((m.title || m.name || '')).toLowerCase().includes(q));
    }
    if (selectedGenre) {
      items = items.filter((m: any) => (m.genres || '').toLowerCase().includes(selectedGenre.toLowerCase()));
    }
    return items;
  }, [myMovies, type, searchQuery, selectedGenre]);

  const genres = React.useMemo(() => {
    const all = myMovies
      .filter((m: any) => type === 'series' ? m.type === 'series' : m.type === 'movie' || !m.type)
      .flatMap((m: any) => (m.genres || '').split(',').map((g: string) => g.trim()))
      .filter(Boolean);
    return [...new Set(all)].sort().slice(0, 14) as string[];
  }, [myMovies, type]);

  const label = type === 'series' ? 'Séries' : 'Filmes';

  return (
    <div className="min-h-screen bg-[#111] text-white pb-32 pt-20 md:pt-28">
      <div className="px-5 md:px-12 max-w-[1920px] mx-auto">
        <div className="flex items-end gap-4 mb-8">
          <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter text-white leading-none">{label}</h1>
          <span className="text-gray-600 font-black uppercase tracking-widest text-xs mb-2">{isLoading ? 'Carregando...' : `${filtered.length} títulos`}</span>
        </div>

        <div className="flex flex-col gap-3 mb-8">
          <div className="relative max-w-lg">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}...`}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-10 text-sm font-bold text-white placeholder-gray-600 outline-none focus:border-red-600 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={15} />
              </button>
            )}
          </div>
          {genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {genres.map((genre: string) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${selectedGenre === genre ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5">
            {filtered.map((m: any, idx: number) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.025, 0.4) }}
                className="group cursor-pointer"
                onClick={() => onSelectMovie(m)}
              >
                <div className="aspect-[2/3] rounded-2xl overflow-hidden relative border border-white/5 group-hover:border-red-600/50 transition-all shadow-xl">
                  <img
                    src={m.poster_path ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w342${m.poster_path}`) : (m.backdrop_path ? `https://image.tmdb.org/t/p/w342${m.backdrop_path}` : 'https://via.placeholder.com/342x513?text=Sem+Poster')}
                    alt={m.title || m.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                    <p className="text-white font-black text-xs uppercase leading-tight truncate">{m.title || m.name}</p>
                    {m.vote_average ? <p className="text-yellow-400 text-[9px] font-bold mt-0.5">★ {(m.vote_average as number).toFixed(1)}</p> : null}
                  </div>
                  {m.type === 'series' && type === 'series' && (
                    <div className="absolute top-2 right-2 bg-red-600/80 px-1.5 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-widest">Série</div>
                  )}
                </div>
                <p className="text-gray-400 text-[10px] font-bold mt-2 truncate group-hover:text-white transition-colors leading-tight">{m.title || m.name}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Search size={40} className="text-gray-700" />
            </div>
            <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Nenhum conteúdo encontrado</p>
            {searchQuery && <button onClick={() => setSearchQuery('')} className="mt-6 px-8 py-3 bg-red-600 rounded-full font-black uppercase text-[10px] tracking-widest">Limpar busca</button>}
          </div>
        )}
      </div>
    </div>
  );
});

const HomeView = React.memo(({ 
  myMovies, 
  streamingProviders, 
  continueWatching, 
  newMovies, 
  top10Movies, 
  top10Series, 
  caraNovaMovies, 
  moviesByGenre, 
  handleSelectMovie, 
  handlePlayMovie,
  toggleMyList, 
  toggleFavorite, 
  myListIds, 
  favoriteIds, 
  setViewAllGenre, 
  setIsModalOpen, 
  profile,
  cinemaMovies,
  searchQuery,
  searchResults,
  episodeSearchResults,
  onEpisodePlay,
  categories,
  franchises
}: any) => {
  const navigate = useNavigate();
  
  const bannerMovies = useMemo(() => {
    if (myMovies.length === 0) return [];
    // Combine some new releases, top movies and random ones for the rotating banner
    const pool = [...newMovies, ...top10Movies, ...myMovies.slice(0, 20)];
    return [...new Set(pool)].sort(() => 0.5 - Math.random()).slice(0, 10);
  }, [myMovies, newMovies, top10Movies]);

  const franchiseToMovie = (f: any) => ({
    ...f,
    title: f.name,
    poster_path: f.poster || f.backdrop || f.logo,
    backdrop_path: f.backdrop || f.poster,
    logo_path: f.logo,
    overview: f.description,
    type: 'franchise',
    isFranchise: true
  });

  const franchiseMovies = useMemo(() => {
    return franchises.map(franchiseToMovie);
  }, [franchises]);

  const top10Franchises = useMemo(() => {
    return franchiseMovies.slice(0, 10);
  }, [franchiseMovies]);

  const animationFranchises = useMemo(() => {
    return franchiseMovies.filter(f => 
      f.id === 'disney' || f.id === 'pixar' || f.name.toLowerCase().includes('anime')
    );
  }, [franchiseMovies]);

  // Optimize and randomize movies per user per session to speed up rendering
  const optimizedGenreMovies = useMemo(() => {
    const optimized: Record<string, any[]> = {};
    for (const [genre, movies] of Object.entries(moviesByGenre as Record<string, any[]>)) {
      // Randomize and slice to 10 for massive performance boost
      optimized[genre] = [...movies].sort(() => 0.5 - Math.random()).slice(0, 10);
    }
    return optimized;
  }, [moviesByGenre, profile?.id]);

  if (searchQuery) {
    return (
      <div
        key="search-mode"
        className="pt-24 px-4 md:px-12 min-h-screen animate-fade-in"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter">Resultados para: <span className="text-red-600">"{searchQuery}"</span></h2>
          <div className="flex items-center gap-4">
             <span className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 italic">
               {searchResults.length} Títulos Encontrados
             </span>
          </div>
        </div>

        {searchResults.length === 0 && (!episodeSearchResults || episodeSearchResults.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white/[0.02] rounded-[4rem] border-2 border-dashed border-white/5">
            <Search className="text-gray-800 mb-8 animate-float" size={80} />
            <h3 className="text-3xl font-black text-white italic uppercase mb-2">Sem resultados na biblioteca</h3>
            <p className="text-gray-500 font-bold max-w-sm text-center">Tente buscar por termos mais genéricos ou use a Busca Premium.</p>
            <button 
              onClick={() => navigate('/search')}
              className="mt-10 px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest italic hover:scale-105 transition-all shadow-xl"
            >
              Ir para Busca Premium
            </button>
          </div>
        ) : (
          <>
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-10">
                {searchResults.map((movie: any) => (
                  <div
                    key={movie.id}
                    className="relative cursor-pointer group hover:-translate-y-2 transition-transform animate-fade-in"
                    onClick={() => handleSelectMovie(movie)}
                  >
                    <div className="aspect-[2/3] rounded-[2rem] overflow-hidden border border-white/10 group-hover:border-red-600 transition-colors duration-300 shadow-xl relative">
                       <img 
                        src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500/${movie.poster_path}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        alt={movie.title || movie.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                       <div className="absolute bottom-4 left-4 right-4">
                          <p className="text-white font-black text-sm uppercase italic truncate leading-none">{movie.title || movie.name}</p>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {episodeSearchResults && episodeSearchResults.length > 0 && (
              <div className={searchResults.length > 0 ? 'mt-12' : ''}>
                <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter mb-4">
                  Episódios <span className="text-gray-500 text-base font-normal not-italic">{episodeSearchResults.length} encontrados</span>
                </h3>
                <div className="flex flex-col gap-3 pb-40">
                  {episodeSearchResults.map(({ movie, episode, episodeIndex }: any) => (
                    <motion.div
                      key={`ep-${movie.id}-${episode.id || episode.episode}`}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.06)' }}
                      onClick={() => onEpisodePlay?.(movie, episode.videoUrl || episode.videoUrl2 || '', episodeIndex)}
                      className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-red-600/30 cursor-pointer transition-all"
                    >
                      <div className="relative w-28 md:w-40 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-gray-900">
                        <img src={episode.still_path || (movie.backdrop_path ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w300/${movie.backdrop_path}`) : '')} alt={episode.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                          <Play size={20} fill="white" className="text-white" />
                        </div>
                        <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                          T{episode.season || 1}·E{episode.episode || '?'}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-red-400 font-black uppercase tracking-widest truncate">{movie.title || movie.name}</p>
                        <p className="text-white font-bold text-sm md:text-base truncate mt-0.5">{episode.title || `Episódio ${episode.episode}`}</p>
                        <p className="text-gray-500 text-[10px] mt-1 line-clamp-2 hidden md:block">{episode.overview}</p>
                        {episode.runtime > 0 && <p className="text-gray-600 text-[9px] font-bold mt-1">{episode.runtime} min</p>}
                      </div>
                      <div className="flex-shrink-0 pr-2">
                        <div className="w-9 h-9 bg-red-600/20 rounded-full flex items-center justify-center border border-red-600/30">
                          <Play size={14} fill="currentColor" className="text-red-400 ml-0.5" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      key="home"
      className="animate-fade-in relative"
    >
      {/* 🚀 PARTICLES AMBIENCE RED */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-screen opacity-20">
         {[...Array(15)].map((_, i) => (
            <motion.div
               key={i}
               initial={{ y: '100vh', x: Math.random() * window.innerWidth, opacity: 0 }}
               animate={{ 
                  y: '-10vh', 
                  x: Math.random() * window.innerWidth, 
                  opacity: [0, 1, 0] 
               }}
               transition={{ 
                  duration: 10 + Math.random() * 20, 
                  repeat: Infinity, 
                  ease: 'linear',
                  delay: Math.random() * 10
               }}
               className="absolute w-1 h-1 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"
            />
         ))}
      </div>

      <div className="relative z-10">
      {bannerMovies.length > 0 ? (
        <Banner 
          movies={bannerMovies}
          onPlay={(m, url) => handlePlayMovie(m, url)} 
          onInfo={handleSelectMovie}
        />
      ) : (
        <Banner 
          onPlay={(m, url) => handlePlayMovie(m, url)} 
          onInfo={handleSelectMovie}
        />
      )}

      <div className="pb-4 mt-[-40px] md:mt-[-100px] relative z-20 space-y-6 md:space-y-8">
        {/* NOVO HERO DASHBOARD INTERATIVO */}
        <section className="px-4 md:px-12 flex flex-col md:flex-row gap-4 md:gap-6 items-stretch mb-8 md:mb-16 -mt-8 relative z-30">
          {/* Quick Resume Card */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex-1 bg-gradient-to-br from-black/80 to-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 md:p-8 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] group cursor-pointer relative overflow-hidden"
            onClick={() => {
               if(continueWatching.length > 0) {
                 handleSelectMovie(continueWatching[0]);
               }
            }}
          >
            <div className="absolute inset-0 bg-red-600/5 group-hover:bg-red-600/10 transition-colors duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,1)]" />
                <span className="text-[10px] md:text-xs font-black text-red-500 uppercase tracking-[0.3em]">{profile ? `Bem-vindo volta, ${profile.name}` : 'Bem-vindo ao NetPlay'}</span>
              </div>
              <h3 className="text-2xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
                {continueWatching.length > 0 ? continueWatching[0].title || continueWatching[0].name : 'O Radar de Hoje'}
              </h3>
              <p className="text-gray-400 font-bold text-xs mt-2 uppercase tracking-widest">{continueWatching.length > 0 ? "Continue de onde parou" : "Descubra novos títulos incríveis"}</p>
            </div>
            
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-500 transition-all shadow-xl relative z-10 shrink-0">
               <Play size={28} className="text-white ml-2" fill="white" />
            </div>
            
            {continueWatching.length > 0 && (
              <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 mix-blend-screen pointer-events-none fade-mask-left">
                <img src={continueWatching[0].backdrop_path?.startsWith('http') ? continueWatching[0].backdrop_path : `https://image.tmdb.org/t/p/w1280/${continueWatching[0].backdrop_path}`} className="w-full h-full object-cover" alt="" />
              </div>
            )}
          </motion.div>
          
          {/* Action Stats / Shortcuts */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 flex-none md:w-[400px]">
            <motion.div 
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/trending')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-all shadow-xl relative overflow-hidden"
             >
               <TrendingUp size={24} className="text-yellow-500 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Em Alta</span>
            </motion.div>
            
            <motion.div 
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/universe')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-all shadow-xl relative overflow-hidden"
             >
               <Sparkles size={24} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Universos</span>
            </motion.div>

            <motion.div 
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/mylist')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-all shadow-xl relative overflow-hidden"
             >
               <ListPlus size={24} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Minha Lista</span>
            </motion.div>

            <motion.div 
               initial={{ backgroundPosition: '0% 50%' }}
               animate={{ backgroundPosition: '100% 50%' }}
               transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
               whileHover={{ scale: 1.05 }}
               onClick={() => {
                  if(myMovies.length > 0) {
                     const random = myMovies[Math.floor(Math.random() * myMovies.length)];
                     handleSelectMovie(random);
                  }
               }}
               className="bg-gradient-to-br from-red-900/40 via-purple-900/40 to-blue-900/40 bg-[length:200%_200%] backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group shadow-xl relative overflow-hidden"
             >
               <Shuffle size={24} className="text-white mb-2 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter drop-shadow-md">Surpreenda</span>
            </motion.div>

            <motion.div 
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/canais')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-orange-500/10 hover:border-orange-500/30 transition-all shadow-xl relative overflow-hidden"
             >
               <Tv2 size={24} className="text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Canais de TV</span>
            </motion.div>

            <motion.div
               whileHover={{ scale: 1.05 }}
               onClick={() => navigate('/novidades-flix')}
               className="bg-black/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer group hover:bg-red-500/10 hover:border-red-500/30 transition-all shadow-xl relative overflow-hidden"
             >
               <Zap size={24} className="text-red-500 mb-2 group-hover:scale-110 transition-transform" fill="currentColor" />
               <span className="text-white font-black text-sm md:text-base italic uppercase tracking-tighter">Novidades Flix</span>
            </motion.div>
          </div>
        </section>

        {/* RADAR DE TENDÊNCIAS MARQUEE */}
        <div className="w-full overflow-hidden bg-red-600/10 border-y border-red-500/20 py-2 mb-8 md:mb-12 relative flex items-center">
           <div className="absolute left-0 w-20 h-full bg-gradient-to-r from-black to-transparent z-10" />
           <div className="absolute right-0 w-20 h-full bg-gradient-to-l from-black to-transparent z-10" />
           
           <motion.div 
             animate={{ x: [0, -1035] }}
             transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
             className="flex gap-8 items-center whitespace-nowrap"
           >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-8 items-center">
                  {['TENDÊNCIA GLOBAL', 'MAIS ASSISTIDOS', 'TOP BILHETERIA', 'CRÍTICA ACLAMADA', 'LOUCURA MULTIVERSO', 'AÇÃO EXPLOSIVA'].map((text, j) => (
                     <div key={j} className="flex items-center gap-4">
                        <span className="text-red-500 font-bold">⚡</span>
                        <span className="text-[10px] md:text-sm font-black text-white/50 uppercase tracking-[0.3em]">{text}</span>
                     </div>
                  ))}
                </div>
              ))}
           </motion.div>
        </div>

        <StreamingHub 
          onSelectProvider={(p: any) => navigate(`/provider/${p}`)} 
          streamingProviders={streamingProviders}
        />

        {/* CYBER SHORTCUTS */}
        <section className="px-4 md:px-12 flex flex-wrap gap-2 md:gap-3 mb-8 md:mb-12 relative z-20">
           {['Filmes', 'Séries', 'Documentários', 'Anime', 'Infantil', 'Ação', 'Terror'].map((tag, idx) => (
             <motion.button 
               key={tag} 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.05 }}
               onClick={() => navigate(`/genre/${tag}`)} 
               className="relative px-5 py-2 overflow-hidden bg-[#0f0f0f] border border-white/10 rounded-full group hover:border-red-500/50 transition-colors shadow-lg"
             >
               <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/10 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
               <span className="relative z-10 text-[10px] md:text-xs font-black text-white/60 group-hover:text-white uppercase tracking-widest italic transition-colors">
                 {tag}
               </span>
             </motion.button>
           ))}
        </section>

        {/* 🌟 MEGA UI: AI HYPE STATS */}
        <section className="px-4 md:px-12 mb-8 md:mb-12">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 relative overflow-hidden backdrop-blur-3xl group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-[50px] -mr-10 -mt-10 group-hover:bg-red-600/20 transition-colors" />
                 <Activity size={24} className="text-red-500 mb-4" />
                 <h4 className="text-white font-black text-3xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">98% Hype</h4>
                 <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Nível de Energia da Comunidade</p>
                 <div className="w-full bg-white/5 h-1 mt-4 rounded-full overflow-hidden">
                    <div className="bg-red-600 w-[98%] h-full rounded-full animate-pulse" />
                 </div>
              </div>
              <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 relative overflow-hidden backdrop-blur-3xl group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px] -mr-10 -mt-10 group-hover:bg-blue-600/20 transition-colors" />
                 <Star size={24} className="text-blue-500 mb-4" />
                 <h4 className="text-white font-black text-3xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">Top 10</h4>
                 <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Listas Atualizadas a cada 10m</p>
                 <div className="flex -space-x-4 mt-3">
                    {top10Movies.slice(0,4).map((m: any, i: number) => (
                      <div key={m.id} className="w-8 h-8 rounded-full border-2 border-black overflow-hidden relative z-[4-i]">
                        <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                 </div>
              </div>
              <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 relative overflow-hidden backdrop-blur-3xl group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-[50px] -mr-10 -mt-10 group-hover:bg-purple-600/20 transition-colors" />
                 <Zap size={24} className="text-purple-500 mb-4" />
                 <h4 className="text-white font-black text-3xl md:text-4xl italic uppercase tracking-tighter leading-none mb-1">Radar.AI</h4>
                 <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Seu Motor Neural Ativo</p>
                 <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-white/50 uppercase">
                    <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-ping" />
                    Buscando novas joias...
                 </div>
              </div>
           </div>
        </section>

        {/* 🌟 MEGA UI: LIVE CHANNELS / TRAILER HUB */}
        {newMovies.length > 0 && (
          <section className="px-4 md:px-12 mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1 items-end h-5">
                <div className="w-1.5 h-3 bg-red-600 animate-pulse delay-75" />
                <div className="w-1.5 h-5 bg-red-600 animate-pulse delay-150" />
                <div className="w-1.5 h-4 bg-red-600 animate-pulse delay-300" />
              </div>
              <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Live Trailers Hub</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
               {newMovies.slice(0, 3).map((movie: any) => (
                  <motion.div 
                    key={`live-${movie.id}`}
                    whileHover={{ scale: 1.02 }}
                    className="aspect-video bg-black rounded-3xl overflow-hidden relative cursor-pointer group border border-white/10"
                    onClick={() => handleSelectMovie(movie)}
                  >
                     <img src={movie.backdrop_path?.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/w780/${movie.backdrop_path}`} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-all duration-700" alt="" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                     
                     <div className="absolute top-4 left-4 bg-red-600 text-white text-[8px] font-black italic uppercase px-2 py-1 rounded shadow-lg flex items-center gap-1">
                        <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                        ESTREIA
                     </div>

                     <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                        <div>
                           <h4 className="text-white font-black italic uppercase text-lg md:text-xl tracking-tighter leading-none mb-1">{movie.title || movie.name}</h4>
                           <p className="text-gray-400 font-bold text-[10px] uppercase">{movie.genres || 'Ação'}</p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 group-hover:bg-red-600 transition-colors shrink-0">
                           <Play size={16} className="text-white ml-0.5" fill="white" />
                        </div>
                     </div>
                  </motion.div>
               ))}
            </div>
          </section>
        )}

        {top10Franchises.length > 0 && (
          <Top10Row 
            title="Top 10 Sagas Populares"
            movies={top10Franchises as any}
            onSelectMovie={(f: any) => navigate(`/universe/${f.id}`)}
          />
        )}

        {animationFranchises.length > 0 && (
          <Row 
            title="Animações & Universos Mágicos"
            movies={animationFranchises}
            onSelectMovie={(f: any) => navigate(`/universe/${f.id}`)}
            type="standard"
          />
        )}

        {top10Movies.length > 0 && (
          <Top10Row 
            title="TOP 10 Filmes de Hoje"
            movies={top10Movies}
            onSelectMovie={handleSelectMovie}
          />
        )}

        {top10Series.length > 0 && (
          <Top10Row 
            title="TOP 10 Séries de Hoje"
            movies={top10Series}
            onSelectMovie={handleSelectMovie}
          />
        )}

        {/* 🚀 ONDA NEURAL COMPACTA */}
        <section className="space-y-4 md:space-y-6 group py-6 md:py-8 px-4 md:px-12 bg-gradient-to-b from-black/80 via-[#0a0a0a] to-transparent relative border-t border-white/5">
          
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse" />
                <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Onda Neural</h3>
              </div>
            </div>
            
            <button 
              className="flex items-center gap-1 md:gap-2 px-4 md:px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group scale-90 md:scale-100"
              onClick={() => navigate('/search')}
            >
              <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Global</span>
              <ChevronLeft className="rotate-180 text-red-500 group-hover:translate-x-1 transition-transform" size={14} />
            </button>
          </div>
          
          <div className="flex overflow-x-auto no-scrollbar gap-3 md:gap-4 pb-4 snap-x -mx-4 px-4 md:mx-0 md:px-0">
            {categories.map((cat, idx) => (
              <motion.div 
                key={cat.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/genre/${cat.name}`)}
                className="relative flex items-center gap-3 min-w-[140px] md:min-w-[180px] h-14 md:h-16 rounded-2xl overflow-hidden group/card cursor-pointer bg-white/5 border border-white/10 snap-center shrink-0 hover:bg-white/10 transition-colors"
              >
                <div className="w-12 md:w-16 h-full relative shrink-0">
                   <img 
                     src={cat.backdrop} 
                     className="w-full h-full object-cover opacity-50 group-hover/card:opacity-80 transition-opacity mix-blend-luminosity group-hover/card:mix-blend-normal" 
                     referrerPolicy="no-referrer" 
                     alt={cat.name}
                   />
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/80 group-hover/card:to-transparent transition-colors" />
                </div>
                
                <div className="flex-1 pr-3 flex items-center justify-between">
                   <h4 className="text-white font-black uppercase text-[10px] md:text-xs tracking-tighter italic whitespace-nowrap">
                     {cat.name}
                   </h4>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {profile && continueWatching.length > 0 && (
          <ContinueWatchingRow 
            title={`Continuar Assistindo como ${profile.name}`}
            movies={continueWatching}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            profileName={profile.name}
          />
        )}

        {myMovies.length > 0 && (
          <>
            {cinemaMovies.length > 0 && (
              <CinemaRow 
                title="Fresquinho do Cinema"
                movies={cinemaMovies}
                onSelectMovie={handleSelectMovie}
              />
            )}

            <Row 
              title="Adicionados Recentemente"
              movies={myMovies}
              type="wide"
              onSelectMovie={handleSelectMovie}
              onToggleMyList={toggleMyList}
              onToggleFavorite={toggleFavorite}
              myListIds={myListIds}
              favoriteIds={favoriteIds}
              onViewAll={setViewAllGenre}
              streamingProviders={streamingProviders}
            />

            {newMovies.length > 0 && (
              <NewReleasesRow 
                title="Lançamentos Exclusivos"
                movies={newMovies}
                onSelectMovie={handleSelectMovie}
              />
            )}

            <Suspense fallback={null}>
              <FlixLatestRow onSelectMovie={handleSelectMovie} />
            </Suspense>

            {Object.entries(optimizedGenreMovies).map(([genre, genreMovies]: [string, any]) => (
              <Row 
                key={genre}
                title={genre}
                movies={genreMovies}
                onSelectMovie={handleSelectMovie}
                onToggleMyList={toggleMyList}
                onToggleFavorite={toggleFavorite}
                myListIds={myListIds}
                favoriteIds={favoriteIds}
                onViewAll={setViewAllGenre}
                streamingProviders={streamingProviders}
              />
            ))}
          </>
        )}

        {/* ── TMDB Discovery Carousels ── categorias com cache 2h */}
        <Suspense fallback={null}>
          <TMDBCategoryCarousels onSelectMovie={handleSelectMovie} />
        </Suspense>

      </div>
      </div>
    </div>
  );
});

const UniverseTabView = React.memo(({ 
  franchises,
  handleSelectMovie, 
  toggleMyList, 
  toggleFavorite, 
  myListIds, 
  favoriteIds 
}: any) => {
  const { franchiseId } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activePeriod, setActivePeriod] = useState<'hoje'|'semanal'|'vital'>('hoje');
  const [activeGenreFilter, setActiveGenreFilter] = useState('Todos os Gêneros');
  const [activeSubGenre, setActiveSubGenre] = useState('Anime');
  const [showQuizDiscover, setShowQuizDiscover] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Merge dynamic franchises with static FRANCHISES as fallbacks so we always have content
  const displayFranchises = useMemo(() => {
    if (franchises.length >= 3) return franchises;
    const dynamicIds = new Set(franchises.map((f: any) => String(f.id)));
    const extras = FRANCHISES
      .filter(f => !dynamicIds.has(f.id))
      .map(f => ({ ...f, movies: [] as any[] }));
    return [...franchises, ...extras];
  }, [franchises]);

  const activeFranchise = useMemo(() => {
    if (!franchiseId) return null;
    return displayFranchises.find((f: any) => String(f.id) === franchiseId)
      || franchises.find((f: any) => String(f.id) === franchiseId);
  }, [franchiseId, displayFranchises, franchises]);

  const safeIdx = displayFranchises.length > 0 ? selectedIdx % displayFranchises.length : 0;
  const selectedFranchise: any = displayFranchises[safeIdx] || null;
  const prevFranchise: any = displayFranchises.length > 1
    ? displayFranchises[(safeIdx - 1 + displayFranchises.length) % displayFranchises.length]
    : null;
  const nextFranchise: any = displayFranchises.length > 1
    ? displayFranchises[(safeIdx + 1) % displayFranchises.length]
    : null;

  const allFranchiseMovies = useMemo(() =>
    franchises.flatMap((f: any) => f.movies || []),
    [franchises]
  );

  const timelineMovies = useMemo(() =>
    [...(selectedFranchise?.movies || [])].sort((a: any, b: any) =>
      (a.release_date || '').localeCompare(b.release_date || '')
    ).slice(0, 6),
    [selectedFranchise]
  );

  const filteredFranchises = useMemo(() =>
    searchTerm
      ? displayFranchises.filter((f: any) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : displayFranchises,
    [displayFranchises, searchTerm]
  );

  // Helper: resolve image URL (TMDB relative or absolute)
  const imgUrl = (path: string | undefined, size = 'original') => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  // Logos fetched dinamicamente do TMDB por franquia
  const [franchiseLogos, setFranchiseLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    displayFranchises.forEach(async (f: any) => {
      const key = String(f.id);
      if (franchiseLogos[key]) return;
      // Prefere logoMovieId estático; se não tiver, usa o primeiro filme da biblioteca
      const movieId = f.logoMovieId ?? f.movies?.[0]?.id;
      if (!movieId) return;
      const mediaType = f.movies?.[0]?.type === 'series' ? 'tv' : 'movie';
      const url = await getMovieLogo(movieId, mediaType);
      if (url) setFranchiseLogos(prev => ({ ...prev, [key]: url }));
    });
  }, [displayFranchises]);

  // Retorna a melhor logo disponível para a franquia (TMDB > static > null)
  const getLogoForFranchise = (f: any): string | null => {
    const fetched = franchiseLogos[String(f.id)];
    if (fetched) return fetched;
    if (f.logo) return imgUrl(f.logo);
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-24 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!activeFranchise ? (
          <motion.div key="universe-catalog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* ───────── HERO BANNER ───────── */}
            <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
              {/* layered franchise backdrops */}
              {[selectedFranchise, prevFranchise, nextFranchise].filter(Boolean).map((f: any, i: number) => (
                <div key={f.id + i} className="absolute inset-0" style={{ zIndex: i === 0 ? 2 : 1, opacity: i === 0 ? 1 : 0.35 }}>
                  <img
                    src={imgUrl(f.backdrop || f.poster)}
                    className="w-full h-full object-cover"
                    style={{ filter: i > 0 ? 'blur(2px)' : 'none' }}
                    referrerPolicy="no-referrer"
                    alt=""
                  />
                </div>
              ))}
              {/* gradient overlays */}
              <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(135deg, rgba(14,14,14,0.88) 0%, rgba(14,14,14,0.3) 60%, rgba(14,14,14,0.6) 100%)' }} />
              <div className="absolute inset-x-0 bottom-0 z-10" style={{ height: 80, background: 'linear-gradient(to top, #0e0e0e 0%, transparent 100%)' }} />
              {/* text */}
              <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 pb-4">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] leading-none mb-1" style={{ color: '#e53e3e' }}>Nexus Multiverso</p>
                <h1 className="font-black text-white uppercase leading-none" style={{ fontSize: 36, letterSpacing: '-0.03em' }}>Universos</h1>
              </div>
            </div>

            {/* ───────── SEARCH BAR ───────── */}
            <div className="px-4 mt-3">
              <div className="flex items-center gap-2 rounded-full px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Search size={12} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); }}
                  placeholder="Buscar"
                  className="bg-transparent text-white text-xs font-bold placeholder-white/30 outline-none flex-1 uppercase tracking-widest"
                />
                {searchTerm
                  ? <button onClick={() => setSearchTerm('')}><X size={11} style={{ color: 'rgba(255,255,255,0.3)' }} /></button>
                  : <div className="flex gap-0.5"><span style={{ width: 2, height: 8, borderRadius: 1, background: 'rgba(255,255,255,0.25)' }} /><span style={{ width: 2, height: 11, borderRadius: 1, background: 'rgba(255,255,255,0.25)' }} /><span style={{ width: 2, height: 6, borderRadius: 1, background: 'rgba(255,255,255,0.25)' }} /></div>
                }
              </div>
            </div>

            {/* ───────── MAIN FRANCHISE CAROUSEL (left · CENTER · right) ───────── */}
            {!searchTerm && displayFranchises.length > 0 && (
              <div className="mt-3 px-4">
                <div className="flex items-end gap-2">
                  {/* LEFT card */}
                  {prevFranchise && (
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      className="flex-none cursor-pointer relative rounded-2xl overflow-hidden"
                      style={{ width: '27vw', maxWidth: 108, height: '21vw', maxHeight: 84, border: '1px solid rgba(255,255,255,0.08)', background: prevFranchise.color ? `${prevFranchise.color}22` : '#111' }}
                      onClick={() => setSelectedIdx((safeIdx - 1 + displayFranchises.length) % displayFranchises.length)}
                    >
                      <img src={imgUrl(prevFranchise.backdrop || prevFranchise.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                        {getLogoForFranchise(prevFranchise)
                          ? <img src={getLogoForFranchise(prevFranchise)!} alt={prevFranchise.name} className="h-4 object-contain mx-auto drop-shadow-2xl" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black text-[9px] uppercase leading-none">{prevFranchise.name}</p>
                        }
                        <p className="font-bold mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>Saga Completa</p>
                        <p className="font-black" style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{prevFranchise.movies?.length || 0} títulos</p>
                      </div>
                    </motion.div>
                  )}

                  {/* CENTER card — featured */}
                  {selectedFranchise && (
                    <motion.div
                      whileTap={{ scale: 0.97 }}
                      className="relative rounded-2xl overflow-hidden cursor-pointer flex-1"
                      style={{ height: '29vw', maxHeight: 118, border: '2px solid #e53e3e', boxShadow: '0 0 24px rgba(229,62,62,0.3)', background: selectedFranchise.color ? `${selectedFranchise.color}22` : '#111' }}
                      onClick={() => navigate(`/universe/${selectedFranchise.id}`)}
                    >
                      <img src={imgUrl(selectedFranchise.backdrop || selectedFranchise.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.72 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
                      <div className="absolute inset-0" style={{ background: 'rgba(229,62,62,0.06)' }} />
                      <div className="absolute inset-x-0 bottom-0 p-2.5 text-center">
                        {getLogoForFranchise(selectedFranchise)
                          ? <img src={getLogoForFranchise(selectedFranchise)!} alt={selectedFranchise.name} className="h-6 object-contain mx-auto drop-shadow-2xl mb-1" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black uppercase leading-none mb-1" style={{ fontSize: 14, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{selectedFranchise.name}</p>
                        }
                        <p className="font-bold" style={{ fontSize: 7, color: '#fc8181' }}>Saga Completa</p>
                        <p className="font-black" style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>{selectedFranchise.movies?.length || 0} títulos</p>
                      </div>
                    </motion.div>
                  )}

                  {/* RIGHT card */}
                  {nextFranchise && (
                    <motion.div
                      whileTap={{ scale: 0.96 }}
                      className="flex-none cursor-pointer relative rounded-2xl overflow-hidden"
                      style={{ width: '27vw', maxWidth: 108, height: '21vw', maxHeight: 84, border: '1px solid rgba(255,255,255,0.08)', background: nextFranchise.color ? `${nextFranchise.color}22` : '#111' }}
                      onClick={() => setSelectedIdx((safeIdx + 1) % displayFranchises.length)}
                    >
                      <img src={imgUrl(nextFranchise.backdrop || nextFranchise.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                        {getLogoForFranchise(nextFranchise)
                          ? <img src={getLogoForFranchise(nextFranchise)!} alt={nextFranchise.name} className="h-4 object-contain mx-auto drop-shadow-2xl" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black text-[9px] uppercase leading-none">{nextFranchise.name}</p>
                        }
                        <p className="font-bold mt-0.5" style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>Saga Completa</p>
                        <p className="font-black" style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{nextFranchise.movies?.length || 0} títulos</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Dot indicators */}
                <div className="flex justify-center gap-1 mt-2">
                  {displayFranchises.slice(0, Math.min(displayFranchises.length, 8)).map((_: any, i: number) => (
                    <button key={i} onClick={() => setSelectedIdx(i)}
                      className="rounded-full transition-all"
                      style={{ width: i === safeIdx ? 12 : 4, height: 4, background: i === safeIdx ? '#e53e3e' : 'rgba(255,255,255,0.2)' }}
                    />
                  ))}
                </div>

                {/* Counter line */}
                {selectedFranchise && (
                  <p className="mt-1.5 text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span className="font-black" style={{ color: 'rgba(255,255,255,0.75)' }}>{selectedFranchise.movies?.length || 0} Títulos</span>
                    {selectedFranchise.movies?.length > 0 && (
                      <> | Explore de {selectedFranchise.movies[0]?.title || selectedFranchise.name} a {selectedFranchise.movies[selectedFranchise.movies.length - 1]?.title || ''}</>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* ───────── SECOND ROW — landscape cards ───────── */}
            {!searchTerm && displayFranchises.length > 1 && (
              <div className="mt-2.5 px-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {displayFranchises.filter((_: any, i: number) => i !== safeIdx).slice(0, 4).map((f: any) => (
                    <motion.div
                      key={`row2-${f.id}`}
                      whileTap={{ scale: 0.96 }}
                      className="flex-none cursor-pointer relative rounded-xl overflow-hidden"
                      style={{ width: '28vw', maxWidth: 112, height: '15vw', maxHeight: 60, border: '1px solid rgba(255,255,255,0.07)' }}
                      onClick={() => {
                        const idx = displayFranchises.findIndex((d: any) => d.id === f.id);
                        if (idx >= 0) setSelectedIdx(idx);
                        navigate(`/universe/${f.id}`);
                      }}
                    >
                      <img src={imgUrl(f.backdrop || f.poster)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)' }} />
                      <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1.5">
                        {getLogoForFranchise(f)
                          ? <img src={getLogoForFranchise(f)!} alt={f.name} className="h-3.5 object-contain drop-shadow-2xl mb-0.5" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <p className="text-white font-black uppercase leading-none mb-0.5" style={{ fontSize: 8 }}>{f.name}</p>
                        }
                        <p className="font-black uppercase" style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>{f.movies?.length || 0} Títulos</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Search results grid */}
            {searchTerm && (
              <div className="mt-3 px-4">
                {filteredFranchises.length === 0
                  ? <p className="text-center font-bold uppercase text-xs mt-8" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum universo encontrado</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {filteredFranchises.map((f: any) => (
                        <motion.div key={f.id} whileTap={{ scale: 0.96 }}
                          className="cursor-pointer relative rounded-xl overflow-hidden"
                          style={{ width: '28vw', maxWidth: 108, aspectRatio: '2/3', border: '1px solid rgba(255,255,255,0.08)' }}
                          onClick={() => navigate(`/universe/${f.id}`)}
                        >
                          <img src={imgUrl(f.poster || f.backdrop)} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.6 }} referrerPolicy="no-referrer" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)' }} />
                          <div className="absolute inset-x-0 bottom-0 p-1.5 text-center">
                            {getLogoForFranchise(f)
                              ? <img src={getLogoForFranchise(f)!} className="h-4 object-contain mx-auto mb-0.5" referrerPolicy="no-referrer" alt={f.name} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <p className="text-white font-black text-[8px] uppercase">{f.name}</p>
                            }
                            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{f.movies?.length || 0} Títulos</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ───────── ACTION BUTTONS ───────── */}
            <div className="mt-4 px-4 flex gap-2">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-widest py-2.5 active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)', color: '#fff' }}
                onClick={() => selectedFranchise?.movies?.[0] && handleSelectMovie(selectedFranchise.movies[0])}
              >
                <Plus size={11} /> Imersão Imediata
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-widest py-2.5 active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                onClick={() => selectedFranchise?.movies?.[0] && toggleMyList(selectedFranchise.movies[0])}
              >
                <Plus size={11} /> Minha Lista
              </button>
            </div>

            {/* ───────── FEATURE CARDS ───────── */}
            <div className="mt-3 px-4 flex gap-2">
              {/* Biblioteca */}
              <div className="flex-1 relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                style={{ height: 88, background: '#151515', border: '1px solid rgba(255,255,255,0.07)' }}
                onClick={() => navigate('/search')}
              >
                {/* stacked avatars */}
                <div className="absolute top-2.5 left-2.5 flex -space-x-2.5">
                  {(allFranchiseMovies.length > 0 ? allFranchiseMovies : displayFranchises).slice(0, 4).map((m: any, i: number) => {
                    const src = m.poster_path ? imgUrl(m.poster_path, 'w92') : imgUrl(m.poster || m.backdrop);
                    return (
                      <div key={i} className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: '2px solid #151515', zIndex: 4 - i, background: '#222' }}>
                        {src && <img src={src} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
                      </div>
                    );
                  })}
                </div>
                {/* thumbnail row */}
                <div className="absolute top-9 left-2.5 flex gap-1">
                  {(allFranchiseMovies.length > 0 ? allFranchiseMovies : displayFranchises).slice(0, 3).map((m: any, i: number) => {
                    const src = m.backdrop_path ? imgUrl(m.backdrop_path, 'w92') : imgUrl(m.backdrop || m.poster);
                    return (
                      <div key={i} className="rounded-md overflow-hidden" style={{ width: 30, height: 20, background: '#222' }}>
                        {src && <img src={src} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
                      </div>
                    );
                  })}
                </div>
                <div className="absolute bottom-2.5 left-2.5 right-2">
                  <p className="text-white font-black uppercase leading-tight" style={{ fontSize: 9 }}>Biblioteca de Saber</p>
                  <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)' }}>Galeria de Fan-Art</p>
                </div>
              </div>

              {/* Quiz */}
              <div className="flex-1 relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                style={{ height: 88, background: '#151515', border: '1px solid rgba(255,255,255,0.07)' }}
                onClick={() => setShowQuizDiscover(true)}
              >
                <Trophy size={14} className="absolute top-2.5 right-2.5" style={{ color: '#e53e3e' }} />
                <div className="absolute top-8 left-2.5 flex gap-1">
                  {[...Array(4)].map((_: any, i: number) => (
                    <div key={i} className="rounded-md flex items-center justify-center text-sm" style={{ width: 28, height: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>?</div>
                  ))}
                </div>
                <p className="absolute top-2.5 left-2.5 font-black uppercase tracking-widest" style={{ fontSize: 7, color: '#e53e3e' }}>Quiz</p>
                <div className="absolute bottom-2.5 left-2.5 right-2">
                  <p className="text-white font-black uppercase leading-tight" style={{ fontSize: 9 }}>Desafios de<br />Quem Sai</p>
                </div>
              </div>
            </div>

            {/* ───────── FILTER TABS ───────── */}
            <div className="mt-4 px-4">
              {/* Row 1 */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {(['hoje','semanal','vital'] as const).map((id, i) => {
                  const labels = ['Hoje', 'Semanal', 'Vital'];
                  const isA = activePeriod === id;
                  return (
                    <button key={id} onClick={() => setActivePeriod(id)}
                      className="flex-none flex items-center gap-1 rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap"
                      style={{ background: isA ? 'rgba(229,62,62,0.18)' : 'rgba(255,255,255,0.05)', color: isA ? '#fc8181' : 'rgba(255,255,255,0.45)', border: isA ? '1px solid rgba(229,62,62,0.35)' : '1px solid rgba(255,255,255,0.07)' }}
                    >
                      {isA && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e53e3e', flexShrink: 0, display: 'inline-block' }} />}
                      {labels[i]}
                    </button>
                  );
                })}
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 2px', flexShrink: 0 }} />
                {['Todos os Gêneros', 'Ação'].map(g => {
                  const isA = activeGenreFilter === g;
                  return (
                    <button key={g} onClick={() => setActiveGenreFilter(g)}
                      className="flex-none rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap"
                      style={{ background: isA ? '#fff' : 'rgba(255,255,255,0.05)', color: isA ? '#000' : 'rgba(255,255,255,0.45)', border: isA ? 'none' : '1px solid rgba(255,255,255,0.07)' }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              {/* Row 2 */}
              <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                {[['Anime', '⚡'], ['Infantil', '🎠'], ['Clássicos', '🏛️']].map(([g, emoji]) => {
                  const isA = activeSubGenre === g;
                  return (
                    <button key={g} onClick={() => setActiveSubGenre(g)}
                      className="flex-none flex items-center gap-1 rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap"
                      style={{ background: isA ? 'rgba(229,62,62,0.14)' : 'rgba(255,255,255,0.04)', color: isA ? '#e53e3e' : 'rgba(255,255,255,0.35)', border: isA ? '1px solid rgba(229,62,62,0.28)' : '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <span>{emoji}</span> {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ───────── DESCUBRA O PRÓXIMO NÍVEL ───────── */}
            <div className="mt-5 px-4 pb-2">
              {/* Section header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={13} style={{ color: '#f6c90e' }} />
                  <div>
                    <p className="text-white font-black uppercase leading-none" style={{ fontSize: 11, letterSpacing: '0.06em' }}>Descubra o Próximo Nível</p>
                    <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Inforafpicos Exclusivos</p>
                  </div>
                </div>
                <button className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <RotateCcw size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              </div>

              {/* Two cards */}
              <div className="flex gap-2.5">
                {/* Card A — Easter Eggs & Segredos */}
                <div className="flex-1 rounded-2xl p-3" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)', minHeight: 160 }}>
                  <p className="text-white font-black uppercase leading-tight mb-1" style={{ fontSize: 10 }}>Easter Eggs &amp; Segredos</p>
                  <p className="font-bold uppercase mb-2.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>secretos para:</p>

                  {/* 2×2 question-mark grid */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    {(selectedFranchise?.movies?.slice(0, 4).length > 0
                      ? selectedFranchise.movies.slice(0, 4)
                      : [{}, {}, {}, {}]
                    ).map((m: any, i: number) => {
                      const src = m.poster_path ? imgUrl(m.poster_path, 'w92') : null;
                      return (
                        <div key={i} className="relative rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {src && <img src={src} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="" referrerPolicy="no-referrer" />}
                          <span className="relative z-10 text-xl" style={{ filter: 'grayscale(0.4)' }}>❓</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* List items */}
                  <div className="space-y-0.5">
                    <p className="font-bold" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Dynamico detônicos séries para:</p>
                    {selectedFranchise?.movies?.slice(0, 2).map((m: any, i: number) => (
                      <p key={i} className="font-bold leading-tight" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                        {i + 1}. {(m.overview || m.title || '').split('.')[0]?.slice(0, 36)}
                      </p>
                    )) || (
                      <>
                        <p className="font-bold" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>1. O mistério de Bulma (Ep 5)</p>
                        <p className="font-bold" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>2. A origem de Shenron</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Card B — Conecte a Franquia (Timeline) */}
                <div className="flex-1 rounded-2xl p-3" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)', minHeight: 160 }}>
                  <p className="text-white font-black uppercase leading-tight mb-0.5" style={{ fontSize: 10 }}>Conecte a Franquia</p>
                  <p className="font-bold uppercase mb-2" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>(Timeline)</p>

                  {/* You are here badge */}
                  <div className="flex justify-center mb-2">
                    <span className="font-black uppercase px-2.5 py-0.5 rounded-full" style={{ fontSize: 7, background: '#e53e3e', color: '#fff' }}>You are Here</span>
                  </div>

                  {/* Timeline dots */}
                  <div className="overflow-x-auto no-scrollbar mb-2">
                    <div className="flex items-center" style={{ minWidth: 'max-content', gap: 0 }}>
                      {(timelineMovies.length > 0
                        ? timelineMovies
                        : [{ title: 'Dragon Ball' }, { title: 'Z' }, { title: 'Super' }, { title: 'Pré' }, { title: 'Movie' }]
                      ).map((m: any, i: number, arr: any[]) => {
                        const isMiddle = i === Math.floor(arr.length / 2);
                        const dotColor = isMiddle ? '#e53e3e' : i % 3 === 0 ? '#63b3ed' : i % 3 === 1 ? '#a78bfa' : '#38b2ac';
                        return (
                          <React.Fragment key={i}>
                            <div className="flex flex-col items-center" style={{ minWidth: 30 }}>
                              <p className="text-center font-bold leading-none mb-1" style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', maxWidth: 28, wordBreak: 'break-word' }}>
                                {(m.title || '').slice(0, 8)}
                              </p>
                              <div className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: dotColor, border: `1.5px solid ${isMiddle ? '#fc8181' : 'rgba(255,255,255,0.2)'}` }} />
                              <p className="text-center font-bold mt-0.5" style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', maxWidth: 28 }}>
                                {m.release_date?.split('-')[0] || ''}
                              </p>
                            </div>
                            {i < arr.length - 1 && (
                              <div style={{ height: 1.5, width: 10, background: 'rgba(255,255,255,0.15)', flexShrink: 0, marginBottom: 8 }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <p className="font-bold uppercase mb-0.5" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{selectedFranchise?.name || 'Dragon Ball'}</p>
                  <p className="font-bold leading-tight mb-0.5" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                    Inferanos Curatoriais séries: {selectedFranchise?.name || 'Dragon Ball'} + {displayFranchises[(safeIdx + 1) % Math.max(displayFranchises.length, 1)]?.name || 'Super Z'}
                  </p>
                  <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>+ {Math.max(0, (selectedFranchise?.movies?.length || 3) - 2)} Super movies</p>
                </div>
              </div>
            </div>

            {/* ───────── COLEÇÕES COM BANNER ───────── */}
            {!searchTerm && franchises && franchises.length > 0 && (
              <div className="mt-6">
                <div className="px-4 flex items-center gap-2 mb-3">
                  <LayoutGrid size={13} style={{ color: '#e53e3e' }} />
                  <div>
                    <p className="text-white font-black uppercase leading-none" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>Coleções</p>
                    <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Clique para explorar a coleção</p>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                  {franchises.filter((f: any) => (f.movies?.length || 0) >= 2).map((f: any) => (
                    <motion.div
                      key={`col-${f.id}`}
                      whileTap={{ scale: 0.96 }}
                      className="flex-none relative rounded-2xl overflow-hidden cursor-pointer"
                      style={{ width: '72vw', maxWidth: 280, height: '42vw', maxHeight: 165, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                      onClick={() => navigate(`/universe/${f.id}`)}
                    >
                      <img
                        src={f.backdrop?.startsWith('http') ? f.backdrop : f.backdrop ? `https://image.tmdb.org/t/p/w780${f.backdrop}` : (f.poster?.startsWith('http') ? f.poster : f.poster ? `https://image.tmdb.org/t/p/w342${f.poster}` : '')}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ opacity: 0.75 }}
                        referrerPolicy="no-referrer"
                        alt={f.name}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                      />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)' }} />
                      {f.color && <div className="absolute inset-0" style={{ background: `${f.color}18` }} />}
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        {getLogoForFranchise(f) ? (
                          <img src={getLogoForFranchise(f)!} alt={f.name} className="h-7 object-contain drop-shadow-2xl mb-1.5" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <p className="text-white font-black uppercase leading-none mb-1.5" style={{ fontSize: 16, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>{f.name}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase text-white/70" style={{ fontSize: 9 }}>{f.movies?.length || 0} títulos</span>
                          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.2)' }} />
                          <span className="font-black uppercase" style={{ fontSize: 9, color: '#fc8181' }}>Ver Saga →</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ───────── SAGAS & COLEÇÕES (carrosseis por franquia) ───────── */}
            {!searchTerm && franchises && franchises.length > 0 && (
              <div className="mt-5">
                <div className="px-4 flex items-center gap-2 mb-3">
                  <List size={13} style={{ color: '#e53e3e' }} />
                  <div>
                    <p className="text-white font-black uppercase leading-none" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>Sagas & Coleções</p>
                    <p className="font-bold uppercase" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Sua biblioteca organizada por franquias</p>
                  </div>
                </div>
                <Suspense fallback={null}>
                  <FranchiseCarousels franchises={franchises} onSelectMovie={handleSelectMovie} />
                </Suspense>
              </div>
            )}

            {/* Quiz modal */}
            <AnimatePresence>
              {showQuizDiscover && (
                <QuizModal movies={allFranchiseMovies.length > 0 ? allFranchiseMovies.slice(0, 12) : []} onClose={() => setShowQuizDiscover(false)} />
              )}
            </AnimatePresence>

          </motion.div>
        ) : (
          <UniverseView
            franchise={activeFranchise}
            onSelectMovie={handleSelectMovie}
            onClose={() => navigate('/universe')}
            onToggleMyList={toggleMyList}
            onToggleFavorite={toggleFavorite}
            myListIds={myListIds}
            favoriteIds={favoriteIds}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

const QuizModal = ({ movies, onClose }: { movies: any[]; onClose: () => void }) => {
  const questions = useMemo(() => {
    const pool = movies.filter(m => m.title || m.name).slice(0, 8);
    if (pool.length < 3) return [];
    const q: { question: string; options: string[]; correct: number; poster: string }[] = [];

    // Q1: nota do filme
    if (pool[0]) {
      const target = pool[0];
      const wrongRatings = [
        ((target.vote_average || 7) - 1.3).toFixed(1),
        ((target.vote_average || 7) + 0.8).toFixed(1),
        ((target.vote_average || 7) - 0.5).toFixed(1),
      ];
      const opts = [target.vote_average?.toFixed(1) || '7.0', ...wrongRatings].sort(() => Math.random() - 0.5);
      q.push({ question: `Qual é a nota de "${target.title || target.name}" no TMDB?`, options: opts, correct: opts.indexOf(target.vote_average?.toFixed(1) || '7.0'), poster: target.poster_path });
    }

    // Q2: ano de lançamento
    if (pool[1]) {
      const target = pool[1];
      const year = target.release_date?.split('-')[0] || target.first_air_date?.split('-')[0] || '2023';
      const wrongYears = [String(parseInt(year) - 1), String(parseInt(year) + 1), String(parseInt(year) - 2)];
      const opts = [year, ...wrongYears].sort(() => Math.random() - 0.5);
      q.push({ question: `Em que ano foi lançado "${target.title || target.name}"?`, options: opts, correct: opts.indexOf(year), poster: target.poster_path });
    }

    // Q3: maior nota entre dois filmes
    if (pool[2] && pool[3]) {
      const a = pool[2]; const b = pool[3];
      const aTitle = a.title || a.name; const bTitle = b.title || b.name;
      const aRating = a.vote_average || 0; const bRating = b.vote_average || 0;
      const correctIdx = aRating >= bRating ? 0 : 1;
      q.push({ question: `Qual filme tem MAIOR nota?`, options: [aTitle, bTitle, 'São iguais', 'Nenhum dos dois'], correct: correctIdx, poster: a.poster_path });
    }

    // Q4: gênero do filme
    if (pool[4]) {
      const target = pool[4];
      const genre = target.genres?.split(',')[0]?.trim() || 'Ação';
      const wrongGenres = ['Terror', 'Comédia', 'Documentário', 'Animação', 'Drama', 'Ficção'].filter(g => g !== genre).slice(0, 3);
      const opts = [genre, ...wrongGenres].sort(() => Math.random() - 0.5);
      q.push({ question: `Qual é o gênero principal de "${target.title || target.name}"?`, options: opts, correct: opts.indexOf(genre), poster: target.poster_path });
    }

    // Q5: adivinhe o filme pelo overview
    if (pool[5] && pool[5].overview) {
      const target = pool[5];
      const decoys = pool.filter(m => m.id !== target.id).slice(0, 3).map((m: any) => m.title || m.name);
      const targetTitle = target.title || target.name;
      const opts = [targetTitle, ...decoys].sort(() => Math.random() - 0.5);
      const snippet = target.overview.slice(0, 80) + (target.overview.length > 80 ? '…' : '');
      q.push({ question: `"${snippet}" — Que filme é esse?`, options: opts, correct: opts.indexOf(targetTitle), poster: target.poster_path });
    }

    return q;
  }, [movies]);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === questions[current].correct) setScore(s => s + 1);
    setTimeout(() => {
      if (current + 1 >= questions.length) { setFinished(true); }
      else { setCurrent(c => c + 1); setSelected(null); }
    }, 900);
  };

  if (questions.length === 0) return null;

  const q = questions[current];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden"
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Trophy size={15} style={{ color: '#e53e3e' }} />
            <span className="text-white font-black text-xs uppercase tracking-widest">Desafios de Quem Sabe</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <X size={13} className="text-white/60" />
          </button>
        </div>

        {finished ? (
          /* Result screen */
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: score >= questions.length / 2 ? 'rgba(229,62,62,0.2)' : 'rgba(255,255,255,0.05)', border: `2px solid ${score >= questions.length / 2 ? '#e53e3e' : 'rgba(255,255,255,0.12)'}` }}>
              <Trophy size={32} style={{ color: score >= questions.length / 2 ? '#e53e3e' : '#555' }} />
            </div>
            <div>
              <p className="text-white font-black text-2xl mb-1">{score}/{questions.length}</p>
              <p className="font-black uppercase tracking-widest text-xs" style={{ color: score >= questions.length / 2 ? '#fc8181' : 'rgba(255,255,255,0.4)' }}>
                {score === questions.length ? 'Perfeito! 🏆' : score >= questions.length / 2 ? 'Bom trabalho!' : 'Continue praticando!'}
              </p>
            </div>
            <button
              onClick={() => { setCurrent(0); setSelected(null); setScore(0); setFinished(false); }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-xs transition-all"
              style={{ background: '#e53e3e', color: '#fff' }}
            >
              <RotateCcw size={12} /> Tentar Novamente
            </button>
            <button onClick={onClose} className="text-white/30 font-bold text-xs uppercase tracking-widest">Fechar</button>
          </div>
        ) : (
          /* Question screen */
          <div className="p-5 space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((current + 1) / questions.length) * 100}%`, background: '#e53e3e' }} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{current + 1}/{questions.length}</span>
            </div>

            {/* Poster */}
            {q.poster && (
              <div className="w-full h-28 rounded-xl overflow-hidden relative">
                <img
                  src={q.poster?.startsWith('http') ? q.poster : `https://image.tmdb.org/t/p/w500/${q.poster}`}
                  className="w-full h-full object-cover object-top"
                  style={{ opacity: 0.5 }}
                  alt=""
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #111 0%, transparent 60%)' }} />
              </div>
            )}

            {/* Question */}
            <p className="text-white font-bold text-sm leading-snug">{q.question}</p>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                let bg = 'rgba(255,255,255,0.05)';
                let border = 'rgba(255,255,255,0.08)';
                let color = 'rgba(255,255,255,0.8)';
                if (selected !== null) {
                  if (i === q.correct) { bg = 'rgba(52,211,153,0.15)'; border = '#34d399'; color = '#34d399'; }
                  else if (i === selected && selected !== q.correct) { bg = 'rgba(229,62,62,0.15)'; border = '#e53e3e'; color = '#fc8181'; }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className="w-full text-left rounded-xl px-4 py-3 text-xs font-bold transition-all"
                    style={{ background: bg, border: `1px solid ${border}`, color }}
                  >
                    <span className="font-black mr-2 opacity-50">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const TrendingView = React.memo(({ top10Movies, top10Series, handleSelectMovie, toggleMyList, toggleFavorite, myListIds, favoriteIds, continueWatching, myMovies, franchises }: any) => {
  const [activeRange, setActiveRange] = useState<'daily' | 'weekly' | 'vital'>('daily');
  const [filter, setFilter] = useState('Todos os Gêneros');
  const [activeGenre, setActiveGenre] = useState('Anime');
  const [showQuiz, setShowQuiz] = useState(false);
  const navigate = useNavigate();

  const filteredMovies = useMemo(() => {
    let list = [...top10Movies];
    if (activeRange === 'vital') {
      list = [...continueWatching].slice(0, 15);
      if (list.length < 5) list = [...myMovies].sort((a,b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 15);
    } else if (activeRange === 'weekly') {
      const now = new Date().getTime();
      list = [...myMovies].filter(m => m.created_at && (now - new Date(m.created_at).getTime()) < (7*24*60*60*1000)).sort((a,b) => (b.vote_average||0)-(a.vote_average||0)).slice(0,15);
    } else {
      const now = new Date().getTime();
      const daily = [...myMovies].filter(m => m.created_at && (now - new Date(m.created_at).getTime()) < (24*60*60*1000));
      list = daily.length >= 5 ? daily.slice(0,15) : [...top10Movies];
    }
    if (filter !== 'Todos os Gêneros') list = list.filter(m => m.genres?.toLowerCase().includes(filter.toLowerCase()));
    return list;
  }, [activeRange, top10Movies, myMovies, continueWatching, filter]);

  const featured = filteredMovies[0] || top10Movies[0];
  const editorialCards = top10Movies.slice(1, 3);
  const fanArtPosters = myMovies.slice(0, 4);
  const rangeTabs = [
    { id: 'daily', label: 'Hoje' },
    { id: 'weekly', label: 'Semanal' },
    { id: 'vital', label: 'Vital' },
  ];
  const genreTabs = [
    { id: 'Todos os Gêneros', label: 'Todos os Gêneros' },
    { id: 'Ação', label: 'Ação' },
    { id: 'Drama', label: 'Drama' },
    { id: 'Comédia', label: 'Comédia' },
  ];
  const subGenreTabs = ['Anime', 'Infantil', 'Clássicos'];
  const quizCards = [
    { label: 'QUIZ', bg: '#c53030', type: 'text' },
    { label: '🤔', bg: '#2d3748', type: 'emoji' },
    { label: 'STAGE 4', bg: '#553c9a', type: 'text' },
  ];

  return (
    <motion.div
      key="trending"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#0d0d0d] pb-24 overflow-x-hidden"
    >
      {/* ── HERO BANNER ── */}
      {featured && (
        <div className="relative w-full overflow-hidden" style={{ height: 'clamp(280px, 45vw, 420px)' }}>
          <motion.img
            key={featured.id}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.72 }}
            transition={{ duration: 1.2 }}
            src={featured.backdrop_path?.startsWith('http') ? featured.backdrop_path : `https://image.tmdb.org/t/p/original/${featured.backdrop_path}`}
            className="absolute inset-0 w-full h-full object-cover"
            alt="Featured"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0d0d0d 0%, rgba(13,13,13,0.55) 55%, rgba(13,13,13,0.25) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(13,13,13,0.9) 0%, transparent 65%)' }} />

          <div className="relative h-full flex flex-col justify-end px-4 md:px-10 pb-5 md:pb-8 z-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-sm" style={{ background: '#e53e3e', borderLeft: '3px solid #fc8181' }}>
                  Lançamento Quente
                </span>
                <span className="text-white/40 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                  : {featured.genres?.split(',')[0] || 'Em Destaque'}
                </span>
              </div>
              <h2 className="font-black text-white uppercase tracking-tighter leading-none mb-3 md:mb-4" style={{ fontSize: 'clamp(26px, 7vw, 56px)', borderLeft: '4px solid #e53e3e', paddingLeft: '10px' }}>
                {featured.title || featured.name}
              </h2>
              <div className="flex items-center gap-3 md:gap-5">
                <span className="flex items-center gap-1 text-[11px] md:text-sm font-bold text-white/80">
                  🎯 <span>{featured.vote_average?.toFixed(1) || '—'}/10</span>
                </span>
                <span className="text-white/20 text-xs">|</span>
                <span className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest">
                  Duration ⏱ <span className="text-white/80">{featured.runtime || '—'}m</span>
                </span>
                <span className="text-white/20 text-xs">|</span>
                <span className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest">
                  Year 💎 <span className="text-white/80">{featured.release_date?.split('-')[0] || '—'}</span>
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── CURADORIA EXCLUSIVA ── */}
      {editorialCards.length > 0 && (
        <div className="px-4 md:px-10 mt-4">
          <h3 className="text-[11px] md:text-xs font-black uppercase tracking-widest text-white/90 mb-3">Curadoria Exclusiva</h3>
          <div className="flex gap-2 md:gap-3">
            {editorialCards.map((card: any, i: number) => (
              <div
                key={card.id}
                className="flex-1 relative rounded-xl overflow-hidden cursor-pointer group"
                style={{ height: 'clamp(100px, 25vw, 140px)', border: '1px solid rgba(255,255,255,0.06)' }}
                onClick={() => handleSelectMovie(card)}
              >
                <img
                  src={card.backdrop_path?.startsWith('http') ? card.backdrop_path : `https://image.tmdb.org/t/p/w500/${card.backdrop_path || card.poster_path}`}
                  alt={card.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ opacity: 0.58 }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 55%)' }} />
                <div className="absolute inset-0 p-2.5 md:p-3 flex flex-col justify-end">
                  {i === 0 && <span className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#e53e3e' }}>Em Alta</span>}
                  <p className="text-white text-[10px] md:text-xs font-bold leading-tight line-clamp-2">{card.title || card.name}</p>
                  {card.overview && <p className="text-white/40 text-[8px] mt-0.5 leading-tight line-clamp-1 hidden md:block">{card.overview}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}
      {featured && (
        <div className="px-4 md:px-10 mt-4 flex gap-2">
          <button
            onClick={() => handleSelectMovie(featured)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest py-2.5 md:py-3 transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <Zap size={11} fill="currentColor" /> Imersão Imediata
          </button>
          <button
            onClick={() => toggleMyList(featured)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest py-2.5 md:py-3 transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
          >
            {myListIds?.has(featured.id) ? <Check size={11} /> : <Plus size={11} />} Minha Lista
          </button>
        </div>
      )}

      {/* ── FEATURE CARDS (biblioteca + quiz) ── */}
      <div className="px-4 md:px-10 mt-4 flex gap-2 md:gap-3">
        {/* Biblioteca de Saber */}
        <div
          className="flex-1 relative rounded-xl overflow-hidden cursor-pointer"
          style={{ height: 'clamp(80px, 20vw, 110px)', background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => navigate('/search')}
        >
          <div className="absolute top-2.5 left-2.5 flex -space-x-2">
            {(fanArtPosters.length > 0 ? fanArtPosters : editorialCards).slice(0, 4).map((m: any, i: number) => (
              <div key={m.id} className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden" style={{ border: '1.5px solid #0d0d0d', zIndex: 4 - i }}>
                <img src={m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w92/${m.poster_path}`} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-white text-[9px] md:text-[10px] font-black uppercase leading-tight">
              Biblioteca de Saber<br />
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Galeria de Fan-Art</span>
            </p>
          </div>
        </div>

        {/* Desafios de Quem Sabe */}
        <div
          className="flex-1 relative rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
          style={{ height: 'clamp(80px, 20vw, 110px)', background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => setShowQuiz(true)}
        >
          <div className="absolute top-2.5 right-2.5">
            <Trophy size={16} style={{ color: '#e53e3e' }} />
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#e53e3e' }}>Quiz</p>
            <p className="text-white text-[9px] md:text-[10px] font-black uppercase leading-tight">Desafios de<br/>Quem Sabe</p>
          </div>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="mt-5 px-4 md:px-10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {rangeTabs.map(tab => {
            const isActive = activeRange === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveRange(tab.id as any)}
                className="flex-none flex items-center gap-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{ background: isActive ? 'rgba(229,62,62,0.18)' : 'rgba(255,255,255,0.05)', color: isActive ? '#fc8181' : 'rgba(255,255,255,0.45)', border: isActive ? '1px solid rgba(229,62,62,0.35)' : '1px solid rgba(255,255,255,0.07)' }}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                {tab.label}
              </button>
            );
          })}
          <div className="w-px h-5 bg-white/10 self-center mx-0.5 flex-shrink-0" />
          {genreTabs.map(tab => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className="flex-none rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{ background: isActive ? '#fff' : 'rgba(255,255,255,0.05)', color: isActive ? '#000' : 'rgba(255,255,255,0.45)', border: isActive ? 'none' : '1px solid rgba(255,255,255,0.07)' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* sub-genre pills */}
        <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
          {subGenreTabs.map(g => {
            const isActive = activeGenre === g;
            return (
              <button
                key={g}
                onClick={() => setActiveGenre(g)}
                className="flex-none rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{ background: isActive ? 'rgba(229,62,62,0.14)' : 'rgba(255,255,255,0.04)', color: isActive ? '#e53e3e' : 'rgba(255,255,255,0.35)', border: isActive ? '1px solid rgba(229,62,62,0.28)' : '1px solid rgba(255,255,255,0.05)' }}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT LIST ── */}
      {filteredMovies.length > 0 && (
        <div className="px-4 md:px-10 mt-5">
          <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2">
            {filteredMovies.slice(0, 10).map((movie: any, idx: number) => (
              <motion.div
                key={movie.id}
                whileHover={{ scale: 1.04 }}
                className="flex-none cursor-pointer relative group"
                style={{ width: 'clamp(110px, 28vw, 160px)' }}
                onClick={() => handleSelectMovie(movie)}
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <img
                    src={movie.poster_path?.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt={movie.title}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <span className="text-white font-black text-[8px]">{idx + 1}</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play size={12} fill="#000" className="text-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-white/70 text-[9px] font-bold mt-1.5 line-clamp-1 uppercase tracking-tight">{movie.title || movie.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── DESAFIOS DE QUEM SABE ── */}
      <div className="px-4 md:px-10 mt-6">
        <div className="flex items-center justify-between mb-3">
          <button className="flex items-center gap-2" onClick={() => setShowQuiz(true)}>
            <Trophy size={14} style={{ color: '#e53e3e' }} />
            <div className="text-left">
              <p className="text-white text-[11px] md:text-xs font-black uppercase tracking-widest">Desafios de Quem Sabe</p>
              <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Toque para jogar</p>
            </div>
          </button>
          <button
            onClick={() => setShowQuiz(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Play size={10} fill="currentColor" className="text-white/60 ml-0.5" />
          </button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {quizCards.map((card, i) => (
            <div
              key={i}
              onClick={() => setShowQuiz(true)}
              className="flex-none rounded-xl overflow-hidden cursor-pointer flex items-center justify-center active:scale-95 transition-transform"
              style={{ width: 'clamp(90px, 24vw, 120px)', height: 'clamp(90px, 24vw, 120px)', background: card.bg, border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="font-black text-white text-center px-2" style={{ fontSize: card.type === 'emoji' ? 'clamp(24px,8vw,36px)' : 'clamp(12px,3.5vw,16px)', lineHeight: 1.1 }}>
                {card.label}
              </span>
            </div>
          ))}
          {top10Movies.slice(3, 5).map((m: any) => (
            <div
              key={m.id}
              className="flex-none rounded-xl overflow-hidden cursor-pointer relative"
              style={{ width: 'clamp(90px, 24vw, 120px)', height: 'clamp(90px, 24vw, 120px)' }}
              onClick={() => handleSelectMovie(m)}
            >
              <img src={m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185/${m.poster_path}`} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── SÉRIE EM DESTAQUE ── */}
      {top10Series.length > 0 && (
        <div className="px-4 md:px-10 mt-6">
          <h3 className="text-[11px] md:text-xs font-black uppercase tracking-widest text-white/70 mb-3">Séries em Alta</h3>
          <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2">
            {top10Series.slice(0, 8).map((s: any) => (
              <div
                key={s.id}
                className="flex-none cursor-pointer group"
                style={{ width: 'clamp(110px, 28vw, 150px)' }}
                onClick={() => handleSelectMovie(s)}
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <img src={s.poster_path?.startsWith('http') ? s.poster_path : `https://image.tmdb.org/t/p/w342/${s.poster_path}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={s.name} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)' }} />
                  <div className="absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                      <Play size={10} fill="#000" className="ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-white/60 text-[9px] font-bold mt-1 line-clamp-1 uppercase tracking-tight">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COLEÇÕES ── */}
      <CollectionsCarousel franchises={franchises} />

      {/* ── COMENTÁRIOS SOCIAIS ── */}
      <div className="px-4 md:px-10 mt-6 space-y-3">
        {[
          { user: 'Espectador_A', text: 'O melhor episódio! 🔥', color: '#e53e3e' },
          { user: 'Espectador_B', text: 'Mestre incrível ❤️', color: '#a78bfa' },
          { user: 'Espectador_C', text: 'Top 10 confirmado 🏆', color: '#34d399' },
        ].map((c, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex-none flex items-center justify-center font-black text-[10px]" style={{ background: c.color + '22', border: `1.5px solid ${c.color}44`, color: c.color }}>
              {c.user[0]}
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>@{c.user}</span>
              <span className="text-[10px] font-medium ml-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{c.text}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── QUIZ MODAL ── */}
      <AnimatePresence>
        {showQuiz && (
          <QuizModal movies={[...top10Movies, ...top10Series]} onClose={() => setShowQuiz(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

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


const MovieDetailRouteWrapper = ({ 
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

  // Se veio do state da navegação e o ID bate, usamos diretamente (evita busca errada no TMDB)
  // Normaliza type a partir de media_type caso não esteja definido
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
         // Usa media_type do state para saber qual endpoint chamar primeiro
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
              genres: res.data.genres?.map((g:any) => g.name).join(', ') || '',
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
               genres: res2.data.genres?.map((g:any) => g.name).join(', ') || '',
               type: 'series',
               episodes: [],
               videoUrl: '',
               number_of_seasons: res2.data.number_of_seasons || 1,
            });
         };

         try {
            if (isTV) {
               await fetchTV();
            } else {
               await fetchMovie();
            }
         } catch (e) {
            try {
               if (isTV) {
                  await fetchMovie();
               } else {
                  await fetchTV();
               }
            } catch (e2) {
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
    return {
      ...base,
      last_position: watchHistory[base.id] || base.last_position || 0
    };
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

  return (
    <MovieDetailsModal 
      movie={movie}
      onClose={closeMovieDetails}
      onPlay={(m, url, time, playerStyle, episodeIndex) => handlePlayMovie(m, url, time, playerStyle, episodeIndex)}
      onToggleMyList={() => toggleMyList(movie)}
      onToggleFavorite={() => toggleFavorite(movie)}
      similarMovies={myMovies.filter((m: any) => m.id?.toString() !== movie.id?.toString()).slice(0, 10)}
      onSelectSimilar={(similar) => navigate(`/movie/${similar.id}`, { state: location.state })}
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

  const PlayerRouteWrapper = ({ myMovies, profile, closePlayer, handleSelectMovie, handlePlayMovie, onProgress, activeRoomId, isAppHost, appSettings }: any) => {
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
  const isHost = isAppHost || (activeRoomId ? true : false); // If activeRoomId is set in App.tsx state, they created it. Otherwise from URL, they are not host.

  const movie = useMemo(() => {
    if (movieFromState && movieFromState.id.toString() === movieId) return movieFromState;
    return myMovies.find((m: any) => m.id.toString() === movieId);
  }, [movieId, myMovies, movieFromState]);
  
  const videoUrl = useMemo(() => {
    if (!movie) return '';
    // For series: always use the sorted first episode as fallback (not DB insertion order)
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
      movie={{...movie, videoUrl: videoUrl || movie.video_url || movie.videoUrl}} 
      onClose={closePlayer}
      profileId={profile?.id}
      profile={profile}
      recommendations={recommendations}
      onProgress={onProgress}
      onPlayNext={(m, url, idx) => {
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
const ProviderViewWrapper = ({ myMovies, handleSelectMovie, toggleMyList, toggleFavorite, myListIds, favoriteIds }: any) => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  
  const providerMovies = useMemo(() => {
    if (!providerId) return [];
    
    // Normalização para busca robusta
    const pIdNormalized = providerId.toLowerCase().replace(/\s+/g, '').replace(/[+]/g, 'plus');
    const pIdDirect = providerId.toLowerCase();
    
    // Mapeamento de apelidos comuns ou variações
    const providerAliases: Record<string, string[]> = {
      'apple tv+': ['apple', 'atvp', 'apple tv', 'apple tv plus'],
      'paramount+': ['paramount', 'pmnt', 'paramount plus'],
      'disney+': ['disney', 'star+', 'star plus'],
      'max': ['hbo', 'warner'],
      'netflix': ['nflx']
    };

    const aliases = providerAliases[pIdDirect] || [];
    
    return myMovies.filter((m: any) => {
      if (!m.watch_providers) return false;
      const wp = m.watch_providers.toLowerCase();
      const wpNormalized = wp.replace(/\s+/g, '').replace(/[+]/g, 'plus');
      
      const containsDirect = wp.includes(pIdDirect) || wpNormalized.includes(pIdNormalized);
      const containsAlias = aliases.some(alias => wp.includes(alias));
      
      // Also check if provider Name is in the title for originals
      const title = (m.title || m.name || '').toLowerCase();
      const isOriginal = aliases.some(alias => title.includes(alias));

      return containsDirect || containsAlias || isOriginal;
    });
  }, [myMovies, providerId]);

  return (
    <ProviderPage 
      provider={providerId || ''}
      movies={providerMovies}
      onClose={() => navigate('/menu')}
      onSelectMovie={handleSelectMovie}
      onToggleMyList={toggleMyList}
      onToggleFavorite={toggleFavorite}
      myListIds={myListIds}
      favoriteIds={favoriteIds}
    />
  );
};

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
    return CATEGORIES.find(c => c.name.toLowerCase() === genreName?.toLowerCase());
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

import PlansScreen from './components/PlansScreen';

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
  setIsPlansScreenOpen // injected
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
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-900 rounded-[1.5rem] blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
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
  const [myMovies, setMyMovies] = useState<Movie[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [continueWatching, setContinueWatching] = useState<Movie[]>([]);
  const [watchHistory, setWatchHistory] = useState<Record<number, number>>({});
  
  // Novos estados para Abas e Pesquisa
  const activeTab = useMemo(() => {
    const path = location.pathname.split('/')[1] || 'menu';
    if (path === 'menu') return 'home';
    if (path === 'perfil') return 'profile';
    if (path === 'provider') return 'home';
    return path as any;
  }, [location.pathname]);

  const [activeFranchise, setActiveFranchise] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
    const heroKeywords = ['marvel', 'dc comics', 'batman', 'spider-man', 'spiderman', 'superman', 'avengers', 'vingadores', 'liga da justiça', 'justice league', 'x-men', 'herói', 'hero', 'super-herói'];
    return myMovies.filter(m => {
      const t = (m.title || '').toLowerCase();
      const o = (m.overview || '').toLowerCase();
      const g = (m.genres || '').toLowerCase();
      return heroKeywords.some(k => t.includes(k) || o.includes(k)) || g.includes('fantasia') || g.includes('ação');
    });
  }, [myMovies]);

  const collectionMovies = useMemo(() => {
    return myMovies.filter(m => {
      const t = (m.title || '').toLowerCase();
      const o = (m.overview || '').toLowerCase();
      return FRANCHISES.some(f => f.keywords.some(k => t.includes(k) || o.includes(k)));
    }).sort((a, b) => {
      const dateA = String(a.release_date || (a as any).release_year || '0');
      const dateB = String(b.release_date || (b as any).release_year || '0');
      return dateA.localeCompare(dateB);
    });
  }, [myMovies]);

  const dynamicFranchises = useMemo(() => {
    const list: any[] = [];
    const coveredMovieIds = new Set<number>();
    
    // Matcha filmes de uma franquia usando título, nome, overview, gêneros e atores
    const matchesFranchise = (m: Movie, keywords: string[]) => {
      const fields = [
        (m.title || '').toLowerCase(),
        ((m as any).name || '').toLowerCase(),
        (m.overview || '').toLowerCase(),
        (m.genres || '').toLowerCase(),
        (m.actors || '').toLowerCase(),
        (m.collection_name || '').toLowerCase(),
      ];
      return keywords.some(k => fields.some(f => f.includes(k)));
    };

    // 1. Franquias definidas (Marvel, DC, Disney, etc.)
    FRANCHISES.forEach(f => {
      const movies = myMovies.filter(m => matchesFranchise(m, f.keywords));
      
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
    myMovies.forEach(m => {
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
    myMovies.forEach(m => {
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
  }, [myMovies]);

  // Enriquece filmes sem collection_id consultando o TMDB em background
  const enrichCollectionsInBackground = React.useCallback(async (movies: Movie[]) => {
    if (!hasSupabase) return;
    const toEnrich = movies.filter(m => 
      !m.collection_id && 
      m.type !== 'series' && 
      (m.title || '').trim().length > 0
    ).slice(0, 60); // Processa até 60 filmes por vez

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
    // Re-carrega filmes após enriquecimento
    fetchMyMovies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSupabase]);

  // Dispara enriquecimento uma vez por sessão quando os filmes carregam
  const enrichedRef = React.useRef(false);
  useEffect(() => {
    if (myMovies.length > 0 && !enrichedRef.current) {
      enrichedRef.current = true;
      enrichCollectionsInBackground(myMovies);
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

    // Ouvir mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        localStorage.removeItem('active_profile');
        setIsAdmin(false);
      }
      setLoading(false);
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
    // Tentar carregar do cache primeiro
    const cached = localStorage.getItem('cached_my_movies');
    if (cached) {
      try {
        setMyMovies(JSON.parse(cached));
      } catch {}
    }

    if (!hasSupabase || !user) {
      console.log('fetchMyMovies: Sem Supabase ou Usuário', { hasSupabase, user: !!user });
      setIsLoadingMovies(false);
      return;
    }
    
    try {
      console.log('Buscando filmes do Supabase...');
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        throw error;
      }

      console.log(`Filmes encontrados: ${data?.length || 0}`);

      if (data) {
        const formattedMovies: Movie[] = data.map(m => {
          let cascadeSettings: { qualityCascadeDelay?: number; cascadeToV3OnPenultimate?: boolean } = {};
          try {
            const raw = localStorage.getItem(`netplay_cascade_${m.id}`);
            if (raw) cascadeSettings = JSON.parse(raw);
          } catch {}
          return {
            ...m,
            id: m.id,
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
            ...cascadeSettings,
          };
        });

        setMyMovies(formattedMovies);
        localStorage.setItem('cached_my_movies', JSON.stringify(formattedMovies));
      }
    } catch (error) {
      console.error('Erro ao buscar filmes do Supabase:', error);
    } finally {
      setIsLoadingMovies(false);
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

  useEffect(() => {
    if (user) {
      fetchMyMovies();
      fetchContinueWatching();

      // Adicionar listener em tempo real para a tabela de filmes
      const channel = supabase
        .channel('public:movies')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, () => {
          fetchMyMovies();
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
    return myMovies.filter(m => !m.is_hidden);
  }, [myMovies]);

  // Filtrar filmes para Lançamentos (2025-2026)
  const newMovies = useMemo(() => {
    return visibleMovies.filter(movie => {
      const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 
                   (movie.release_year ? parseInt(String(movie.release_year)) : 0);
      return year === 2025 || year === 2026;
    });
  }, [visibleMovies]);

  // Filtrar filmes para Fresquinho do Cinema (2026 e <= 5 meses)
  const cinemaMovies = useMemo(() => {
    const now = new Date();
    return visibleMovies.filter(movie => {
      if (!movie.release_date) return false;
      const releaseDate = new Date(movie.release_date);
      const year = releaseDate.getFullYear();
      
      if (year !== 2026) return false;

      const diffMonths = (now.getFullYear() - releaseDate.getFullYear()) * 12 + (now.getMonth() - releaseDate.getMonth());
      return diffMonths <= 5 && diffMonths >= 0;
    });
  }, [visibleMovies]);

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
    const now = new Date().getTime();
    return visibleMovies.filter(movie => {
      if (movie.last_rescanned_at) {
        const rescanDate = new Date(movie.last_rescanned_at).getTime();
        const diffHours = (now - rescanDate) / (1000 * 60 * 60);
        return diffHours <= 24;
      }
      return false;
    });
  }, [visibleMovies]);

  // Conteúdo TeraBox
  const teraboxMovies = useMemo(() => {
    return visibleMovies.filter(m => 
      m.videoUrl?.includes('terabox') || 
      m.videoUrl?.includes('1024terabox') || 
      m.videoUrl?.includes('teraboxapp')
    ).slice(0, 10);
  }, [visibleMovies]);

  // Conteúdo TARAPLAY (KingX/TeraDL)
  const taraplayMovies = useMemo(() => {
    return visibleMovies.filter(m => 
      m.videoUrl?.includes('player.kingx.dev') || 
      m.videoUrl?.includes('teradl.kingx.dev') ||
      m.videoUrl?.includes('gdplayer.to') ||
      m.videoUrl?.includes('gdplayer.org')
    );
  }, [visibleMovies]);

  // Função auxiliar para agrupar por gênero
  const groupByGenre = (movies: Movie[]) => {
    const grouped: { [key: string]: Movie[] } = {};
    movies.forEach(movie => {
      if (!movie.genres) {
        if (!grouped['Outros']) grouped['Outros'] = [];
        grouped['Outros'].push(movie);
        return;
      }
      const genres = movie.genres.split(',').map(g => g.trim());
      genres.forEach(genre => {
        if (!grouped[genre]) grouped[genre] = [];
        grouped[genre].push(movie);
      });
    });
    return Object.keys(grouped).sort().reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {} as { [key: string]: Movie[] });
  };

  const moviesByGenre = useMemo(() => groupByGenre(visibleMovies), [visibleMovies]);
  const newMoviesByGenre = useMemo(() => groupByGenre(newMovies), [newMovies]);

  // Filtrar filmes para a pesquisa
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return visibleMovies.filter(movie => {
      const title = (movie.title || "").toLowerCase();
      const name = (movie.name || "").toLowerCase();
      const originalName = (movie.original_name || "").toLowerCase();
      const genres = (movie.genres || "").toLowerCase();
      const overview = (movie.overview || "").toLowerCase();
      
      return title.includes(query) || 
             name.includes(query) || 
             originalName.includes(query) || 
             genres.includes(query) ||
             overview.includes(query);
    });
  }, [visibleMovies, searchQuery]);

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

  const handleSelectMovie = useCallback((movie: Movie) => {
    navigate(`/movie/${movie.id}`, { state: { backgroundLocation: location.pathname, movie } });
  }, [navigate, location.pathname]);

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

    const currentGenres = movie.genres.split(',').map(g => g.trim());
    
    // Calcular pontuação de similaridade baseada em gêneros comuns
    const scoredMovies = visibleMovies
      .filter(m => m.id?.toString() !== movie.id?.toString())
      .map(m => {
        let score = 0;
        if (m.genres) {
          const mGenres = m.genres.split(',').map(g => g.trim());
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

  if (loading || showIntro) {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
        <IntroVignette 
          isLoading={loading} 
          onComplete={() => {
            try { sessionStorage.setItem('netplay_intro_shown', '1'); } catch {}
            setShowIntro(false);
          }} 
          movies={myMovies}
        />
      </Suspense>
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
      return <AppInfo onContinue={(mode) => {
        if (mode) setInitialLoginMode(mode);
        setShowAppInfo(false);
      }} movies={myMovies} />;
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
          if (tab === 'search' && searchQuery) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
          } else {
            navigate(`/${tab === 'home' ? 'menu' : tab === 'profile' ? 'perfil' : tab === 'novos-eps' ? 'novos-episodios' : tab}`);
          }
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
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
          <Routes location={state?.backgroundLocation || location}>
            <Route path="/" element={<Navigate to={`/menu${location.search}`} replace />} />
          
          <Route path="/redefinirsenha" element={<Login initialMode="updatePassword" />} />
          <Route path="/confirmacao" element={<Login initialMode="login" />} />
          <Route path="/invite/:inviteId" element={
            <InviteRedirect />
          } />
          <Route path="/menu" element={
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
            />
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
          
          <Route path="/search" element={<AdvancedSearch onSelectMovie={handleSelectMovie} myMovies={myMovies} moviesByGenre={moviesByGenre} dynamicFranchises={dynamicFranchises} onSelectFranchise={setActiveFranchise} categories={categories} />} />
          <Route path="/filmes" element={
            <React.Suspense fallback={<div className="min-h-screen bg-black" />}>
              <FlixNovitiesPage onSelectMovie={handleSelectMovie} defaultFilter="movies" hideFilterBar={true} pageTitle="Filmes" />
            </React.Suspense>
          } />
          <Route path="/series" element={<ContentFilteredPage myMovies={visibleMovies} type="series" onSelectMovie={handleSelectMovie} isLoading={isLoadingMovies} />} />
          <Route path="/novos-episodios" element={<NewEpisodesView myMovies={myMovies} onEpisodeClick={handleSmartPlayEpisode} onSelectMovie={handleSelectMovie} />} />
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
          <Route path="/mylist" element={<MyListView myList={myList} handleSelectMovie={handleSelectMovie} navigate={navigate} />} />
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

          <Route path="/perfil" element={
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
          } />
          </Routes>
        </Suspense>

        {/* Modal Routes */}
        <AnimatePresence mode="wait">
        <Suspense fallback={null}>
          {/* @ts-expect-error - React-Router Types might not include key, but React allows it */}
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
    </div>
  </ThemeContext.Provider>
  );
}
