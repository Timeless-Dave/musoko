'use client';

import { useCallback, useMemo, useState } from 'react';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { services } from '@/data';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, Section, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@/design-system/primitives';
import type { ProductCategory } from '@/domain/types';
import {
  CATEGORY_ORDER,
  useCommunities,
  useMilesFrom,
  usePublicFarms,
  usePublicMarkets,
  usePublicPickupLocations,
  usePublicProducts,
  useSelectedCommunity,
} from '@/features/catalogue';
import { MapPanel } from './components/MapPanel';
import { PlaceList } from './components/PlaceList';
import { buildPlaces, filterPlaces, groupPins, sortPlaces, type Place } from './places';

const VIEWS = ['list', 'map'] as const;
const KINDS = ['farm', 'market', 'pickup'] as const;

// Map is the default; the canvas still mounts only while this tab is selected.
const params = {
  view: parseAsStringLiteral(VIEWS).withDefault('map'),
  show: parseAsStringLiteral(KINDS),
  town: parseAsString,
  food: parseAsStringLiteral(CATEGORY_ORDER),
};

/**
 * Counts one open of a market or pickup preview. Anonymous and best effort: a
 * failed count never gets in the visitor's way.
 */
function countPreview(place: Place, surface: 'map' | 'list') {
  if (place.kind === 'farm') return;
  void services.gateway
    .recordPreviewOpen({
      targetKind: place.kind === 'market' ? 'farmers_market' : 'pickup_location',
      targetId: place.id,
      surface,
    })
    .catch(() => undefined);
}

export function MapExplorer() {
  const [state, setState] = useQueryStates(params, { history: 'replace', shallow: true });
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: communities } = useCommunities();
  const { data: farms } = usePublicFarms();
  const { data: markets } = usePublicMarkets();
  const { data: pickupLocations } = usePublicPickupLocations();
  const { data: products } = usePublicProducts();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loaded = Boolean(farms && markets && pickupLocations && products);
  const all = useMemo(
    () =>
      loaded
        ? buildPlaces({ farms: farms!, markets: markets!, pickupLocations: pickupLocations!, products: products! })
        : [],
    [loaded, farms, markets, pickupLocations, products],
  );

  const townId = useMemo(
    () => (state.town ? (communities?.find((c) => c.slug === state.town)?.id ?? null) : null),
    [communities, state.town],
  );

  const places = useMemo(
    () =>
      sortPlaces(
        filterPlaces(all, { kind: state.show, communityId: townId, category: state.food as ProductCategory | null }),
        milesFrom,
      ),
    [all, state.show, townId, state.food, milesFrom],
  );
  const pins = useMemo(() => groupPins(places), [places]);
  const selected = useMemo(() => pins.find((p) => p.key === selectedKey) ?? null, [pins, selectedKey]);

  const townsWithPlaces = useMemo(() => {
    const ids = new Set(all.map((p) => p.communityId));
    return (communities ?? []).filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, communities]);
  const foodsWithPlaces = useMemo(
    () => CATEGORY_ORDER.filter((category) => all.some((p) => p.categories.includes(category))),
    [all],
  );

  const awayFor = useCallback(
    (place: Place) => {
      const miles = milesFrom(place.communityId);
      return miles === null ? null : copy.product.away(miles);
    },
    [milesFrom],
  );

  const selectPin = useCallback(
    (key: string | null) => {
      setSelectedKey(key);
      if (key === null) return;
      const pin = pins.find((p) => p.key === key);
      pin?.places.forEach((place) => countPreview(place, 'map'));
    },
    [pins],
  );

  const filtered = state.show !== null || state.town !== null || state.food !== null;
  const clear = () => {
    setSelectedKey(null);
    void setState({ show: null, town: null, food: null });
  };

  return (
    <>
      {/* Not a named region: MapLibre labels its canvas "Map", and two landmarks may not share a name. */}
      <Section pad="none" className="food-top">
        <h1 className="food-top__title">
          {copy.map.title}
        </h1>
        <p className="map-lead">{copy.map.lead}</p>
      </Section>

      <Section pad="none" className="food-results">
        <div className="filter-bar">
          <Select
            label={copy.map.show}
            value={state.show ?? ''}
            onChange={(e) => void setState({ show: (e.target.value || null) as (typeof KINDS)[number] | null })}
          >
            <option value="">{copy.map.showAll}</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {copy.map.kindsPlural[kind]}
              </option>
            ))}
          </Select>
          <Select
            label={copy.map.town}
            value={state.town ?? ''}
            onChange={(e) => void setState({ town: e.target.value || null })}
          >
            <option value="">{copy.map.anyTown}</option>
            {townsWithPlaces.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label={copy.map.food}
            value={state.food ?? ''}
            onChange={(e) => void setState({ food: (e.target.value || null) as ProductCategory | null })}
          >
            <option value="">{copy.map.anyFood}</option>
            {foodsWithPlaces.map((category) => (
              <option key={category} value={category}>
                {copy.categories[category]}
              </option>
            ))}
          </Select>
        </div>

        <div className="food-results__head">
          <p className="food-results__count" role="status">
            {loaded ? copy.map.count(places.length) : copy.common.loading}
          </p>
          {filtered ? (
            <Button variant="link" onClick={clear}>
              {copy.map.clear}
            </Button>
          ) : null}
        </div>

        <Tabs value={state.view} onValueChange={(view) => void setState({ view: view === 'map' ? 'map' : null })}>
          <TabsList aria-label={copy.map.viewLabel}>
            <TabsTrigger value="list">{copy.map.viewList}</TabsTrigger>
            <TabsTrigger value="map">{copy.map.viewMap}</TabsTrigger>
          </TabsList>
          <TabsContent value="list">
            {loaded && places.length === 0 ? (
              <EmptyState
                sentence={copy.map.none}
                action={
                  <Button variant="secondary" onClick={clear}>
                    {copy.map.clear}
                  </Button>
                }
              />
            ) : (
              <PlaceList places={places} awayFor={awayFor} onOpen={(place) => countPreview(place, 'list')} />
            )}
          </TabsContent>
          <TabsContent value="map">
            {loaded && places.length === 0 ? (
              <EmptyState
                sentence={copy.map.none}
                action={
                  <Button variant="secondary" onClick={clear}>
                    {copy.map.clear}
                  </Button>
                }
              />
            ) : (
              <MapPanel pins={pins} selected={selected} onSelect={selectPin} />
            )}
          </TabsContent>
        </Tabs>
      </Section>
    </>
  );
}
