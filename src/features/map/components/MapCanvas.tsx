'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus } from '@phosphor-icons/react/ssr';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import type { Pin } from '../places';
import { PinGlyph } from './PinGlyph';

// MapLibre finds its worker file next to its own module. Once the app is bundled
// that location no longer exists, so the worker is emitted as a static asset and
// handed over by URL.
let workerReady = false;
function pointToBundledWorker() {
  if (workerReady || typeof window === 'undefined') return;
  setWorkerUrl(new URL('../../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
  workerReady = true;
}

/**
 * Below this zoom a town's farm, market and pickup pins sit within a few pixels
 * of each other, so each kind is nudged sideways, one pin width apart, to stay reachable. At this zoom
 * and above they are drawn at their true points.
 */
const FAN_BELOW_ZOOM = 13;
const FAN_OFFSET: Record<Pin['kind'], [number, number]> = { farm: [0, 0], market: [-46, 0], pickup: [46, 0] };
const fanOffset = (kind: Pin['kind'], zoom: number): [number, number] => (zoom < FAN_BELOW_ZOOM ? FAN_OFFSET[kind] : [0, 0]);

/** A coarse point deserves a wide view. Never zoom in closer than a town. */
const MAX_FIT_ZOOM = 11;

function pinLabel(pin: Pin): string {
  const [first] = pin.places;
  if (pin.kind === 'farm') {
    return pin.places.length > 1
      ? `${copy.map.farmsNear(pin.places.length, first.town)}. ${copy.demo.mark}`
      : `${copy.map.farmNear(first.name, first.town)}. ${copy.demo.mark}`;
  }
  const kind = copy.map.kinds[pin.kind];
  return pin.places.length > 1
    ? `${copy.map.kindsPlural[pin.kind]} in ${first.town}, ${pin.places.length}. ${copy.demo.mark}`
    : `${copy.map.placeLabel(kind, first.name, first.town)}. ${copy.demo.mark}`;
}

/**
 * The MapLibre map and its markers. This file is the only one that imports
 * maplibre-gl, and it is loaded with next/dynamic only when the visitor opens
 * the map. Markers are real buttons rendered by React into MapLibre's marker
 * elements, so they take focus, have names and follow the theme tokens.
 */
export default function MapCanvas({
  pins,
  selectedKey,
  onSelect,
}: {
  pins: Pin[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const config = services.map;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const styleLoaded = useRef(false);
  const onSelectRef = useRef(onSelect);
  const pinsRef = useRef(pins);
  const [mapReady, setMapReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [elements, setElements] = useState<ReadonlyMap<string, HTMLElement>>(new Map());

  useEffect(() => {
    onSelectRef.current = onSelect;
    pinsRef.current = pins;
  }, [onSelect, pins]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap;
    try {
      pointToBundledWorker();
      map = new MapLibreMap({
        container: container.current,
        style: config.styleUrl,
        center: [config.defaultCentre.lng, config.defaultCentre.lat],
        zoom: config.defaultZoom,
        // The hosted style carries its own attribution. A configured source that does not gets the port's line.
        attributionControl: {
          compact: false,
          customAttribution: config.styleUrl.includes('openfreemap.org') ? undefined : config.attribution,
        },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: false,
      });
    } catch {
      // No WebGL, for example. The list view shows the same places.
      queueMicrotask(() => setFailed(true));
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      styleLoaded.current = true;
    });
    map.on('error', () => {
      if (!styleLoaded.current) setFailed(true);
    });
    map.on('click', (event) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest('.map-pin')) return;
      onSelectRef.current(null);
    });
    mapRef.current = map;
    const markers = markersRef.current;
    queueMicrotask(() => setMapReady(true));
    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      setElements(new Map());
    };
  }, [config]);

  // Keep one marker per pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const markers = markersRef.current;
    const live = new Set(pins.map((p) => p.key));
    let changed = false;
    for (const [key, marker] of markers) {
      if (!live.has(key)) {
        marker.remove();
        markers.delete(key);
        changed = true;
      }
    }
    for (const pin of pins) {
      const existing = markers.get(pin.key);
      if (existing) {
        existing.setLngLat([pin.point.lng, pin.point.lat]);
      } else {
        const element = document.createElement('div');
        element.className = 'map-marker';
        markers.set(
          pin.key,
          new Marker({ element, anchor: 'center', offset: fanOffset(pin.kind, map.getZoom()) })
            .setLngLat([pin.point.lng, pin.point.lat])
            .addTo(map),
        );
        changed = true;
      }
    }
    if (changed) queueMicrotask(() => setElements(new Map([...markers].map(([key, marker]) => [key, marker.getElement()]))));
  }, [pins, mapReady]);

  // Fit the view when the set of pins changes, not when their data refreshes.
  const fitKey = useMemo(() => pins.map((p) => p.key).sort().join('|'), [pins]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pins.length === 0) {
      map.jumpTo({ center: [config.defaultCentre.lng, config.defaultCentre.lat], zoom: config.defaultZoom });
      return;
    }
    if (pins.length === 1) {
      const [only] = pins;
      map.easeTo({ center: [only.point.lng, only.point.lat], zoom: 10, duration: animate ? 300 : 0 });
      return;
    }
    const bounds = new LngLatBounds();
    for (const pin of pins) bounds.extend([pin.point.lng, pin.point.lat]);
    map.fitBounds(bounds, { padding: 72, maxZoom: MAX_FIT_ZOOM, duration: animate ? 300 : 0 });
    // fitKey stands for the set of pins; the pins array itself changes on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mapReady, config]);

  // Bring the chosen pin into the part of the map the preview does not cover.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = animate ? 250 : 0;
    const selected = selectedKey ? pinsRef.current.find((p) => p.key === selectedKey) : null;
    if (!selected) {
      map.easeTo({ padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration });
      return;
    }
    const { height } = map.getContainer().getBoundingClientRect();
    const wide = window.matchMedia('(min-width: 48rem)').matches;
    map.easeTo({
      center: [selected.point.lng, selected.point.lat],
      padding: wide ? { top: 0, right: 0, bottom: 0, left: 400 } : { top: 0, right: 0, bottom: Math.round(height * 0.5), left: 0 },
      duration,
    });
  }, [selectedKey, mapReady]);

  // Re-fan or un-fan the pins when the zoom crosses the threshold.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let fanned = map.getZoom() < FAN_BELOW_ZOOM;
    const update = () => {
      const now = map.getZoom() < FAN_BELOW_ZOOM;
      if (now === fanned) return;
      fanned = now;
      for (const pin of pinsRef.current) markersRef.current.get(pin.key)?.setOffset(fanOffset(pin.kind, map.getZoom()));
    };
    map.on('zoomend', update);
    return () => void map.off('zoomend', update);
  }, [mapReady]);

  const pinByKey = useMemo(() => new Map(pins.map((p) => [p.key, p])), [pins]);

  return (
    <div className="map-canvas">
      <div ref={container} className="map-canvas__map" role="group" aria-label={copy.map.mapAria} />
      {!mapReady && !failed ? (
        <p className="map-canvas__note" role="status">
          {copy.map.mapLoading}
        </p>
      ) : null}
      {mapReady ? (
        <div className="map-zoom">
          <button type="button" className="map-zoom__button" aria-label={copy.map.zoomIn} onClick={() => mapRef.current?.zoomIn()}>
            <Plus size={22} weight="bold" aria-hidden="true" />
          </button>
          <button type="button" className="map-zoom__button" aria-label={copy.map.zoomOut} onClick={() => mapRef.current?.zoomOut()}>
            <Minus size={22} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {failed ? (
        <p className="map-canvas__note" role="status">
          {copy.map.mapUnavailable}
        </p>
      ) : null}
      {[...elements].map(([key, element]) => {
        const pin = pinByKey.get(key);
        if (!pin) return null;
        return createPortal(
          <button
            type="button"
            className={cn('map-pin', `map-pin--${pin.kind}`)}
            data-pin-key={pin.key}
            aria-pressed={selectedKey === pin.key}
            aria-label={pinLabel(pin)}
            onClick={() => onSelect(pin.key)}
          >
            <PinGlyph kind={pin.kind} />
            {pin.places.length > 1 ? <span className="map-pin__count">{pin.places.length}</span> : null}
          </button>,
          element,
          key,
        );
      })}
    </div>
  );
}
