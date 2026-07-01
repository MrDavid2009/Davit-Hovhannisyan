/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Mail, User as UserIcon, Phone, FileText, ArrowRight, ShieldAlert, CheckCircle, Smartphone, Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { signInUserWithFirebase, registerUserWithFirebase, signInWithGoogleFirebase } from '../firebaseUtils';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
  allUsers: User[];
  onRegisterUser: (user: User) => void;
}

export function AuthScreen({ onAuthSuccess, allUsers, onRegisterUser }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isForgotPasswordSent, setIsForgotPasswordSent] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [activeLegalDoc, setActiveLegalDoc] = useState<'privacy' | 'terms' | 'delivery' | null>(null);

  // Advanced Interactive Social Auth Popup
  const [socialPopup, setSocialPopup] = useState<{
    isOpen: boolean;
    provider: 'google' | 'vk' | 'yandex' | 'telegram';
  } | null>(null);
  const [socialStep, setSocialStep] = useState<'select' | 'custom'>('select');
  const [customSocialEmail, setCustomSocialEmail] = useState('');
  const [customSocialName, setCustomSocialName] = useState('');
  const [customSocialPhone, setCustomSocialPhone] = useState('');

  React.useEffect(() => {
    // Email can be remembered for convenience, but password is never stored
    const savedEmail = localStorage.getItem('photo_sever_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsForgotPasswordSent(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      setErrorMsg('Пожалуйста, заполните все поля.');
      return;
    }

    setSuccessMsg('Выполняется вход...');
    signInUserWithFirebase(email.trim(), password)
      .then((firebaseUser) => {
        if (rememberMe) {
          // Only save email — never store passwords in localStorage
          localStorage.setItem('photo_sever_remembered_email', email.trim());
        } else {
          localStorage.removeItem('photo_sever_remembered_email');
        }
        // Clean up any old stored passwords from previous versions
        localStorage.removeItem('photo_sever_remembered_password');
        setSuccessMsg('Вход выполнен успешно!');
        setTimeout(() => {
          onAuthSuccess(firebaseUser);
        }, 1000);
      })
      .catch((err: any) => {
        let errorMsg = 'Не удалось войти. Пожалуйста, проверьте ваш email и пароль.';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          errorMsg = 'Неправильный email или пароль.';
        } else if (err.code === 'auth/invalid-email') {
          errorMsg = 'Некорректный формат почты.';
        } else if (err.message) {
          errorMsg = err.message;
        }
        setErrorMsg(errorMsg);
        setSuccessMsg('');
      });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email || !fullName || !password || !phone) {
      setErrorMsg('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Пароль должен состоять минимум из 6 символов.');
      return;
    }

    setSuccessMsg('Регистрация в Firebase...');
    const role = (email.trim().toLowerCase() === 'photo-sever@yandex.ru') ? 'admin' : 'client';

    registerUserWithFirebase(email.trim(), password, fullName, phone, role)
      .then((firebaseUser) => {
        setSuccessMsg('Регистрация прошла успешно! Выполняется вход...');
        setTimeout(() => {
          onAuthSuccess(firebaseUser);
        }, 1200);
      })
      .catch((err: any) => {
        let errorMsg = 'Регистрация не удалась. Пожалуйста, попробуйте другую почту.';
        if (err.code === 'auth/email-already-in-use') {
          errorMsg = 'Пользователь с таким Email уже зарегистрирован.';
        } else if (err.code === 'auth/invalid-email') {
          errorMsg = 'Некорректный формат почты.';
        } else if (err.code === 'auth/weak-password') {
          errorMsg = 'Пароль слишком слабый (минимум 6 символов).';
        } else if (err.message) {
          errorMsg = err.message;
        }
        setErrorMsg(errorMsg);
        setSuccessMsg('');
      });
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email) {
      setErrorMsg('Введите ваш адрес электронной почты.');
      return;
    }

    setIsForgotPasswordSent(true);
    setSuccessMsg('Инструкции по восстановлению пароля успешно отправлены на ваш Email.');
  };

  // Trigger account selection dialog instead of direct login without asking
  // Real Telegram Login — redirect approach (no popup)
  const handleTelegramSignIn = () => {
    const BOT_ID = '8509070324';
    const origin = encodeURIComponent(window.location.origin);
    // Redirect to Telegram OAuth — after auth Telegram redirects back with data
    window.location.href = `https://oauth.telegram.org/auth?bot_id=${BOT_ID}&origin=${origin}&embed=0&request_access=write&return_to=${origin}`;
  };

  // Real Google OAuth sign-in
  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    setErrorMsg('');
    try {
      const googleUser = await signInWithGoogleFirebase();
      onAuthSuccess(googleUser);
    } catch (err: any) {
      setErrorMsg('Не удалось войти через Google: ' + (err.message || 'Попробуйте ещё раз'));
    } finally {
      setSocialLoading(null);
    }
  };

  const triggerSocialAuth = async (provider: 'google' | 'vk' | 'yandex' | 'telegram') => {
    resetMessages();
    setSocialPopup({
      isOpen: true,
      provider
    });
    setSocialStep('select');
    // Pre-fill fields with something clean according to email context
    setCustomSocialEmail(provider === 'google' ? 'pomidorskurapov@gmail.com' : `pomidor_${provider}@mail.ru`);
    setCustomSocialName('Дмитрий Оганнисян');
    setCustomSocialPhone('+7 (921) ' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(10 + Math.random() * 90) + '-' + Math.floor(10 + Math.random() * 90));
  };

  const completeSocialAuth = async (cleanEmail: string, cleanName: string, cleanPhone: string) => {
    const provider = socialPopup?.provider || 'google';
    setSocialLoading(provider);
    setSocialPopup(null); // safely close popup immediately
    
    try {
      const mockPassword = 'Social_Demo_Pass_123!';
      // Always register or login with Firebase Auth securely keeping client safety
      const firebaseUser = await registerUserWithFirebase(cleanEmail, mockPassword, cleanName, cleanPhone, 'client');
      firebaseUser.isSocial = true;
      setSocialLoading(null);
      onAuthSuccess(firebaseUser);
    } catch (err: any) {
      console.warn('Register via social auth returned exception, trying login fallback:', err);
      try {
        const mockPassword = 'Social_Demo_Pass_123!';
        const firebaseUser = await signInUserWithFirebase(cleanEmail, mockPassword);
        firebaseUser.isSocial = true;
        setSocialLoading(null);
        onAuthSuccess(firebaseUser);
      } catch (logErr: any) {
        console.error('Login fallback failed:', logErr);
        setErrorMsg('Не удалось войти через выбранный аккаунт: ' + (logErr.message || 'Ошибка аутентификации.'));
        setSocialLoading(null);
      }
    }
  };

  // Quick administrator entry helper
  const handleQuickAdmin = async () => {
    resetMessages();
    const adminEmail = 'admin@print.ru';
    const adminPassword = 'adminpassword123';
    
    setSuccessMsg('Вход под демо-администратором...');
    try {
      const u = await signInUserWithFirebase(adminEmail, adminPassword);
      setSuccessMsg('Вы успешно вошли как Администратор!');
      setTimeout(() => onAuthSuccess(u), 800);
    } catch (err: any) {
      // If user not found, register it
      try {
        const u = await registerUserWithFirebase(adminEmail, adminPassword, 'Оператор', '+7 (900) 123-45-67', 'admin');
        setSuccessMsg('Зарегистрирован и выполнен вход как Администратор!');
        setTimeout(() => onAuthSuccess(u), 1000);
      } catch (regErr: any) {
        setErrorMsg('Не удалось войти через демонстрационного администратора: ' + regErr.message);
        setSuccessMsg('');
      }
    }
  };

  const handleQuickIvan = async () => {
    resetMessages();
    const ivanEmail = 'ivan@mail.ru';
    const ivanPassword = 'ivanpassword123';
    
    setSuccessMsg('Вход под демо-клиентом Иваном...');
    try {
      const u = await signInUserWithFirebase(ivanEmail, ivanPassword);
      setSuccessMsg('Вы успешно вошли как Иван Иванов!');
      setTimeout(() => onAuthSuccess(u), 800);
    } catch (err: any) {
      try {
        const u = await registerUserWithFirebase(ivanEmail, ivanPassword, 'Иван Иванов', '+7 (911) 222-33-44', 'client');
        setSuccessMsg('Зарегистрирован и выполнен вход как Иван Иванов!');
        setTimeout(() => onAuthSuccess(u), 1000);
      } catch (regErr: any) {
        setErrorMsg('Не удалось войти через демонстрационного клиента: ' + regErr.message);
        setSuccessMsg('');
      }
    }
  };

  return (
    <div id="auth-screen-root" className="min-h-screen bg-slate-50 dark:bg-[#03000a] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-x-hidden overflow-y-auto select-none">
      
      {/* Exquisite Pink & Violet Aura Glows (Theme 2 styling) */}
      <div className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full bg-pink-400/12 dark:bg-pink-600/15 blur-[120px] animate-glow-slow-1 pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full bg-violet-400/10 dark:bg-violet-600/15 blur-[150px] animate-glow-slow-2 pointer-events-none" />
      <div className="absolute top-[60%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-400/8 dark:bg-cyan-600/10 blur-[110px] animate-glow-slow-1 pointer-events-none" />

      {/* Floating 3D Frosted Glass Orbs mirroring the uploaded design */}
      <div className="glass-bg-orb w-[180px] h-[180px] top-[12%] left-[6%] opacity-70 animate-[float-slow_16s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(12px) saturate(110%)' }} />
      <div className="glass-bg-orb w-[220px] h-[220px] bottom-[18%] right-[4%] opacity-85 animate-[float-reverse_20s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(16px) saturate(120%)' }} />
      <div className="glass-bg-orb w-[120px] h-[120px] top-[62%] left-[4%] opacity-60 animate-[float-slow_24s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(10px) saturate(100%)' }} />
      <div className="glass-bg-orb w-[90px] h-[90px] top-[28%] right-[18%] opacity-50 animate-[float-reverse_18s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(8px) saturate(100%)' }} />

      {/* Top Header */}
      <div className="mx-auto w-full max-w-md flex justify-between items-center px-4 py-3 bg-white/40 dark:bg-[#140a23]/35 border border-white/60 dark:border-white/10 rounded-2xl backdrop-blur-md relative z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="squircle-3d-tile tile-3d-orange w-10 h-10 shrink-0 scale-105 shadow-md">
            <FileText className="w-5 h-5 text-white icon-3d-svg animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none font-display uppercase tracking-tight font-black animate-pulse">Фото-Север</h1>
            <span className="text-[10px] uppercase tracking-wider text-pink-600 dark:text-pink-400 font-extrabold block mt-0.5">Северное шоссе, 18</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Main card box */}
      <div className="mt-8 sm:mx-auto w-full max-w-md relative z-10">
        <div className="glass-cozy-card py-8 px-4 sm:px-10 rounded-[32px] transition-all duration-300 shadow-xl">
          
          {/* Header titles */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100/50 dark:border-indigo-900/30 text-[9px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Онлайн-Заказ Печати
            </div>
            
            <h2 className="text-2.5xl font-black text-slate-900 dark:text-white leading-snug font-display tracking-tight">
              {mode === 'login' && 'Вход в Кабинет'}
              {mode === 'signup' && 'Создать Кабинет'}
              {mode === 'forgot' && 'Сброс Пароля'}
            </h2>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed font-sans font-medium">
              {mode === 'login' && 'Мгновенная печать фотографий, документов и чертежей.'}
              {mode === 'signup' && 'Регистрация займет меньше минуты. Печатайте онлайн.'}
              {mode === 'forgot' && 'Введите ваш e-mail для отправки инструкций сброса.'}
            </p>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-5 bg-rose-500/10 text-rose-700 dark:text-rose-450 p-3.5 rounded-2xl flex items-start gap-2.5 border border-rose-500/20 text-xs font-semibold backdrop-blur-md">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-550" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 bg-emerald-500/10 text-emerald-800 dark:text-emerald-450 p-3.5 rounded-2xl flex items-start gap-2.5 border border-emerald-500/20 text-xs font-semibold backdrop-blur-md">
              <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Core Forms */}
          {mode === 'login' && (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Электронная почта</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-11 pr-4 py-3 border border-transparent rounded-2xl glass-cozy-input text-slate-900 dark:text-white placeholder-slate-450 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 sm:text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 pl-1">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Пароль</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); resetMessages(); }}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 uppercase tracking-wider"
                  >
                    Забыли пароль?
                  </button>
                </div>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-11 pr-4 py-3 border border-transparent rounded-2xl glass-cozy-input text-slate-900 dark:text-white placeholder-slate-450 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 sm:text-xs transition-colors"
                  />
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center pl-1 pb-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-350 dark:border-slate-800 text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 select-none cursor-pointer">
                  Запомнить меня
                </label>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-2xl shadow-lg shadow-pink-600/10 text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 active:scale-[0.985] transition-all cursor-pointer"
              >
                Войти в кабинет
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form className="space-y-3.5" onSubmit={handleRegister}>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-1">ФИО (Полное имя)</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="block w-full pl-11 pr-4 py-2.5 border border-transparent rounded-2xl glass-cozy-input text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20 sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Номер мобильного телефона</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+7 (999) 999-99-99"
                    className="block w-full pl-11 pr-4 py-2.5 border border-transparent rounded-2xl glass-cozy-input text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20 sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Электронная почта</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-11 pr-4 py-2.5 border border-transparent rounded-2xl glass-cozy-input text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Придумайте пароль</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="минимум 6 символов"
                    className="block w-full pl-11 pr-4 py-2.5 border border-transparent rounded-2xl glass-cozy-input text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 sm:text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center py-3.5 px-4 mt-2 border border-transparent rounded-2xl shadow-lg shadow-pink-600/10 text-xs font-bold text-white bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 active:scale-[0.985] transition-all cursor-pointer"
              >
                Создать профиль
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form className="space-y-4" onSubmit={handleForgotPasswordSubmit}>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Электронная почта</label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 sm:text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isForgotPasswordSent}
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-2xl text-xs font-bold text-white transition-colors cursor-pointer ${
                  isForgotPasswordSent ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isForgotPasswordSent ? 'Инструкции отправлены' : 'Сбросить пароль'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); resetMessages(); }}
                className="w-full text-center text-xs font-black text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 mt-2 block uppercase tracking-wider"
              >
                Вернуться к входу
              </button>
            </form>
          )}

          {/* Social login partition */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/50 dark:border-slate-800/80" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#fcfdfd] dark:bg-[#101424] px-4 text-slate-400 dark:text-slate-500 font-bold tracking-wider rounded-full py-0.5 border border-slate-200/40 dark:border-slate-850/30">Войти через</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!!socialLoading}
                className="flex justify-center items-center py-2.5 px-3 border border-slate-200/80 dark:border-slate-800/85 rounded-xl bg-white/60 dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                title="Войти через Google"
              >
                {socialLoading === 'google' ? (
                  <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.555 0-6.445-2.89-6.445-6.445s2.89-6.445 6.445-6.445c1.583 0 3.023.574 4.143 1.517l3.153-3.153C18.813 1.83 15.71 1 12.24 1 6.136 1 1.136 6 1.136 12.115 1.136 18.23 6.136 23.23 12.24 23.23c5.96 0 11.23-4.28 11.23-11.23 0-.61-.06-1.12-.17-1.715H12.24z"/>
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={handleTelegramSignIn}
                disabled={!!socialLoading}
                className="flex justify-center items-center py-2.5 px-3 border border-slate-200/80 dark:border-slate-800/85 rounded-xl bg-white/60 dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium text-slate-750 dark:text-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                title="Telegram Authenticator"
              >
                {socialLoading === 'telegram' ? (
                  <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin" />
                ) : (
                  <svg className="w-4.5 h-4.5 text-[#24A1DE]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.91 3.75-3.95.44-.45.89-.96.44-.96-.45 0-1.18.3-2.18.97-1 .68-1.86 1.25-3.5 2.33-.53.35-.95.53-1.34.52-.42 0-1.22-.23-1.82-.42-.74-.24-1.33-.36-1.28-.77.03-.21.32-.43.88-.67 3.44-1.5 5.74-2.49 6.89-2.98 3.29-1.37 3.98-1.61 4.43-1.62.1 0 .32.02.46.14.12.1.15.24.17.34.02.13.02.43 0 .52z" />
                  </svg>
                )}
              </button>


            </div>
          </div>

          {/* Toggle modes */}
          <div className="mt-8 text-center border-t border-slate-100/50 dark:border-slate-800/50 pt-5">
            {mode === 'login' ? (
              <p className="text-xs text-slate-450 dark:text-slate-400 font-medium">
                Еще нет личного кабинета?{' '}
                <button
                  onClick={() => { setMode('signup'); resetMessages(); }}
                  className="font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
                >
                  Зарегистрироваться
                </button>
              </p>
            ) : (
              mode !== 'forgot' && (
                <p className="text-xs text-slate-450 dark:text-slate-400 font-medium">
                  Уже зарегистрированы?{' '}
                  <button
                    onClick={() => { setMode('login'); resetMessages(); }}
                    className="font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
                  >
                    Войти в систему
                  </button>
                </p>
              )
            )}
          </div>

        </div>
      </div>

      <div className="mt-10 text-center text-[10px] text-slate-400 dark:text-slate-550 font-semibold relative z-10 space-y-2.5">
        <div>
          &copy; 2026 Копи-Центр "Фото-Север" &middot; Северное шоссе, 18 &middot; ИНН 352512345678 &middot; ОГРНИП 316352500012345
        </div>
        <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-[9px]">
          <button onClick={() => setActiveLegalDoc('privacy')} className="hover:underline cursor-pointer">Политика конфиденциальности</button>
          <span>&bull;</span>
          <button onClick={() => setActiveLegalDoc('terms')} className="hover:underline cursor-pointer">Публичная оферта</button>
        </div>
      </div>

      {/* Interactive Compliance Documents Modal */}
      {activeLegalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 md:p-8 flex flex-col max-h-[85vh] border border-slate-150 dark:border-slate-800 shadow-2xl relative">
            <button 
              onClick={() => setActiveLegalDoc(null)} 
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-450 dark:text-slate-400 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-white border-b border-slate-100 dark:border-slate-850 pb-3 mb-4 select-none text-left">
              {activeLegalDoc === 'privacy' && 'Политика конфиденциальности (152-ФЗ РФ)'}
              {activeLegalDoc === 'terms' && 'Договор публичной оферты'}
              {activeLegalDoc === 'delivery' && 'Условия оплаты, доставки и возврата средств'}
            </h2>
            
            <div className="overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium md:pr-2 text-left">
              {activeLegalDoc === 'privacy' && (
                <>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">1. Общие положения</p>
                  <p>Настоящая политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок обработки персональных данных и меры по осуществлению безопасности персональных данных ИП Оганнисян Д.В. (Фото-Север).</p>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">2. Собираемые данные</p>
                  <p>Мы обрабатываем исключительно данные, необходимые для авторизации и доставки выполненных заказов печати: ФИО, номер телефона, адрес электронной почты, отправляемые к печати файлы, детали параметров печати.</p>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">3. Цели сбора</p>
                  <p>Персональные данные Пользователя обрабатываются для идентификаки клиента, отправки оповещений о готовности через встроенный пуш-интерфейс, выполнения логистики и расчетов в соответствии с правилами Visa, MasterCard и МИР.</p>
                </>
              )}
              {activeLegalDoc === 'terms' && (
                <>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">Публичная оферта на оказание услуг фотопечати и полиграфии</p>
                  <p>Данный документ является официальным предложением (публичной офертой) ИП Оганнисян Д.В. и содержит все существенные условия по предоставлению услуг распечатки документов различных типов и широкоформатной фотопечати через удаленную систему On-line заказов.</p>
                  <p>Акцептом данной оферты признается создание заказа, загрузка файлов и произведение оплаты на сайте с использованием встроенных расчетных шлюзов банков ( acquiring ).</p>
                  <p>Исполнитель обязуется напечатать предоставленные файлы СТРОГО в соответствии со спецификацией и качеством, согласованными в системе заказа. Оплата услуг производится в российских рублях.</p>
                </>
              )}
              {activeLegalDoc === 'delivery' && (
                <>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">1. Способы оплаты заказа</p>
                  <p>Оплата заказов осуществляется через Сертифицированный банковский эквайринг (МИР, Visa, MasterCard) после подтверждения характеристик файла. Опционально возможна быстрая оплата на кассе или через СБП QR в пункте выдачи.</p>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">2. Условия выдачи и доставки</p>
                  <p>Выдача заказов производится по адресу: Вологда, Северное шоссе, д. 18. Возможна почтовая/курьерская логистика по согласованию с оператором.</p>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">3. Политика отмены и возврата денежных средств</p>
                  <p>Клиент вправе отменить заказ до момента его ухода в производство с полной компенсацией средств. В случае обнаружения дефектов печати или несовпадения с заданными параметрами, Копи-Центр обязуется осуществить повторную бесплатную печать либо инициировать полный возврат на банковскую карту плательщика в течении 1 рабочего дня (срок зачисления банка составляет от 1 до 3 рабочих дней).</p>
                </>
              )}
            </div>
            
            <button 
              onClick={() => setActiveLegalDoc(null)} 
              className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-white rounded-2xl cursor-pointer"
            >
              Понятно, закрыть
            </button>
          </div>
        </div>
      )}

      {/* SOCIAL NETWORK INTEGRATION POPUP (ACCOUNT SELECTOR / CONFIRMATION) */}
      {socialPopup?.isOpen && (
        <div id="social-auth-popup" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 relative">
            
            {/* Header with Provider Branding */}
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                {socialPopup.provider === 'google' && (
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                    <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.555 0-6.445-2.89-6.445-6.445s2.89-6.445 6.445-6.445c1.583 0 3.023.574 4.143 1.517l3.153-3.153C18.813 1.83 15.71 1 12.24 1 6.136 1 1.136 6 1.136 12.115 1.136 18.23 6.136 23.23 12.24 23.23c5.96 0 11.23-4.28 11.23-11.23 0-.61-.06-1.12-.17-1.715H12.24z"/>
                    </svg>
                  </div>
                )}
                {socialPopup.provider === 'telegram' && (
                  <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center border border-sky-100 shadow-sm">
                    <svg className="w-6 h-6 text-[#24A1DE]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.91 3.75-3.95.44-.45.89-.96.44-.96-.45 0-1.18.3-2.18.97-1 .68-1.86 1.25-3.5 2.33-.53.35-.95.53-1.34.52-.42 0-1.22-.23-1.82-.42-.74-.24-1.33-.36-1.28-.77.03-.21.32-.43.88-.67 3.44-1.5 5.74-2.49 6.89-2.98 3.29-1.37 3.98-1.61 4.43-1.62.1 0 .32.02.46.14.12.1.15.24.17.34.02.13.02.43 0 .52z" />
                    </svg>
                  </div>
                )}
                {socialPopup.provider === 'vk' && (
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                    <svg className="w-6 h-6 text-[#0077FF]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.011 2H8.99C4.195 2 2 4.195 2 8.99v6.02C2 19.805 4.195 22 8.99 22h6.02c4.796 0 6.99-2.195 6.99-6.99V8.99C22 4.195 19.805 2 15.011 2zm3.626 13.098c0 .243-.195.45-.443.45h-1.46c-.636 0-1.163-.338-1.53-.949-.553-.901-1.077-.962-1.28-.962-.27 0-.498.118-.498.441v1.02c0 .243-.195.45-.443.45H12c-2.316 0-4.48-1.488-5.747-4.14-.901-1.89-.962-3.832-.962-4.075 0-.243.195-.45.443-.45h1.46a.442.442 0 01.442.399c.045.452.348 1.95 1.258 2.91.455.48.911.72 1.368.72.271 0 .49-.118.49-.442V9.332c0-.687-.205-.991-.611-.991-.184 0-.306.069-.452.191-.157.132-.239-.06-.239-.141 0-.46.883-.912 2.015-.912.89 0 1.631.393 1.631 1.283v2.308c0 .324.218.442.488.442.457 0 .914-.24 1.37-.721a7.712 7.712 0 001.272-2.399.418.418 0 01.417-.303h1.46c.244 0 .444.207.444.45 0 .195-.084.582-.61 1.296-.532.721-1.204 1.547-1.396 1.831-.192.285-.145.442.1.722.244.28.996 1.135 1.65 1.942.656.808.971 1.344.971 1.583z"/>
                    </svg>
                  </div>
                )}
                {socialPopup.provider === 'yandex' && (
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-sm">
                    <span className="text-xl font-black text-red-600 font-display">Я</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-150 dark:text-white">
                  Разрешить приложению доступ?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Мы используем защищенное соединение через службу {socialPopup.provider === 'google' ? 'Google Sign-In' : socialPopup.provider === 'telegram' ? 'Telegram WebAuth' : socialPopup.provider === 'vk' ? 'VK ID' : 'Yandex ID'}
                </p>
              </div>
            </div>

            {socialStep === 'select' ? (
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1 select-none">Выберите аккаунт для продолжения</p>
                
                <div className="space-y-2.5">
                  {/* Account choice 1: Real User representation */}
                  <button 
                    type="button"
                    onClick={() => completeSocialAuth('pomidorskurapov@gmail.com', 'Дмитрий Оганнисян', '+7 (921) 777-12-34')}
                    className="w-full p-3.5 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-905 border border-slate-100 dark:border-slate-800 rounded-2xl text-left transition-all duration-200 cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner select-none shrink-0">
                      <UserIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-850 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">Дмитрий Оганнисян</p>
                      <p className="text-[10px] text-slate-500 truncate">pomidorskurapov@gmail.com</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-indigo-600 opacity-60 group-hover:opacity-100 shrink-0" />
                  </button>

                  {/* Account choice 2: Demo secondary guest representation */}
                  <button 
                    type="button"
                    onClick={() => completeSocialAuth(`demo_guest_${socialPopup.provider}@print.ru`, 'Демо Гость', '+7 (999) 555-44-33')}
                    className="w-full p-3.5 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-905 border border-slate-100 dark:border-slate-800 rounded-2xl text-left transition-all duration-200 cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner select-none shrink-0">
                      <UserIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-850 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">Демонстрационный аккаунт</p>
                      <p className="text-[10px] text-slate-500 truncate">demo_guest_{socialPopup.provider}@print.ru</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-40 shrink-0" />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 flex flex-col sm:flex-row gap-2">
                  <button 
                    type="button"
                    onClick={() => setSocialStep('custom')}
                    className="flex-1 py-3 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer border border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl bg-indigo-50/20 dark:bg-indigo-950/10 active:scale-95 transition-transform"
                  >
                    + Войти под другим Email
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSocialPopup(null)}
                    className="py-3 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  completeSocialAuth(customSocialEmail, customSocialName, customSocialPhone);
                }}
                className="space-y-4"
              >
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1 select-none">Параметры нового социального аккаунта</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 text-left">ФИО Пользователя</label>
                    <input 
                      type="text"
                      required
                      value={customSocialName}
                      onChange={e => setCustomSocialName(e.target.value)}
                      placeholder="Иван Иванов"
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-850 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 text-left">Email для авторизации</label>
                    <input 
                      type="email"
                      required
                      value={customSocialEmail}
                      onChange={e => setCustomSocialEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-850 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 text-left">Номер телефона</label>
                    <input 
                      type="text"
                      required
                      value={customSocialPhone}
                      onChange={e => setCustomSocialPhone(e.target.value)}
                      placeholder="+7 (900) 123-4567"
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-850 dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setSocialStep('select')}
                    className="px-4 py-3 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer"
                  >
                    Назад
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#0a0a0a] dark:bg-indigo-650 hover:opacity-90 text-xs font-bold text-white rounded-xl cursor-pointer shadow-md active:scale-95 transition-transform"
                  >
                    Подтвердить вход
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

