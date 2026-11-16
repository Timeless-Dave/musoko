'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { Logo } from '@/design-system/brand/Logo';
import { ThemeToggle } from '@/design-system/theme';
import { NAV } from '../nav';

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul>
      {NAV.map((item) => (
        <li key={item.href}>
          <Link href={item.href} aria-current={pathname?.startsWith(item.href) ? 'page' : undefined}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Reads the path, so it renders inside Suspense and the rest of the header can be prerendered. */
function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  // A hairline appears under the header only once the page has scrolled.
  useEffect(() => {
    const sentinel = document.querySelector('[data-scroll-sentinel]');
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header" data-tone="ground" data-scrolled={scrolled || undefined}>
      <div className="container site-header__bar">
        <Link href="/" className="site-header__brand" aria-label={`${copy.brand.name}, home`}>
          <Logo size={32} className="site-header__mark" />
          <span className="site-header__name">{copy.brand.name}</span>
        </Link>
        <nav className="site-nav" aria-label={copy.nav.label}>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <CurrentNavLinks />
          </Suspense>
        </nav>
      </div>
      <ThemeToggle labels={copy.theme} />
    </header>
  );
}
