'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import {
  CalendarBlank,
  ChatsCircle,
  ChartBar,
  ListBullets,
  Shield,
  UserCircle,
} from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { isNavActive, NavIcon, SIDEBAR } from '@/features/shell';
import { useOwnInquiries } from './hooks';

const WORK = [
  { href: '/dashboard', label: copy.dashboard.nav.today, icon: CalendarBlank },
  { href: '/dashboard/listings', label: copy.dashboard.nav.listings, icon: ListBullets },
  { href: '/dashboard/inquiries', label: copy.dashboard.nav.inquiries, icon: ChatsCircle },
  { href: '/dashboard/profile', label: copy.dashboard.nav.profile, icon: UserCircle },
  { href: '/dashboard/privacy', label: copy.dashboard.nav.privacy, icon: Shield },
  { href: '/dashboard/numbers', label: copy.dashboard.nav.numbers, icon: ChartBar },
] as const;

function current(pathname: string | null, href: string) {
  return href === '/dashboard' ? pathname === '/dashboard' : Boolean(pathname?.startsWith(href));
}

function WorkLinks({ pathname, waiting }: { pathname: string | null; waiting: number }) {
  return (
  <div className="side-nav__group">
    <p className="side-nav__heading">{copy.dashboard.nav.label}</p>
    <ul>
      {WORK.map((item) => {
        const Icon = item.icon;
        const active = current(pathname, item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} className="side-nav__link" aria-current={active ? 'page' : undefined}>
              <Icon size={22} weight="regular" aria-hidden="true" />
              <span>{item.label}</span>
              {item.href === '/dashboard/inquiries' && waiting > 0 ? (
                <>
                  <span className="side-nav__badge" aria-hidden="true">
                    {waiting}
                  </span>
                  <span className="visually-hidden">({waiting})</span>
                </>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  </div>
  );
}

function BrowseLinks({ pathname }: { pathname: string | null }) {
  const browse = SIDEBAR[0];
  if (!browse) return null;
  return (
    <div className="side-nav__group">
      <p className="side-nav__heading">{copy.shell.publicSite}</p>
      <ul>
        {browse.items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} className="side-nav__link" aria-current={active ? 'page' : undefined}>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MobileWorkLinks({ pathname, waiting }: { pathname: string | null; waiting: number }) {
  return (
    <nav className="dash-nav dash-nav--mobile" aria-label={copy.dashboard.nav.label}>
      <ul>
        {WORK.map((link) => {
          const active = current(pathname, link.href);
          return (
            <li key={link.href}>
              <Link href={link.href} aria-current={active ? 'page' : undefined}>
                {link.label}
                {link.href === '/dashboard/inquiries' && waiting > 0 ? ` (${waiting})` : ''}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarBody({ pathname }: { pathname: string | null }) {
  const { data: inquiries } = useOwnInquiries();
  const waiting = (inquiries ?? []).filter((r) => r.inquiry.status === 'awaiting_response').length;
  return (
    <>
      <WorkLinks pathname={pathname} waiting={waiting} />
      <BrowseLinks pathname={pathname} />
    </>
  );
}

function AsideCurrent() {
  const pathname = usePathname();
  return <SidebarBody pathname={pathname} />;
}

/** Fixed sidebar from 1024px with dashboard links and shortcuts back to the public site. */
export function DashboardAside() {
  return (
    <aside className="app-sidebar role-sidebar">
      <nav className="side-nav" aria-label={copy.dashboard.nav.label}>
        <Suspense fallback={<WorkLinks pathname={null} waiting={0} />}>
          <AsideCurrent />
        </Suspense>
      </nav>
    </aside>
  );
}

function MobileNavCurrent() {
  const pathname = usePathname();
  const { data: inquiries } = useOwnInquiries();
  const waiting = (inquiries ?? []).filter((r) => r.inquiry.status === 'awaiting_response').length;
  return <MobileWorkLinks pathname={pathname} waiting={waiting} />;
}

/** Horizontal dashboard links above the page on phones. */
export function DashboardMobileNav() {
  return (
    <Suspense fallback={null}>
      <MobileNavCurrent />
    </Suspense>
  );
}

/** @deprecated Use DashboardAside and DashboardMobileNav in the route layout. */
export function DashboardSidebar() {
  return <DashboardAside />;
}