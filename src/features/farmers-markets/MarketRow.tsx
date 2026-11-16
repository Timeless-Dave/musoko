'use client';

import Link from 'next/link';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { PhotoFrame } from '@/design-system/patterns';
import { MetaLine } from '@/design-system/primitives';
import type { PublicMarket } from '@/domain/types';
import { scheduleLines } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';

/** General market photographs. They illustrate a market, not this market. */
const MARKET_PHOTOS = [
  { src: '/images/markets/crates-of-greens.jpg', alt: 'Crates of cabbages, herbs, aubergines and cucumbers at a market.' },
  { src: '/images/markets/produce-close.jpg', alt: 'Radishes, limes and other produce piled on a market stall.' },
  { src: '/images/markets/vegetable-crates.jpg', alt: 'Green crates of peppers, leeks, cauliflower and tomatoes at a market.' },
  { src: '/images/markets/fruit-stall.jpg', alt: 'A market stall of fruit in tubs, with watermelons at the front.' },
  { src: '/images/markets/roots-on-stall.jpg', alt: 'Root vegetables and corn on a covered market stall.' },
];

export function MarketRow({
  market,
  index,
  compact,
  offered,
}: {
  market: PublicMarket;
  index: number;
  compact?: boolean;
  /** Product type names the participating farms list most often. */
  offered?: string[];
}) {
  const photo = MARKET_PHOTOS[index % MARKET_PHOTOS.length];
  return (
    <article className="market-row" id={market.slug}>
      <PhotoFrame
        ratio="4:3"
        src={photo.src}
        alt={compact ? '' : photo.alt}
        sizes="(min-width: 48rem) 16rem, 100vw"
        blurDataURL={blurFor(photo.src)}
        className="market-row__photo"
      />
      <div className="market-row__body">
        <h3 className="market-row__name">
          {compact ? <Link href={`/farmers-markets#${market.slug}`}>{market.name}</Link> : market.name}
        </h3>
        <p className="market-row__when">{scheduleLines(market.schedule).join(', ')}</p>
        <p>
          {market.venue}
          {compact ? null : ` · ${market.seasonNote}`}
        </p>
        {compact ? null : (
          <>
            <p>
              <strong>{copy.markets.farmers}: </strong>
              {market.farms.length
                ? market.farms.map((farm, i) => (
                    <span key={farm.id}>
                      {i > 0 ? ', ' : ''}
                      <Link href={`/farmers/${farm.slug}`}>{farm.farmName}</Link>
                    </span>
                  ))
                : copy.markets.noFarmers}
            </p>
            {offered?.length ? (
              <p>
                <strong>{copy.markets.products}: </strong>
                {offered.join(', ')}
              </p>
            ) : null}
            <p className="market-row__contact">
              <a href={market.directionsUrl} target="_blank" rel="noreferrer">
                {copy.markets.directions}
              </a>
              {market.contactPhone ? <a href={`tel:${market.contactPhone}`}>{market.contactPhone}</a> : null}
              {market.contactEmail ? <a href={`mailto:${market.contactEmail}`}>{market.contactEmail}</a> : null}
            </p>
          </>
        )}
        <MetaLine>
          <span>{market.town}</span>
          {market.isDemo ? <DemoMark /> : null}
        </MetaLine>
      </div>
    </article>
  );
}
