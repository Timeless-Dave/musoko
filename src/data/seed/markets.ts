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

/**
 * Real farmers markets, from their own pages and public listings (checked
 * November 2026). Public places, so the venue is shown. No phone or email is
 * stored: people follow the market's own page. Days and hours are left out
 * when no source states them.
 */
interface RealSpec {
  n: number; slug: string; name: string; town: string; venue: string; point: [number, number] | null;
  schedule: OpeningHours[]; seasonNote: string; website: string | null; sources: string[];
}
const REAL: RealSpec[] = [
  { n: 11, slug: 'judd-hill-farmers-market', name: "Judd Hill Farmers' Market", town: 'jonesboro', venue: '3350 Aggie Road, Arkansas State University farm', point: [35.84221, -90.66602],
    schedule: [{ day: 2, opens: '11:00', closes: '16:00' }, { day: 6, opens: '08:00', closes: '13:00' }], seasonNote: 'Saturdays May to October; Tuesdays June to August.',
    website: 'https://juddhillfarmersmarket.com/', sources: ['https://arkansasgrown.org/listing/judd-hill-farmers-market-2/', 'https://arkansas.com/jonesboro/farmers-market/judd-hill-farmers-market'] },
  { n: 12, slug: 'forrest-city-farmers-market', name: 'Forrest City Farmers Market', town: 'forrest-city', venue: 'Civic Center parking lot, 1335 N. Washington Street', point: [35.02293, -90.78813],
    schedule: [{ day: 6, opens: '08:00', closes: '12:00' }], seasonNote: 'June to October.',
    website: 'https://cityofforrestcityar.com/page/forrest-city-farmers-market', sources: ['https://thnews.com/farmers-market-held-saturdays-at-civic-center/', 'https://arkansasgrown.org/listing/forrest-city-farmers-market/'] },
  { n: 13, slug: 'crittenden-county-farmers-market', name: 'Crittenden County Farmers Market', town: 'marion', venue: 'Courthouse Square, 1 Court Street', point: [35.21446, -90.1968],
    schedule: [{ day: 6, opens: '08:00', closes: '12:00' }], seasonNote: 'Second Saturday of each month, May to October.',
    website: null, sources: ['https://arkansasgrown.org/listing/crittenden-county-farmers-market/', 'https://www.uaex.uada.edu/media-resources/news/2024/august2024/08-30-2024-ark-crittenden-co-farmers-market.aspx'] },
  { n: 14, slug: 'osceola-main-street-farmers-market', name: 'Osceola Main Street Farmers Market', town: 'osceola', venue: 'Courthouse Square, downtown Osceola', point: null,
    schedule: [{ day: 4, opens: '10:00', closes: '14:00' }], seasonNote: 'April to October.',
    website: 'https://osceolamainstreet.org/farmers-market', sources: ['https://osceolamainstreet.org/farmers-market'] },
  { n: 15, slug: 'cross-county-farmers-market', name: 'Cross County Farmers Market', town: 'wynne', venue: 'North lawn of the Cross County Courthouse, 705 E. Union Avenue', point: [35.22245, -90.78718],
    schedule: [{ day: 6, opens: '08:00', closes: '11:00' }], seasonNote: 'May to October. Check the market’s page; older listings give other hours.',
    website: 'https://www.facebook.com/crosscountyfarmersmarket', sources: ['https://arkansasgrown.org/listing/cross-county-farmers-market/'] },
  { n: 16, slug: 'saracen-landing-farmers-market', name: 'Saracen Landing Farmers Market', town: 'pine-bluff', venue: 'Saracen Landing pavilion, 200 Lake Saracen Drive', point: null,
    schedule: [{ day: 2, opens: '06:00', closes: '13:00' }, { day: 4, opens: '06:00', closes: '13:00' }, { day: 6, opens: '06:00', closes: '13:00' }], seasonNote: 'June to October. Sources differ on days; check before going.',
    website: 'https://www.explorepinebluff.com/farmers-market', sources: ['https://www.explorepinebluff.com/farmers-market', 'https://aymag.com/farmers-markets-across-arkansas/'] },
  { n: 17, slug: 'ag-capital-farmers-market', name: 'Ag Capital of Pine Bluff Farmers Market', town: 'pine-bluff', venue: '12th and Palm, 1199 Palm Street', point: null,
    schedule: [], seasonNote: 'Saturdays. Hours are not published.',
    website: null, sources: ['https://www.deltaplexnews.com/local-news/ag-capital-farmers-market-returns-to-pine-bluff-with-fresh-food-local-vendors-and-urban-agriculture-expansion/'] },
  { n: 18, slug: 'grand-prairie-farmers-market', name: 'Grand Prairie Farmers Market', town: 'stuttgart', venue: 'Chamber of Commerce pavilion, 507 S. Main Street', point: [34.49804, -91.55231],
    schedule: [{ day: 4, opens: '15:00', closes: '18:00' }, { day: 6, opens: '07:00', closes: '12:00' }], seasonNote: 'Season not published; check before going.',
    website: null, sources: ['https://arkansasgrown.org/listing/grand-prairie-farmers-market/', 'https://marketspread.com/market/25834/grand-prairie-farmers-market/'] },
  { n: 19, slug: 'downtown-newport-farmers-market', name: 'Downtown Newport Farmers Market', town: 'newport', venue: 'Market Pavilion, 201 Malcolm Avenue', point: [35.60697, -91.27623],
    schedule: [{ day: 3, opens: '07:00', closes: '12:00' }, { day: 6, opens: '07:00', closes: '12:00' }], seasonNote: 'June to October.',
    website: 'https://www.facebook.com/Downtown-Newport-Farmers-Market-1454514414840500/', sources: ['https://arkansasgrown.org/listing/downtown-newport-farmers-market/'] },
  { n: 20, slug: 'marianna-farmers-market', name: 'Marianna Farmers Market', town: 'marianna', venue: 'Court Square Park, historic downtown', point: [34.77371, -90.75761],
    schedule: [], seasonNote: 'Fourth Saturday of each month. Hours are not published.',
    website: null, sources: ['https://arkansasgrown.org/listing/marianna-farmers-market/'] },
];

function buildRealMarkets(): FarmersMarket[] {
  return REAL.map((s) => {
    const community = communityBySlug(s.town);
    const point = s.point ? { lat: s.point[0], lng: s.point[1] } : community.centre;
    const directionsUrl = s.point
      ? `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.venue}, ${community.name}, AR`)}`;
    return {
      id: marketId(s.n), slug: s.slug, name: s.name, communityId: community.id, town: community.name, point, venue: s.venue,
      schedule: s.schedule, seasonNote: s.seasonNote, contactPhone: null, contactEmail: null, directionsUrl,
      moderationStatus: 'visible' as const, isDemo: false, website: s.website, sources: s.sources,
    };
  });
}

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
  return { markets: [...markets, ...buildRealMarkets()], links };
}
