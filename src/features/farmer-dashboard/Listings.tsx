'use client';

import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button } from '@/design-system/primitives';
import { ListingRow } from './ListingRow';
import { useNow, useOwnListings, useSettings } from './hooks';

/** All the farmer's listings, those that need a tap first. */
export function ListingList({ limit }: { limit?: number }) {
  const { data: listings, isPending } = useOwnListings();
  const { data: settings } = useSettings();
  const now = useNow();

  if (isPending || !settings) return <p role="status">{copy.common.loading}</p>;
  if (!listings || listings.length === 0) {
    return (
      <EmptyState
        sentence={copy.dashboard.today.listingsNone}
        action={<Button href="/dashboard/listings/new">{copy.dashboard.today.add}</Button>}
      />
    );
  }
  const shown = limit ? listings.slice(0, limit) : listings;
  return (
    <ul className="listing-list">
      {shown.map((listing) => (
        <ListingRow key={listing.product.id} listing={listing} now={now} settings={settings} />
      ))}
    </ul>
  );
}

export function ListingsPage() {
  return (
    <section className="dash-section" aria-labelledby="listings-title">
      <div className="dash-section__head">
        <h2 id="listings-title" className="dash-title">
          {copy.dashboard.today.listings}
        </h2>
        <Button href="/dashboard/listings/new">{copy.dashboard.today.add}</Button>
      </div>
      <p className="dash-lead">{copy.dashboard.today.listingsLead}</p>
      <ListingList />
    </section>
  );
}
