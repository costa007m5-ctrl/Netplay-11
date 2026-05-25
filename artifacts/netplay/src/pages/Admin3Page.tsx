import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trash2, Copy, Server, Tv2, ExternalLink, Loader2, RefreshCcw, AlertTriangle, CheckCircle2, Link, Database, Film, Clapperboard, ChevronDown, ChevronUp } from 'lucide-react';

interface DuplicateItem {
  id: number;
  title: string;
  type: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  video_url: string | null;
  video_url_2: string | null;
  tmdb_id: number | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

interface DuplicateGroup {
  items: DuplicateItem[];
  expanded: boolean;
}

function getPlayerBadges(item: DuplicateItem) {
  const badges: { label: string; color: string; bg: string; icon: React.ElementType }[] = [];
  if (item.video_url) badges.push({ label: 'Terabox', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/20', icon: Server });
  if (item.video_url_2) badges.push({ label: 'Link Admin', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/20', icon: Link });
  if (item.tmdb_id) {
    badges.push({ label: 'API Flix', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/20', icon: Tv2 });
    badges.push({ label: 'Net 2.0', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/20', icon: ExternalLink });
    badges.push({ label: 'Flix 3.0', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20', icon: Tv2 });
  }
  return badges;
}

export default function Admin3Page({ navigate }: { navigate: (to: any) => void }) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/duplicates');
      if (!res.ok) throw new Error('Erro ao buscar duplicatas');
      const data = await res.json();
      setGroups((data.duplicates as DuplicateItem[][]).map(items => ({ items, expanded: false })));
      setTotalItems(data.total);
      setTotalGroups(data.groups);
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDuplicates(); }, [fetchDuplicates]);

  const deleteItem = useCallback(async (id: number) => {
    setDeleting(prev => new Set([...prev, id]));
    try {
      const res = await fetch(`/api/admin/duplicates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar');
      setDeletedIds(prev => new Set([...prev, id]));
      setSuccessMsg('Item deletado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, []);

  const deleteAllDuplicatesInGroup = useCallback(async (groupIdx: number) => {
    const group = groups[groupIdx];
    const visibleItems = group.items.filter(i => !deletedIds.has(i.id));
    if (visibleItems.length <= 1) return;
    const toDelete = visibleItems.slice(1);
    const ids = toDelete.map(i => i.id);
    setBatchDeleting(true);
    try {
      const res = await fetch('/api/admin/duplicates/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Erro ao deletar em lote');
      setDeletedIds(prev => new Set([...prev, ...ids]));
      setSuccessMsg(`${ids.length} duplicata(s) removidas!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setBatchDeleting(false);
    }
  }, [groups, deletedIds]);

  const deleteAllDuplicates = useCallback(async () => {
    if (!confirm('Deletar TODAS as duplicatas? Apenas o primeiro registro de cada título será mantido. Esta ação não pode ser desfeita!')) return;
    setBatchDeleting(true);
    const allIds: number[] = [];
    for (const group of groups) {
      const visible = group.items.filter(i => !deletedIds.has(i.id));
      if (visible.length > 1) allIds.push(...visible.slice(1).map(i => i.id));
    }
    if (allIds.length === 0) { setBatchDeleting(false); return; }
    try {
      const res = await fetch('/api/admin/duplicates/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: allIds }),
      });
      if (!res.ok) throw new Error('Erro ao deletar em lote');
      setDeletedIds(prev => new Set([...prev, ...allIds]));
      setSuccessMsg(`${allIds.length} duplicatas removidas!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setBatchDeleting(false);
    }
  }, [groups, deletedIds]);

  const toggleGroup = (idx: number) => {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, expanded: !g.expanded } : g));
  };

  const activeDuplicateCount = groups.reduce((acc, g) => {
    const visible = g.items.filter(i => !deletedIds.has(i.id));
    return acc + Math.max(0, visible.length - 1);
  }, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-20 pb-32 px-4 md:px-12">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-black uppercase tracking-widest text-xs"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
        </div>

        <div className="mb-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Copy size={22} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500 tracking-tighter uppercase">
                Admin 3.0
              </h1>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Gerenciador de Conteúdo Duplicado</p>
            </div>
          </div>

          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-white">{totalGroups}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Grupos</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-white">{totalItems}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Total duplicados</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-red-400">{activeDuplicateCount}</p>
                <p className="text-[10px] text-red-500/70 uppercase tracking-widest font-bold mt-1">Para remover</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-green-400">{deletedIds.size}</p>
                <p className="text-[10px] text-green-500/70 uppercase tracking-widest font-bold mt-1">Removidos</p>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-3 text-green-400 text-sm font-bold">
              <CheckCircle2 size={16} /> {successMsg}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 text-red-400 text-sm font-bold">
              <AlertTriangle size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={fetchDuplicates}
            disabled={loading}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-all"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          {activeDuplicateCount > 0 && (
            <button
              onClick={deleteAllDuplicates}
              disabled={batchDeleting}
              className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 font-bold text-sm px-5 py-2.5 rounded-full transition-all"
            >
              {batchDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remover todas as duplicatas ({activeDuplicateCount})
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-600" />
            <p className="text-xl font-black uppercase">Nenhum duplicado encontrado!</p>
            <p className="text-sm mt-2">O catálogo está limpo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, groupIdx) => {
              const visibleItems = group.items.filter(i => !deletedIds.has(i.id));
              if (visibleItems.length <= 1 && deletedIds.size > 0) return null;
              const duplicatesInGroup = visibleItems.length - 1;

              return (
                <motion.div
                  key={group.items[0].title}
                  layout
                  className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]"
                >
                  <button
                    onClick={() => toggleGroup(groupIdx)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
                  >
                    {group.items[0].poster_path ? (
                      <img
                        src={group.items[0].poster_path.startsWith('http')
                          ? group.items[0].poster_path
                          : `https://image.tmdb.org/t/p/w92/${group.items[0].poster_path}`}
                        className="w-10 h-14 object-cover rounded-lg shrink-0"
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        {group.items[0].type === 'series' ? <Clapperboard size={16} className="text-gray-600" /> : <Film size={16} className="text-gray-600" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm uppercase tracking-tight truncate">{group.items[0].title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${group.items[0].type === 'series' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {group.items[0].type === 'series' ? 'Série' : 'Filme'}
                        </span>
                        <span className="text-[9px] text-gray-500 font-bold">
                          {visibleItems.length}x · {duplicatesInGroup} duplicata{duplicatesInGroup !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {duplicatesInGroup > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteAllDuplicatesInGroup(groupIdx); }}
                          disabled={batchDeleting}
                          className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                        >
                          <Trash2 size={10} />
                          Limpar
                        </button>
                      )}
                      {group.expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {group.expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/5"
                      >
                        <div className="p-3 space-y-2">
                          {visibleItems.map((item, itemIdx) => {
                            const badges = getPlayerBadges(item);
                            const isDeleting = deleting.has(item.id);
                            const isOriginal = itemIdx === 0;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isOriginal
                                  ? 'border-green-500/20 bg-green-500/5'
                                  : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    {isOriginal && (
                                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/20">
                                        ORIGINAL
                                      </span>
                                    )}
                                    <span className="text-[9px] text-gray-600 font-mono">ID: {item.id}</span>
                                    <span className="text-[9px] text-gray-700">
                                      {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {badges.map(b => {
                                      const BIcon = b.icon;
                                      return (
                                        <span key={b.label} className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${b.bg} ${b.color}`}>
                                          <BIcon size={8} /> {b.label}
                                        </span>
                                      );
                                    })}
                                    {badges.length === 0 && (
                                      <span className="text-[9px] text-gray-700 font-bold">Sem links configurados</span>
                                    )}
                                  </div>
                                </div>

                                {!isOriginal && (
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    disabled={isDeleting}
                                    className="shrink-0 flex items-center gap-1.5 bg-red-600/15 hover:bg-red-600/25 border border-red-600/20 text-red-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                                  >
                                    {isDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                    Deletar
                                  </button>
                                )}
                                {isOriginal && (
                                  <div className="shrink-0">
                                    <Database size={14} className="text-green-600" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
