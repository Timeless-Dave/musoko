'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { BrandWordmark } from '@/design-system/brand/BrandWordmark';
import { ThemeToggle } from '@/design-system/theme';
import { useCompareStore } from '@/features/compare';
import { isNavActive } from '../nav-active';
import { NAV } from '../nav';
import { NavIcon } from '../NavIcon';
import { FoodMenu } from '../FoodMenu';

function NavLinks({ pathname }: { pathname: string | null }) {
  const compareCount = useCompareStore((s) => s.ids.length);
  return (
    <ul>
      {NAV.map((item) => (
        <li key={item.href}>
          {item.href === '/food' ? (
            <FoodMenu pathname={pathname} />
          ) : (
            <Link href={item.href} aria-current={isNavActive(pathname, item.href) ? 'page' : undefined}>
              <NavIcon name={item.icon} />
              {item.label}
              {item.href === '/compare' && compareCount > 0 ? (
                <span className="site-nav__badge" aria-label={`${compareCount} listings in compare`}>
                  {compareCount}
                </span>
              ) : null}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = document.querySelector('[data-scroll-sentinel]');
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header" data-tone="ground" data-scrolled={scrolled ? '' : undefined}>
      <div className="container site-header__bar">
        <Link href="/" className="site-header__brand" aria-label={`${copy.brand.name}, home`}>
          <BrandWordmark logoSize={32} markClassName="site-header__mark" suffixClassName="site-header__name" />
        </Link>
        <nav className="site-nav" aria-label={copy.nav.label}>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <CurrentNavLinks />
          </Suspense>
        </nav>
        <div className="site-header__actions">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}