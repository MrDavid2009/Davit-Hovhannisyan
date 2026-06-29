/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

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

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      className="p-2 mr-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-indigo-500"
      aria-label="Переключение темы"
      title={theme === 'light' ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        {theme === 'light' ? (
          <Moon className="w-5 h-5 text-indigo-600 transition-all duration-500 transform rotate-0 scale-100" />
        ) : (
          <Sun className="w-5 h-5 text-amber-400 transition-all duration-500 transform rotate-360 scale-100" />
        )}
      </div>
    </button>
  );
}
