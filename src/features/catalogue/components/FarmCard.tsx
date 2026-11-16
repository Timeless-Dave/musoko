'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
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
  const photo = farm.photos[0];
  const href = `/farmers/${farm.slug}`;
  return (
    <article className="farm-card">
      <Link href={href} className="farm-card__photo" tabIndex={-1} aria-hidden="true">
        {photo ? (
          <PhotoFrame ratio="3:2" src={photo.src} alt="" sizes={sizes} blurDataURL={blurFor(photo.src)} />
        ) : (
          <div className="farm-card__no-photo" />
        )}
      </Link>
      <h3 className="farm-card__name">
        <Link href={href}>{farm.farmName}</Link>
      </h3>
      <p className="farm-card__place">
        {farm.farmerName} · {farm.location.town}
      </p>
      <p className="farm-card__intro">{farm.intro}</p>
      <MetaLine>
        <span>{copy.claims.listed}</span>
        {listings != null ? <span>{copy.farms.listings(listings)}</span> : null}
        {miles != null ? <span>{copy.product.away(miles)}</span> : null}
        {farm.isDemo ? <DemoMark /> : null}
      </MetaLine>
    </article>
  );
}
