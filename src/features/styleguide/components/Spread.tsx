import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * An open book: the yellow page and the green page, touching at a spine. The
 * same specimen is drawn on both, so the two themes read as two sides of one sheet.
 */
export function Spread({ children, full }: { children: ReactNode; full?: boolean }) {
  return (
    <div className={cn('spread', full && 'spread--full')}>
      <div className="spread__page" data-theme="yellow" data-tone="ground">
        <p className="spread__name">Yellow</p>
        {children}
      </div>
      <div className="spread__page" data-theme="green" data-tone="ground">
        <p className="spread__name">Green</p>
        {children}
      </div>
    </div>
  );
}

/** A named group of specimens: the component's name, then its spread. */
export function Specimen({ name, children, full }: { name: string; children: ReactNode; full?: boolean }) {
  return (
    <div className="specimen">
      <h3 className="specimen__name">{name}</h3>
      <Spread full={full}>{children}</Spread>
    </div>
  );
}
