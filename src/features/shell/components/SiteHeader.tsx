'use client';

import Link from 'next/link';
import { BrandWordmark } from '@/design-system/brand/BrandWordmark';
import { ThemeToggle } from '@/design-system/theme';
import { TownPicker } from '@/features/catalogue';
import { GetToggle } from './GetToggle';
import { GlobalSearch } from './GlobalSearch';
import { MenuDrawer } from './MenuDrawer';

/**
 * The top bar, on every page: menu (below 1024px), brand, search, town,
 * pickup or farm delivery, theme. No cart, no account bell: Musoko does not sell.
 */
export function SiteHeader() {
  return (
    <header className="site-header" data-tone="ground">
      <div className="site-header__bar">
        <div className="site-header__menu-slot">
          <MenuDrawer />
        </div>
        <Link href="/" className="site-header__brand">
          <BrandWordmark logoSize={32} markClassName="site-header__mark" suffixClassName="site-header__name" />
        </Link>
        <div className="site-header__search">
          <GlobalSearch />
        </div>
        <div className="site-header__actions">
          <TownPicker />
          <div className="site-header__get">
            <GetToggle />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
