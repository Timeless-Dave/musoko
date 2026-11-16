'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { runPeelTransition } from './peelTransition';
import { THEME_STORAGE_KEY, type ThemeName } from './theme-script';

interface ThemeApi {
  theme: ThemeName;
  setTheme: (next: ThemeName) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

function readTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'green' ? 'green' : 'yellow';
}

function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function applyTheme(next: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage may be blocked.
  }
  const ground = getComputedStyle(root).getPropertyValue('--theme-ground').trim();
  if (ground) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = ground;
  }
}

function changeTheme(next: ThemeName) {
  if (readTheme() === next) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof document.startViewTransition !== 'function') {
    applyTheme(next);
    return;
  }

  runPeelTransition(() => {
    applyTheme(next);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'yellow' as ThemeName);
  const setTheme = useCallback((next: ThemeName) => changeTheme(next), []);
  const toggle = useCallback(() => changeTheme(readTheme() === 'green' ? 'yellow' : 'green'), []);
  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}