'use client';

import Link from 'next/link';
import type { Ref } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react/ssr';
import { copy } from '@/content/copy';
import { MetaLine } from '@/design-system/primitives';
import { scheduleDays, scheduleLines } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import type { FarmPlace, MarketPlace, PickupPlace, Place } from '../places';

function FarmBlock({ place, showName }: { place: FarmPlace; showName: boolean }) {
  return (
    <div className="place-preview__block">
      <MetaLine>
        <span>{copy.map.kinds.farm}</span>
        <span>{place.town}</span>
        {place.isDemo ? <DemoMark /> : null}
      </MetaLine>
      <p className="place-preview__name">
        <Link href={`/farmers/${place.slug}`}>{showName ? place.name : copy.map.openProfile}</Link>
      </p>
      <p>{place.precision === 'exact' ? copy.map.farmExact : copy.map.farmGeneral(place.town)}</p>
    </div>
  );
}

function MarketBlock({ place }: { place: MarketPlace }) {
  const { market } = place;
  return (
    <div className="place-preview__block">
      <MetaLine>
        <span>{copy.map.kinds.market}</span>
        <span>{place.town}</span>
        {place.isDemo ? <DemoMark /> : null}
      </MetaLine>
      <p className="place-preview__when">{scheduleLines(market.schedule).join(', ')}</p>
      <p>
        {market.venue} · {market.seasonNote}
      </p>
      <p>
        <strong>{copy.map.sellsHere}: </strong>
        {market.farms.length
          ? market.farms.map((farm, i) => (
              <span key={farm.id}>
                {i > 0 ? ', ' : ''}
                <Link href={`/farmers/${farm.slug}`}>{farm.farmName}</Link>
              </span>
            ))
          : copy.markets.noFarmers}
      </p>
      <p className="place-preview__links">
        <Link href={`/farmers-markets#${market.slug}`}>{copy.map.openMarketPage}</Link>
        <a href={market.directionsUrl} target="_blank" rel="noreferrer">
          {copy.map.directions}
          <ArrowSquareOut size={16} weight="bold" aria-hidden="true" /> <span className="visually-hidden">{copy.map.opensNewTab}</span>
        </a>
      </p>
    </div>
  );
}

function PickupBlock({ place }: { place: PickupPlace }) {
  return (
    <div className="place-preview__block">
      <MetaLine>
        <span>{copy.map.kinds.pickup}</span>
        <span>{place.town}</span>
        {place.isDemo ? <DemoMark /> : null}
      </MetaLine>
      <p>{place.description}</p>
      {place.farms.length ? (
        <>
          <p>
            <strong>{copy.map.usedBy}</strong>
          </p>
          <ul className="place-preview__farms">
            {place.farms.map((farm) => (
              <li key={farm.id}>
                <Link href={`/farmers/${farm.slug}`}>{farm.farmName}</Link>
                {farm.schedule.length ? ` · ${copy.map.pickupWhen(scheduleDays(farm.schedule))}` : ''}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p>{copy.map.arrangePickup}</p>
    </div>
  );
}

function Block({ place, several }: { place: Place; several: boolean }) {
  if (place.kind === 'farm') return <FarmBlock place={place} showName={several} />;
  if (place.kind === 'market') return <MarketBlock place={place} />;
  return <PickupBlock place={place} />;
}

/**
 * What a place has to say: where and when, who is there, how to get there. Used
 * by the map pin and by the list row, so the two views never disagree. It shows
 * only what the public projection carries.
 */
export function PlacePreview({
  places,
  heading,
  headingRef,
}: {
  places: Place[];
  /** Pass null to leave the heading out, when the list row already shows the name. */
  heading: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const several = places.length > 1;
  return (
    <div className="place-preview">
      {heading ? (
        <h3 className="place-preview__title" tabIndex={-1} ref={headingRef}>
          {heading}
        </h3>
      ) : null}
      {places.map((place) => (
        <div key={place.key} className="place-preview__item">
          {several && place.kind !== 'farm' ? <p className="place-preview__name">{place.name}</p> : null}
          <Block place={place} several={several} />
        </div>
      ))}
    </div>
  );
}
