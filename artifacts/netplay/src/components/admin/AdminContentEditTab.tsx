import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Edit3, X, RefreshCw, Save, Plus, Trash2,
  Film, Tv, ChevronDown, ChevronUp, Loader2, CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import tmdb, { requests } from '../../services/tmdb';
import { translateToPortuguese } from '../../services/ai';

const IMG = (path: string | null | undefined, size = 'w185') =>
  path ? (path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`) : '';

export default function AdminContentEditTab() {
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [editingMovie, setEditingMovie] = useState<any | null>(null);
  const [isTmdbSearching, setIsTmdbSearching] = useState(false);
  const [tmdbSearchResults, setTmdbSearchResults] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('movies')
      .select('id,title,type,poster_path,video_url,is_hidden,rating,release_date')
      .order('created_at', { ascending: false });
    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
    setMovies(data || []);
    setLoading(false);
  }, [search, typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openEdit = async (m: any) => {
    const { data } = await supabase.from('movies').select('*').eq('id', m.id).single();
    setEditingMovie(data || m);
    setTmdbSearchResults([]);
  };

  const handleSearchTmdb = async () => {
    if (!editingMovie?.title) return;
    setIsTmdbSearching(true);
    try {
      const res = await tmdb.get(requests.searchMulti, { params: { query: editingMovie.title } });
      const results = res.data.results || [];
      if (results.length === 1) {
        await selectTmdbResult(results[0]);
        setTmdbSearchResults([]);
      } else {
        setTmdbSearchResults(results);
      }
    } catch {
      alert('Erro ao buscar no TMDB.');
    } finally {
      setIsTmdbSearching(false);
    }
  };

  const selectTmdbResult = async (result: any) => {
    setIsTmdbSearching(true);
    try {
      const isTv = result.media_type === 'tv' || !result.title;
      const detailsPath = isTv ? requests.tvDetails(result.id) : requests.movieDetails(result.id);
      const [detailsRes] = await Promise.all([
        tmdb.get(detailsPath, { params: { language: 'pt-BR' } }),
      ]);
      const d = detailsRes.data;
      let overview = d.overview;
      if (!overview) {
        try {
          const enRes = await tmdb.get(detailsPath, { params: { language: 'en-US' } });
          if (enRes.data.overview) overview = await translateToPortuguese(enRes.data.overview);
        } catch {}
      }
      setEditingMovie((prev: any) => ({
        ...prev,
        title: d.title || d.name || prev.title,
        overview,
        poster_path: d.poster_path || prev.poster_path,
        backdrop_path: d.backdrop_path || prev.backdrop_path,
        release_date: d.release_date || d.first_air_date || prev.release_date,
        rating: d.vote_average || prev.rating,
        runtime: d.runtime || d.episode_run_time?.[0] || prev.runtime,
        genres: (d.genres || []).map((g: any) => g.name).join(', ') || prev.genres,
      }));
      setTmdbSearchResults([]);
    } catch {
      alert('Erro ao carregar detalhes do TMDB.');
    } finally {
      setIsTmdbSearching(false);
    }
  };

  const handleTranslate = async () => {
    if (!editingMovie?.overview) return;
    setTranslating(true);
    try {
      const translated = await translateToPortuguese(editingMovie.overview);
      setEditingMovie((prev: any) => ({ ...prev, overview: translated }));
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie) return;
    setSaving(true);
    try {
      const updateData: any = {
        title: editingMovie.title,
        overview: editingMovie.overview,
        video_url: editingMovie.video_url || '',
        video_url_2: editingMovie.video_url_2 || '',
        poster_path: editingMovie.poster_path || '',
        backdrop_path: editingMovie.backdrop_path || '',
        release_date: editingMovie.release_date || '',
        release_year: editingMovie.release_date ? parseInt(editingMovie.release_date) : editingMovie.release_year,
        runtime: editingMovie.runtime || null,
        rating: editingMovie.rating || null,
        genres: editingMovie.genres || '',
        type: editingMovie.type || 'movie',
        is_hidden: editingMovie.is_hidden || false,
        actors: editingMovie.actors || '',
        watch_providers: editingMovie.watch_providers || '',
        logo_path: editingMovie.logo_path || '',
        updated_at: new Date().toISOString(),
      };
      if (editingMovie.type === 'series' && Array.isArray(editingMovie.episodes)) {
        updateData.episodes = editingMovie.episodes;
      }
      const { error } = await supabase.from('movies').update(updateData).eq('id', editingMovie.id);
      if (error) throw error;
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      setEditingMovie(null);
      load();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addEpisode = () => {
    const eps = editingMovie.episodes || [];
    const lastEp = eps[eps.length - 1];
    const nextNum = lastEp ? (lastEp.episodeNumber || 0) + 1 : 1;
    setEditingMovie((prev: any) => ({
      ...prev,
      episodes: [...(prev.episodes || []), {
        episodeNumber: nextNum,
        title: `Episódio ${nextNum}`,
        videoUrl: '',
        season: lastEp?.season || 1,
      }],
    }));
  };

  const removeEpisode = (idx: number) => {
    setEditingMovie((prev: any) => ({
      ...prev,
      episodes: prev.episodes.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateEpisode = (idx: number, field: string, value: any) => {
    setEditingMovie((prev: any) => ({
      ...prev,
      episodes: prev.episodes.map((ep: any, i: number) => i === idx ? { ...ep, [field]: value } : ep),
    }));
  };

  const syncEpisodesWithTMDB = async () => {
    if (!editingMovie) return;
    setIsTmdbSearching(true);
    try {
      const seasonsRes = await tmdb.get(`/tv/${editingMovie.id}/season/1`, { params: { language: 'pt-BR' } });
      const episodes = (seasonsRes.data.episodes || []).map((ep: any) => ({
        episodeNumber: ep.episode_number,
        season: ep.season_number,
        title: ep.name || `Episódio ${ep.episode_number}`,
        overview: ep.overview || '',
        videoUrl: '',
      }));
      setEditingMovie((prev: any) => ({ ...prev, episodes }));
    } catch {
      alert('Erro ao sincronizar episódios com TMDB.');
    } finally {
      setIsTmdbSearching(false);
    }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-red-600 transition-all';
  const labelCls = 'block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1';

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar título..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-red-600 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'movie', 'series'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(0); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${typeFilter === t ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}
            >
              {t === 'all' ? 'Todos' : t === 'movie' ? 'Filmes' : 'Séries'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-red-500" size={28} /></div>
      ) : (
        <>
          <div className="space-y-1.5">
            {movies.map(m => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/8 border border-white/5 hover:border-red-600/30 rounded-xl px-4 py-3 transition-all group cursor-pointer"
                onClick={() => openEdit(m)}
              >
                <div className="w-8 h-12 rounded-lg overflow-hidden bg-black/40 shrink-0 border border-white/10">
                  {m.poster_path && <img src={IMG(m.poster_path)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate italic uppercase leading-tight">{m.title}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                    {m.type === 'series' ? 'Série' : 'Filme'}
                    {m.release_date ? ` · ${m.release_date.slice(0, 4)}` : ''}
                    {m.is_hidden ? ' · 🔴 Oculto' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Editar</span>
                  <Edit3 size={14} className="text-red-600" />
                </div>
              </motion.div>
            ))}
            {movies.length === 0 && (
              <p className="text-center text-gray-600 text-sm font-bold py-16">Nenhum conteúdo encontrado.</p>
            )}
          </div>

          {/* Paginação */}
          <div className="flex justify-center gap-3 pt-2">
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-gray-400 hover:text-white transition-all">
                ← Anterior
              </button>
            )}
            {movies.length === PAGE && (
              <button onClick={() => setPage(p => p + 1)} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-gray-400 hover:text-white transition-all">
                Próxima →
              </button>
            )}
          </div>
        </>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingMovie && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setEditingMovie(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[#121212] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Edit3 size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black italic uppercase tracking-tighter">Editar Conteúdo</h2>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">ID: {editingMovie.id}</p>
                  </div>
                </div>
                <button onClick={() => setEditingMovie(null)} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coluna 1 */}
                  <div className="space-y-5">
                    {/* Título */}
                    <div>
                      <label className={labelCls}>Título</label>
                      <div className="flex gap-2 relative">
                        <input
                          value={editingMovie.title || ''}
                          onChange={e => setEditingMovie((p: any) => ({ ...p, title: e.target.value }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-red-600 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleSearchTmdb}
                          disabled={isTmdbSearching}
                          className="bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 rounded-xl px-4 flex items-center justify-center transition-all disabled:opacity-50"
                        >
                          {isTmdbSearching ? <Loader2 className="animate-spin text-red-600" size={16} /> : <RefreshCw size={16} className="text-red-600" />}
                        </button>
                        {tmdbSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-[800] mt-2 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto scrollbar-hide">
                            {tmdbSearchResults.map(r => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => selectTmdbResult(r)}
                                className="w-full p-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                              >
                                {r.poster_path
                                  ? <img src={`https://image.tmdb.org/t/p/w92${r.poster_path}`} className="w-9 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                                  : <div className="w-9 h-12 rounded-lg bg-white/5" />
                                }
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-white italic truncate uppercase">{r.title || r.name}</p>
                                  <p className="text-[10px] text-gray-500">{(r.release_date || r.first_air_date || '').slice(0, 4)} · {r.media_type === 'tv' ? 'Série' : 'Filme'}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sinopse */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sinopse</label>
                        <button type="button" onClick={handleTranslate} disabled={translating} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 disabled:opacity-50">
                          {translating ? 'Traduzindo...' : 'Traduzir p/ PT-BR'}
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        value={editingMovie.overview || ''}
                        onChange={e => setEditingMovie((p: any) => ({ ...p, overview: e.target.value }))}
                        className={`${inputCls} resize-none`}
                      />
                    </div>

                    {/* Links */}
                    <div>
                      <label className={labelCls}>Link Principal</label>
                      <input value={editingMovie.video_url || editingMovie.videoUrl || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, video_url: e.target.value, videoUrl: e.target.value }))} className={`${inputCls} font-mono text-blue-400 text-xs`} />
                    </div>
                    <div>
                      <label className={labelCls}>Link Secundário</label>
                      <input value={editingMovie.video_url_2 || editingMovie.videoUrl2 || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, video_url_2: e.target.value, videoUrl2: e.target.value }))} className={`${inputCls} font-mono text-red-400 text-xs`} />
                    </div>

                    {/* Data / Duração */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Lançamento</label>
                        <input value={editingMovie.release_date || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, release_date: e.target.value }))} placeholder="AAAA-MM-DD" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Duração (min)</label>
                        <input type="number" value={editingMovie.runtime || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, runtime: parseInt(e.target.value) || 0 }))} className={`${inputCls} font-mono`} />
                      </div>
                    </div>

                    {/* Avaliação / Ocultar */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Avaliação</label>
                        <input type="number" step="0.1" value={editingMovie.rating || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, rating: parseFloat(e.target.value) || 0 }))} className={`${inputCls} font-mono`} />
                      </div>
                      <div className="flex flex-col justify-end pb-1">
                        <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setEditingMovie((p: any) => ({ ...p, is_hidden: !p.is_hidden }))}>
                          <div className={`w-10 h-5 rounded-full transition-all relative ${editingMovie.is_hidden ? 'bg-red-600' : 'bg-gray-800'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingMovie.is_hidden ? 'left-6' : 'left-1'}`} />
                          </div>
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-white transition-colors">Ocultar</span>
                        </label>
                      </div>
                    </div>

                    {/* Atores / Plataformas */}
                    <div>
                      <label className={labelCls}>Atores / Elenco</label>
                      <input value={editingMovie.actors || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, actors: e.target.value }))} placeholder="Separados por vírgula" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Plataformas</label>
                      <input value={editingMovie.watch_providers || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, watch_providers: e.target.value }))} placeholder="Netflix, HBO..." className={inputCls} />
                    </div>
                  </div>

                  {/* Coluna 2 */}
                  <div className="space-y-5">
                    {/* Poster */}
                    <div>
                      <label className={labelCls}>Poster URL</label>
                      <div className="flex gap-3">
                        <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black">
                          <img src={IMG(editingMovie.poster_path)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        </div>
                        <input value={editingMovie.poster_path || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, poster_path: e.target.value }))} className={`${inputCls} text-xs self-center`} />
                      </div>
                    </div>

                    {/* Backdrop */}
                    <div>
                      <label className={labelCls}>Backdrop URL</label>
                      <input value={editingMovie.backdrop_path || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, backdrop_path: e.target.value }))} className={`${inputCls} text-xs`} />
                    </div>

                    {/* Logo */}
                    <div>
                      <label className={labelCls}>Logo URL</label>
                      <input value={editingMovie.logo_path || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, logo_path: e.target.value }))} className={`${inputCls} text-xs`} />
                    </div>

                    {/* Tipo / Gêneros */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Tipo</label>
                        <select value={editingMovie.type || 'movie'} onChange={e => setEditingMovie((p: any) => ({ ...p, type: e.target.value }))} className={`${inputCls} appearance-none`}>
                          <option value="movie">Filme</option>
                          <option value="series">Série</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Gêneros</label>
                        <input value={editingMovie.genres || ''} onChange={e => setEditingMovie((p: any) => ({ ...p, genres: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                  </div>

                  {/* Episódios (Séries) */}
                  {editingMovie.type === 'series' && (
                    <div className="col-span-1 md:col-span-2 pt-4 border-t border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-red-500">Episódios</h3>
                        <div className="flex gap-2">
                          <button type="button" onClick={syncEpisodesWithTMDB} disabled={isTmdbSearching} className="flex items-center gap-1.5 bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white text-[10px] font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                            {isTmdbSearching ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Sync TMDB
                          </button>
                          <button type="button" onClick={addEpisode} className="bg-white/5 hover:bg-white/10 text-[10px] font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1">
                            <Plus size={10} /> Episódio
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
                        {(editingMovie.episodes || []).map((ep: any, idx: number) => (
                          <EpisodeRow key={idx} ep={ep} idx={idx} onChange={updateEpisode} onRemove={removeEpisode} />
                        ))}
                        {(!editingMovie.episodes || editingMovie.episodes.length === 0) && (
                          <p className="text-gray-600 text-xs font-bold text-center py-6">Nenhum episódio. Clique em "+ Episódio" ou "Sync TMDB".</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 mt-8 pt-6 border-t border-white/5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded-xl font-black uppercase text-xs tracking-widest text-white transition-all shadow-lg"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : savedOk ? <CheckCircle size={14} /> : <Save size={14} />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button type="button" onClick={() => setEditingMovie(null)} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black uppercase text-xs tracking-widest text-gray-400 hover:text-white transition-all">
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EpisodeRow({ ep, idx, onChange, onRemove }: { ep: any; idx: number; onChange: (i: number, f: string, v: any) => void; onRemove: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black text-gray-500 uppercase">T{ep.season || 1}E{ep.episodeNumber}</span>
        </div>
        <p className="flex-1 text-xs font-bold text-white truncate">{ep.title || `Episódio ${ep.episodeNumber}`}</p>
        <div className="flex items-center gap-1 shrink-0">
          {ep.videoUrl ? <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />}
          {open ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          <div className="grid grid-cols-2 gap-2 pt-3">
            <div>
              <label className="block text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Temporada</label>
              <input type="number" value={ep.season || 1} onChange={e => onChange(idx, 'season', parseInt(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono" />
            </div>
            <div>
              <label className="block text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Episódio nº</label>
              <input type="number" value={ep.episodeNumber || idx + 1} onChange={e => onChange(idx, 'episodeNumber', parseInt(e.target.value))} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Título</label>
            <input value={ep.title || ''} onChange={e => onChange(idx, 'title', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Link do Vídeo</label>
            <input value={ep.videoUrl || ''} onChange={e => onChange(idx, 'videoUrl', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-blue-400" />
          </div>
          <button type="button" onClick={() => onRemove(idx)} className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-400 transition-colors">
            <Trash2 size={10} /> Remover episódio
          </button>
        </div>
      )}
    </div>
  );
}
