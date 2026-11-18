'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRowScroller } from '../useRowScroller';
import { ScrollButtons } from './ScrollButtons';

/**
 * A titled row that scrolls sideways, with "See all" and prev and next buttons
 * at its head. Titles name a place or a season, never a promotion.
 */
export function Shelf({
  id,
  title,
  hint,
  more,
  size = 'product',
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  more?: { href: string; label: string };
  size?: 'product' | 'wide';
  children: ReactNode;
}) {
  const { ref, back, forward, step } = useRowScroller<HTMLUListElement>();
  const rowId = `${id}-row`;
  return (
    <div className="shelf">
      <div className="shelf__head">
        <div className="shelf__titles">
          <h2 id={id} className="shelf__title">
            {title}
          </h2>
          {hint ? <p className="shelf__hint">{hint}</p> : null}
        </div>
        <div className="shelf__controls">
          {more ? (
            <Link href={more.href} className="shelf__more">
              {more.label}
            </Link>
          ) : null}
          <ScrollButtons
            className="shelf__controls-scroll"
            back={back}
            forward={forward}
            onStep={step}
            controls={rowId}
          />
        </div>
      </div>
      <div className="shelf__track">
        <ul ref={ref} id={rowId} className={`shelf__row shelf__row--${size}`} aria-labelledby={id}>
          {children}
        </ul>
      </div>
    </div>
  );
}
