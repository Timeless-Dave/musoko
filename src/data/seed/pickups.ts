import {
  asId,
  type FarmerPickupOption,
  type FarmerPickupOptionId,
  type OpeningHours,
  type PickupLocation,
  type PickupLocationId,
} from '@/domain/types';
import { communityBySlug } from './communities';
import { farmId, offsetPoint } from './farms';
import { marketId } from './markets';

export const pickupLocationId = (n: number): PickupLocationId => asId<PickupLocationId>(`pickup-${String(n).padStart(2, '0')}`);

export function buildPickupLocations(): PickupLocation[] {
  const rows: Array<[number, string, string, string, string, number, number]> = [
    [1, 'cypress-commons-pickup-shed', 'Cypress Commons Pickup Shed', 'helena-west-helena', 'A covered shed with shelves and a cooler, open to arranged pickups.', 0.8, 0.5],
    [2, 'levee-road-pickup-porch', 'Levee Road Pickup Porch', 'dumas', 'A shaded porch beside a community hall. Farmers leave orders in labelled crates.', -0.4, 0.3],
    [3, 'depot-lot-pickup-point', 'Depot Lot Pickup Point', 'wynne', 'A marked space in a small lot. Meet the farmer at the arranged time.', 0.5, -0.6],
  ];
  return rows.map(([n, slug, name, town, description, north, east]) => {
    const community = communityBySlug(town);
    return {
      id: pickupLocationId(n), slug, name, communityId: community.id, town: community.name,
      point: offsetPoint(community.centre, north, east), description,
      moderationStatus: 'visible' as const, isDemo: true,
    };
  });
}

const optionId = (n: number) => asId<FarmerPickupOptionId>(`option-${String(n).padStart(2, '0')}`);
const sat: OpeningHours[] = [{ day: 6, opens: '08:00', closes: '12:00' }];

/** Every published farm has at least one option. Four offer their own delivery. */
export function buildPickupOptions(): FarmerPickupOption[] {
  type Row = [farm: number, kind: FarmerPickupOption['kind'], target: number | null, schedule: OpeningHours[], note: string];
  const rows: Row[] = [
    [1, 'farmers_market', 1, sat, 'Find the stall by the green awning.'],
    [1, 'pickup_location', 1, [{ day: 3, opens: '16:00', closes: '18:00' }], 'Orders ready on Wednesday afternoons.'],
    [1, 'own_delivery', null, [{ day: 2, opens: '10:00', closes: '14:00' }], 'Delivery inside Helena-West Helena on Tuesdays.'],
    [2, 'pickup_location', 1, [{ day: 1, opens: '09:00', closes: '11:00' }], 'Eggs are left in a cooler. Bring your own carton if you can.'],
    [3, 'farmers_market', 1, sat, 'Honey and pecans at the end of the row.'],
    [3, 'own_delivery', null, [], 'Delivery to Marvell and Helena-West Helena by arrangement.'],
    [4, 'farmers_market', 2, [{ day: 6, opens: '07:30', closes: '11:30' }], 'Look for the herb table.'],
    [5, 'farmers_market', 2, [{ day: 6, opens: '07:30', closes: '11:30' }], 'Syrup and cornmeal in autumn.'],
    [6, 'farmers_market', 3, [{ day: 5, opens: '15:00', closes: '18:00' }], 'Friday afternoons.'],
    [7, 'farmers_market', 3, [{ day: 5, opens: '15:00', closes: '18:00' }], 'Frozen cuts, bring a cooler.'],
    [7, 'own_delivery', null, [{ day: 5, opens: '09:00', closes: '14:00' }], 'Delivery around Forrest City on Fridays.'],
    [8, 'farmers_market', 4, [{ day: 4, opens: '16:00', closes: '18:30' }], 'Spring and summer.'],
    [9, 'farmers_market', 5, [{ day: 6, opens: '08:00', closes: '11:00' }], 'Rice and grits by the bag.'],
    [9, 'pickup_location', 3, [{ day: 6, opens: '12:00', closes: '14:00' }], 'Saturday after the market.'],
    [10, 'pickup_location', 2, [{ day: 3, opens: '14:00', closes: '17:00' }], 'Milk is kept cold in the cooler.'],
    [10, 'own_delivery', null, [{ day: 3, opens: '09:00', closes: '13:00' }], 'Delivery around Dumas on Wednesdays.'],
    [12, 'pickup_location', 2, [{ day: 2, opens: '15:00', closes: '17:00' }], 'By arrangement.'],
  ];
  return rows.map(([farm, kind, target, schedule, note], i) => ({
    id: optionId(i + 1),
    farmerProfileId: farmId(farm),
    kind,
    pickupLocationId: kind === 'pickup_location' && target ? pickupLocationId(target) : null,
    marketId: kind === 'farmers_market' && target ? marketId(target) : null,
    schedule,
    note,
  }));
}
