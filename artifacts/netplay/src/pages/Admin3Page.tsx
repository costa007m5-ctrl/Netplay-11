import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Trash2, Copy, Server, Tv2, ExternalLink, Loader2,
  RefreshCcw, AlertTriangle, CheckCircle2, Link, Database, Film,
  Clapperboard, ChevronDown, ChevronUp, Monitor,
} from 'lucide-react';

interface DuplicateItem {
  id: number;
  title: string;
  type: string | null;
  poster_path: string | null;
  video_url: string | null;
  video_url_2: string | null;
  tmdb_id: number | null;
  is_hidden: boolean;
  created_at: string;
}

interface DuplicateGroup {
  items: DuplicateItem[];
  expanded: boolean;
}

type FilterMode = 'all' | 'terabox' | 'apisflix';

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
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

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

  const batchDelete = useCallback(async (ids: number[], msg: string) => {
    if (ids.length === 0) return;
    setBatchDeleting(true);
    try {
      const res = await fetch('/api/admin/duplicates/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Erro ao deletar em lote');
      setDeletedIds(prev => new Set([...prev, ...ids]));
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setBatchDeleting(false);
    }
  }, []);

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

  const toggleGroup = (idx: number) => {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, expanded: !g.expanded } : g));
  };

  const filteredGroups = useMemo(() => {
    return groups.map((g, idx) => ({ ...g, originalIdx: idx })).filter(g => {
      const visible = g.items.filter(i => !deletedIds.has(i.id));
      if (visible.length <= 1) return false;
      if (filterMode === 'terabox') return visible.some(i => i.video_url);
      if (filterMode === 'apisflix') return visible.some(i => i.tmdb_id);
      return true;
    });
  }, [groups, deletedIds, filterMode]);

  const activeDuplicateCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => {
      const visible = g.items.filter(i => !deletedIds.has(i.id));
      return acc + Math.max(0, visible.length - 1);
    }, 0);
  }, [filteredGroups, deletedIds]);

  const handleDeleteAllTerabox = async () => {
    if (!confirm(`Deletar todos os itens com link Terabox? Os itens sem link Terabox serão mantidos. Esta ação não pode ser desfeita!`)) return;
    const ids: number[] = [];
    for (const g of filteredGroups) {
      const visible = g.items.filter(i => !deletedIds.has(i.id));
      const teraboxItems = visible.filter(i => i.video_url);
      const nonTeraboxItems = visible.filter(i => !i.video_url);
      if (nonTeraboxItems.length > 0) {
        ids.push(...teraboxItems.map(i => i.id));
      } else {
        ids.push(...teraboxItems.slice(1).map(i => i.id));
      }
    }
    if (ids.length === 0) return;
    await batchDelete(ids, `${ids.length} item(s) Terabox removidos!`);
  };

  const handleDeleteAllApisflix = async () => {
    if (!confirm(`Deletar TODAS as duplicatas no modo APIs Flix? Apenas o primeiro registro de cada grupo será mantido. Esta ação não pode ser desfeita!`)) return;
    const ids: number[] = [];
    for (const g of filteredGroups) {
      const visible = g.items.filter(i => !deletedIds.has(i.id));
      if (visible.length > 1) ids.push(...visible.slice(1).map(i => i.id));
    }
    await batchDelete(ids, `${ids.length} duplicata(s) APIs Flix removidas!`);
  };

  const handleDeleteAll = async () => {
    if (!confirm('Deletar TODAS as duplicatas? Apenas o primeiro registro de cada título será mantido. Esta ação não pode ser desfeita!')) return;
    const ids: number[] = [];
    for (const g of filteredGroups) {
      const visible = g.items.filter(i => !deletedIds.has(i.id));
      if (visible.length > 1) ids.push(...visible.slice(1).map(i => i.id));
    }
    await batchDelete(ids, `${ids.length} duplicatas removidas!`);
  };

  const handleDeleteTeraboxInGroup = async (g: DuplicateGroup & { originalIdx: number }) => {
    const visible = g.items.filter(i => !deletedIds.has(i.id));
    const teraboxItems = visible.filter(i => i.video_url);
    const nonTeraboxItems = visible.filter(i => !i.video_url);
    let toDelete: DuplicateItem[];
    if (nonTeraboxItems.length > 0) {
      toDelete = teraboxItems;
    } else {
      toDelete = teraboxItems.slice(1);
    }
    if (toDelete.length === 0) return;
    await batchDelete(toDelete.map(i => i.id), `${toDelete.length} item(s) Terabox removidos!`);
  };

  const handleDeleteGroupDuplicates = async (g: DuplicateGroup & { originalIdx: number }) => {
    const visible = g.items.filter(i => !deletedIds.has(i.id));
    if (visible.length <= 1) return;
    const toDelete = visible.slice(1).map(i => i.id);
    await batchDelete(toDelete, `${toDelete.length} duplicata(s) removidas!`);
  };

  const filterButtons: { id: FilterMode; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'Todos', icon: Copy },
    { id: 'terabox', label: 'Com Link Terabox', icon: Server },
    { id: 'apisflix', label: 'APIs Flix', icon: Monitor },
  ];

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

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filterButtons.map(f => {
            const Icon = f.icon;
            const active = filterMode === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id)}
                className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full border transition-all ${
                  active
                    ? f.id === 'terabox'
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                      : f.id === 'apisflix'
                      ? 'bg-orange-600/20 border-orange-500/40 text-orange-400'
                      : 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/8'
                }`}
              >
                <Icon size={12} /> {f.label}
              </button>
            );
          })}
        </div>

        {/* Info box do modo */}
        <AnimatePresence mode="wait">
          {filterMode === 'terabox' && (
            <motion.div
              key="terabox-info"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="mb-4 flex items-start gap-3 bg-blue-600/10 border border-blue-500/25 rounded-2xl px-5 py-4"
            >
              <Server size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-blue-300 text-xs font-black uppercase tracking-widest mb-1">Modo Terabox</p>
                <p className="text-blue-400/70 text-xs leading-relaxed">
                  Mostra apenas grupos que contêm itens com link Terabox.
                  Use o botão <span className="text-blue-300 font-black">Deletar Terabox</span> para remover somente os
                  itens com link Terabox do grupo, mantendo os sem link.
                </p>
              </div>
            </motion.div>
          )}
          {filterMode === 'apisflix' && (
            <motion.div
              key="apisflix-info"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="mb-4 flex items-start gap-3 bg-orange-600/10 border border-orange-500/25 rounded-2xl px-5 py-4"
            >
              <Monitor size={16} className="text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-orange-300 text-xs font-black uppercase tracking-widest mb-1">Modo APIs Flix</p>
                <p className="text-orange-400/70 text-xs leading-relaxed">
                  Mostra grupos com conteúdo que usa APIs Flix. Clique em{' '}
                  <span className="text-orange-300 font-black">Confirmar Exclusão</span> para escolher qual entrada preservar —
                  os demais serão deletados ao confirmar.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botões de ação */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={fetchDuplicates}
            disabled={loading}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-all"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>

          {filterMode === 'terabox' && filteredGroups.length > 0 && (
            <button
              onClick={handleDeleteAllTerabox}
              disabled={batchDeleting}
              className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 font-bold text-sm px-5 py-2.5 rounded-full transition-all"
            >
              {batchDeleting ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
              Deletar todos com Terabox ({filteredGroups.length} grupos)
            </button>
          )}

          {filterMode === 'apisflix' && filteredGroups.length > 0 && (
            <button
              onClick={handleDeleteAllApisflix}
              disabled={batchDeleting}
              className="flex items-center gap-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-400 font-bold text-sm px-5 py-2.5 rounded-full transition-all"
            >
              {batchDeleting ? <Loader2 size={14} className="animate-spin" /> : <Monitor size={14} />}
              Deletar todos APIs Flix ({filteredGroups.length} grupos)
            </button>
          )}

          {filterMode === 'all' && activeDuplicateCount > 0 && (
            <button
              onClick={handleDeleteAll}
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
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-600" />
            <p className="text-xl font-black uppercase">Nenhum duplicado encontrado!</p>
            <p className="text-sm mt-2">O catálogo está limpo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const visibleItems = group.items.filter(i => !deletedIds.has(i.id));
              const duplicatesInGroup = visibleItems.length - 1;
              const teraboxItems = visibleItems.filter(i => i.video_url);
              const nonTeraboxItems = visibleItems.filter(i => !i.video_url);
              const teraboxToDelete = nonTeraboxItems.length > 0
                ? teraboxItems.length
                : Math.max(0, teraboxItems.length - 1);

              return (
                <motion.div
                  key={group.items[0].id}
                  layout
                  className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]"
                >
                  <button
                    onClick={() => toggleGroup(group.originalIdx)}
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
                        {group.items[0].type === 'series'
                          ? <Clapperboard size={16} className="text-gray-600" />
                          : <Film size={16} className="text-gray-600" />}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm uppercase tracking-tight truncate">{group.items[0].title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          group.items[0].type === 'series' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {group.items[0].type === 'series' ? 'Série' : 'Filme'}
                        </span>
                        <span className="text-[9px] text-gray-500 font-bold">
                          {visibleItems.length}x · {duplicatesInGroup} duplicata{duplicatesInGroup !== 1 ? 's' : ''}
                        </span>
                        {filterMode === 'terabox' && teraboxItems.length > 0 && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                            {teraboxItems.length} Terabox
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      {filterMode === 'terabox' && teraboxToDelete > 0 && (
                        <button
                          onClick={() => handleDeleteTeraboxInGroup(group)}
                          disabled={batchDeleting}
                          className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                        >
                          {batchDeleting ? <Loader2 size={10} className="animate-spin" /> : <Server size={10} />}
                          Deletar Terabox ({teraboxToDelete})
                        </button>
                      )}

                      {filterMode === 'apisflix' && duplicatesInGroup > 0 && (
                        <button
                          onClick={() => handleDeleteGroupDuplicates(group)}
                          disabled={batchDeleting}
                          className="flex items-center gap-1.5 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                        >
                          {batchDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                          Confirmar Exclusão
                        </button>
                      )}

                      {filterMode === 'all' && duplicatesInGroup > 0 && (
                        <button
                          onClick={() => handleDeleteGroupDuplicates(group)}
                          disabled={batchDeleting}
                          className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                        >
                          <Trash2 size={10} />
                          Limpar
                        </button>
                      )}

                      {group.expanded
                        ? <ChevronUp size={16} className="text-gray-500" />
                        : <ChevronDown size={16} className="text-gray-500" />}
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
