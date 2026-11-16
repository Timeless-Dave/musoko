import { asId, type FarmersMarket, type FarmersMarketId, type FarmerMarketLink, type OpeningHours } from '@/domain/types';
import { communityBySlug } from './communities';
import { farmId } from './farms';
import { offsetPoint } from './farms';

export const marketId = (n: number): FarmersMarketId => asId<FarmersMarketId>(`market-${String(n).padStart(2, '0')}`);

interface Spec {
  n: number; slug: string; name: string; town: string; venue: string; north: number; east: number;
  schedule: OpeningHours[]; seasonNote: string; phone: string; email: string;
}

// Market phones use 870-555-019x, never a farmer's number.
const SPECS: Spec[] = [
  { n: 1, slug: 'delta-saturday-stalls', name: 'Delta Saturday Stalls', town: 'helena-west-helena', venue: 'Demo Square, Helena-West Helena', north: 0.4, east: -0.3,
    schedule: [{ day: 6, opens: '08:00', closes: '12:00' }], seasonNote: 'Open all year. Fewer stalls from December to February.', phone: '870-555-0190', email: 'stalls@deltasaturday.example' },
  { n: 2, slug: 'riverbank-harvest-table', name: 'Riverbank Harvest Table', town: 'pine-bluff', venue: 'Demo Landing, Pine Bluff', north: -0.5, east: 0.6,
    schedule: [{ day: 6, opens: '07:30', closes: '11:30' }], seasonNote: 'April to November.', phone: '870-555-0191', email: 'table@riverbankharvest.example' },
  { n: 3, slug: 'lantern-hill-growers-stand', name: 'Lantern Hill Growers Stand', town: 'forrest-city', venue: 'Demo Lot, Forrest City', north: 0.3, east: 0.5,
    schedule: [{ day: 5, opens: '15:00', closes: '18:00' }], seasonNote: 'Fridays, year round, weather allowing.', phone: '870-555-0192', email: 'stand@lanternhill.example' },
  { n: 4, slug: 'tupelo-row-market', name: 'Tupelo Row Market', town: 'marianna', venue: 'Demo Green, Marianna', north: -0.2, east: -0.4,
    schedule: [{ day: 4, opens: '16:00', closes: '18:30' }], seasonNote: 'May to October. A winter pop-up runs on the first Thursday of the month.', phone: '870-555-0193', email: 'row@tupelomarket.example' },
  { n: 5, slug: 'grain-loft-market', name: 'Grain Loft Market', town: 'stuttgart', venue: 'Demo Warehouse Lot, Stuttgart', north: 0.6, east: 0.2,
    schedule: [{ day: 6, opens: '08:00', closes: '11:00' }], seasonNote: 'Open all year.', phone: '870-555-0194', email: 'loft@grainloft.example' },
];

export function buildMarkets(): { markets: FarmersMarket[]; links: FarmerMarketLink[] } {
  const markets: FarmersMarket[] = SPECS.map((s) => {
    const community = communityBySlug(s.town);
    const point = offsetPoint(community.centre, s.north, s.east);
    return {
      id: marketId(s.n), slug: s.slug, name: s.name, communityId: community.id, town: community.name,
      point, venue: s.venue, schedule: s.schedule, seasonNote: s.seasonNote,
      contactPhone: s.phone, contactEmail: s.email,
      directionsUrl: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`,
      moderationStatus: 'visible' as const, isDemo: true,
    };
  });
  const pairs: Array<[number, number]> = [
    [1, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [8, 4], [9, 5],
  ];
  const links = pairs.map(([farm, market]) => ({ farmerProfileId: farmId(farm), marketId: marketId(market) }));
  return { markets, links };
}
