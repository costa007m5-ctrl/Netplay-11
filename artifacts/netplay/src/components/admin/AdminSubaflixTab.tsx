import React, { useState, useEffect } from 'react';
import { Settings, Film, Tv, Save, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';

const DEFAULT_LIMIT = 800;
const QUICK_OPTIONS = [100, 200, 500, 800, 1000, 2000, 5000];

const LimitControl: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ icon, label, value, onChange }) => {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setInputValue(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) onChange(n);
  };

  const handleQuickSelect = (opt: number) => {
    onChange(opt);
    setInputValue(String(opt));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-red-500">{icon}</span>
        <span className="text-white font-black text-sm uppercase tracking-widest">{label}</span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={() => {
              const n = parseInt(inputValue, 10);
              if (!isNaN(n) && n > 0) {
                onChange(n);
                setInputValue(String(n));
              } else {
                setInputValue(String(value));
              }
            }}
            className="w-24 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-red-400 font-black text-lg text-center outline-none focus:border-red-500 transition-colors"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_OPTIONS.map(opt => (
          <button
            key={opt}
            onClick={() => handleQuickSelect(opt)}
            className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              value === opt
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
            }`}
          >
            {opt >= 1000 ? `${opt / 1000}k` : opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const AdminSubaflixTab: React.FC = () => {
  const [movieLimit, setMovieLimit] = useState<number>(DEFAULT_LIMIT);
  const [seriesLimit, setSeriesLimit] = useState<number>(DEFAULT_LIMIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.movie_limit) setMovieLimit(parseInt(data.movie_limit, 10));
        if (data.series_limit) setSeriesLimit(parseInt(data.series_limit, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = async (ml: number, sl: number) => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_limit: String(ml), series_limit: String(sl) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => persist(movieLimit, seriesLimit);

  const handleReset = () => {
    setMovieLimit(DEFAULT_LIMIT);
    setSeriesLimit(DEFAULT_LIMIT);
    persist(DEFAULT_LIMIT, DEFAULT_LIMIT);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="text-red-500 animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-10 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center">
          <Settings className="text-red-500" size={22} />
        </div>
        <div>
          <h2 className="text-white font-black text-xl italic uppercase tracking-tighter">Subaflix</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Quantidade de conteúdo carregada automaticamente</p>
        </div>
      </div>

      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-8">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
          Define quantos títulos são carregados nas abas Filmes e Séries. Digite qualquer número ou escolha um valor rápido abaixo. Quanto maior, mais conteúdo nos carrosséis.
        </p>

        <LimitControl
          icon={<Film size={16} />}
          label="Filmes"
          value={movieLimit}
          onChange={setMovieLimit}
        />

        <div className="border-t border-white/10 pt-6">
          <LimitControl
            icon={<Tv size={16} />}
            label="Séries"
            value={seriesLimit}
            onChange={setSeriesLimit}
          />
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
          As configurações ficam salvas no servidor e valem para todos os usuários da plataforma.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded-xl font-black uppercase text-xs tracking-widest text-white transition-all shadow-lg shadow-red-600/20"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black uppercase text-xs tracking-widest text-gray-400 hover:text-white transition-all disabled:opacity-60"
        >
          <RefreshCw size={14} />
          Resetar ({DEFAULT_LIMIT})
        </button>
      </div>
    </div>
  );
};

export default AdminSubaflixTab;
