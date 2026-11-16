'use client';

import { copy } from '@/content/copy';
import { Button } from '@/design-system/primitives';
import { NeedsYou } from './Inquiries';
import { ListingList } from './Listings';

/** Opens on what needs a tap: inquiries to answer, then the listings to confirm. */
export function Today() {
  return (
    <>
      <NeedsYou />
      <section className="dash-section" aria-labelledby="today-listings">
        <div className="dash-section__head">
          <h2 id="today-listings" className="dash-title">
            {copy.dashboard.today.listings}
          </h2>
          <Button href="/dashboard/listings/new" variant="secondary">
            {copy.dashboard.today.add}
          </Button>
        </div>
        <p className="dash-lead">{copy.dashboard.today.listingsLead}</p>
        <ListingList limit={6} />
        <div>
          <Button variant="link" href="/dashboard/listings">
            {copy.dashboard.today.seeListings}
          </Button>
        </div>
      </section>
    </>
  );
}
