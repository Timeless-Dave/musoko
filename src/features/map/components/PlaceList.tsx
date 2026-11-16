'use client';

import { useId, useState } from 'react';
import { copy } from '@/content/copy';
import { Button, MetaLine, VisuallyHidden } from '@/design-system/primitives';
import { scheduleLines } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import type { Place, PlaceKind } from '../places';
import { PlacePreview } from './PlacePreview';

const GROUPS: PlaceKind[] = ['market', 'pickup', 'farm'];

function PlaceRow({
  place,
  away,
  onOpen,
}: {
  place: Place;
  away: string | null;
  onOpen: (place: Place) => void;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <li className="place-row">
      <div className="place-row__head">
        <div className="place-row__main">
          <h3 className="place-row__name">{place.name}</h3>
          {place.kind === 'market' ? (
            <p className="place-row__when">{scheduleLines(place.market.schedule).join(', ')}</p>
          ) : null}
          <MetaLine>
            <span>{place.town}</span>
            {away ? <span>{away}</span> : null}
            {place.isDemo ? <DemoMark /> : null}
          </MetaLine>
        </div>
        <Button
          variant="link"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => {
            // Only opening is a preview open. Closing it again is not counted.
            if (!open) onOpen(place);
            setOpen(!open);
          }}
        >
          {open ? copy.map.hideDetails : copy.map.showDetails}
          <VisuallyHidden> {place.name}</VisuallyHidden>
        </Button>
      </div>
      <div id={detailsId} hidden={!open} className="place-row__details">
        {open ? <PlacePreview places={[place]} heading={null} /> : null}
      </div>
    </li>
  );
}

/** The map's equivalent: the same places as text, grouped by kind, nearest first. */
export function PlaceList({
  places,
  awayFor,
  onOpen,
}: {
  places: Place[];
  awayFor: (place: Place) => string | null;
  onOpen: (place: Place) => void;
}) {
  return (
    <div className="place-list">
      {GROUPS.map((kind) => {
        const group = places.filter((p) => p.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} className="place-list__group" aria-labelledby={`places-${kind}`}>
            <h2 id={`places-${kind}`} className="place-list__title">
              {copy.map.kindsPlural[kind]}
            </h2>
            <ul>
              {group.map((place) => (
                <PlaceRow key={place.key} place={place} away={awayFor(place)} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
