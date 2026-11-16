'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { StatFigure, StatGrid } from '@/design-system/patterns';
import { awaitingFarmerReview, registrationQueue } from '@/domain/admin';
import { claimsToCheck } from '@/domain/claims';
import { useAdminClaims, useAdminFarms, useAdminInquiries, useModerationItems } from './hooks';

const words = copy.admin.overview;

/** Opens on what needs a person today, then points to the rest. */
export function OverviewPage() {
  const { data: farms } = useAdminFarms();
  const { data: inquiries } = useAdminInquiries();
  const { data: claims } = useAdminClaims();
  const { data: moderation } = useModerationItems();
  if (!farms || !inquiries || !claims || !moderation) return <p role="status">{copy.admin.loading}</p>;

  const queue = registrationQueue(farms);
  const links = [
    { href: '/admin/registrations', label: copy.admin.nav.registrations, text: words.go.registrations },
    { href: '/admin/farms', label: copy.admin.nav.farms, text: words.go.farms },
    { href: '/admin/inquiries', label: copy.admin.nav.inquiries, text: words.go.inquiries },
    { href: '/admin/claims', label: copy.admin.nav.claims, text: words.go.claims },
    { href: '/admin/moderation', label: copy.admin.nav.moderation, text: words.go.moderation },
    { href: '/admin/metrics', label: copy.admin.nav.metrics, text: words.go.metrics },
    { href: '/admin/data', label: copy.admin.nav.data, text: words.go.data },
  ];

  return (
    <>
      <section className="admin-section" aria-labelledby="overview-title">
        <h2 id="overview-title" className="admin-title">
          {words.title}
        </h2>
        <p className="admin-lead">{words.lead}</p>
        <StatGrid>
          <StatFigure figure={queue.filter((r) => r.state === 'pending_review').length} label={words.registrations} />
          <StatFigure figure={queue.filter((r) => r.state === 'needs_consent').length} label={words.needConsent} />
          <StatFigure figure={awaitingFarmerReview(farms).length} label={words.awaitingFarmer} />
          <StatFigure figure={inquiries.filter((r) => r.inquiry.status === 'awaiting_response').length} label={words.inquiries} />
          <StatFigure figure={claimsToCheck(claims.map((r) => r.claim)).length} label={words.claims} />
          <StatFigure figure={moderation.filter((i) => i.status !== 'visible').length} label={words.hidden} />
        </StatGrid>
      </section>
      <section className="admin-section" aria-labelledby="overview-go">
        <h2 id="overview-go" className="admin-title">
          {words.goTitle}
        </h2>
        <ul className="admin-list">
          {links.map((link) => (
            <li key={link.href} className="admin-row">
              <div className="admin-row__main">
                <h3 className="admin-row__title">
                  <Link href={link.href}>{link.label}</Link>
                </h3>
                <p className="admin-note">{link.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
