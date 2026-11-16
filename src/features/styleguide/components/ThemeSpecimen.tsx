'use client';

import { copy } from '@/content/copy';
import { ThemeToggle, useTheme } from '@/design-system/theme';
import { Specimen } from './Spread';

const FOLDS = [
  ['Rest', '30px'],
  ['Hover', '40px'],
  ['Pressed', '48px'],
] as const;

export function ThemeSpecimen() {
  const { theme } = useTheme();
  return (
    <>
      <div className="specimen">
        <h3 className="specimen__name">The corner</h3>
        <div className="theme-bar" data-tone="ground">
          <ThemeToggle labels={copy.theme} />
        </div>
        <p className="theme-note">Switch the page theme with the corner at the top right. The page turns from that corner.</p>
        <p className="theme-note theme-note--strong" role="status">
          The page is currently {theme}.
        </p>
      </div>
      <Specimen name="Fold states, frozen at real size">
        <ul className="fold-list">
          {FOLDS.map(([name, fold]) => (
            <li key={name} className="fold-list__item">
              <span className="fold-specimen" style={{ ['--fold' as string]: fold }}>
                <span className="theme-toggle__under" aria-hidden="true" />
                <span className="theme-toggle__flap" aria-hidden="true" />
              </span>
              <span className="meta">
                {name} · {fold}
              </span>
            </li>
          ))}
        </ul>
      </Specimen>
    </>
  );
}
