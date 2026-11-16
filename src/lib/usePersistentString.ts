'use client';

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A small per-visitor preference kept in the browser, such as the chosen town.
 * Not for application data: that goes through the data ports.
 */
export function usePersistentString(key: string, fallback: string): [string, (value: string) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const set = listeners.get(key) ?? new Set();
      listeners.set(key, set);
      set.add(onChange);
      window.addEventListener('storage', onChange);
      return () => {
        set.delete(onChange);
        window.removeEventListener('storage', onChange);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage can be blocked. The choice then lasts for this page only.
      }
      listeners.get(key)?.forEach((listener) => listener());
    },
    [key],
  );
  return [value, set];
}
