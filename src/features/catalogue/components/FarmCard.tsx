'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { PhotoCycle } from '@/design-system/patterns';
import { MetaLine } from '@/design-system/primitives';
import type { PublicFarm } from '@/domain/types';
import { DemoMark } from '@/features/demo';

/** The land first, then the farm's name, its town and the person behind it. */
export function FarmCard({
  farm,
  listings,
  miles,
  sizes = '(min-width: 75rem) 26rem, (min-width: 48rem) 50vw, 80vw',
}: {
  farm: PublicFarm;
  listings?: number;
  miles?: number | null;
  sizes?: string;
}) {
  const photos = farm.photos.map((p) => p.src);
  const href = `/farmers/${farm.slug}`;
  return (
    <article className="farm-card">
      <div className="farm-card__media">
        <Link href={href} className="farm-card__photo" tabIndex={-1} aria-hidden="true">
          {photos.length ? (
            <PhotoCycle ratio="3:2" srcs={photos} sizes={sizes} />
          ) : (
            <div className="farm-card__no-photo" />
          )}
        </Link>
        {farm.intro ? <p className="farm-card__intro">{farm.intro}</p> : null}
      </div>
      <h3 className="farm-card__name">
        <Link href={href}>{farm.farmName}</Link>
      </h3>
      <p className="farm-card__place">
        {farm.farmerName} · {farm.location.town}
      </p>
      <MetaLine>
        <span>{copy.claims.listed}</span>
        {listings != null ? <span>{copy.farms.listings(listings)}</span> : null}
        {miles != null ? <span>{copy.product.away(miles)}</span> : null}
        {farm.isDemo ? <DemoMark /> : null}
      </MetaLine>
    </article>
  );
}
