'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRowScroller } from '../useRowScroller';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { copy } from '@/content/copy';

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
      {/* Overlaid on the row's ends, over a fade, so they never take width from the chips. */}
      <div className="chip-rail__edge chip-rail__edge--back" data-shown={back || undefined}>
        <button type="button" className="scroll-button" aria-label={copy.shell.scrollBack} onClick={() => step(-1)} tabIndex={back ? 0 : -1}>
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="chip-rail__edge chip-rail__edge--forward" data-shown={forward || undefined}>
        <button type="button" className="scroll-button" aria-label={copy.shell.scrollForward} onClick={() => step(1)} tabIndex={forward ? 0 : -1}>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
