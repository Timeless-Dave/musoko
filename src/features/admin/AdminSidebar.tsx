'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import {
  ChartLineUp,
  ChatsCircle,
  Database,
  Prohibit,
  SealCheck,
  SquaresFour,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { claimsToCheck } from '@/domain/claims';
import { registrationQueue } from '@/domain/admin';
import { isNavActive, NavIcon, SIDEBAR } from '@/features/shell';
import { useAdminClaims, useAdminFarms, useAdminInquiries } from './hooks';

const WORK = [
  { href: '/admin', label: copy.admin.nav.overview, icon: SquaresFour },
  { href: '/admin/registrations', label: copy.admin.nav.registrations, icon: UserPlus, countKey: 'registrations' as const },
  { href: '/admin/farms', label: copy.admin.nav.farms, icon: UsersThree },
  { href: '/admin/inquiries', label: copy.admin.nav.inquiries, icon: ChatsCircle, countKey: 'inquiries' as const },
  { href: '/admin/claims', label: copy.admin.nav.claims, icon: SealCheck, countKey: 'claims' as const },
  { href: '/admin/moderation', label: copy.admin.nav.moderation, icon: Prohibit },
  { href: '/admin/metrics', label: copy.admin.nav.metrics, icon: ChartLineUp },
  { href: '/admin/data', label: copy.admin.nav.data, icon: Database },
] as const;

function current(pathname: string | null, href: string) {
  return href === '/admin' ? pathname === '/admin' : Boolean(pathname?.startsWith(href));
}

function useAdminCounts() {
  const { data: farms } = useAdminFarms();
  const { data: inquiries } = useAdminInquiries();
  const { data: claims } = useAdminClaims();
  return {
    registrations: farms ? registrationQueue(farms).length : 0,
    inquiries: (inquiries ?? []).filter((r) => r.inquiry.status === 'awaiting_response').length,
    claims: claims ? claimsToCheck(claims.map((r) => r.claim)).length : 0,
  };
}

function WorkLinks({
  pathname,
  counts,
}: {
  pathname: string | null;
  counts: ReturnType<typeof useAdminCounts>;
}) {
  return (
    <div className="side-nav__group">
      <p className="side-nav__heading">{copy.admin.nav.label}</p>
      <ul>
        {WORK.map((item) => {
          const Icon = item.icon;
          const active = current(pathname, item.href);
          const count = 'countKey' in item && item.countKey ? counts[item.countKey] : 0;
          return (
            <li key={item.href}>
              <Link href={item.href} className="side-nav__link" aria-current={active ? 'page' : undefined}>
                <Icon size={22} weight="regular" aria-hidden="true" />
                <span>{item.label}</span>
                {count > 0 ? (
                  <span className="side-nav__badge" aria-label={`${count} items need attention`}>
                    {count}
                  </span>
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

function MobileWorkLinks({
  pathname,
  counts,
}: {
  pathname: string | null;
  counts: ReturnType<typeof useAdminCounts>;
}) {
  return (
    <nav className="admin-nav admin-nav--mobile" aria-label={copy.admin.nav.label}>
      <ul>
        {WORK.map((link) => {
          const active = current(pathname, link.href);
          const count = 'countKey' in link && link.countKey ? counts[link.countKey] : 0;
          return (
            <li key={link.href}>
              <Link href={link.href} aria-current={active ? 'page' : undefined}>
                {link.label}
                {count > 0 ? ` (${count})` : ''}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarBody({ pathname }: { pathname: string | null }) {
  const counts = useAdminCounts();
  return (
    <>
      <WorkLinks pathname={pathname} counts={counts} />
      <BrowseLinks pathname={pathname} />
    </>
  );
}

function AsideCurrent() {
  const pathname = usePathname();
  return <SidebarBody pathname={pathname} />;
}

/** Fixed sidebar from 1024px with admin links and shortcuts back to the public site. */
export function AdminAside() {
  return (
    <aside className="app-sidebar role-sidebar">
      <nav className="side-nav" aria-label={copy.admin.nav.label}>
        <Suspense fallback={<WorkLinks pathname={null} counts={{ registrations: 0, inquiries: 0, claims: 0 }} />}>
          <AsideCurrent />
        </Suspense>
      </nav>
    </aside>
  );
}

function MobileNavCurrent() {
  const pathname = usePathname();
  const counts = useAdminCounts();
  return <MobileWorkLinks pathname={pathname} counts={counts} />;
}

/** Horizontal admin links above the page on phones. */
export function AdminMobileNav() {
  return (
    <Suspense fallback={null}>
      <MobileNavCurrent />
    </Suspense>
  );
}

/** @deprecated Use AdminAside and AdminMobileNav in the route layout. */
export function AdminSidebar() {
  return <AdminAside />;
}