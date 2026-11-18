import 'server-only';
import { services } from '@/data';
import { distanceKm, kmToMiles } from '@/domain/geo';
import type {
  Community,
  Coordinates,
  PublicFarm,
  PublicMarket,
  PublicPickupLocation,
  PublicProduct,
} from '@/domain/types';

/**
 * The guide's view of Musoko: public projections only, read through the
 * gateway like any page. No private address, exact point or unshared contact
 * can reach a caller, because none is in these types.
 */
export interface Catalogue {
  products: PublicProduct[];
  farms: PublicFarm[];
  markets: PublicMarket[];
  pickups: PublicPickupLocation[];
  communities: Community[];
}

let cached: { at: number; value: Catalogue } | null = null;
const TTL_MS = 5 * 60_000;

export async function loadCatalogue(): Promise<Catalogue> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const g = services.gateway;
  const [products, farms, markets, pickups, communities] = await Promise.all([
    g.listPublicProducts(),
    g.listPublicFarms(),
    g.listPublicMarkets(),
    g.listPublicPickupLocations(),
    g.listCommunities(),
  ]);
  const value = { products, farms, markets, pickups, communities };
  cached = { at: Date.now(), value };
  return value;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** A town from loose text: "helena", "West Helena", "pine bluff ar". */
export function findCommunity(cat: Catalogue, text: string | undefined | null): Community | null {
  if (!text) return null;
  const q = norm(text);
  if (!q) return null;
  return (
    cat.communities.find((c) => norm(c.name) === q || c.slug === q.replace(/ /g, '-')) ??
    cat.communities.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name))) ??
    cat.communities.find((c) => norm(c.name).split(' ').some((w) => w.length > 3 && q.includes(w))) ??
    null
  );
}

export function milesBetween(a: Coordinates, b: Coordinates): number {
  return kmToMiles(distanceKm(a, b));
}

/** A place a caller can name: a town, a market, a pickup point or a farm, with its public point. */
export interface Place {
  kind: 'town' | 'market' | 'pickup point' | 'farm';
  name: string;
  town: string;
  point: Coordinates;
  /** Text for a maps search. Farms give only their town unless the farmer shared the exact spot. */
  mapsQuery: string;
}

export function findPlace(cat: Catalogue, text: string): Place | null {
  const q = norm(text);
  const market = cat.markets.find((m) => norm(m.name).includes(q) || q.includes(norm(m.name)));
  if (market) {
    return { kind: 'market', name: market.name, town: market.town, point: market.point, mapsQuery: `${market.town}, Arkansas` };
  }
  const pickup = cat.pickups.find((p) => norm(p.name).includes(q) || q.includes(norm(p.name)));
  if (pickup) {
    return { kind: 'pickup point', name: pickup.name, town: pickup.town, point: pickup.point, mapsQuery: `${pickup.town}, Arkansas` };
  }
  const farm = cat.farms.find((f) => norm(f.farmName).includes(q) || q.includes(norm(f.farmName)));
  if (farm) {
    const exact = farm.location.precision === 'exact';
    return {
      kind: 'farm',
      name: farm.farmName,
      town: farm.location.town,
      point: farm.location.point,
      mapsQuery: exact ? `${farm.location.point.lat},${farm.location.point.lng}` : `${farm.location.town}, Arkansas`,
    };
  }
  const town = findCommunity(cat, text);
  if (town) return { kind: 'town', name: town.name, town: town.name, point: town.centre, mapsQuery: `${town.name}, Arkansas` };
  return null;
}

export function directionsUrl(from: Place, to: Place): string {
  const params = new URLSearchParams({ api: '1', origin: from.mapsQuery, destination: to.mapsQuery, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
