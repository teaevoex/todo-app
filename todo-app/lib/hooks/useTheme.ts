'use client';

import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const storageKey = 'todo-app-theme';

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const resolved =
      stored === 'light' || stored === 'dark'
        ? stored
        : 'dark';

    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
