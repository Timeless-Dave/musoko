import {
  asId,
  type Product,
  type ProductAvailability,
  type ProductAvailabilityHistoryEntry,
  type EventId,
  type ProductId,
  type ProductQuantity,
  type ProductType,
  type SellingUnit,
  type UnitSize,
} from '@/domain/types';
import { normalizedUnitPrice } from '@/domain/units';
import { farmId } from './farms';
import { productTypeId } from './product-types';
import { daysAgo, monthsAhead } from './time';
import { DEMO_FARMER_USER_ID } from './users';

export const productId = (n: number): ProductId => asId<ProductId>(`prod-${String(n).padStart(3, '0')}`);

/**
 * Availability kinds
 *  F fresh: stored available_now, confirmed `age` days ago (inside the window)
 *  W watch: confirmed 13 days ago, one day from lapsing
 *  L lapsed: stored available_now, confirmed 15 to 40 days ago, reads as unconfirmed
 *  C coming soon: expected `months` months after now
 *  U unconfirmed: stored unconfirmed
 */
type Kind = 'F' | 'W' | 'L' | 'C' | 'U';

interface Spec {
  n: number;
  farm: number;
  type: string;
  title: string;
  desc: string;
  cents: number;
  unit: SellingUnit;
  size: UnitSize | null;
  kind: Kind;
  age?: number;
  months?: number;
  qty?: [amount: number, unit: SellingUnit, approximate: boolean];
  licence?: boolean;
  hidden?: boolean;
}

const lb = (amount = 1): UnitSize => ({ amount, measure: 'lb' });

// Prices are plausible for the Delta in November 2026. Fictional all the same.
export const PRODUCT_SPECS: Spec[] = [
  // farm-01 Cypress Knee Gardens (the demo farmer): two lapsed listings, one on the watch
  { n: 1, farm: 1, type: 'collard-greens', title: 'Collard greens', desc: 'Cut this week. One large bunch.', cents: 350, unit: 'bunch', size: null, kind: 'F', age: 1 },
  { n: 2, farm: 1, type: 'sweet-potatoes', title: 'Sweet potatoes', desc: 'Cured, mixed sizes, sold by the pound.', cents: 225, unit: 'lb', size: lb(), kind: 'F', age: 2, qty: [40, 'lb', true] },
  { n: 3, farm: 1, type: 'tomatoes', title: 'Slicing tomatoes, high tunnel', desc: 'Late slicers from the high tunnel.', cents: 450, unit: 'lb', size: lb(), kind: 'W', age: 13 },
  { n: 4, farm: 1, type: 'pole-beans', title: 'Pole beans', desc: 'Last of the season.', cents: 400, unit: 'lb', size: lb(), kind: 'L', age: 17 },
  { n: 5, farm: 1, type: 'mustard-greens', title: 'Mustard greens', desc: 'Peppery greens, one bunch.', cents: 300, unit: 'bunch', size: null, kind: 'L', age: 22 },
  { n: 6, farm: 1, type: 'winter-squash', title: 'Butternut squash', desc: 'Whole squash, sold by the pound.', cents: 175, unit: 'lb', size: lb(), kind: 'F', age: 3 },
  { n: 7, farm: 1, type: 'tomatoes', title: 'Cherry tomatoes', desc: 'Sold by the pint.', cents: 500, unit: 'pint', size: { amount: 1, measure: 'pint' }, kind: 'F', age: 1, qty: [12, 'pint', false] },
  // farm-02 Willowmere Hens
  { n: 8, farm: 2, type: 'eggs', title: 'Pasture hen eggs, dozen', desc: 'Brown and green shells, gathered daily.', cents: 550, unit: 'dozen', size: { amount: 1, measure: 'dozen' }, kind: 'F', age: 0.2, qty: [3, 'dozen', true] },
  { n: 9, farm: 2, type: 'eggs', title: 'Pasture hen eggs, half dozen', desc: 'Six eggs in a carton.', cents: 300, unit: 'carton', size: { amount: 6, measure: 'each' }, kind: 'F', age: 0.5 },
  { n: 10, farm: 2, type: 'whole-chicken', title: 'Whole chicken, frozen', desc: 'Priced each. Roughly four pounds.', cents: 1800, unit: 'each', size: null, kind: 'F', age: 4, qty: [14, 'each', false], licence: true },
  { n: 11, farm: 2, type: 'eggs', title: 'Duck eggs, dozen', desc: 'Larger eggs, richer yolks.', cents: 800, unit: 'dozen', size: { amount: 1, measure: 'dozen' }, kind: 'F', age: 2, hidden: true },
  // farm-03 Three Gate Honey
  { n: 12, farm: 3, type: 'honey', title: 'Wildflower honey, 12 oz jar', desc: 'Raw, strained.', cents: 900, unit: 'jar', size: { amount: 12, measure: 'oz' }, kind: 'F', age: 2, qty: [30, 'jar', false] },
  { n: 13, farm: 3, type: 'honey', title: 'Wildflower honey, 1 lb jar', desc: 'Raw, strained.', cents: 1400, unit: 'jar', size: lb(), kind: 'F', age: 2, qty: [18, 'jar', false] },
  { n: 14, farm: 3, type: 'pecans', title: 'Shelled pecans, 1 lb bag', desc: 'New crop halves and pieces.', cents: 1600, unit: 'bag', size: lb(), kind: 'F', age: 3, qty: [10, 'bag', false] },
  { n: 15, farm: 3, type: 'honey', title: 'Comb honey box', desc: 'Cut comb in a small box.', cents: 1800, unit: 'box', size: { amount: 8, measure: 'oz' }, kind: 'U', age: 50 },
  // farm-04 Quillfeather Acres
  { n: 16, farm: 4, type: 'tomatoes', title: 'Tomatoes, 10 lb box', desc: 'Field tomatoes by the box, for canning and sauce.', cents: 2800, unit: 'box', size: lb(10), kind: 'C', months: 6 },
  { n: 17, farm: 4, type: 'culinary-herbs', title: 'Rosemary, fresh bunch', desc: 'Cut stems, one bunch.', cents: 300, unit: 'bunch', size: null, kind: 'L', age: 16 },
  { n: 18, farm: 4, type: 'culinary-herbs', title: 'Dried herb blend, 2 oz jar', desc: 'Thyme, oregano and savory.', cents: 600, unit: 'jar', size: { amount: 2, measure: 'oz' }, kind: 'F', age: 5 },
  { n: 19, farm: 4, type: 'turnips', title: 'Turnips', desc: 'Purple top, sold by the pound.', cents: 250, unit: 'lb', size: lb(), kind: 'F', age: 2 },
  { n: 20, farm: 4, type: 'sweet-corn', title: 'Sweet corn, dozen ears', desc: 'Planted for early summer.', cents: 600, unit: 'dozen', size: { amount: 1, measure: 'dozen' }, kind: 'C', months: 7 },
  // farm-05 Stillwater Sorghum Works
  { n: 21, farm: 5, type: 'sorghum-syrup', title: 'Sorghum syrup, pint', desc: 'This autumn\'s press.', cents: 1400, unit: 'pint', size: { amount: 1, measure: 'pint' }, kind: 'F', age: 6, qty: [24, 'pint', false] },
  { n: 22, farm: 5, type: 'sorghum-syrup', title: 'Sorghum syrup, quart', desc: 'This autumn\'s press.', cents: 2600, unit: 'quart', size: { amount: 1, measure: 'quart' }, kind: 'F', age: 6 },
  { n: 23, farm: 5, type: 'cornmeal', title: 'Stone-ground cornmeal, 2 lb bag', desc: 'Medium grind, yellow corn.', cents: 600, unit: 'bag', size: lb(2), kind: 'F', age: 7, qty: [15, 'bag', false] },
  { n: 24, farm: 5, type: 'pecans', title: 'Pecans in shell, 5 lb bag', desc: 'Mixed sizes.', cents: 2000, unit: 'bag', size: lb(5), kind: 'F', age: 4 },
  // farm-06 Ninebark Row Farm
  { n: 25, farm: 6, type: 'tomatoes', title: 'Tomatoes, 5 lb box, greenhouse', desc: 'Greenhouse tomatoes, boxed.', cents: 2250, unit: 'box', size: lb(5), kind: 'F', age: 1, qty: [9, 'box', false] },
  { n: 26, farm: 6, type: 'kale', title: 'Lacinato kale bunch', desc: 'One bunch.', cents: 300, unit: 'bunch', size: null, kind: 'F', age: 1 },
  { n: 27, farm: 6, type: 'strawberries', title: 'Strawberries, pint', desc: 'Expected with the spring crop.', cents: 500, unit: 'pint', size: { amount: 1, measure: 'pint' }, kind: 'C', months: 5 },
  // farm-07 Ragged Robin Beef and Pork
  { n: 28, farm: 7, type: 'ground-beef', title: 'Ground beef, 1 lb', desc: 'Frozen, one pound packs.', cents: 850, unit: 'lb', size: lb(), kind: 'F', age: 5, qty: [60, 'lb', true], licence: true },
  { n: 29, farm: 7, type: 'pork-products', title: 'Smoked bacon, 12 oz', desc: 'Hickory smoked.', cents: 900, unit: 'pack', size: { amount: 12, measure: 'oz' }, kind: 'L', age: 25, licence: true },
  // farm-08 Larkspur Lane Kitchen Garden
  { n: 30, farm: 8, type: 'field-peas', title: 'Purple hull peas, frozen, 1 lb', desc: 'Shelled and frozen in the summer.', cents: 650, unit: 'bag', size: lb(), kind: 'F', age: 3, qty: [20, 'bag', false] },
  { n: 31, farm: 8, type: 'okra', title: 'Okra', desc: 'Planted for summer.', cents: 400, unit: 'lb', size: lb(), kind: 'C', months: 7 },
  { n: 32, farm: 8, type: 'watermelon', title: 'Watermelon', desc: 'Priced each. Expected midsummer.', cents: 800, unit: 'each', size: null, kind: 'C', months: 7 },
  { n: 33, farm: 8, type: 'eggs', title: 'Eggs, flat of 30', desc: 'Thirty eggs on a flat.', cents: 1500, unit: 'flat', size: { amount: 30, measure: 'each' }, kind: 'F', age: 2 },
  // farm-09 Marsh Wren Grains
  { n: 34, farm: 9, type: 'rice', title: 'Long-grain rice, 2 lb bag', desc: 'Milled and bagged on the farm.', cents: 550, unit: 'bag', size: lb(2), kind: 'F', age: 8, qty: [40, 'bag', false] },
  { n: 35, farm: 9, type: 'cornmeal', title: 'Stone-ground grits, 2 lb bag', desc: 'White corn grits.', cents: 650, unit: 'bag', size: lb(2), kind: 'U', age: 45 },
  // farm-10 Sweetgum Creek Dairy
  { n: 36, farm: 10, type: 'milk', title: 'Whole milk, half gallon', desc: 'Bottled this week.', cents: 450, unit: 'half_gallon', size: { amount: 0.5, measure: 'gallon' }, kind: 'F', age: 1, qty: [12, 'half_gallon', false], licence: true },
  { n: 37, farm: 10, type: 'milk', title: 'Whole milk, gallon', desc: 'Bottled this week.', cents: 800, unit: 'gallon', size: { amount: 1, measure: 'gallon' }, kind: 'F', age: 1, qty: [10, 'gallon', false], licence: true },
  { n: 38, farm: 10, type: 'fresh-cheese', title: 'Fresh farm cheese, 8 oz', desc: 'Soft, mild, made weekly.', cents: 700, unit: 'pack', size: { amount: 8, measure: 'oz' }, kind: 'L', age: 20, licence: true },
  // farm-12 Pelican Slough Orchard
  { n: 39, farm: 12, type: 'apples', title: 'Apples', desc: 'Mixed varieties, sold by the pound.', cents: 300, unit: 'lb', size: lb(), kind: 'L', age: 28 },
  { n: 40, farm: 12, type: 'persimmons', title: 'Persimmons', desc: 'Sold by the pound.', cents: 350, unit: 'lb', size: lb(), kind: 'U', age: 60 },
  { n: 41, farm: 12, type: 'peaches', title: 'Peaches, basket', desc: 'Priced by the basket. Expected in early summer.', cents: 2200, unit: 'basket', size: null, kind: 'C', months: 7 },
  { n: 42, farm: 12, type: 'blueberries', title: 'Blueberries, pint', desc: 'Expected in late spring.', cents: 600, unit: 'pint', size: { amount: 1, measure: 'pint' }, kind: 'C', months: 6 },
  // farm-11 Fennel and Flint Farm (draft profile): present in the data, absent from every public method
  { n: 43, farm: 11, type: 'turnips', title: 'Turnips', desc: 'Belongs to an unpublished profile.', cents: 250, unit: 'lb', size: lb(), kind: 'F', age: 2 },
  { n: 44, farm: 11, type: 'kale', title: 'Kale bunch', desc: 'Belongs to an unpublished profile.', cents: 300, unit: 'bunch', size: null, kind: 'F', age: 2 },
];

export function buildProducts(
  now: Date,
  productTypes: ProductType[],
): {
  products: Product[];
  availability: ProductAvailability[];
  history: ProductAvailabilityHistoryEntry[];
  quantities: ProductQuantity[];
} {
  const products: Product[] = [];
  const availability: ProductAvailability[] = [];
  const history: ProductAvailabilityHistoryEntry[] = [];
  const quantities: ProductQuantity[] = [];

  for (const s of PRODUCT_SPECS) {
    const id = productId(s.n);
    const type = productTypes.find((t) => t.id === productTypeId(s.type));
    if (!type) throw new Error(`Seed product ${s.n} names unknown type ${s.type}`);
    const unitPrice = normalizedUnitPrice({ priceCents: s.cents, unitSize: s.size }, type);

    products.push({
      id,
      farmerProfileId: farmId(s.farm),
      productTypeId: type.id,
      title: s.title,
      description: s.desc,
      photo: null,
      priceCents: s.cents,
      sellingUnit: s.unit,
      unitSize: s.size,
      normalizedUnitPriceCents: unitPrice ? unitPrice.cents : null,
      licenceSelfConfirmed: s.licence === undefined ? null : s.licence,
      moderationStatus: s.hidden ? 'hidden' : 'visible',
      isDemo: true,
      createdAt: daysAgo(now, 70 + (s.n % 20)),
      updatedAt: daysAgo(now, s.age ?? 3),
    });

    let status: ProductAvailability['status'];
    let confirmed: string | null;
    let expected: string | null = null;
    let updated: string;
    switch (s.kind) {
      case 'C':
        status = 'coming_soon';
        confirmed = null;
        expected = monthsAhead(now, s.months ?? 6);
        updated = daysAgo(now, 10);
        break;
      case 'U':
        status = 'unconfirmed';
        confirmed = daysAgo(now, s.age ?? 50);
        updated = confirmed;
        break;
      default: // F, W, L: stored available_now
        status = 'available_now';
        confirmed = daysAgo(now, s.age ?? 1);
        updated = confirmed;
    }
    availability.push({ productId: id, status, lastConfirmedAt: confirmed, expectedMonth: expected, updatedAt: updated });
    history.push({
      id: asId<EventId>(`avail-hist-${String(s.n).padStart(3, '0')}`),
      productId: id,
      status,
      changedAt: updated,
      changedBy: s.farm === 1 ? DEMO_FARMER_USER_ID : null,
    });
    if (s.qty && confirmed) {
      quantities.push({ productId: id, amount: s.qty[0], unit: s.qty[1], approximate: s.qty[2], lastConfirmedAt: confirmed });
    }
  }
  return { products, availability, history, quantities };
}
