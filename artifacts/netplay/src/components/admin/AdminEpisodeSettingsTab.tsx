import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Save, RotateCcw, Play, Check, X, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import {
  EpisodePattern,
  getPatterns,
  savePatterns,
  BUILTIN_PATTERNS,
  parseSeasonEpisode,
} from '../../utils/episodeParser';

export default function AdminEpisodeSettingsTab() {
  const [patterns, setPatterns] = useState<EpisodePattern[]>([]);
  const [testInput, setTestInput] = useState('DBC.002.BD1080p.MemoriadaTV.Menor.mkv');
  const [testResult, setTestResult] = useState<{ season: number; episode: number } | null | 'none'>('none');
  const [matchedPatternId, setMatchedPatternId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newPat, setNewPat] = useState<Partial<EpisodePattern>>({
    label: '',
    description: '',
    example: '',
    regexStr: '',
    seasonGroup: null,
    episodeGroup: 1,
    enabled: true,
    builtin: false,
  });
  const [newPatError, setNewPatError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setPatterns(getPatterns());
  }, []);

  const handleToggle = (id: string) => {
    setPatterns(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleDelete = (id: string) => {
    setPatterns(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = () => {
    savePatterns(patterns);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setPatterns(BUILTIN_PATTERNS);
    savePatterns(BUILTIN_PATTERNS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = () => {
    if (!testInput.trim()) return;
    let matched: string | null = null;
    const active = patterns.filter(p => p.enabled);
    for (const pat of active) {
      try {
        const re = new RegExp(pat.regexStr, 'i');
        const name = testInput.replace(/\.(mkv|mp4|avi|mov|webm|m4v|wmv|flv|ts|m3u8)$/i, '');
        const m = name.match(re);
        if (m) {
          const e = parseInt(m[pat.episodeGroup], 10);
          const s = pat.seasonGroup !== null ? parseInt(m[pat.seasonGroup], 10) : 1;
          if (e >= 1 && e <= 999 && s >= 0 && s <= 50) {
            matched = pat.id;
            break;
          }
        }
      } catch {}
    }
    const result = parseSeasonEpisode(testInput, patterns);
    setTestResult(result ?? null);
    setMatchedPatternId(matched);
  };

  const handleAddPattern = () => {
    setNewPatError('');
    if (!newPat.label?.trim()) { setNewPatError('Informe um nome para o padrão.'); return; }
    if (!newPat.regexStr?.trim()) { setNewPatError('Informe a expressão regular.'); return; }
    if (!newPat.episodeGroup || newPat.episodeGroup < 1) { setNewPatError('Grupo do episódio deve ser >= 1.'); return; }
    try {
      new RegExp(newPat.regexStr!, 'i');
    } catch (e: any) {
      setNewPatError('Regex inválido: ' + e.message);
      return;
    }
    const id = 'custom_' + Date.now();
    const pat: EpisodePattern = {
      id,
      label: newPat.label!.trim(),
      description: newPat.description?.trim() || '',
      example: newPat.example?.trim() || '',
      regexStr: newPat.regexStr!.trim(),
      seasonGroup: newPat.seasonGroup ?? null,
      episodeGroup: newPat.episodeGroup!,
      enabled: true,
      builtin: false,
    };
    setPatterns(prev => [...prev, pat]);
    setNewPat({ label: '', description: '', example: '', regexStr: '', seasonGroup: null, episodeGroup: 1, enabled: true, builtin: false });
    setShowAddForm(false);
  };

  const SAMPLE_FILENAMES = [
    'DBC.002.BD1080p.MemoriadaTV.Menor.mkv',
    'Naruto.S01E03.720p.mkv',
    'Dragon.Ball.Z.1x05.mkv',
    'Attack.on.Titan.T02E07.mkv',
    'One.Piece.EP001.mkv',
    'Serie Temporada 1 Episodio 5.mkv',
    'XYZ-014.BluRay.1080p.mkv',
    'JJBA.003.WEB.mkv',
  ];

  return (
    <div className="space-y-8 p-6 md:p-10 pb-20 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-black text-2xl md:text-3xl uppercase tracking-tighter italic flex items-center gap-3">
            <Zap className="text-yellow-400" size={28} />
            Padrões de Episódio
          </h2>
          <p className="text-gray-400 text-sm font-medium mt-1">
            Configure como o sistema detecta temporada/episódio a partir de nomes de arquivo.
            Os padrões são testados em ordem — o primeiro que combinar é usado.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all"
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
          >
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Test area */}
      <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-3">Testar Nome de Arquivo</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder="Cole um nome de arquivo aqui..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-red-500/50"
          />
          <button
            onClick={handleTest}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Play size={13} />
            Testar
          </button>
        </div>
        {/* Sample filenames */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SAMPLE_FILENAMES.map(f => (
            <button
              key={f}
              onClick={() => { setTestInput(f); setTestResult('none'); setMatchedPatternId(null); }}
              className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg font-mono transition-all"
            >
              {f}
            </button>
          ))}
        </div>
        {testResult !== 'none' && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${testResult ? 'bg-green-600/15 border border-green-500/20 text-green-400' : 'bg-red-600/15 border border-red-500/20 text-red-400'}`}>
            {testResult ? (
              <>
                <Check size={16} className="shrink-0" />
                <span>
                  Detectado: <span className="text-white">Temporada {testResult.season}, Episódio {testResult.episode}</span>
                  {matchedPatternId && (
                    <span className="text-gray-400 font-normal ml-2">
                      via padrão <span className="text-yellow-400">{patterns.find(p => p.id === matchedPatternId)?.label ?? matchedPatternId}</span>
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <X size={16} className="shrink-0" />
                <span>Nenhum padrão reconheceu esse arquivo. Verifique se os padrões ativos cobrem esse formato.</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pattern list */}
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">Padrões Ativos (em ordem de prioridade)</p>
        {patterns.map((pat, idx) => (
          <motion.div
            key={pat.id}
            layout
            className={`rounded-2xl border transition-all ${pat.enabled ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-50'}`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-[10px] text-gray-600 font-black w-5 text-center shrink-0">{idx + 1}</span>
              <button
                onClick={() => handleToggle(pat.id)}
                className={`w-9 h-5 rounded-full transition-all shrink-0 relative ${pat.enabled ? 'bg-green-500' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${pat.enabled ? 'left-4' : 'left-0.5'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-bold truncate">{pat.label}</span>
                  {!pat.builtin && <span className="text-[9px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Custom</span>}
                  {pat.id === 'code_ep' && <span className="text-[9px] bg-yellow-600/30 text-yellow-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Novo</span>}
                </div>
                <p className="text-gray-500 text-[11px] truncate">{pat.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === pat.id ? null : pat.id)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all"
                >
                  {expandedId === pat.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {!pat.builtin && (
                  <button
                    onClick={() => handleDelete(pat.id)}
                    className="p-1.5 hover:bg-red-600/20 rounded-lg text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {expandedId === pat.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-white/5"
                >
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Exemplo</p>
                        <code className="text-xs text-yellow-400 font-mono bg-black/30 px-2 py-1 rounded">{pat.example || '—'}</code>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Grupos</p>
                        <span className="text-xs text-gray-300 font-mono">
                          Temporada: {pat.seasonGroup !== null ? `grupo ${pat.seasonGroup}` : 'padrão 1'} · Episódio: grupo {pat.episodeGroup}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Regex</p>
                      <code className="text-xs text-green-400 font-mono bg-black/30 px-3 py-2 rounded block break-all">{pat.regexStr}</code>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Add custom pattern */}
      <div className="border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-all"
        >
          <Plus size={16} className="text-red-500" />
          <span className="text-white font-bold text-sm">Adicionar Padrão Personalizado</span>
          {showAddForm ? <ChevronUp size={14} className="ml-auto text-gray-500" /> : <ChevronDown size={14} className="ml-auto text-gray-500" />}
        </button>
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Nome do Padrão *</label>
                    <input
                      type="text"
                      value={newPat.label}
                      onChange={e => setNewPat(p => ({ ...p, label: e.target.value }))}
                      placeholder="Ex: EP001 estilo"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Exemplo de arquivo</label>
                    <input
                      type="text"
                      value={newPat.example}
                      onChange={e => setNewPat(p => ({ ...p, example: e.target.value }))}
                      placeholder="Serie.EP001.mkv"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Descrição</label>
                  <input
                    type="text"
                    value={newPat.description}
                    onChange={e => setNewPat(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descreva o formato..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Regex (JavaScript) *</label>
                  <input
                    type="text"
                    value={newPat.regexStr}
                    onChange={e => setNewPat(p => ({ ...p, regexStr: e.target.value }))}
                    placeholder="[Ee][Pp](\d{1,3})"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-green-400 font-mono placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                  />
                  <p className="text-gray-600 text-[10px] mt-1">Use grupos de captura (\d+) para temporada e episódio. Não inclua as barras /</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Grupo da Temporada</label>
                    <input
                      type="number"
                      value={newPat.seasonGroup ?? ''}
                      onChange={e => setNewPat(p => ({ ...p, seasonGroup: e.target.value === '' ? null : parseInt(e.target.value) }))}
                      placeholder="Deixe vazio = sempre Temporada 1"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black block mb-1">Grupo do Episódio *</label>
                    <input
                      type="number"
                      min={1}
                      value={newPat.episodeGroup}
                      onChange={e => setNewPat(p => ({ ...p, episodeGroup: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                </div>
                {newPatError && (
                  <div className="text-red-400 text-xs font-bold flex items-center gap-2">
                    <X size={13} /> {newPatError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddPattern}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus size={13} />
                    Adicionar Padrão
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewPatError(''); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-gray-600 text-xs text-center">
        As alterações são salvas localmente neste navegador e aplicadas imediatamente no Auto-Detectar S/E das abas Terabox.
      </p>
    </div>
  );
}
