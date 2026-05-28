import { useState, useEffect, useRef } from "react";

const HERO = [
  {
    id: 1,
    title: "Das Schwarze Meer",
    subtitle: "Continue de onde parou",
    backdrop: "https://image.tmdb.org/t/p/w1280/628Dep6AxEtDxjZoGP78TsOxYbK.jpg",
    logo: null,
    rating: "8.3",
    year: "2023",
    genre: "Ação • Thriller",
    progress: 62,
  },
  {
    id: 2,
    title: "Oppenheimer",
    subtitle: "Em Alta no NETPLAY",
    backdrop: "https://image.tmdb.org/t/p/w1280/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    logo: null,
    rating: "8.6",
    year: "2023",
    genre: "Drama • Biografia",
    progress: 0,
  },
  {
    id: 3,
    title: "Duna: Parte 2",
    subtitle: "Novo Episódio Disponível",
    backdrop: "https://image.tmdb.org/t/p/w1280/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg",
    logo: null,
    rating: "8.5",
    year: "2024",
    genre: "Ficção Científica • Aventura",
    progress: 0,
  },
];

const EM_ALTA = [
  { id: 1, title: "Oppenheimer", poster: "https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", rating: "8.6" },
  { id: 2, title: "Duna 2", poster: "https://image.tmdb.org/t/p/w342/czembW0Rk1Ke7lCJGahbOhdCuhV.jpg", rating: "8.5" },
  { id: 3, title: "John Wick 4", poster: "https://image.tmdb.org/t/p/w342/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg", rating: "7.8" },
  { id: 4, title: "Godzilla", poster: "https://image.tmdb.org/t/p/w342/tMefBSflR6PGQLv7WvFPpTKpuKk.jpg", rating: "7.4" },
  { id: 5, title: "Avatar 2", poster: "https://image.tmdb.org/t/p/w342/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg", rating: "7.6" },
];

const CONTINUE = [
  { id: 1, title: "Das Schwarze Meer", poster: "https://image.tmdb.org/t/p/w342/9ppqLa4pkDjDp3cqpWRQqm5BUWQ.jpg", progress: 62, ep: "T1 E3" },
  { id: 2, title: "The Last of Us", poster: "https://image.tmdb.org/t/p/w342/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", progress: 28, ep: "T1 E5" },
  { id: 3, title: "House of Dragon", poster: "https://image.tmdb.org/t/p/w342/z2yahl2uefxDCl0nogcRBstwruJ.jpg", progress: 85, ep: "T2 E6" },
];

const MINHA_LISTA = [
  { id: 1, title: "Batman", poster: "https://image.tmdb.org/t/p/w342/74xTEgt7R36Fpooo50r9T25onhq.jpg" },
  { id: 2, title: "Coringa", poster: "https://image.tmdb.org/t/p/w342/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg" },
  { id: 3, title: "Thor", poster: "https://image.tmdb.org/t/p/w342/pIkRyD18kl4FhoCNQuWxWu5cBLM.jpg" },
  { id: 4, title: "Dr. Strange", poster: "https://image.tmdb.org/t/p/w342/svIDTNUoajS8dLEo7EosxvyAsgJ.jpg" },
];

const TABS = ["Em Alta", "Universos", "Ação", "Comédia", "Drama"];
const NAV = [
  { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", label: "Início", active: true },
  { icon: "M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z", label: "Canais" },
  { icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", label: "Buscar" },
  { icon: "M4 6h16M4 10h16M4 14h16M4 18h16", label: "Lista" },
  { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label: "Perfil" },
];

export function Home() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [imgLoaded, setImgLoaded] = useState<Record<number, boolean>>({});
  const hero = HERO[heroIdx];

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#050505] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── HERO BANNER ── */}
      <div className="relative w-full" style={{ height: "58vh", minHeight: 340 }}>
        {/* Backdrop */}
        {HERO.map((h, i) => (
          <div
            key={h.id}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          >
            <img
              src={h.backdrop}
              className="w-full h-full object-cover"
              onLoad={() => setImgLoaded(p => ({ ...p, [h.id]: true }))}
              style={{ display: imgLoaded[h.id] ? "block" : "none" }}
            />
            {!imgLoaded[h.id] && <div className="w-full h-full bg-zinc-900 animate-pulse" />}
          </div>
        ))}

        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.15) 0%, rgba(5,5,5,0) 30%, rgba(5,5,5,0.7) 70%, rgba(5,5,5,1) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(5,5,5,0.6) 0%, transparent 60%)" }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-10 pb-3">
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#ff1a1a" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            </div>
            <span className="font-black text-base tracking-wider uppercase" style={{ letterSpacing: "0.15em" }}>
              NET<span style={{ color: "#ff1a1a" }}>PLAY</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: "#ff1a1a" }}>
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=felix" className="w-full h-full" />
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(255,26,26,0.2)", border: "1px solid rgba(255,26,26,0.4)", color: "#ff6b6b" }}>
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse inline-block" />
            Catálogo Premium
          </div>

          <h1 className="text-2xl font-black leading-tight mb-0.5" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>
            {hero.title}
          </h1>

          <div className="flex items-center gap-2 mb-3 text-[11px]">
            <span className="text-yellow-400 font-bold">★ {hero.rating}</span>
            <span className="text-white/40">•</span>
            <span className="text-white/70">{hero.year}</span>
            <span className="text-white/40">•</span>
            <span className="text-white/70">{hero.genre}</span>
          </div>

          {/* Progress bar if continuing */}
          {hero.progress > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-white/50 mb-1">{hero.subtitle} — {hero.progress}%</p>
              <div className="h-0.5 w-full rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${hero.progress}%`, background: "#ff1a1a" }} />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all" style={{ background: "#ff1a1a", boxShadow: "0 0 20px rgba(255,26,26,0.4)" }}>
              <svg width="12" height="12" fill="white" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
              {hero.progress > 0 ? "Continuar" : "Assistir"}
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white/10 backdrop-blur-sm border border-white/20">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              Detalhes
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
          {HERO.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIdx(i)}
              className="rounded-full transition-all"
              style={{
                width: i === heroIdx ? 3 : 3,
                height: i === heroIdx ? 20 : 6,
                background: i === heroIdx ? "#ff1a1a" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0"
            style={activeTab === i
              ? { background: "#ff1a1a", color: "white", boxShadow: "0 0 12px rgba(255,26,26,0.4)" }
              : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── EM ALTA ── */}
      <Section title="Em Alta" accent="#ff1a1a" icon="🔥">
        <div className="flex gap-2.5 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {EM_ALTA.map((m) => (
            <PosterCard key={m.id} title={m.title} poster={m.poster} rating={m.rating} />
          ))}
        </div>
      </Section>

      {/* ── CONTINUE ASSISTINDO ── */}
      <Section title="Continue Assistindo" accent="#9b59b6" icon="▶">
        <div className="flex gap-3 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {CONTINUE.map((m) => (
            <ContinueCard key={m.id} {...m} />
          ))}
        </div>
      </Section>

      {/* ── MINHA LISTA ── */}
      <Section title="Minha Lista" accent="#3498db" icon="♥">
        <div className="flex gap-2.5 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {MINHA_LISTA.map((m) => (
            <PosterCard key={m.id} title={m.title} poster={m.poster} />
          ))}
        </div>
      </Section>

      <div className="h-24" />

      {/* ── NAVBAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-2">
        <div className="flex items-center justify-around rounded-2xl px-2 py-2" style={{
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.5)"
        }}>
          {NAV.map((n) => (
            <button key={n.label} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl relative transition-all" style={n.active ? { background: "rgba(255,26,26,0.12)" } : {}}>
              {n.active && <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />}
              <svg width="20" height="20" fill="none" stroke={n.active ? "#ff1a1a" : "rgba(255,255,255,0.45)"} strokeWidth={n.active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d={n.icon} />
              </svg>
              <span className="text-[9px] font-semibold" style={{ color: n.active ? "#ff1a1a" : "rgba(255,255,255,0.4)" }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, accent, icon, children }: { title: string; accent: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="font-bold text-sm text-white">{title}</span>
        </div>
        <button className="text-[11px] font-semibold" style={{ color: accent }}>Ver todos</button>
      </div>
      {children}
    </div>
  );
}

function PosterCard({ title, poster, rating }: { title: string; poster: string; rating?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="shrink-0 relative" style={{ width: 100, borderRadius: 10, overflow: "hidden" }}>
      {!loaded && <div className="bg-zinc-800 animate-pulse rounded-[10px]" style={{ width: 100, height: 148 }} />}
      <img
        src={poster}
        alt={title}
        className="object-cover rounded-[10px] transition-transform hover:scale-105"
        style={{ width: 100, height: 148, display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
      />
      {rating && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <span className="text-yellow-400">★</span> {rating}
        </div>
      )}
    </div>
  );
}

function ContinueCard({ title, poster, progress, ep }: { title: string; poster: string; progress: number; ep: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="shrink-0 relative" style={{ width: 155, borderRadius: 12, overflow: "hidden" }}>
      {!loaded && <div className="bg-zinc-800 animate-pulse rounded-[12px]" style={{ width: 155, height: 90 }} />}
      <img
        src={poster}
        alt={title}
        className="object-cover"
        style={{ width: 155, height: 90, display: loaded ? "block" : "none", objectPosition: "top center" }}
        onLoad={() => setLoaded(true)}
      />
      <div className="absolute inset-0 flex items-end" style={{ background: "linear-gradient(transparent 30%, rgba(0,0,0,0.85) 100%)" }}>
        <div className="w-full px-2 pb-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-white/60 font-medium">{ep}</span>
            <span className="text-[9px] font-bold" style={{ color: "#ff1a1a" }}>{progress}%</span>
          </div>
          <div className="h-0.5 w-full rounded-full overflow-hidden bg-white/20">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "#ff1a1a" }} />
          </div>
        </div>
      </div>
      <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <svg width="8" height="8" fill="white" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
      </div>
    </div>
  );
}
