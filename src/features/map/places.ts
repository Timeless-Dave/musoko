import type {
  CommunityId,
  Coordinates,
  OpeningHours,
  ProductCategory,
  PublicFarm,
  PublicMarket,
  PublicPickupLocation,
  PublicProduct,
} from '@/domain/types';

/**
 * What the map and its list show. Built only from public projections, so the
 * points here are the ones the gateway already chose to publish: a town centre
 * for a farm unless the farmer opted in, and the public point of a market or
 * pickup location. There is no field for an address.
 */
export type PlaceKind = 'farm' | 'market' | 'pickup';

interface PlaceBase {
  /** Unique across kinds, e.g. "market:market-01". */
  key: string;
  kind: PlaceKind;
  /** The market or pickup location id, or the farm's profile id. */
  id: string;
  name: string;
  town: string;
  communityId: CommunityId;
  point: Coordinates;
  categories: ProductCategory[];
  isDemo: boolean;
}

export interface FarmPlace extends PlaceBase {
  kind: 'farm';
  slug: string;
  precision: 'town_centre' | 'exact';
  intro: string;
}
export interface MarketPlace extends PlaceBase {
  kind: 'market';
  slug: string;
  market: PublicMarket;
}
export interface PickupPlace extends PlaceBase {
  kind: 'pickup';
  slug: string;
  description: string;
  /** Farms that list this pickup point, with the days each one is there. */
  farms: Array<{ id: string; slug: string; farmName: string; schedule: OpeningHours[] }>;
}
export type Place = FarmPlace | MarketPlace | PickupPlace;

/** One marker. Places that share a point (farms in one town) share a marker. */
export interface Pin {
  key: string;
  kind: PlaceKind;
  point: Coordinates;
  places: Place[];
}

export interface PlaceFilters {
  kind: PlaceKind | null;
  communityId: CommunityId | null;
  category: ProductCategory | null;
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export function buildPlaces(input: {
  farms: PublicFarm[];
  markets: PublicMarket[];
  pickupLocations: PublicPickupLocation[];
  products: PublicProduct[];
}): Place[] {
  const { farms, markets, pickupLocations, products } = input;

  const categoriesByFarm = new Map<string, ProductCategory[]>();
  for (const product of products) {
    const list = categoriesByFarm.get(product.farm.id) ?? [];
    list.push(product.productType.category);
    categoriesByFarm.set(product.farm.id, list);
  }
  const categoriesOf = (farmIds: string[]) => unique(farmIds.flatMap((id) => categoriesByFarm.get(id) ?? []));

  const farmPlaces: FarmPlace[] = farms.map((farm) => ({
    key: `farm:${farm.id}`,
    kind: 'farm',
    id: farm.id,
    slug: farm.slug,
    name: farm.farmName,
    town: farm.location.town,
    communityId: farm.location.communityId,
    point: farm.location.point,
    precision: farm.location.precision,
    intro: farm.intro,
    categories: unique(categoriesByFarm.get(farm.id) ?? []),
    isDemo: farm.isDemo,
  }));

  const marketPlaces: MarketPlace[] = markets.map((market) => ({
    key: `market:${market.id}`,
    kind: 'market',
    id: market.id,
    slug: market.slug,
    name: market.name,
    town: market.town,
    communityId: market.communityId,
    point: market.point,
    categories: categoriesOf(market.farms.map((f) => f.id)),
    isDemo: market.isDemo,
    market,
  }));

  const pickupPlaces: PickupPlace[] = pickupLocations.map((location) => {
    const users = farms
      .map((farm) => {
        const option = farm.pickupOptions.find((o) => o.pickupLocationId === location.id);
        return option ? { id: farm.id, slug: farm.slug, farmName: farm.farmName, schedule: option.schedule } : null;
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);
    return {
      key: `pickup:${location.id}`,
      kind: 'pickup',
      id: location.id,
      slug: location.slug,
      name: location.name,
      town: location.town,
      communityId: location.communityId,
      point: location.point,
      description: location.description,
      farms: users,
      categories: categoriesOf(users.map((u) => u.id)),
      isDemo: location.isDemo,
    };
  });

  return [...marketPlaces, ...pickupPlaces, ...farmPlaces];
}

export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  return places.filter(
    (place) =>
      (filters.kind === null || place.kind === filters.kind) &&
      (filters.communityId === null || place.communityId === filters.communityId) &&
      (filters.category === null || place.categories.includes(filters.category)),
  );
}

const KIND_ORDER: Record<PlaceKind, number> = { market: 0, pickup: 1, farm: 2 };

/** Kind first, then nearest to the visitor's chosen town. Places with no known distance go last. */
export function sortPlaces(places: Place[], milesFrom: (communityId: CommunityId) => number | null): Place[] {
  const far = Number.MAX_SAFE_INTEGER;
  return [...places].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (milesFrom(a.communityId) ?? far) - (milesFrom(b.communityId) ?? far) ||
      a.name.localeCompare(b.name),
  );
}

const pointKey = (p: Coordinates) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/** Places at one point and of one kind become one pin. Order of first appearance is kept. */
export function groupPins(places: Place[]): Pin[] {
  const pins = new Map<string, Pin>();
  for (const place of places) {
    const key = `${place.kind}@${pointKey(place.point)}`;
    const pin = pins.get(key);
    if (pin) pin.places.push(place);
    else pins.set(key, { key, kind: place.kind, point: place.point, places: [place] });
  }
  return [...pins.values()];
}

/** The box around a set of pins, for fitting the view. */
export function boundsOf(pins: Pin[]): { sw: Coordinates; ne: Coordinates } | null {
  if (pins.length === 0) return null;
  const lats = pins.map((p) => p.point.lat);
  const lngs = pins.map((p) => p.point.lng);
  return {
    sw: { lat: Math.min(...lats), lng: Math.min(...lngs) },
    ne: { lat: Math.max(...lats), lng: Math.max(...lngs) },
  };
}
