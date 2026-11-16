import { beforeAll, describe, expect, it } from 'vitest';
import { services } from '@/data';
import type { PublicCatalogue } from '@/domain/types';
import { boundsOf, buildPlaces, filterPlaces, groupPins, sortPlaces, type Place } from './places';

let catalogue: PublicCatalogue;
let places: Place[];

beforeAll(async () => {
  const [farms, products, markets, pickupLocations] = await Promise.all([
    services.gateway.listPublicFarms(),
    services.gateway.listPublicProducts(),
    services.gateway.listPublicMarkets(),
    services.gateway.listPublicPickupLocations(),
  ]);
  catalogue = { farms, products, markets, pickupLocations };
  places = buildPlaces(catalogue);
});

const none = { kind: null, communityId: null, category: null } as const;

describe('map places', () => {
  it('has a place for every public farm, market and pickup location', () => {
    expect(places.filter((p) => p.kind === 'farm')).toHaveLength(catalogue.farms.length);
    expect(places.filter((p) => p.kind === 'market')).toHaveLength(catalogue.markets.length);
    expect(places.filter((p) => p.kind === 'pickup')).toHaveLength(catalogue.pickupLocations.length);
    expect(places.every((p) => p.isDemo)).toBe(true);
  });

  it('PRIV-1: a farm sits at the town centre unless the farmer opted in to the exact place', async () => {
    const communities = await services.gateway.listCommunities();
    for (const place of places.filter((p) => p.kind === 'farm')) {
      if (place.kind !== 'farm') continue;
      const centre = communities.find((c) => c.id === place.communityId)!.centre;
      if (place.precision === 'town_centre') expect(place.point).toEqual(centre);
      else expect(place.point).not.toEqual(centre);
    }
    expect(places.some((p) => p.kind === 'farm' && p.precision === 'exact')).toBe(true);
  });

  it('carries no farm address, phone or email', () => {
    for (const place of places.filter((p) => p.kind === 'farm')) {
      expect(Object.keys(place).sort()).toEqual(
        ['categories', 'communityId', 'id', 'intro', 'isDemo', 'key', 'kind', 'name', 'point', 'precision', 'slug', 'town'],
      );
    }
  });

  it('puts farms that share a town centre on one pin, and keeps kinds apart', () => {
    const pins = groupPins(places);
    expect(pins.flatMap((p) => p.places)).toHaveLength(places.length);
    for (const pin of pins) expect(pin.places.every((p) => p.kind === pin.kind)).toBe(true);
    expect(pins.some((pin) => pin.kind === 'farm' && pin.places.length > 1)).toBe(true);
    expect(pins.length).toBeLessThan(places.length);
  });

  it('filters by kind, town and food, and the three combine', () => {
    const markets = filterPlaces(places, { ...none, kind: 'market' });
    expect(markets.length).toBe(catalogue.markets.length);

    const town = catalogue.markets[0].communityId;
    const inTown = filterPlaces(places, { ...none, communityId: town });
    expect(inTown.length).toBeGreaterThan(0);
    expect(inTown.every((p) => p.communityId === town)).toBe(true);

    const eggs = filterPlaces(places, { ...none, category: 'eggs' });
    expect(eggs.length).toBeGreaterThan(0);
    expect(eggs.every((p) => p.categories.includes('eggs'))).toBe(true);

    const both = filterPlaces(places, { kind: 'farm', communityId: town, category: 'eggs' });
    expect(both.every((p) => p.kind === 'farm' && p.communityId === town && p.categories.includes('eggs'))).toBe(true);
  });

  it('sorts markets, then pickup points, then farms, nearest first', () => {
    const sorted = sortPlaces(places, (id) => (id === places[0].communityId ? 0 : 10));
    const order = sorted.map((p) => p.kind);
    expect(order).toEqual([...order].sort((a, b) => ['market', 'pickup', 'farm'].indexOf(a) - ['market', 'pickup', 'farm'].indexOf(b)));
  });

  it('bounds a set of pins and returns null for none', () => {
    expect(boundsOf([])).toBeNull();
    const box = boundsOf(groupPins(places))!;
    expect(box.sw.lat).toBeLessThanOrEqual(box.ne.lat);
    expect(box.sw.lng).toBeLessThanOrEqual(box.ne.lng);
  });
});
