'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Basket, Buildings, MagnifyingGlass, Plant } from '@phosphor-icons/react';
import { copy } from '@/content/copy';

const PATHS = [
  { icon: Basket, ...copy.home.paths.household },
  { icon: Plant, ...copy.home.paths.farmer },
  { icon: Buildings, ...copy.home.paths.institution },
] as const;

/** The headline, one big food search, and a clear way in for each kind of user. */
export function HomeHero({ town }: { town: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/food?q=${encodeURIComponent(term)}` : '/food');
  };
  return (
    <div className="hero">
      <div className="hero__text">
        <h1 id="home-title" className="hero__title">
          {copy.home.headline}
        </h1>
        <p className="hero__lead">{town ? copy.home.leadNear(town) : copy.home.lead}</p>
        <form className="hero-search" role="search" onSubmit={submit}>
          <MagnifyingGlass size={22} weight="bold" aria-hidden="true" className="hero-search__icon" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={copy.home.searchLabel}
            placeholder={copy.home.searchPlaceholder}
            maxLength={60}
            enterKeyHint="search"
            autoComplete="off"
          />
          <button type="submit" className="hero-search__go">
            {copy.home.searchGo}
          </button>
        </form>
      </div>
      <ul className="paths" aria-label={copy.home.pathsLabel}>
        {PATHS.map(({ icon: Icon, title, body, href, action }) => (
          <li key={href}>
            <Link href={href} className="path">
              <Icon size={26} aria-hidden="true" className="path__icon" />
              <span className="path__title">{title}</span>
              <span className="path__body">{body}</span>
              <span className="path__action">
                {action} <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
