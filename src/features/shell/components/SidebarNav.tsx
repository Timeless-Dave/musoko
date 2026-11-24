'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { SidebarSimple } from '@phosphor-icons/react';
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

const SIDEBAR_KEY = 'musoko.sidebar';

/**
 * Fixed beside the content from 1024px. It folds down to a rail of icons from
 * the toggle beside the logo, and the choice is remembered in this browser.
 * Below 1024px the same links live in the menu drawer.
 */
export function AppSidebar() {
  const [state] = usePersistentString(SIDEBAR_KEY, 'open');
  return (
    <aside className="app-sidebar" data-collapsed={state === 'collapsed' || undefined}>
      <SidebarNav />
    </aside>
  );
}

/** One icon in the top bar, beside the logo, that folds and unfolds the sidebar. */
export function SidebarToggle() {
  const [state, setState] = usePersistentString(SIDEBAR_KEY, 'open');
  const collapsed = state === 'collapsed';
  const label = collapsed ? copy.shell.expandMenu : copy.shell.collapseMenu;
  return (
    <button
      type="button"
      className="icon-button sidebar-toggle"
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      onClick={() => setState(collapsed ? 'open' : 'collapsed')}
    >
      <SidebarSimple size={22} weight="regular" aria-hidden="true" />
    </button>
  );
}
