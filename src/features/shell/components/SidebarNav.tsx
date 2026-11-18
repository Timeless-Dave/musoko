'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { CaretDoubleLeft, CaretDoubleRight } from '@phosphor-icons/react';
import { usePersistentString } from '@/lib/usePersistentString';
import { copy } from '@/content/copy';
import { useCompareStore } from '@/features/compare';
import { isNavActive } from '../nav-active';
import { NavIcon } from '../NavIcon';
import { SIDEBAR } from '../nav';

function Links({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const compareCount = useCompareStore((s) => s.ids.length);
  return (
    <>
      {SIDEBAR.map((group, g) => (
        <div className="side-nav__group" key={g}>
          {group.label ? <p className="side-nav__heading">{group.label}</p> : null}
          <ul>
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="side-nav__link"
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    title={item.label}
                  >
                    <NavIcon name={item.icon} />
                    <span className="side-nav__label">{item.label}</span>
                    {item.href === '/compare' && compareCount > 0 ? (
                      <span className="side-nav__badge" aria-label={`${compareCount} listings in compare`}>
                        {compareCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function CurrentLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <Links pathname={usePathname()} onNavigate={onNavigate} />;
}

/** The browse navigation. The path is read inside Suspense so the frame can be prerendered. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="side-nav" aria-label={copy.shell.sidebar}>
      <Suspense fallback={<Links pathname={null} onNavigate={onNavigate} />}>
        <CurrentLinks onNavigate={onNavigate} />
      </Suspense>
    </nav>
  );
}

/**
 * Fixed beside the content from 1024px. It folds down to a rail of icons, and
 * the choice is remembered in this browser. Below 1024px the same links live in
 * the menu drawer.
 */
export function AppSidebar() {
  const [state, setState] = usePersistentString('musoko.sidebar', 'open');
  const collapsed = state === 'collapsed';
  return (
    <aside className="app-sidebar" data-collapsed={collapsed || undefined}>
      <button
        type="button"
        className="app-sidebar__toggle"
        aria-expanded={!collapsed}
        aria-label={collapsed ? copy.shell.expandMenu : copy.shell.collapseMenu}
        title={collapsed ? copy.shell.expandMenu : copy.shell.collapseMenu}
        onClick={() => setState(collapsed ? 'open' : 'collapsed')}
      >
        {collapsed ? (
          <CaretDoubleRight size={18} weight="bold" aria-hidden="true" />
        ) : (
          <CaretDoubleLeft size={18} weight="bold" aria-hidden="true" />
        )}
        <span className="side-nav__label">{copy.shell.collapseMenu}</span>
      </button>
      <SidebarNav />
    </aside>
  );
}
