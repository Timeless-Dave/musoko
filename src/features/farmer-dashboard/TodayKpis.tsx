'use client';

import { ChatsCircle, Eye, HandPointing, ListChecks } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { KpiStrip, KpiTile } from '@/design-system/patterns';
import { useFarmerNumbers } from './hooks';

const words = copy.dashboard.today.kpis;

/** At-a-glance counts before the task lists — inquiries, listings and anonymous views. */
export function TodayKpis() {
  const { data: n, isPending } = useFarmerNumbers();
  if (isPending || !n) return null;

  return (
    <section className="dash-section" aria-labelledby="today-kpis">
      <h2 id="today-kpis" className="visually-hidden">
        {words.title}
      </h2>
      <KpiStrip aria-label={words.title}>
        <KpiTile
          value={n.inquiries.awaiting}
          label={words.waiting}
          href="/dashboard/inquiries"
          icon={<ChatsCircle weight="duotone" />}
          emphasis={n.inquiries.awaiting > 0}
        />
        <KpiTile
          value={n.listings.availableNow}
          label={words.listingsNow}
          note={words.listingsOf(n.listings.availableNow, n.listings.total)}
          href="/dashboard/listings"
          icon={<ListChecks weight="duotone" />}
        />
        <KpiTile
          value={n.views.listingCards}
          label={words.listingViews}
          note={words.window(n.windowDays)}
          href="/dashboard/numbers"
          icon={<Eye weight="duotone" />}
        />
        <KpiTile
          value={n.views.contactClicks}
          label={words.contactClicks}
          note={words.window(n.windowDays)}
          href="/dashboard/numbers"
          icon={<HandPointing weight="duotone" />}
        />
      </KpiStrip>
    </section>
  );
}