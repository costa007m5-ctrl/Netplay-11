import React, { useState, useEffect } from 'react';
import { Settings, Film, Tv, Save, RefreshCw, CheckCircle } from 'lucide-react';

const MOVIE_LIMIT_KEY = 'subaflix_movie_limit';
const SERIES_LIMIT_KEY = 'subaflix_series_limit';

const LIMIT_OPTIONS = [100, 200, 300, 500, 800, 1000, 1500, 2000];

const AdminSubaflixTab: React.FC = () => {
  const [movieLimit, setMovieLimit] = useState<number>(
    parseInt(localStorage.getItem(MOVIE_LIMIT_KEY) || '800', 10)
  );
  const [seriesLimit, setSeriesLimit] = useState<number>(
    parseInt(localStorage.getItem(SERIES_LIMIT_KEY) || '800', 10)
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(MOVIE_LIMIT_KEY, String(movieLimit));
    localStorage.setItem(SERIES_LIMIT_KEY, String(seriesLimit));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setMovieLimit(800);
    setSeriesLimit(800);
    localStorage.setItem(MOVIE_LIMIT_KEY, '800');
    localStorage.setItem(SERIES_LIMIT_KEY, '800');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 p-6 md:p-10 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center">
          <Settings className="text-red-500" size={22} />
        </div>
        <div>
          <h2 className="text-white font-black text-xl italic uppercase tracking-tighter">Subaflix</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Configurações de carregamento de conteúdo</p>
        </div>
      </div>

      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-6">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
          Define quantos títulos são carregados automaticamente nas abas Filmes e Séries. Quanto maior o número, mais conteúdo aparece nos carrosséis — mas o carregamento pode ser mais lento.
        </p>

        {/* Filmes */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Film size={16} className="text-red-500" />
            <span className="text-white font-black text-sm uppercase tracking-widest">Filmes</span>
            <span className="ml-auto text-red-400 font-black text-lg">{movieLimit}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LIMIT_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setMovieLimit(opt)}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  movieLimit === opt
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={movieLimit}
            onChange={e => setMovieLimit(Number(e.target.value))}
            className="w-full accent-red-600"
          />
        </div>

        {/* Séries */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <Tv size={16} className="text-red-500" />
            <span className="text-white font-black text-sm uppercase tracking-widest">Séries</span>
            <span className="ml-auto text-red-400 font-black text-lg">{seriesLimit}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LIMIT_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setSeriesLimit(opt)}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  seriesLimit === opt
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={seriesLimit}
            onChange={e => setSeriesLimit(Number(e.target.value))}
            className="w-full accent-red-600"
          />
        </div>
      </div>

      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
        <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest">
          Após salvar, recarregue o app para que o novo limite entre em vigor. Os carrosséis serão preenchidos com a quantidade configurada.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-black uppercase text-xs tracking-widest text-white transition-all shadow-lg shadow-red-600/20"
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black uppercase text-xs tracking-widest text-gray-400 hover:text-white transition-all"
        >
          <RefreshCw size={14} />
          Resetar (800)
        </button>
      </div>
    </div>
  );
};

export default AdminSubaflixTab;
