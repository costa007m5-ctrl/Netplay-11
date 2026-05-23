import React, { useState, useCallback } from 'react';
import { ToggleLeft, ToggleRight, Server, RefreshCcw, Zap, ExternalLink, Tv2 } from 'lucide-react';
import { getDisabledPlayerApis, setPlayerApiEnabled } from '../SmartPlayerSelector';

interface ApiOption {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  desc: string;
  icon: React.ElementType;
  gradient: string;
  border: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeColor: string;
  badge: string;
  toggleColor: string;
}

const ALL_APIS: ApiOption[] = [
  {
    id: 'admin',
    num: '01',
    title: 'Servidor Padrão',
    subtitle: 'Nativo Terabox',
    desc: 'Reprodução direta via link configurado pelo admin ou API nativa do Terabox.',
    icon: Server,
    gradient: 'from-blue-600/12 to-blue-900/5',
    border: 'border-blue-500/20',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    badgeBg: 'bg-blue-500/20',
    badgeColor: 'text-blue-300',
    badge: 'ADMIN',
    toggleColor: 'text-blue-400',
  },
  {
    id: 'alternative',
    num: '02',
    title: 'Servidor API 01',
    subtitle: 'Cascata Automática',
    desc: 'Testa cada qualidade da API 01 (Pro) em cascata. Se todas falharem, muda para API 3.0.',
    icon: RefreshCcw,
    gradient: 'from-purple-600/12 to-purple-900/5',
    border: 'border-purple-500/20',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/20',
    badgeColor: 'text-purple-300',
    badge: 'CASCATA',
    toggleColor: 'text-purple-400',
  },
  {
    id: 'auto',
    num: '03',
    title: 'Modo Automático',
    subtitle: 'API Nativa + Fallback',
    desc: 'Testa qualidades e APIs automaticamente. Se uma falhar, troca para a próxima sem intervenção.',
    icon: Zap,
    gradient: 'from-red-600/12 to-red-900/5',
    border: 'border-red-500/20',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    badgeColor: 'text-red-300',
    badge: 'AUTO',
    toggleColor: 'text-red-400',
  },
  {
    id: 'kingx',
    num: '04',
    title: 'Player KingX',
    subtitle: 'KingX · Player Externo',
    desc: 'Reproduz via player externo KingX com alta qualidade e legendas automáticas integradas.',
    icon: ExternalLink,
    gradient: 'from-violet-600/12 to-violet-900/5',
    border: 'border-violet-500/20',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    badgeBg: 'bg-violet-500/20',
    badgeColor: 'text-violet-300',
    badge: 'KINGX',
    toggleColor: 'text-violet-400',
  },
  {
    id: 'betterflix',
    num: '05',
    title: 'API Flix',
    subtitle: 'BetterFlix · Player Externo',
    desc: 'Reproduz via player externo BetterFlix. Ideal quando os servidores internos falham.',
    icon: Tv2,
    gradient: 'from-orange-600/12 to-red-900/5',
    border: 'border-orange-500/20',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    badgeBg: 'bg-orange-500/20',
    badgeColor: 'text-orange-300',
    badge: 'FLIX',
    toggleColor: 'text-orange-400',
  },
  {
    id: 'vidsrc',
    num: '06',
    title: 'Net 2.0',
    subtitle: 'Vidsrc · Player Externo',
    desc: 'Reproduz via Vidsrc com embed integrado. Alternativa confiável com legendas em português.',
    icon: Tv2,
    gradient: 'from-red-600/12 to-pink-900/5',
    border: 'border-red-500/20',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    badgeColor: 'text-red-300',
    badge: 'NET 2.0',
    toggleColor: 'text-red-400',
  },
  {
    id: 'redeflix',
    num: '07',
    title: 'Flix 3.0',
    subtitle: 'RedeFlixApi · Player Externo',
    desc: 'Reproduz via RedeFlixApi por ID TMDB. Sem chave de API — acesso público.',
    icon: Tv2,
    gradient: 'from-emerald-600/12 to-cyan-900/5',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20',
    badgeColor: 'text-emerald-300',
    badge: 'FLIX 3.0',
    toggleColor: 'text-emerald-400',
  },
];

export function AdminPlayerAPIsTab() {
  const [disabled, setDisabled] = useState<Set<string>>(() => getDisabledPlayerApis());

  const toggle = useCallback((id: string) => {
    const isCurrentlyEnabled = !disabled.has(id);
    setPlayerApiEnabled(id, !isCurrentlyEnabled);
    setDisabled(getDisabledPlayerApis());
  }, [disabled]);

  const enabledCount = ALL_APIS.length - disabled.size;

  return (
    <div className="space-y-6 md:space-y-10 pb-12">
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 tracking-tighter uppercase font-mono">
          <ToggleRight className="inline-block w-8 h-8 md:w-10 md:h-10 mr-3 -mt-2 text-indigo-400" />
          Players Ativos
        </h2>
        <p className="text-base md:text-lg text-gray-400 font-medium max-w-3xl">
          Ative ou desative cada opção de player que aparece no seletor "Como deseja assistir?".
          APIs desativadas ficam ocultas para todos os usuários.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span><strong className="text-white">{enabledCount}</strong> de <strong className="text-white">{ALL_APIS.length}</strong> players ativos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_APIS.map((api) => {
          const enabled = !disabled.has(api.id);
          const Icon = api.icon;
          return (
            <div
              key={api.id}
              className={`relative flex items-start gap-4 p-5 rounded-2xl border bg-gradient-to-br transition-all duration-300 cursor-pointer select-none
                ${enabled
                  ? `${api.gradient} ${api.border} opacity-100`
                  : 'from-gray-900/40 to-gray-900/20 border-white/5 opacity-50 grayscale'
                }`}
              onClick={() => toggle(api.id)}
            >
              <div className={`w-10 h-10 rounded-xl ${enabled ? api.iconBg : 'bg-white/5'} border border-white/10 flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon size={18} className={enabled ? api.iconColor : 'text-gray-600'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${enabled ? `${api.badgeBg} ${api.badgeColor}` : 'bg-gray-800 text-gray-600'}`}>
                    {api.badge}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono"># {api.num}</span>
                </div>
                <p className={`text-sm font-bold mb-0.5 ${enabled ? 'text-white' : 'text-gray-600'}`}>{api.title}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{api.desc}</p>
              </div>

              <div className="shrink-0 mt-0.5">
                {enabled
                  ? <ToggleRight size={28} className={api.toggleColor} />
                  : <ToggleLeft size={28} className="text-gray-700" />
                }
              </div>

              {!enabled && (
                <div className="absolute top-3 right-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-700 bg-gray-900/80 px-2 py-0.5 rounded-full border border-white/5">
                    DESATIVADO
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 text-sm text-amber-300/70">
        <strong className="text-amber-300">Atenção:</strong> as configurações são salvas localmente neste navegador.
        Cada dispositivo ou navegador terá seu próprio estado independente.
      </div>
    </div>
  );
}
