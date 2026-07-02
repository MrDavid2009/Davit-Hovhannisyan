/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Phone, MapPin, Clock, ArrowRight, Upload, Sliders, PackageCheck,
  FileText, Printer, Send, ShieldCheck, ExternalLink
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

const STEPS = [
  {
    icon: Upload,
    title: 'Загрузите файл',
    desc: 'PDF, фото, документы, чертежи — до 100 МБ, любые форматы, прямо с телефона или компьютера.',
  },
  {
    icon: Sliders,
    title: 'Настройте параметры',
    desc: 'Формат (А4/А3), цвет или ч/б, количество копий, срочность и переплёт — всё в пару кликов.',
  },
  {
    icon: PackageCheck,
    title: 'Заберите заказ',
    desc: 'Оплата онлайн или на месте, push-уведомление когда готово. Забрать — на Северном шоссе, 18.',
  },
];

const PRICES = [
  { label: 'А4, чёрно-белая', price: 'от 20 ₽', unit: '/ стр.' },
  { label: 'А4, цветная', price: 'от 40 ₽', unit: '/ стр.' },
  { label: 'А3, любой цвет', price: 'от 45 ₽', unit: '/ стр.' },
  { label: 'Срочная печать', price: '+50%', unit: 'к стоимости' },
];

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#03000a] text-slate-900 dark:text-white">

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-black/40 border-b border-slate-150 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-192-v2.png" alt="Фото-Север" className="w-9 h-9 rounded-xl object-cover" />
            <div className="leading-tight">
              <div className="text-sm font-black">Фото-Север</div>
              <div className="text-[10px] text-slate-500 dark:text-white/40">Северное шоссе, 18</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:+79680508800" className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-white/70 hover:text-orange-500 transition-colors">
              <Phone className="w-3.5 h-3.5" />
              8 (968) 050-88-00
            </a>
            <button
              onClick={onEnter}
              className="landing-cta-btn btn-holo-glass flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
            >
              Войти в кабинет
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO — fullwidth liquid glass ===== */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: '92vh' }}>

        {/* Фоновое видео */}
        <video
          src="/hero-demo.mp4"
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Liquid glass оверлей */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(5,8,20,0.72) 0%, rgba(15,8,40,0.55) 50%, rgba(5,8,20,0.78) 100%)',
          backdropFilter: 'blur(2px)'
        }} />

        {/* Декоративные liquid glass шары */}
        <div className="absolute top-[15%] right-[8%] w-64 h-64 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle at 35% 35%, rgba(249,115,22,0.18), rgba(99,102,241,0.08) 60%, transparent)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 80px rgba(249,115,22,0.12)'
        }} />
        <div className="absolute bottom-[20%] left-[5%] w-48 h-48 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle at 60% 40%, rgba(99,102,241,0.15), transparent 70%)',
          backdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.06)'
        }} />

        {/* Контент */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6" style={{ minHeight: '92vh' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            {/* Бейдж */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.15)'
            }}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/80">Принимаем заказы онлайн</span>
            </div>

            <h1 className="landing-h1 text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6" style={{ textShadow: '0 2px 32px rgba(0,0,0,0.5)' }}>
              Печать фото и документов<br />
              в Раменском{' '}
              <span className="bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                за минуты
              </span>
            </h1>

            <p className="landing-p text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Загрузи файл онлайн — мы распечатаем и сообщим, когда будет готово.<br className="hidden sm:block" />
              А4/А3, фото на документы, переплёт. Без очередей и звонков.
            </p>

            {/* CTA кнопки */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
              <button
                onClick={onEnter}
                className="landing-cta-btn flex items-center gap-2 px-8 py-4 rounded-full text-sm font-black cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #ec4899)',
                  color: '#fff',
                  boxShadow: '0 8px 32px rgba(249,115,22,0.4), 0 0 0 1px rgba(255,255,255,0.1)'
                }}
              >
                <Upload className="w-4 h-4" />
                Загрузить файл
              </button>
              <a
                href="https://t.me/photosever18"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-8 py-4 rounded-full text-sm font-black transition-all"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}
              >
                <Send className="w-4 h-4" />
                Написать в Telegram
              </a>
            </div>

            {/* Инфо-пиллы */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                { icon: <Phone className="w-3.5 h-3.5" />, text: '8 (968) 050-88-00' },
                { icon: <MapPin className="w-3.5 h-3.5" />, text: 'Северное шоссе, 18' },
                { icon: <Clock className="w-3.5 h-3.5" />, text: 'Пн–Пт 9:00–19:00 · Сб–Вс 10:00–19:00' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold" style={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.85)'
                }}>
                  <span style={{ color: '#f97316' }}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          >
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Листай вниз</span>
            <div className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5" style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}>
              <div className="w-1 h-2 rounded-full bg-white/60" style={{ animation: 'scroll-dot 1.8s ease-in-out infinite' }} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== КАК ЗАКАЗАТЬ ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="landing-h2 text-2xl sm:text-3xl font-black text-center mb-2">Как заказать</h2>
        <p className="text-sm text-slate-500 dark:text-white/50 text-center mb-10">Три шага — и готово</p>

        <div className="grid sm:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card rounded-3xl p-6 relative"
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 text-white text-xs font-black flex items-center justify-center shadow-lg">
                {i + 1}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-4">
                <step.icon className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-sm font-black mb-1.5">{step.title}</h3>
              <p className="text-xs text-slate-500 dark:text-white/50 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== ЦЕНЫ ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="landing-h2 text-xl sm:text-2xl font-black mb-1">Цены</h2>
              <p className="text-xs text-slate-500 dark:text-white/50">Ориентировочные — точную стоимость увидите при оформлении заказа</p>
            </div>
            <button
              onClick={onEnter}
              className="flex items-center gap-1.5 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Полный прайс в кабинете
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PRICES.map((p, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-4 text-center">
                <div className="text-lg font-black text-orange-500">{p.price}</div>
                <div className="text-[10px] text-slate-400 mb-1.5">{p.unit}</div>
                <div className="text-xs font-bold">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== КАРТА ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="landing-h2 text-2xl sm:text-3xl font-black text-center mb-2">Где нас найти</h2>
        <p className="text-sm text-slate-500 dark:text-white/50 text-center mb-8">Раменское, Северное шоссе, 18</p>

        <div className="glass-card rounded-3xl overflow-hidden">
          <iframe
            title="Карта — Фото-Север, Северное шоссе 18, Раменское"
            src="https://yandex.ru/map-widget/v1/?text=Раменское%20Северное%20шоссе%2018&z=16"
            width="100%"
            height="360"
            style={{ border: 0 }}
            loading="lazy"
          />
          <div className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold">Северное шоссе, 18, Раменское</span>
            </div>
            <a
              href="https://yandex.ru/maps/?text=Раменское%20Северное%20шоссе%2018&rtext=~Раменское%20Северное%20шоссе%2018"
              target="_blank" rel="noopener noreferrer"
              className="landing-cta-btn btn-holo-glass flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer"
            >
              Построить маршрут
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-150 dark:border-white/10 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-8 text-xs text-slate-500 dark:text-white/50">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo-192-v2.png" alt="Фото-Север" className="w-7 h-7 rounded-lg object-cover" />
              <span className="text-sm font-black text-slate-900 dark:text-white">Фото-Север</span>
            </div>
            <p className="leading-relaxed">Копи-центр в Раменском.<br />Печать фото, документов, чертежей.</p>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Контакты</div>
            <a href="tel:+79680508800" className="flex items-center gap-1.5 hover:text-orange-500 transition-colors"><Phone className="w-3.5 h-3.5" /> 8 (968) 050-88-00</a>
            <a href="https://t.me/photosever18" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-orange-500 transition-colors"><Send className="w-3.5 h-3.5" /> @photosever18</a>
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Северное шоссе, 18, Раменское</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Пн–Пт 9:00–19:00 · Сб–Вс 10:00–19:00</div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Реквизиты
            </div>
            <div>ИП, ИНН 501110120673</div>
            <div>ОГРНИП 324774600314137</div>
            <div className="pt-2 flex flex-col gap-1">
              <a href="/legal.html" target="_blank" className="text-left hover:text-orange-500 transition-colors underline decoration-dotted">Публичная оферта</a>
              <a href="/legal.html#privacy" target="_blank" className="text-left hover:text-orange-500 transition-colors underline decoration-dotted">Политика обработки персональных данных</a>
            </div>
          </div>
        </div>
        <div className="text-center text-[10px] text-slate-400 dark:text-white/30 pb-6">
          &copy; 2026 Копи-Центр «Фото-Север» &middot; Северное шоссе, 18 &middot; Лицензия SSL
        </div>
      </footer>
    </div>
  );
}
