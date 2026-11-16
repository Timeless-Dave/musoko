'use client';

import { useTheme } from './ThemeProvider';

/**
 * The page's own top-right corner, folded down. Under the fold the other
 * theme shows through. Pressing it lifts the corner and peels the page.
 * The labels come from the caller because the design system holds no wording.
 */
export function ThemeToggle({ labels }: { labels: { toGreen: string; toYellow: string } }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'yellow' ? labels.toGreen : labels.toYellow}
      onClick={toggle}
    >
      <span className="theme-toggle__under" aria-hidden="true" />
      <span className="theme-toggle__flap" aria-hidden="true" />
    </button>
  );
}
