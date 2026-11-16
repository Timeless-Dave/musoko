import type { ReactNode } from 'react';
import { Button } from '@/design-system/primitives';

/**
 * A titled row that scrolls sideways on phones and settles into columns on
 * wide screens. Titles name a place or a season, never a promotion.
 */
export function Shelf({
  id,
  title,
  more,
  columns = 4,
  children,
}: {
  id: string;
  title: string;
  more?: { href: string; label: string };
  columns?: 3 | 4;
  children: ReactNode;
}) {
  return (
    <div className="shelf">
      <div className="shelf__head">
        <h2 id={id} className="shelf__title">
          {title}
        </h2>
        {more ? (
          <Button variant="link" href={more.href} className="shelf__more">
            {more.label}
          </Button>
        ) : null}
      </div>
      <ul className={`shelf__row shelf__row--${columns}`} aria-labelledby={id}>
        {children}
      </ul>
    </div>
  );
}
