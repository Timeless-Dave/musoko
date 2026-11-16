'use client';

import Image from 'next/image';
import Link from 'next/link';
import { copy } from '@/content/copy';
import type { ProductCategory } from '@/domain/types';
import { CATEGORY_ORDER, CATEGORY_PHOTO } from '../format';

/** A sideways row of categories, each a small photograph with one word under it. */
export function CategoryRail({
  selected,
  hrefFor,
}: {
  selected?: ProductCategory | null;
  hrefFor: (category: ProductCategory | null) => string;
}) {
  return (
    <nav className="category-rail" aria-label={copy.food.category}>
      <ul>
        {CATEGORY_ORDER.map((category) => {
          const current = selected === category;
          return (
            <li key={category}>
              <Link
                href={hrefFor(current ? null : category)}
                className="category-rail__item"
                aria-current={current ? 'true' : undefined}
                scroll={false}
              >
                <span className="category-rail__photo">
                  <Image src={CATEGORY_PHOTO[category]} alt="" fill sizes="5.5rem" style={{ objectFit: 'cover' }} />
                </span>
                <span className="category-rail__label">{copy.categories[category]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
