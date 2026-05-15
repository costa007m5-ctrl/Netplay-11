import { useState } from "react";
import { Play, Plus, Check, Trophy, RefreshCw, RotateCcw, Home, TrendingUp, Compass, Star, User, Zap, BookOpen, Swords, Baby, Clock3, Layers } from "lucide-react";

const TMDB = (path: string, size = "w780") =>
  path?.startsWith("http") ? path : `https://image.tmdb.org/t/p/${size}${path}`;

const featured = {
  title: "Dragon Ball",
  tagline: "Saga Clássica",
  score: "8.3",
  duration: "24m",
  year: "1986",
  backdrop: "https://image.tmdb.org/t/p/original/hKHZhUbIyUAjcSrqJThFGYIR6kI.jpg",
};

const editorialCards = [
  {
    id: 1,
    title: "O Caminho do Mestre",
    subtitle: "Uma Retrospectiva dos Treinamentos Icônicos",
    image: "https://image.tmdb.org/t/p/w500/3mj1KcFF4BiZn7NYHz2a9EkVhjW.jpg",
    badge: "EXCLUSIVO",
  },
  {
    id: 2,
    title: "Dragon Ball Z — O Início de Uma Lenda e Seus Legados Z & Super",
    subtitle: "",
    image: "https://image.tmdb.org/t/p/w500/doaM2oPmg47lYkF0oRn6j0GG7LT.jpg",
    badge: "DRAGONBALL Z",
  },
];

const quizCards = [
  { id: 1, type: "quiz", label: "QUIZ", color: "#e53e3e", players: 2 },
  { id: 2, type: "emoji", label: "🤔", color: "#2d3748", players: 36 },
  { id: 3, type: "stage", label: "STAGE 4", color: "#553c9a", players: 0 },
];

const comments = [
  { user: "User_A", text: "O melhor episódio!", avatar: "A" },
  { user: "User_B", text: "Master Roshi ❤️", avatar: "B" },
  { user: "User_C", text: "🔥🔥🔥", avatar: "C" },
];

const rangeTabs = ["HOJE", "SEMANAL", "VITAL", "TODOS OS GÊNEROS", "AÇÃO"];
const genreTabs = [
  { label: "ANIME", icon: <Layers size={11} /> },
  { label: "INFANTIL", icon: <Baby size={11} /> },
  { label: "CLÁSSICOS", icon: <Clock3 size={11} /> },
];

export function EmAlta() {
  const [activeRange, setActiveRange] = useState("TODOS OS GÊNEROS");
  const [activeGenre, setActiveGenre] = useState("ANIME");
  const [inList, setInList] = useState(false);

  return (
    <div
      className="relative w-full min-h-screen overflow-y-auto overflow-x-hidden text-white"
      style={{ background: "#0d0d0d", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ───── HERO BANNER ───── */}
      <div className="relative w-full" style={{ height: 340 }}>
        <img
          src={featured.backdrop}
          alt={featured.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.72 }}
        />
        {/* gradients */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0d0d0d 0%, rgba(13,13,13,0.55) 55%, rgba(13,13,13,0.3) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(13,13,13,0.9) 0%, transparent 70%)" }} />

        {/* content */}
        <div className="relative h-full flex flex-col justify-end px-4 pb-5 z-10">
          {/* hot badge */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm"
              style={{ background: "#e53e3e", borderLeft: "3px solid #ff6b6b" }}
            >
              Lançamento Quente
            </span>
            <span className="text-white/50 text-[9px] font-bold uppercase tracking-widest">
              : {featured.tagline}
            </span>
          </div>

          {/* title */}
          <h1
            className="font-black uppercase leading-none mb-3"
            style={{ fontSize: 38, letterSpacing: "-0.03em", borderLeft: "4px solid #e53e3e", paddingLeft: 10 }}
          >
            {featured.title}
          </h1>

          {/* stats row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 13 }}>🎯</span>
              <span className="text-[11px] font-bold text-white/80">{featured.score}/10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 11 }} className="text-white/40 uppercase font-black tracking-widest text-[8px]">DURATION</span>
              <span style={{ fontSize: 13 }}>⏱</span>
              <span className="text-[11px] font-bold text-white/80">{featured.duration}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 11 }} className="text-white/40 uppercase font-black tracking-widest text-[8px]">YEAR</span>
              <span style={{ fontSize: 13 }}>💎</span>
              <span className="text-[11px] font-bold text-white/80">{featured.year}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ───── CURADORIA EXCLUSIVA ───── */}
      <div className="px-4 mt-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-white/90 mb-3">Curadoria Exclusiva</h2>
        <div className="flex gap-2">
          {editorialCards.map((card) => (
            <div
              key={card.id}
              className="flex-1 relative rounded-xl overflow-hidden cursor-pointer"
              style={{ height: 120, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <img src={card.image} alt={card.title} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)" }} />
              <div className="absolute inset-0 p-2.5 flex flex-col justify-end">
                {card.badge && (
                  <span className="text-[8px] font-black uppercase tracking-widest mb-1"
                    style={{ color: "#e53e3e" }}>
                    {card.badge}
                  </span>
                )}
                <p className="text-white text-[10px] font-bold leading-tight line-clamp-2">{card.title}</p>
                {card.subtitle && (
                  <p className="text-white/50 text-[8px] mt-0.5 leading-tight line-clamp-1">{card.subtitle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───── ACTION BUTTONS ───── */}
      <div className="px-4 mt-4 flex gap-2">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-widest py-2.5"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}
        >
          <Zap size={11} fill="currentColor" />
          Imersão Imediata
        </button>
        <button
          onClick={() => setInList(!inList)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-full text-[10px] font-black uppercase tracking-widest py-2.5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
        >
          {inList ? <Check size={11} /> : <Plus size={11} />}
          Minha Lista
        </button>
      </div>

      {/* ───── FEATURE CARDS ───── */}
      <div className="px-4 mt-4 flex gap-2">
        {/* Biblioteca */}
        <div
          className="flex-1 rounded-xl overflow-hidden cursor-pointer relative"
          style={{ height: 88, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* stacked avatars */}
          <div className="absolute top-2 left-2 flex -space-x-1.5">
            {["https://image.tmdb.org/t/p/w92/3mj1KcFF4BiZn7NYHz2a9EkVhjW.jpg",
              "https://image.tmdb.org/t/p/w92/doaM2oPmg47lYkF0oRn6j0GG7LT.jpg",
              "https://image.tmdb.org/t/p/w92/hKHZhUbIyUAjcSrqJThFGYIR6kI.jpg"].map((src, i) => (
              <div key={i} className="w-6 h-6 rounded-full overflow-hidden" style={{ border: "1.5px solid #0d0d0d", zIndex: 3 - i }}>
                <img src={src} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-white text-[9px] font-black uppercase leading-tight">
              Biblioteca de Saber<br />
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Galeria de Fan-Art</span>
            </p>
          </div>
        </div>

        {/* Desafios */}
        <div
          className="flex-1 rounded-xl overflow-hidden cursor-pointer relative"
          style={{ height: 88, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="absolute top-2.5 right-2.5">
            <Trophy size={16} style={{ color: "#e53e3e" }} />
          </div>
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: "#e53e3e" }}>Quiz</p>
            <p className="text-white text-[9px] font-black uppercase leading-tight">Desafios de Quem Sabe</p>
          </div>
        </div>
      </div>

      {/* ───── FILTER TABS ───── */}
      <div className="mt-4 px-4">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {rangeTabs.map((tab) => {
            const isActive = activeRange === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveRange(tab)}
                className="flex-none flex items-center gap-1 rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 whitespace-nowrap transition-all"
                style={{
                  background: isActive ? "#fff" : "rgba(255,255,255,0.06)",
                  color: isActive ? "#000" : "rgba(255,255,255,0.6)",
                  border: isActive ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {tab === "HOJE" && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#e53e3e", flexShrink: 0 }}
                  />
                )}
                {tab}
              </button>
            );
          })}
        </div>

        {/* genre sub-filters */}
        <div className="flex gap-2 mt-2">
          {genreTabs.map((g) => {
            const isActive = activeGenre === g.label;
            return (
              <button
                key={g.label}
                onClick={() => setActiveGenre(g.label)}
                className="flex items-center gap-1.5 rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1.5 transition-all"
                style={{
                  background: isActive ? "rgba(229,62,62,0.15)" : "rgba(255,255,255,0.04)",
                  color: isActive ? "#e53e3e" : "rgba(255,255,255,0.45)",
                  border: isActive ? "1px solid rgba(229,62,62,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {g.icon}
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ───── DESAFIOS DE QUEM SABE ───── */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy size={14} style={{ color: "#e53e3e" }} />
            <div>
              <p className="text-white text-[11px] font-black uppercase tracking-widest">Desafios de Quem Sabe</p>
              <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Quiz</p>
            </div>
          </div>
          <button className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <RefreshCw size={11} className="text-white/40" />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {quizCards.map((card) => (
            <div
              key={card.id}
              className="flex-none rounded-xl overflow-hidden cursor-pointer relative"
              style={{ width: 100, height: 100, background: card.color, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* player count badge */}
              {card.players > 0 && (
                <div
                  className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5"
                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
                >
                  <User size={7} className="text-white/70" />
                  <span className="text-[8px] font-bold text-white/70">{card.players}</span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="font-black"
                  style={{
                    fontSize: card.type === "emoji" ? 32 : card.type === "stage" ? 13 : 16,
                    color: "#fff",
                    letterSpacing: card.type === "stage" ? "0.05em" : undefined,
                    textAlign: "center",
                    lineHeight: 1.1,
                  }}
                >
                  {card.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───── SOCIAL COMMENTS ───── */}
      <div className="px-4 mt-5 space-y-2.5">
        {comments.map((c, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex-none flex items-center justify-center font-black text-[10px]"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
            >
              {c.avatar}
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                @{c.user}
              </span>
              <span className="text-[10px] font-medium ml-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                {c.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ───── BOTTOM NAV ───── */}
      <div
        className="sticky bottom-0 w-full flex items-center justify-around px-2 py-2.5 mt-6"
        style={{ background: "rgba(13,13,13,0.95)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {[
          { icon: <Home size={20} />, label: "Home", active: false },
          { icon: <TrendingUp size={20} />, label: "Em Alta", active: true },
          { icon: <Compass size={20} />, label: "Discover", active: false },
          { icon: <Star size={20} />, label: "Novidades", active: false },
          { icon: <User size={20} />, label: "", active: false, isAvatar: true },
        ].map((item, i) => (
          <button key={i} className="flex flex-col items-center gap-0.5 px-2">
            <span style={{ color: item.active ? "#e53e3e" : "rgba(255,255,255,0.35)" }}>
              {item.isAvatar ? (
                <div className="w-6 h-6 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              ) : item.icon}
            </span>
            {item.label && (
              <span
                className="text-[8px] font-black uppercase tracking-widest"
                style={{ color: item.active ? "#e53e3e" : "rgba(255,255,255,0.25)" }}
              >
                {item.label}
              </span>
            )}
          </button>
        ))}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
