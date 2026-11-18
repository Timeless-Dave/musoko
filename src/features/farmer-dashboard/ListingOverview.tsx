'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { MetaLine } from '@/design-system/primitives';
import type { OwnListing } from '@/domain/farmer';
import { formatListingPrice } from '@/lib/format';
import { DailyCharts } from './DailyCharts';
import { useFarmerNumbers } from './hooks';

const words = copy.dashboard.today.listing;
const stats = copy.dashboard.today.stats;

/** The top of one listing's page: its photo, what buyers see, and how it is doing. */
export function ListingOverview({ listing }: { listing: OwnListing }) {
  const { data: n } = useFarmerNumbers();
  const { product } = listing;
  const figures = n?.byListing[product.id];
  return (
    <div className="listing-overview">
      {product.photo ? (
        <PhotoFrame
          ratio="4:3"
          src={product.photo.src}
          alt={product.photo.alt}
          sizes="(min-width: 64rem) 28rem, 100vw"
          blurDataURL={blurFor(product.photo.src)}
          className="listing-overview__photo"
        />
      ) : (
        <p className="dash-calm listing-overview__photo">{words.noPhoto}</p>
      )}
      <div className="listing-overview__text">
        <h2 className="dash-title">{product.title}</h2>
        <MetaLine>
          <span>{formatListingPrice(product.priceCents, product.sellingUnit, product.unitSize)}</span>
          <span>{copy.availability[listing.status]}</span>
        </MetaLine>
        {n && figures ? (
          <section className="stats-panel" aria-labelledby="listing-stats">
            <h3 id="listing-stats" className="stats-panel__period">
              <strong>{words.title}</strong> {stats.window(n.windowDays)}
            </h3>
            <dl className="stats-panel__row">
              {[
                { label: words.views, value: figures.views },
                { label: words.contactTaps, value: figures.contactTaps },
                { label: words.inquiries, value: figures.inquiriesRecent },
                { label: words.waiting, value: figures.awaiting },
              ].map((f) => (
                <div key={f.label} className="stats-panel__figure">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            <DailyCharts daily={figures.daily} />
            <p className="dash-note">
              {words.allTime(figures.inquiriesTotal)} · {words.sales(figures.salesReported)} ·{' '}
              <Link href="/dashboard/inquiries" className="dash-link">
                {words.seeInquiries}
              </Link>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
