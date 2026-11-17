'use client';

import Link from 'next/link';
import {
  ChatsCircle,
  Eye,
  HandPointing,
  MagnifyingGlass,
  MapPin,
  SealCheck,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { KpiStrip, KpiTile, StatFigure, StatGrid } from '@/design-system/patterns';
import { awaitingFarmerReview, registrationQueue } from '@/domain/admin';
import { claimsToCheck } from '@/domain/claims';
import {
  useAdminClaims,
  useAdminFarms,
  useAdminInquiries,
  useModerationItems,
  usePilotMetrics,
} from './hooks';

const words = copy.admin.overview;

/** Opens on what needs a person today, then points to the rest. */
export function OverviewPage() {
  const { data: farms } = useAdminFarms();
  const { data: inquiries } = useAdminInquiries();
  const { data: claims } = useAdminClaims();
  const { data: moderation } = useModerationItems();
  const { data: metrics } = usePilotMetrics();
  if (!farms || !inquiries || !claims || !moderation) return <p role="status">{copy.admin.loading}</p>;

  const queue = registrationQueue(farms);
  const pending = queue.filter((r) => r.state === 'pending_review').length;
  const needConsent = queue.filter((r) => r.state === 'needs_consent').length;
  const awaitingFarmer = awaitingFarmerReview(farms).length;
  const waitingInquiries = inquiries.filter((r) => r.inquiry.status === 'awaiting_response').length;
  const openClaims = claimsToCheck(claims.map((r) => r.claim)).length;
  const hidden = moderation.filter((i) => i.status !== 'visible').length;
  const discovery = metrics?.discovery;
  const searches = metrics?.overall.searches;
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
        <KpiStrip aria-label={words.title}>
          <KpiTile
            value={pending}
            label={words.registrations}
            href="/admin/registrations"
            icon={<UserPlus weight="duotone" />}
            emphasis={pending > 0}
          />
          <KpiTile
            value={needConsent}
            label={words.needConsent}
            href="/admin/registrations"
            icon={<UsersThree weight="duotone" />}
            emphasis={needConsent > 0}
          />
          <KpiTile
            value={waitingInquiries}
            label={words.inquiries}
            href="/admin/inquiries"
            icon={<ChatsCircle weight="duotone" />}
            emphasis={waitingInquiries > 0}
          />
          <KpiTile
            value={openClaims}
            label={words.claims}
            href="/admin/claims"
            icon={<SealCheck weight="duotone" />}
            emphasis={openClaims > 0}
          />
        </KpiStrip>
        <StatGrid>
          <StatFigure figure={awaitingFarmer} label={words.awaitingFarmer} />
          <StatFigure figure={hidden} label={words.hidden} />
        </StatGrid>
      </section>
      {discovery ? (
        <section className="admin-section" aria-labelledby="overview-activity">
          <h2 id="overview-activity" className="admin-title">
            {words.activityTitle}
          </h2>
          <p className="admin-lead">{words.activityLead}</p>
          <KpiStrip aria-label={words.activityTitle}>
            <KpiTile
              value={searches?.shown ? searches.value : '—'}
              label={words.searches}
              href="/admin/metrics"
              icon={<MagnifyingGlass weight="duotone" />}
            />
            <KpiTile value={discovery.farmProfiles} label={words.farmProfiles} icon={<UsersThree weight="duotone" />} />
            <KpiTile value={discovery.listingCards} label={words.listingCards} icon={<Eye weight="duotone" />} />
            <KpiTile value={discovery.contactClicks} label={words.contactClicks} icon={<HandPointing weight="duotone" />} />
            <KpiTile value={discovery.placePreviews} label={words.placePreviews} icon={<MapPin weight="duotone" />} />
          </KpiStrip>
        </section>
      ) : null}
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
