'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { Logo } from '@/design-system/brand/Logo';
import { ThemeToggle } from '@/design-system/theme';

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
      </div>
      <ThemeToggle labels={copy.theme} />
    </header>
  );
}
