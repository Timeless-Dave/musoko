'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { PhotoCycle } from '@/design-system/patterns';
import { MetaLine } from '@/design-system/primitives';
import type { PublicFarm } from '@/domain/types';
import { DemoMark } from '@/features/demo';

/**
 * A farm as a marketplace store card: the land, the farm's name, where it is
 * and how far, how much it has now. The person behind it is named, never pictured.
 */
export function FarmCard({
  farm,
  listings,
  availableNow,
  miles,
  sizes = '(min-width: 75rem) 22rem, (min-width: 48rem) 40vw, 80vw',
}: {
  farm: PublicFarm;
  listings?: number;
  availableNow?: number;
  miles?: number | null;
  sizes?: string;
}) {
  const photos = farm.photos.map((p) => p.src);
  const href = `/farmers/${farm.slug}`;
  const place = [farm.location.town, miles != null ? copy.product.away(miles) : null, listings != null ? copy.farms.listings(listings) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className="farm-card">
      <div className="farm-card__media">
        <Link href={href} className="farm-card__photo" tabIndex={-1} aria-hidden="true">
          {photos.length ? (
            <PhotoCycle ratio="16:9" srcs={photos} sizes={sizes} />
          ) : (
            <div className="farm-card__no-photo" />
          )}
        </Link>
        {farm.intro ? <p className="farm-card__intro">{farm.intro}</p> : null}
      </div>
      <h3 className="farm-card__name">
        <Link href={href}>{farm.farmName}</Link>
      </h3>
      <p className="farm-card__place">{place}</p>
      <div className="farm-card__foot">
        {availableNow ? <span className="pill-note">{copy.farms.availableNow(availableNow)}</span> : null}
        <MetaLine>
          <span>{farm.farmerName}</span>
          <span>{copy.claims.listed}</span>
          {farm.isDemo ? <DemoMark /> : null}
        </MetaLine>
      </div>
    </article>
  );
}
