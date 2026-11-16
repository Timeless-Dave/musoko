'use client';

import { Leaf, Sun } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { useTheme } from './ThemeProvider';

/** Sliding pill like VerifAI: sun = yellow theme, leaf = green; peel runs on change. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const green = theme === 'green';

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={green}
      aria-label={green ? copy.theme.toYellow : copy.theme.toGreen}
      title={green ? copy.theme.toYellow : copy.theme.toGreen}
      onClick={toggle}
    >
      <Sun size={16} weight="bold" className="theme-toggle__icon theme-toggle__sun" aria-hidden="true" />
      <Leaf size={16} weight="fill" className="theme-toggle__icon theme-toggle__leaf" aria-hidden="true" />
      <span className="theme-toggle__knob" aria-hidden="true" />
    </button>
  );
}