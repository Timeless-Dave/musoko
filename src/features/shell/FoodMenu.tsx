'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { CATEGORY_ORDER, CATEGORY_PHOTO } from '@/features/catalogue';
import { NavIcon } from './NavIcon';
import { isNavActive } from './nav-active';

export function FoodMenu({ pathname }: { pathname: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const current = isNavActive(pathname, '/food');

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  const filtered = CATEGORY_ORDER.filter((c) => copy.categories[c].toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="food-menu" ref={root}>
      <button
        type="button"
        className="food-menu__button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-current={current ? 'page' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon name="basket" />
        {copy.nav.food}
        <CaretDown size={14} weight="bold" aria-hidden="true" />
      </button>
      {open ? (
        <div className="food-menu__panel" role="menu">
          <form
            className="food-menu__search"
            onSubmit={(event) => {
              event.preventDefault();
              go(q.trim() ? `/food?q=${encodeURIComponent(q.trim())}` : '/food');
            }}
          >
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              aria-label={copy.search.label}
              placeholder={copy.search.placeholder}
            />
          </form>
          <ul>
            <li>
              <button type="button" role="menuitem" onClick={() => go('/food')}>
                {copy.food.allCategories}
              </button>
            </li>
            {filtered.map((category) => (
              <li key={category}>
                <button type="button" role="menuitem" onClick={() => go(`/food?category=${category}`)}>
                  <span className="food-menu__thumb">
                    <Image src={CATEGORY_PHOTO[category]} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
                  </span>
                  {copy.categories[category]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}