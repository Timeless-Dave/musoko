'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react/ssr';
import { copy } from '@/content/copy';
import { Sprout } from '@/design-system/brand/Sprout';
import type { Pin, PlaceKind } from '../places';
import { PinGlyph } from './PinGlyph';
import { PlacePreview } from './PlacePreview';

// MapLibre and its tiles are fetched only when this component first renders,
// which happens only once the visitor has opened the map.
const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="map-canvas">
      <p className="map-canvas__note" role="status">
        <Sprout size={20} animate /> {copy.map.mapLoading}
      </p>
    </div>
  ),
});

const LEGEND: PlaceKind[] = ['farm', 'market', 'pickup'];

export function MapPanel({
  pins,
  selected,
  onSelect,
}: {
  pins: Pin[];
  selected: Pin | null;
  onSelect: (key: string | null) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const lastKey = useRef<string | null>(null);

  // Move focus into the preview when a pin opens it, and back to the pin when it closes.
  useEffect(() => {
    if (selected) {
      lastKey.current = selected.key;
      heading.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  const close = () => {
    const key = lastKey.current;
    onSelect(null);
    if (key) {
      requestAnimationFrame(() => {
        stage.current?.querySelector<HTMLElement>(`[data-pin-key="${CSS.escape(key)}"]`)?.focus();
      });
    }
  };

  const first = selected?.places[0];
  const title = !selected || !first
    ? ''
    : selected.kind === 'farm' && selected.places.length > 1
      ? copy.map.farmsNear(selected.places.length, first.town)
      : selected.places.length > 1
        ? `${copy.map.kindsPlural[selected.kind]} in ${first.town}`
        : first.name;

  return (
    <div className="map-panel">
      <div
        ref={stage}
        className="map-panel__stage"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && selected) {
            event.stopPropagation();
            close();
          }
        }}
      >
        <MapCanvas pins={pins} selectedKey={selected?.key ?? null} onSelect={onSelect} />
        {selected ? (
          <section className="map-preview" aria-label={copy.map.previewFor(title)}>
            <button type="button" className="icon-button map-preview__close" aria-label={copy.map.closePreview} onClick={close}>
              <X size={24} weight="bold" aria-hidden="true" />
            </button>
            <PlacePreview places={selected.places} heading={title} headingRef={heading} />
          </section>
        ) : null}
      </div>
      <div className="map-panel__foot">
        <p>{copy.map.mapHint}</p>
        <ul className="map-legend" aria-label={copy.map.legend}>
          {LEGEND.map((kind) => (
            <li key={kind} className="map-legend__item">
              <span className={`map-pin map-pin--${kind} map-pin--static`} aria-hidden="true">
                <PinGlyph kind={kind} size={16} />
              </span>
              {copy.map.kindsPlural[kind]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
