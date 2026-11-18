'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
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
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
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

/** Fixed beside the content from 1024px. Below that the same links live in the menu drawer. */
export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <SidebarNav />
    </aside>
  );
}
