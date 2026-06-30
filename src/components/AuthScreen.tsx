/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Mail, User as UserIcon, Phone, FileText, ArrowRight, ShieldAlert, CheckCircle, Smartphone, Sparkles, Printer } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { signInUserWithFirebase, registerUserWithFirebase } from '../firebaseUtils';
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
    const role = (email.trim().toLowerCase() === 'admin@print.ru' || email.trim().toLowerCase() === 'photo-sever@yandex.ru') ? 'admin' : 'client';

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

  // Simulate Social network logins
  const triggerSocialAuth = async (provider: 'google' | 'vk' | 'yandex' | 'telegram') => {
    resetMessages();
    setSocialLoading(provider);

    try {
      const providerNames = { google: 'Google', vk: 'ВКонтакте', yandex: 'Яндекс', telegram: 'Telegram' };
      const emailPrefix = provider === 'vk' ? 'vk_' : provider === 'yandex' ? 'ya_' : provider === 'telegram' ? 'tg_' : 'g_';
      const mockEmail = `${emailPrefix}user_${Math.floor(Math.random() * 9000 + 1000)}@${provider}.ru`;
      
      const names = [
        'Дмитрий Ковалев',
        'Мария Петрова',
        'Александр Власов',
        'Елена Соколова',
        'Сергей Морозов'
      ];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const fullName = `${randomName} (${providerNames[provider]})`;
      const phone = '+7 (999) ' + Math.floor(100+Math.random()*900) + '-' + Math.floor(10+Math.random()*90) + '-' + Math.floor(10+Math.random()*90);
      const mockPassword = 'Social_Demo_Pass_123!';

      // Register with real Firebase auth and save to firestore profile
      const firebaseUser = await registerUserWithFirebase(mockEmail, mockPassword, fullName, phone, 'client');
      
      // Mark as social
      firebaseUser.isSocial = true;

      setSocialLoading(null);
      onAuthSuccess(firebaseUser);
    } catch (err: any) {
      console.error('Social mock auth failed with Firebase:', err);
      setErrorMsg('Не удалось зарегистрировать социальный демо-профиль в Firebase Authentication. Проверьте сеть.');
      setSocialLoading(null);
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
        const u = await registerUserWithFirebase(adminEmail, adminPassword, 'Дмитрий (Администратор)', '+7 (900) 123-45-67', 'admin');
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
    <div id="auth-screen-root" className="min-h-screen bg-slate-50 dark:bg-[#03000a] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden select-none">
      
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
      <div className="mx-auto w-full max-w-md flex justify-between items-center px-4 py-3 bg-white/40 dark:bg-[#140a23]/35 border border-white/60 dark:border-white/10 border-b-0 rounded-t-[28px] backdrop-blur-md relative z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="squircle-3d-tile tile-3d-orange w-10 h-10 shrink-0 scale-105 shadow-md">
            <FileText className="w-5 h-5 text-white icon-3d-svg animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none font-display uppercase tracking-tight font-black animate-pulse">Фото-Север</h1>
            <span className="text-[10px] uppercase tracking-wider text-pink-600 dark:text-pink-400 font-extrabold block mt-0.5">Северное шоссе, 18</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Main card box */}
      <div className="sm:mx-auto w-full max-w-md relative z-10">
        <div className="glass-cozy-card py-8 px-4 sm:px-10 rounded-b-[32px] rounded-t-none border-t-0 transition-all duration-300 shadow-xl">
          
          {/* Header titles */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-900/30 text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Printer className="w-3 h-3 text-emerald-500" />
              Принимаем заказы онлайн
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

              <label className="flex items-center gap-2 cursor-pointer select-none -mt-1">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 accent-red-500 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Запомнить меня</span>
              </label>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-slate-200/70 dark:border-white/10 rounded-2xl shadow-sm text-xs font-bold text-slate-900 dark:text-white bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 active:scale-[0.985] transition-all cursor-pointer"
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
                <span className="bg-white/70 dark:bg-white/10 backdrop-blur-sm px-4 text-slate-500 dark:text-slate-300 font-bold tracking-wider rounded-full py-0.5 border border-slate-200/40 dark:border-white/15">Войти через</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => triggerSocialAuth('google')}
                disabled={!!socialLoading}
                className="flex justify-center items-center py-2.5 px-3 border border-slate-200/70 dark:border-white/10 rounded-xl bg-white/80 dark:bg-white/8 hover:bg-white dark:hover:bg-white/15 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                title="Google ID"
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
                onClick={() => triggerSocialAuth('telegram')}
                disabled={!!socialLoading}
                className="flex justify-center items-center py-2.5 px-3 border border-slate-200/70 dark:border-white/10 rounded-xl bg-white/80 dark:bg-white/8 hover:bg-white dark:hover:bg-white/15 text-xs font-medium text-slate-750 dark:text-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
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

      <div className="mt-10 text-center text-[10px] text-slate-400 dark:text-slate-550 font-medium relative z-10">
        &copy; 2026 Копи-Центр "Фото-Север" &middot; Северное шоссе, 18 &middot; Лицензия SSL &middot; Все права защищены
      </div>
    </div>
  );
}

