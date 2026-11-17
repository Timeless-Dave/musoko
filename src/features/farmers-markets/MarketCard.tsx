'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { MetaLine } from '@/design-system/primitives';
import type { PublicMarket } from '@/domain/types';
import { scheduleLines } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import { MARKET_PHOTOS } from './MarketRow';

/** A market on a shelf: a stall photograph, its name, when it opens, where. */
export function MarketCard({ market, index, miles }: { market: PublicMarket; index: number; miles?: number | null }) {
  const photo = MARKET_PHOTOS[index % MARKET_PHOTOS.length];
  const href = `/farmers-markets#${market.slug}`;
  return (
    <article className="farm-card">
      <Link href={href} className="farm-card__photo" tabIndex={-1} aria-hidden="true">
        <PhotoFrame
          ratio="16:9"
          src={photo.src}
          alt=""
          sizes="(min-width: 75rem) 22rem, (min-width: 48rem) 40vw, 80vw"
          blurDataURL={blurFor(photo.src)}
        />
      </Link>
      <h3 className="farm-card__name">
        <Link href={href}>{market.name}</Link>
      </h3>
      <p className="farm-card__place">
        {[market.town, miles != null ? copy.product.away(miles) : null].filter(Boolean).join(' · ')}
      </p>
      <div className="farm-card__foot">
        <span className="pill-note">{scheduleLines(market.schedule).join(', ')}</span>
        <MetaLine>
          <span>{copy.markets.farmerCount(market.farms.length)}</span>
          {market.isDemo ? <DemoMark /> : null}
        </MetaLine>
      </div>
    </article>
  );
}
