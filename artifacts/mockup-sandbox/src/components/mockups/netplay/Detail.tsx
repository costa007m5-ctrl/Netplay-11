import { useState } from "react";

const MOVIE = {
  title: "The Groove Under the Groove: Os Sons de Paulinho da Costa",
  backdrop: "https://image.tmdb.org/t/p/w1280/628Dep6AxEtDxjZoGP78TsOxYbK.jpg",
  poster: "https://image.tmdb.org/t/p/w342/9ppqLa4pkDjDp3cqpWRQqm5BUWQ.jpg",
  rating: "8.0",
  match: "92%",
  year: "2020",
  runtime: "1h 45min",
  genre: "Documentário • Música",
  overview: "Um mergulho profundo na vida e obra do lendário percussionista Paulinho da Costa, explorando sua influência na música mundial. Acompanhe a jornada de um artista que deixou sua marca em mais de 3.000 gravações ao lado dos maiores nomes do jazz, soul e pop internacional.",
};

const RELACIONADOS = [
  { id: 1, title: "Quincy", poster: "https://image.tmdb.org/t/p/w342/4MC9vFoJJ6BLFcgKoWEoqBhzd6c.jpg", rating: "8.3" },
  { id: 2, title: "Amy", poster: "https://image.tmdb.org/t/p/w342/iSZEJaxJkzS3kJc5B9aVZv0yOqF.jpg", rating: "7.8" },
  { id: 3, title: "Orquestra", poster: "https://image.tmdb.org/t/p/w342/9Gtg2DzBhmYamXBS1hKAhiwbBKS.jpg", rating: "8.2" },
  { id: 4, title: "Som Noir", poster: "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg", rating: "7.1" },
];

const TABS = ["Sobre", "Relacionados", "Detalhes"];

export function Detail() {
  const [activeTab, setActiveTab] = useState(0);
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [inList, setInList] = useState(false);
  const [rated, setRated] = useState(false);

  return (
    <div className="w-full min-h-screen bg-[#050505] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── BACKDROP HERO ── */}
      <div className="relative w-full" style={{ height: "42vh", minHeight: 280 }}>
        {!backdropLoaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse" />}
        <img
          src={MOVIE.backdrop}
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setBackdropLoaded(true)}
          style={{ opacity: backdropLoaded ? 1 : 0, transition: "opacity 0.5s" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.3) 0%, rgba(5,5,5,0) 25%, rgba(5,5,5,0.6) 70%, rgba(5,5,5,1) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(5,5,5,0.5) 0%, transparent 60%)" }} />

        {/* Back button */}
        <button className="absolute top-10 left-4 w-8 h-8 rounded-full flex items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
        </button>

        {/* Share button */}
        <button className="absolute top-10 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
        </button>

        {/* Badge */}
        <div className="absolute bottom-16 left-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-2" style={{ background: "rgba(255,26,26,0.2)", border: "1px solid rgba(255,26,26,0.4)", color: "#ff6b6b" }}>
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse inline-block" />
            Catálogo Premium
          </div>
        </div>
      </div>

      {/* ── MOVIE INFO ── */}
      <div className="px-4 -mt-12 relative z-10">
        <h1 className="text-lg font-black leading-tight mb-2" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>
          {MOVIE.title}
        </h1>

        <div className="flex items-center gap-3 mb-3">
          {/* Rating */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="text-yellow-400">★</span>
            <span>{MOVIE.rating}</span>
          </div>
          {/* Match */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "rgba(39,174,96,0.15)", border: "1px solid rgba(39,174,96,0.3)", color: "#2ecc71" }}>
            {MOVIE.match} compatível
          </div>
          <span className="text-white/40 text-xs">{MOVIE.year}</span>
          <span className="text-white/40 text-xs">{MOVIE.runtime}</span>
        </div>

        <p className="text-xs text-white/50 mb-4">{MOVIE.genre}</p>

        {/* CTA Button */}
        <button className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm mb-4 transition-all" style={{ background: "linear-gradient(135deg, #ff1a1a, #cc0000)", boxShadow: "0 4px 20px rgba(255,26,26,0.35)" }}>
          <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
          Assistir Agora
        </button>

        {/* Action row */}
        <div className="grid grid-cols-4 gap-1 mb-5">
          {[
            { icon: inList ? "M5 13l4 4L19 7" : "M12 4v16m-8-8h16", label: inList ? "Na Lista" : "Minha Lista", action: () => setInList(v => !v), active: inList },
            { icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", label: "Avaliar", action: () => setRated(v => !v), active: rated },
            { icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4", label: "Baixar", action: () => {} },
            { icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z", label: "Compartilhar", action: () => {} },
          ].map((a) => (
            <button key={a.label} onClick={a.action} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all" style={{ background: a.active ? "rgba(255,26,26,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${a.active ? "rgba(255,26,26,0.3)" : "rgba(255,255,255,0.06)"}` }}>
              <svg width="16" height="16" fill="none" stroke={a.active ? "#ff1a1a" : "rgba(255,255,255,0.7)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d={a.icon} />
              </svg>
              <span className="text-[9px] font-medium" style={{ color: a.active ? "#ff6b6b" : "rgba(255,255,255,0.45)" }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b mb-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              className="relative px-4 py-2 text-xs font-semibold transition-all"
              style={{ color: activeTab === i ? "white" : "rgba(255,255,255,0.35)" }}
            >
              {t}
              {activeTab === i && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: "#ff1a1a" }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 0 && (
          <div className="pb-8">
            <p className="text-sm text-white/70 leading-relaxed">{MOVIE.overview}</p>

            <div className="mt-5 space-y-2">
              {[
                { label: "Gênero", value: "Documentário, Música" },
                { label: "Ano", value: MOVIE.year },
                { label: "Duração", value: MOVIE.runtime },
                { label: "Classificação", value: "Livre" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span className="text-xs text-white/40 font-medium">{r.label}</span>
                  <span className="text-xs text-white/80">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="pb-8">
            <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wider">Títulos Relacionados</p>
            <div className="grid grid-cols-2 gap-3">
              {RELACIONADOS.map((m) => (
                <RelatedCard key={m.id} {...m} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="pb-8 space-y-3">
            {[
              { label: "Título Original", value: "The Groove Under the Groove" },
              { label: "Direção", value: "Carlos Saldanha" },
              { label: "Produção", value: "Sony Music Brasil" },
              { label: "Idioma Original", value: "Português (Brasil)" },
              { label: "Orçamento", value: "R$ 2.4 milhões" },
              { label: "Bilheteria", value: "R$ 8.1 milhões" },
            ].map(r => (
              <div key={r.label} className="flex flex-col gap-0.5 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider">{r.label}</span>
                <span className="text-sm text-white/80">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedCard({ title, poster, rating }: { title: string; poster: string; rating: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "2/3" }}>
      {!loaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
      <img src={poster} alt={title} className="w-full h-full object-cover" onLoad={() => setLoaded(true)} style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(transparent 55%, rgba(0,0,0,0.9) 100%)" }} />
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-[11px] font-bold leading-tight mb-1 line-clamp-2">{title}</p>
        <div className="flex items-center gap-1">
          <span className="text-yellow-400 text-[10px]">★</span>
          <span className="text-[10px] text-white/70">{rating}</span>
        </div>
      </div>
    </div>
  );
}
