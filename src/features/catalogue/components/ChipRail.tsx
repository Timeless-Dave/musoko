'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRowScroller } from '../useRowScroller';
import { ScrollButtons } from './ScrollButtons';

export interface Chip {
  key: string;
  label: string;
  href: string;
  image?: string;
  current?: boolean;
}

/**
 * A row of pill chips, each a small photograph and a word: categories, kinds of
 * produce, farms. Swipes on phones; prev and next buttons on wide screens.
 */
export function ChipRail({ label, chips }: { label: string; chips: Chip[] }) {
  const { ref, back, forward, step } = useRowScroller<HTMLUListElement>();
  return (
    <nav className="chip-rail" aria-label={label}>
      <ul ref={ref} className="chip-rail__row">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className="chip"
              aria-current={chip.current ? 'true' : undefined}
              scroll={false}
            >
              {chip.image ? (
                <span className="chip__photo">
                  <Image src={chip.image} alt="" fill sizes="32px" style={{ objectFit: 'cover' }} />
                </span>
              ) : null}
              <span>{chip.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="chip-rail__buttons">
        <ScrollButtons back={back} forward={forward} onStep={step} />
      </div>
    </nav>
  );
}
