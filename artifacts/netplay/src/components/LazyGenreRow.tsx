import React from 'react';
import { Movie } from '../types';

const LazyGenreRow = React.memo(({ genre, items, onExpand, MovieCard }: {
  genre: string; items: Movie[]; onExpand: (g: string) => void; MovieCard: React.FC<{ m: any; idx: number }>;
}) => {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    if (visible) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  return (
    <div ref={rowRef}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black uppercase tracking-tighter text-white">{genre}</h2>
        {items.length > 10 && (
          <button onClick={() => onExpand(genre)} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400 transition-colors">
            Ver todos ({items.length}) →
          </button>
        )}
      </div>
      {visible ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {items.slice(0, 10).map((m: any, idx: number) => (
            <div key={m.id} className="flex-none w-[110px] sm:w-[140px] md:w-[150px]">
              <MovieCard m={m} idx={idx} />
            </div>
          ))}
          {items.length > 10 && (
            <div className="flex-none w-[110px] sm:w-[140px] md:w-[150px]">
              <button onClick={() => onExpand(genre)} className="aspect-[2/3] w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-600/50 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white">
                <span className="text-xl font-black">+{items.length - 10}</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Ver mais</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[220px] rounded-xl bg-white/5 animate-pulse" />
      )}
    </div>
  );
});

export default LazyGenreRow;
