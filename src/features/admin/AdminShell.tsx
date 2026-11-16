'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { services } from '@/data';
import { EmptyState } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';
import { claimsToCheck } from '@/domain/claims';
import { registrationQueue } from '@/domain/admin';
import { useSession } from '@/features/auth';
import { useMounted } from '@/lib/useMounted';
import { useAdminClaims, useAdminFarms, useAdminInquiries } from './hooks';

const LINKS = [
  { href: '/admin', label: copy.admin.nav.overview },
  { href: '/admin/registrations', label: copy.admin.nav.registrations },
  { href: '/admin/farms', label: copy.admin.nav.farms },
  { href: '/admin/inquiries', label: copy.admin.nav.inquiries },
  { href: '/admin/claims', label: copy.admin.nav.claims },
  { href: '/admin/moderation', label: copy.admin.nav.moderation },
  { href: '/admin/metrics', label: copy.admin.nav.metrics },
  { href: '/admin/data', label: copy.admin.nav.data },
] as const;

/**
 * Wraps every administrator page. Only a signed-in administrator gets past it;
 * anyone else is told what this area is for and, in the demo, how to look around.
 * The gateway checks the role again on every call: this is the courtesy, not the lock.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const { data: session, isPending } = useSession();

  if (!mounted || isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.admin.loading}</p>
      </Section>
    );
  }
  if (!session || session.role !== 'administrator') {
    return (
      <Section pad="tight" aria-labelledby="admin-guard">
        <EmptyState
          sentence={copy.admin.notAdminTitle}
          action={
            <div className="admin-stack">
              <p id="admin-guard" className="admin-note">
                {copy.admin.notAdminBody}
              </p>
              {services.mode === 'demo' ? <p className="admin-note">{copy.admin.notAdminDemo}</p> : null}
            </div>
          }
        />
      </Section>
    );
  }
  return <Frame>{children}</Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: farms } = useAdminFarms();
  const { data: inquiries } = useAdminInquiries();
  const { data: claims } = useAdminClaims();
  const counts: Record<string, number> = {
    '/admin/registrations': farms ? registrationQueue(farms).length : 0,
    '/admin/inquiries': (inquiries ?? []).filter((r) => r.inquiry.status === 'awaiting_response').length,
    '/admin/claims': claims ? claimsToCheck(claims.map((r) => r.claim)).length : 0,
  };

  return (
    <>
      <Section pad="none">
        <div className="admin-head">
          <h1 className="admin-head__name">{copy.admin.title}</h1>
        </div>
      </Section>
      <Section pad="none">
        <nav className="admin-nav" aria-label={copy.admin.nav.label}>
          <ul>
            {LINKS.map((link) => {
              const current = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
              const count = counts[link.href] ?? 0;
              return (
                <li key={link.href}>
                  <Link href={link.href} aria-current={current ? 'page' : undefined}>
                    {link.label}
                    {count > 0 ? ` (${count})` : ''}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Section>
      <Section pad="none">
        <div className="admin-body">{children}</div>
      </Section>
    </>
  );
}
