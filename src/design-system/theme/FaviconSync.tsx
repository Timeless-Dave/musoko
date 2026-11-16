'use client';

import { useEffect } from 'react';
import { useTheme } from './ThemeProvider';

/** Keeps the tab icon in step with yellow vs green theme. */
export function FaviconSync() {
  const { theme } = useTheme();
  useEffect(() => {
    const href = theme === 'green' ? '/brand/favicon-green.svg' : '/brand/favicon-yellow.svg';
    let link = document.querySelector<HTMLLinkElement>('link[data-musoko-icon]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.dataset.musokoIcon = '';
      document.head.appendChild(link);
    }
    if (link.href !== new URL(href, window.location.origin).href) link.href = href;
  }, [theme]);
  return null;
}