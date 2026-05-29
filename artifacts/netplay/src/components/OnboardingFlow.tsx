import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, User, Phone, Mail, Lock, Eye, EyeOff, Check, Loader2, Sparkles, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OnboardingFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

const CONTENT_TYPES = [
  { id: 'movies', label: 'Filmes', emoji: '🎬' },
  { id: 'series', label: 'Séries', emoji: '📺' },
  { id: 'docs', label: 'Documentários', emoji: '🎥' },
  { id: 'anime', label: 'Anime', emoji: '⛩️' },
  { id: 'kids', label: 'Infantil', emoji: '🧒' },
  { id: 'sports', label: 'Esportes', emoji: '⚽' },
];

const GENRES = [
  { id: 'acao', label: 'Ação', emoji: '💥' },
  { id: 'aventura', label: 'Aventura', emoji: '🗺️' },
  { id: 'comedia', label: 'Comédia', emoji: '😂' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'terror', label: 'Terror', emoji: '👻' },
  { id: 'ficcao', label: 'Ficção Científica', emoji: '🚀' },
  { id: 'romance', label: 'Romance', emoji: '💕' },
  { id: 'animacao', label: 'Animação', emoji: '🎨' },
  { id: 'crime', label: 'Crime', emoji: '🔫' },
  { id: 'thriller', label: 'Thriller', emoji: '😰' },
  { id: 'fantasia', label: 'Fantasia', emoji: '🧙' },
  { id: 'musical', label: 'Musical', emoji: '🎵' },
];

const AVATAR_COLORS = [
  { bg: '#ef4444', label: 'Vermelho' },
  { bg: '#f97316', label: 'Laranja' },
  { bg: '#eab308', label: 'Amarelo' },
  { bg: '#22c55e', label: 'Verde' },
  { bg: '#3b82f6', label: 'Azul' },
  { bg: '#8b5cf6', label: 'Roxo' },
  { bg: '#ec4899', label: 'Rosa' },
  { bg: '#14b8a6', label: 'Teal' },
];

const TOTAL_STEPS = 6;

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const [profileName, setProfileName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0].bg);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (name && !profileName) setProfileName(name.split(' ')[0]);
  }, [name]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const goNext = () => {
    setError(null);
    setDirection(1);
    setStep(s => s + 1);
  };

  const goPrev = () => {
    setError(null);
    setDirection(-1);
    if (step === 1) { onBack(); return; }
    setStep(s => s - 1);
  };

  const toggleType = (id: string) => {
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      const referralCode = localStorage.getItem('netplay_referral_code');
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/menu`,
          data: {
            display_name: name,
            full_name: name,
            whatsapp: phone.replace(/\D/g, ''),
            referred_by: referralCode || null,
            content_types: selectedTypes.join(','),
            genres: selectedGenres.join(','),
          },
        },
      });

      if (signupError) throw signupError;

      const userId = data.user?.id;
      if (userId) {
        try {
          await supabase.from('profiles').insert({
            user_id: userId,
            name: profileName || name.split(' ')[0],
            avatar_url: null,
            avatar_color: avatarColor,
            content_preferences: selectedTypes.join(','),
            genre_preferences: selectedGenres.join(','),
          });
        } catch {}

        try {
          localStorage.setItem('netplay_onboarding_name', profileName || name.split(' ')[0]);
          localStorage.setItem('netplay_onboarding_color', avatarColor);
          localStorage.setItem('netplay_onboarding_types', selectedTypes.join(','));
          localStorage.setItem('netplay_onboarding_genres', selectedGenres.join(','));
        } catch {}
      }

      setStep(7);
    } catch (err: any) {
      if (err.message?.includes('already registered') || err.message?.includes('already been registered')) {
        setError('Este e-mail já está cadastrado. Clique em "JÁ TENHO CONTA" para entrar.');
      } else if (err.message?.includes('Password')) {
        setError('Senha deve ter pelo menos 6 caracteres.');
      } else {
        setError(err.message || 'Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = name.trim().length >= 2;
  const canProceedStep2 = phone.replace(/\D/g, '').length >= 10;
  const canProceedStep3 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canProceedStep4 = password.length >= 6 && password === confirmPassword;
  const canProceedStep5 = selectedTypes.length > 0 && selectedGenres.length > 0;

  const stepVariants = {
    enter: (d: number) => ({ x: d > 0 ? '60%' : '-60%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-[200] flex flex-col overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-60 bg-red-600/20 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-5 pt-12 pb-4">
        <button onClick={goPrev} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex-1">
          <div className="flex gap-1">
            {[...Array(TOTAL_STEPS)].map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-red-500"
                  initial={{ width: '0%' }}
                  animate={{ width: step > i ? '100%' : step === i + 1 ? '50%' : '0%' }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            ))}
          </div>
        </div>
        <span className="text-[11px] font-black text-white/30 tabular-nums">{step > TOTAL_STEPS ? TOTAL_STEPS : step}/{TOTAL_STEPS}</span>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col px-5 pt-2 overflow-y-auto pb-4"
          >
            {/* STEP 1: NOME */}
            {step === 1 && (
              <div className="flex flex-col flex-1">
                <div className="mb-8">
                  <span className="text-[10px] font-black tracking-[0.3em] text-red-500">PASSO 01</span>
                  <h2 className="text-[28px] font-black text-white uppercase tracking-tight leading-tight mt-1">Qual é o seu nome?</h2>
                  <p className="text-gray-400 text-[13px] mt-2">Como devemos te chamar?</p>
                </div>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    autoFocus
                    className="w-full pl-11 pr-4 py-4 rounded-2xl text-white text-[15px] font-medium placeholder-white/20 bg-white/5 border border-white/10 focus:outline-none focus:border-red-500/50 transition-colors"
                    onKeyDown={e => e.key === 'Enter' && canProceedStep1 && goNext()}
                  />
                </div>
                {name.length > 0 && name.trim().length < 2 && (
                  <p className="text-red-400 text-[11px] mt-2 ml-1">Digite pelo menos 2 caracteres</p>
                )}
              </div>
            )}

            {/* STEP 2: CELULAR */}
            {step === 2 && (
              <div className="flex flex-col flex-1">
                <div className="mb-8">
                  <span className="text-[10px] font-black tracking-[0.3em] text-red-500">PASSO 02</span>
                  <h2 className="text-[28px] font-black text-white uppercase tracking-tight leading-tight mt-1">Número de celular</h2>
                  <p className="text-gray-400 text-[13px] mt-2">Para recuperação de conta e notificações.</p>
                </div>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="tel" value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    autoFocus inputMode="numeric"
                    className="w-full pl-11 pr-4 py-4 rounded-2xl text-white text-[15px] font-medium placeholder-white/20 bg-white/5 border border-white/10 focus:outline-none focus:border-red-500/50 transition-colors"
                    onKeyDown={e => e.key === 'Enter' && canProceedStep2 && goNext()}
                  />
                </div>
                <p className="text-white/20 text-[11px] mt-3 ml-1">WhatsApp ou celular com DDD</p>
              </div>
            )}

            {/* STEP 3: EMAIL */}
            {step === 3 && (
              <div className="flex flex-col flex-1">
                <div className="mb-8">
                  <span className="text-[10px] font-black tracking-[0.3em] text-red-500">PASSO 03</span>
                  <h2 className="text-[28px] font-black text-white uppercase tracking-tight leading-tight mt-1">Seu e-mail</h2>
                  <p className="text-gray-400 text-[13px] mt-2">Usaremos para acessar sua conta.</p>
                </div>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    autoFocus inputMode="email"
                    className="w-full pl-11 pr-4 py-4 rounded-2xl text-white text-[15px] font-medium placeholder-white/20 bg-white/5 border border-white/10 focus:outline-none focus:border-red-500/50 transition-colors"
                    onKeyDown={e => e.key === 'Enter' && canProceedStep3 && goNext()}
                  />
                </div>
                {email.length > 0 && !canProceedStep3 && (
                  <p className="text-red-400 text-[11px] mt-2 ml-1">Digite um e-mail válido</p>
                )}
              </div>
            )}

            {/* STEP 4: SENHA */}
            {step === 4 && (
              <div className="flex flex-col flex-1">
                <div className="mb-8">
                  <span className="text-[10px] font-black tracking-[0.3em] text-red-500">PASSO 04</span>
                  <h2 className="text-[28px] font-black text-white uppercase tracking-tight leading-tight mt-1">Crie sua senha</h2>
                  <p className="text-gray-400 text-[13px] mt-2">Mínimo de 6 caracteres.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      autoFocus
                      className="w-full pl-11 pr-12 py-4 rounded-2xl text-white text-[15px] font-medium placeholder-white/20 bg-white/5 border border-white/10 focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff size={16} className="text-white/30" /> : <Eye size={16} className="text-white/30" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirme a senha"
                      className="w-full pl-11 pr-12 py-4 rounded-2xl text-white text-[15px] font-medium placeholder-white/20 bg-white/5 border border-white/10 focus:outline-none focus:border-red-500/50 transition-colors"
                      onKeyDown={e => e.key === 'Enter' && canProceedStep4 && goNext()}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2">
                      {showConfirm ? <EyeOff size={16} className="text-white/30" /> : <Eye size={16} className="text-white/30" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  {[
                    { label: '6+ caracteres', ok: password.length >= 6 },
                    { label: 'Senhas iguais', ok: password.length >= 6 && password === confirmPassword },
                  ].map(req => (
                    <div key={req.label} className="flex items-center gap-1.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${req.ok ? 'bg-green-500' : 'bg-white/10'}`}>
                        {req.ok && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] ${req.ok ? 'text-green-400' : 'text-white/30'}`}>{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: PERSONALIZAÇÃO */}
            {step === 5 && (
              <div className="flex flex-col flex-1">
                <div className="mb-5">
                  <span className="text-[10px] font-black tracking-[0.3em] text-red-500">PASSO 05</span>
                  <h2 className="text-[24px] font-black text-white uppercase tracking-tight leading-tight mt-1">
                    O que você <span style={{ color: '#ff1a1a' }}>ama</span> assistir?
                  </h2>
                  <p className="text-gray-400 text-[12px] mt-1">Selecione pelo menos 1 em cada categoria.</p>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">TIPO DE CONTEÚDO</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CONTENT_TYPES.map(t => {
                      const sel = selectedTypes.includes(t.id);
                      return (
                        <button key={t.id} onClick={() => toggleType(t.id)}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                          style={{
                            background: sel ? 'rgba(255,26,26,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1.5px solid ${sel ? '#ff1a1a' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          <span className="text-xl">{t.emoji}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wide ${sel ? 'text-red-400' : 'text-white/50'}`}>{t.label}</span>
                          {sel && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">GÊNEROS FAVORITOS</p>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(g => {
                      const sel = selectedGenres.includes(g.id);
                      return (
                        <button key={g.id} onClick={() => toggleGenre(g.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                          style={{
                            background: sel ? 'rgba(255,26,26,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1.5px solid ${sel ? '#ff1a1a' : 'rgba(255,255,255,0.08)'}`,
                            color: sel ? '#ff6b6b' : 'rgba(255,255,255,0.4)',
                          }}>
                          <span className="text-[14px]">{g.emoji}</span>
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: PERFIL */}
            {step === 6 && (
              <div className="flex flex-col flex-1">
                <div className="mb-6">
                  <span className="text-[10px] font-black tracking-[0.3em] text-red-500">PASSO 06</span>
                  <h2 className="text-[24px] font-black text-white uppercase tracking-tight leading-tight mt-1">Personalize seu perfil</h2>
                  <p className="text-gray-400 text-[12px] mt-1">Escolha uma cor e confirme seu nome.</p>
                </div>

                <div className="flex flex-col items-center gap-4 mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 rounded-3xl flex items-center justify-center text-[32px] font-black text-white shadow-2xl"
                    style={{ background: avatarColor, boxShadow: `0 0 40px ${avatarColor}60` }}
                  >
                    {(profileName || name || '?').charAt(0).toUpperCase()}
                  </motion.div>
                  <div className="flex gap-2.5 flex-wrap justify-center">
                    {AVATAR_COLORS.map(c => (
                      <button key={c.bg} onClick={() => setAvatarColor(c.bg)}
                        className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                        style={{
                          background: c.bg,
                          boxShadow: avatarColor === c.bg ? `0 0 12px ${c.bg}` : 'none',
                          border: avatarColor === c.bg ? '2.5px solid white' : '2px solid transparent',
                          transform: avatarColor === c.bg ? 'scale(1.2)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text" value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="Nome no perfil"
                    className="w-full pl-11 pr-4 py-4 rounded-2xl text-white text-[15px] font-medium placeholder-white/20 bg-white/5 border border-white/10 focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>

                {error && (
                  <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-[12px]">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 7: SUCESSO */}
            {step === 7 && (
              <div className="flex flex-col flex-1 items-center justify-center text-center">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
                  style={{ background: avatarColor, boxShadow: `0 0 60px ${avatarColor}60` }}
                >
                  <span className="text-[40px] font-black text-white">{(profileName || name || '?').charAt(0).toUpperCase()}</span>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h2 className="text-[28px] font-black text-white uppercase tracking-tight">
                    Bem-vindo, {profileName || name.split(' ')[0]}! 🎉
                  </h2>
                  <p className="text-gray-400 text-[13px] mt-3 leading-relaxed max-w-xs mx-auto">
                    Sua conta foi criada com sucesso. Verifique seu e-mail <span className="text-white font-bold">{email}</span> para ativar o acesso.
                  </p>

                  <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <Mail size={16} className="text-red-400" />
                      <span className="text-white text-[13px] font-bold">Confirme seu e-mail</span>
                    </div>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Enviamos um link de confirmação para <strong className="text-white">{email}</strong>. Clique no link para ativar sua conta e começar a assistir.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 mt-6">
                    {[
                      { emoji: '✅', text: 'Conta criada com sucesso' },
                      { emoji: '📧', text: 'E-mail de confirmação enviado' },
                      { emoji: '🎬', text: 'Perfil personalizado salvo' },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-3">
                        <span className="text-[16px]">{item.emoji}</span>
                        <span className="text-[12px] text-gray-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div className="relative z-10 px-5 pb-10 pt-2">
        {step < 6 && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2) ||
              (step === 3 && !canProceedStep3) ||
              (step === 4 && !canProceedStep4) ||
              (step === 5 && !canProceedStep5)
            }
            className="w-full py-[17px] rounded-2xl font-black text-[14px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 transition-all"
            style={{
              background: (
                (step === 1 && canProceedStep1) ||
                (step === 2 && canProceedStep2) ||
                (step === 3 && canProceedStep3) ||
                (step === 4 && canProceedStep4) ||
                (step === 5 && canProceedStep5)
              ) ? 'linear-gradient(135deg, #c50000 0%, #ff1a1a 100%)' : 'rgba(255,255,255,0.06)',
              color: 'white',
              boxShadow: (step === 1 && canProceedStep1) ? '0 0 25px rgba(255,26,26,0.4)' : 'none',
            }}
          >
            CONTINUAR
            <ChevronRight size={18} strokeWidth={2.5} />
          </motion.button>
        )}

        {step === 6 && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleFinish}
            disabled={loading || !profileName.trim()}
            className="w-full py-[17px] rounded-2xl font-black text-white text-[14px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #c50000 0%, #ff1a1a 100%)',
              boxShadow: '0 0 30px rgba(255,26,26,0.5)',
              opacity: loading || !profileName.trim() ? 0.7 : 1,
            }}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> CRIANDO CONTA...</>
            ) : (
              <><Sparkles size={16} /> CRIAR MINHA CONTA</>
            )}
          </motion.button>
        )}

        {step === 7 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileTap={{ scale: 0.97 }}
            onClick={onComplete}
            className="w-full py-[17px] rounded-2xl font-black text-white text-[14px] uppercase tracking-[0.15em] flex items-center justify-center gap-3"
            style={{ background: 'linear-gradient(135deg, #c50000 0%, #ff1a1a 100%)', boxShadow: '0 0 30px rgba(255,26,26,0.5)' }}
          >
            <Star size={16} />
            IR PARA O LOGIN
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default OnboardingFlow;
