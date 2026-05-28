import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  AlertCircle, Loader2, ShieldCheck, Mail, Lock,
  Eye, EyeOff, ChevronLeft, Check, Smartphone,
  Tv, Zap, Shield, RefreshCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  initialMode?: 'login' | 'signup' | 'updatePassword';
  movies?: any[];
}

const DEFAULT_MOVIES = [
  { poster_path: 'https://image.tmdb.org/t/p/w500/8Gxv8ZiiQjLTVq9hlqU1Mv2U0qO.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/q719jsmZvqb6tUFiBbqB8p6mw1m.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/6oom5QYdwZ71TCWbkvMvS0n0Dby.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/r2J0VzYnUEsIbiSSTSksvUo7mo1.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/uY7URv89yS6Om9j32oOM4STU68B.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/h8mzmDcYmCcy1ar9Mdh9ofjH7s8.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/6WpY9i9at6L89lR7p5vA7Dq0S2p.jpg' },
  { poster_path: 'https://image.tmdb.org/t/p/w500/A7uByuyGKE69uYv7SFF9vI9Ym96.jpg' },
];

const MINI_FEATURES = [
  { icon: Tv,         label: '4K',     sub: 'Ultra HD',       color: '#3b82f6' },
  { icon: () => (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="3" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
        <text x="10" y="13" textAnchor="middle" fontSize="7" fontWeight="900" fill="currentColor" fontFamily="sans-serif">DOLBY</text>
      </svg>
    ),        label: 'DOLBY', sub: 'Áudio Imersivo', color: '#8b5cf6' },
  { icon: Zap,        label: 'RÁPIDO', sub: 'Streaming estável', color: '#f59e0b' },
  { icon: Shield,     label: 'SEGURO', sub: 'Privacidade garantida', color: '#22c55e' },
];

const Login: React.FC<LoginProps> = ({ initialMode = 'login', movies = [] }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'updatePassword'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');

  const displayMovies = movies.length > 8 ? movies : [...DEFAULT_MOVIES, ...movies];

  React.useEffect(() => {
    if (window.location.pathname.includes('/redefinirsenha')) setMode('updatePassword');
    else if (window.location.pathname.includes('/confirmacao')) setMessage('🍿 Bem-vindo! Quase lá, sua conta está sendo validada...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setMode('updatePassword'); setMessage(null); setError(null); }
      if (event === 'SIGNED_IN') { setMessage('🎯 Conta confirmada! Bem-vindo ao NetPlay.'); setTimeout(() => setMessage(null), 5000); }
    });

    const h = new Date().getHours();
    setWelcomeText(h < 12 ? 'Bom dia!' : h < 18 ? 'Boa tarde!' : 'Boa noite!');
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const referralCode = localStorage.getItem('netplay_referral_code');
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/menu`, data: { referred_by: referralCode || null, whatsapp } }
        });
        if (error) throw error;
        setMessage('✨ Cadastro realizado! Verifique o Gmail para confirmar sua conta e liberar o acesso.');
      } else if (mode === 'updatePassword') {
        if (password !== confirmPassword) throw new Error('As senhas não coincidem.');
        if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('✅ Senha alterada com sucesso! Você já pode entrar.');
        setTimeout(() => setMode('login'), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na ação.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Por favor, informe seu e-mail para recuperar a senha.'); return; }
    setLoading(true); setError(null); setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      if (error) throw error;
      setMessage('📧 Link de redefinição enviado! Confira sua caixa de entrada no Gmail.');
      setIsForgotPassword(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    try { sessionStorage.removeItem('netplay_intro_shown'); } catch {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] overflow-y-auto overflow-x-hidden font-sans">

      {/* ── Fundo cinematográfico ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] grayscale blur-sm scale-110">
          {[0, 1, 2].map(row => (
            <motion.div
              key={row}
              animate={{ x: row % 2 === 0 ? [0, -1400] : [-1400, 0] }}
              transition={{ duration: 70 + row * 20, repeat: Infinity, ease: 'linear' }}
              className="flex gap-3 mb-3 shrink-0"
            >
              {[...displayMovies, ...displayMovies, ...displayMovies].slice(0, 24).map((m, i) => (
                <div key={i} className="w-32 h-48 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src={m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w185${m.poster_path}`}
                    className="w-full h-full object-cover"
                    alt=""
                    loading="lazy"
                  />
                </div>
              ))}
            </motion.div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/65 to-[#050505]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-transparent to-[#050505]/80" />
        <motion.div
          animate={{ opacity: [0.15, 0.28, 0.15], scale: [1, 1.2, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#ff1a1a]/20 blur-[130px] rounded-full"
        />
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: '110vh', x: `${6 + i * 11}vw`, opacity: 0 }}
            animate={{ y: '-10vh', opacity: [0, 0.5, 0] }}
            transition={{ duration: 20 + i * 2.5, repeat: Infinity, delay: i * 2.2, ease: 'linear' }}
            className="absolute w-px h-20 bg-gradient-to-b from-transparent via-[#ff1a1a]/35 to-transparent"
          />
        ))}
      </div>

      {/* ── Topo: botão voltar ── */}
      <div className="fixed top-0 left-0 right-0 z-30 px-5 pt-11 pb-2 flex items-center">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <ChevronLeft size={20} className="text-white" />
        </motion.button>
      </div>

      {/* ── Conteúdo ── */}
      <div className="relative z-10 flex flex-col min-h-screen px-5 pb-10 max-w-sm mx-auto">

        {/* Logo */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="pt-24 pb-5 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-5">
            <motion.div
              animate={{ filter: ['drop-shadow(0 0 8px #ff1a1a)', 'drop-shadow(0 0 22px #ff1a1a)', 'drop-shadow(0 0 8px #ff1a1a)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
                <polygon points="6,4 36,20 6,36" fill="#ff1a1a" />
              </svg>
            </motion.div>
            <motion.div
              animate={{ filter: ['drop-shadow(0 0 10px #ff1a1a50)', 'drop-shadow(0 0 24px #ff1a1a80)', 'drop-shadow(0 0 10px #ff1a1a50)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex items-baseline"
            >
              <span className="text-[38px] font-black text-white uppercase italic tracking-tighter leading-none">NET</span>
              <span className="text-[38px] font-black uppercase italic tracking-tighter leading-none" style={{ color: '#ff1a1a' }}>PLAY</span>
            </motion.div>
          </div>

          {/* Título dinâmico */}
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-center">
              <h1 className="text-white text-[26px] font-black leading-tight tracking-tight">
                {mode === 'signup' ? 'Criar Conta' : mode === 'updatePassword' ? 'Nova Senha' : isForgotPassword ? 'Recuperar Acesso' : 'Bem-vindo de volta!'}
              </h1>
              <p className="text-gray-400 text-[13px] mt-1.5">
                {mode === 'signup' ? 'Preencha os dados para começar' : mode === 'updatePassword' ? 'Digite sua nova senha segura' : isForgotPassword ? 'Informe seu e-mail de cadastro' : 'Faça login para continuar'}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── Card glassmorphism do formulário ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.65 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(28px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Linha de brilho no topo */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Alertas */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-[12px] font-bold"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <span className="text-red-200">{error}</span>
              </motion.div>
            )}
            {message && (
              <motion.div
                key="msg"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3 text-[12px] font-bold"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)' }}
              >
                <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-emerald-200">{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulários */}
          <AnimatePresence mode="wait">
            {isForgotPassword ? (
              <motion.form key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleResetPassword} className="flex flex-col gap-4">
                <InputField label="E-MAIL" icon={<Mail size={16} />} type="email" placeholder="Digite seu e-mail" value={email} onChange={setEmail} />
                <PremiumButton loading={loading} label="Enviar Recuperação" icon={<RefreshCcw size={16} />} />
                <button type="button" onClick={() => { setIsForgotPassword(false); setError(null); setMessage(null); }} className="flex items-center justify-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-widest mt-1 hover:text-white transition-colors">
                  <ChevronLeft size={13} /> Voltar ao login
                </button>
              </motion.form>
            ) : mode === 'updatePassword' ? (
              <motion.form key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleAuth} className="flex flex-col gap-4">
                <InputField label="NOVA SENHA" icon={<Lock size={16} />} type={showPassword ? 'text' : 'password'} placeholder="Digite a nova senha" value={password} onChange={setPassword} suffix={<EyeToggle show={showPassword} toggle={() => setShowPassword(p => !p)} />} />
                <InputField label="CONFIRMAR SENHA" icon={<Lock size={16} />} type={showPassword ? 'text' : 'password'} placeholder="Confirme a nova senha" value={confirmPassword} onChange={setConfirmPassword} />
                <PremiumButton loading={loading} label="Definir Nova Senha" />
              </motion.form>
            ) : (
              <motion.form key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleAuth} className="flex flex-col gap-4">
                <InputField label="E-MAIL" icon={<Mail size={16} />} type="email" placeholder="Digite seu e-mail" value={email} onChange={setEmail} />
                <InputField label="SENHA" icon={<Lock size={16} />} type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" value={password} onChange={setPassword} suffix={<EyeToggle show={showPassword} toggle={() => setShowPassword(p => !p)} />} />

                {mode === 'signup' && (
                  <InputField label="WHATSAPP" icon={<Smartphone size={16} />} type="tel" placeholder="WhatsApp (com DDD)" value={whatsapp} onChange={setWhatsapp} />
                )}

                {/* Lembrar + Esqueci */}
                {mode === 'login' && (
                  <div className="flex items-center justify-between mt-0.5">
                    <button type="button" onClick={() => setRememberMe(p => !p)} className="flex items-center gap-2 group">
                      <div
                        className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-all"
                        style={{
                          background: rememberMe ? '#ff1a1a' : 'rgba(255,255,255,0.06)',
                          border: rememberMe ? '1.5px solid #ff1a1a' : '1.5px solid rgba(255,255,255,0.18)',
                          boxShadow: rememberMe ? '0 0 10px rgba(255,26,26,0.4)' : 'none',
                        }}
                      >
                        {rememberMe && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-gray-400 text-[12px] font-medium">Lembrar de mim</span>
                    </button>
                    <button type="button" onClick={() => { setIsForgotPassword(true); setError(null); setMessage(null); }} className="text-[12px] font-bold transition-colors" style={{ color: '#ff1a1a' }}>
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                <PremiumButton loading={loading} label={mode === 'login' ? 'ENTRAR' : 'FINALIZAR INSCRIÇÃO'} />
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Alternar login / signup */}
        {!isForgotPassword && mode !== 'updatePassword' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center justify-center gap-2 mt-5"
          >
            <span className="text-gray-500 text-[12px]">
              {mode === 'login' ? 'Novo por aqui?' : 'Já tem uma conta?'}
            </span>
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null); }} className="text-[12px] font-black uppercase tracking-wide transition-colors" style={{ color: '#ff1a1a' }}>
              {mode === 'login' ? 'Criar conta' : 'Fazer login'}
            </button>
          </motion.div>
        )}

        {/* Card 100% SEGURO */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-5 rounded-2xl flex items-center gap-4 px-5 py-4 relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,26,26,0.18)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <motion.div
            animate={{ boxShadow: ['0 0 12px rgba(255,26,26,0.3)', '0 0 28px rgba(255,26,26,0.6)', '0 0 12px rgba(255,26,26,0.3)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,26,26,0.15)', border: '1px solid rgba(255,26,26,0.3)' }}
          >
            <ShieldCheck size={20} style={{ color: '#ff1a1a' }} />
          </motion.div>
          <div>
            <div className="text-white font-black text-[13px] tracking-wide">100% SEGURO</div>
            <div className="text-gray-400 text-[11px] mt-0.5 leading-snug">Seus dados protegidos com criptografia de ponta a ponta.</div>
          </div>
          {/* Glow de fundo */}
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#ff1a1a]/10 blur-[40px] rounded-full pointer-events-none" />
        </motion.div>

        {/* Mini cards de features */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-4 gap-2.5 mt-4"
        >
          {MINI_FEATURES.map((feat, i) => {
            const Icon = feat.icon as any;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.85 + i * 0.07 }}
                className="rounded-2xl flex flex-col items-center gap-1.5 py-3 px-1.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${feat.color}18`, border: `1px solid ${feat.color}35`, color: feat.color }}>
                  <Icon size={16} />
                </div>
                <div className="text-white font-black text-[10px] text-center tracking-wide leading-none">{feat.label}</div>
                <div className="text-gray-500 text-[8px] text-center leading-tight">{feat.sub}</div>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </div>
  );
};

/* ── Sub-componentes ── */

function InputField({ label, icon, type, placeholder, value, onChange, suffix }: {
  label: string; icon: React.ReactNode; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</label>
      <div
        className="relative flex items-center rounded-2xl transition-all duration-300"
        style={{
          background: focused ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
          border: focused ? '1.5px solid rgba(255,26,26,0.6)' : '1.5px solid rgba(255,255,255,0.1)',
          boxShadow: focused ? '0 0 0 3px rgba(255,26,26,0.08), 0 0 20px rgba(255,26,26,0.1)' : 'none',
        }}
      >
        <span className="absolute left-4" style={{ color: focused ? '#ff1a1a' : 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }}>
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required
          className="w-full bg-transparent text-white text-[14px] font-medium pl-11 pr-11 py-[15px] outline-none placeholder:text-white/20"
        />
        {suffix && <div className="absolute right-4">{suffix}</div>}
      </div>
    </div>
  );
}

function EyeToggle({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} className="text-gray-400 hover:text-white transition-colors">
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

function PremiumButton({ loading, label, icon }: { loading: boolean; label: string; icon?: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="submit"
      disabled={loading}
      className="w-full py-[16px] rounded-2xl font-black text-white text-[14px] uppercase tracking-[0.18em] flex items-center justify-center gap-3 relative overflow-hidden mt-1 disabled:opacity-60"
      style={{
        background: 'linear-gradient(135deg, #c50000 0%, #ff1a1a 55%, #cc0000 100%)',
        boxShadow: '0 0 28px rgba(255,26,26,0.5), 0 6px 24px rgba(255,26,26,0.3)',
        border: '1px solid rgba(255,120,120,0.25)',
      }}
    >
      <motion.div
        animate={{ x: ['-120%', '220%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
      />
      {loading ? <Loader2 size={20} className="animate-spin" /> : <>{icon}{label}</>}
    </motion.button>
  );
}

export default Login;
