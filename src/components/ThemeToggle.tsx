/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('print_shop_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('print_shop_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const isDark = theme === 'dark';

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label="Переключение темы"
      title={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
      style={{
        position: 'relative',
        width: 72,
        height: 36,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        background: isDark
          ? 'linear-gradient(135deg, #1a1030, #0d0820)'
          : 'linear-gradient(135deg, #fef3c7, #fde68a)',
        boxShadow: isDark
          ? 'inset 0 2px 6px rgba(0,0,0,0.5), 0 0 16px rgba(167,139,250,0.5), 0 0 4px rgba(167,139,250,0.6)'
          : 'inset 0 2px 6px rgba(0,0,0,0.08), 0 0 16px rgba(251,191,36,0.45), 0 0 4px rgba(251,191,36,0.5)',
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
        outline: 'none',
        flexShrink: 0,
      }}
    >
      {/* Текст ON / OFF внутри трека */}
      <span
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.06em',
          color: isDark ? 'rgba(167,139,250,0.9)' : 'transparent',
          opacity: isDark ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      >
        ON
      </span>
      <span
        style={{
          position: 'absolute',
          right: 9,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.06em',
          color: isDark ? 'transparent' : 'rgba(180,140,20,0.7)',
          opacity: isDark ? 0 : 1,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      >
        OFF
      </span>

      {/* Бегунок с кольцом-свечением */}
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: isDark ? 39 : 3,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 35% 30%, #c4b5fd, #7c3aed 70%)'
            : 'radial-gradient(circle at 35% 30%, #fffbeb, #f59e0b 75%)',
          boxShadow: isDark
            ? '0 0 0 3px rgba(124,58,237,0.25), 0 0 14px rgba(167,139,250,0.9), 0 2px 6px rgba(0,0,0,0.4)'
            : '0 0 0 3px rgba(251,191,36,0.25), 0 0 14px rgba(251,191,36,0.85), 0 2px 6px rgba(0,0,0,0.15)',
          transition: 'left 0.4s cubic-bezier(0.34,1.4,0.64,1), background 0.4s ease, box-shadow 0.4s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Внутренняя иконка солнца/луны - простая SVG */}
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
            <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
          </svg>
        )}
      </span>
    </button>
  );
}
