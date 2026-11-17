import { format, formatDistanceStrict } from 'date-fns';
import { copy } from '@/content/copy';
import type { OpeningHours, ProductCategory, PublicPickupOption, PublicProduct } from '@/domain/types';

export const CATEGORY_ORDER: ProductCategory[] = [
  'vegetables',
  'fruits',
  'herbs',
  'eggs',
  'meat_poultry',
  'dairy',
  'grains_legumes',
  'other',
];

/** One photograph stands for each category in the rail. */
export const CATEGORY_PHOTO: Record<ProductCategory, string> = {
  vegetables: '/images/produce/tomatoes.jpg',
  fruits: '/images/produce/peaches.jpg',
  herbs: '/images/produce/culinary-herbs.jpg',
  eggs: '/images/produce/eggs.jpg',
  meat_poultry: '/images/produce/whole-chicken.jpg',
  dairy: '/images/produce/milk.jpg',
  grains_legumes: '/images/produce/field-peas.jpg',
  other: '/images/produce/honey.jpg',
};

/** Extra photographs of the same listing type, when we have them. */
const TYPE_EXTRAS: Record<string, readonly string[]> = {
  eggs: ['/images/produce/eggs-carton.jpg', '/images/farms/hens-on-pasture.jpg'],
  honey: ['/images/farms/beehives.jpg'],
  milk: ['/images/farms/dairy-herd.jpg', '/images/produce/fresh-cheese.jpg'],
  'whole-chicken': ['/images/farms/hens-on-pasture.jpg'],
  'ground-beef': ['/images/farms/cattle-at-fence.jpg'],
  'culinary-herbs': ['/images/farms/kitchen-garden.jpg'],
};

export function listingPhotos(product: PublicProduct): { src: string; focus?: 'center' | 'left' | 'right' | 'top' }[] {
  const primary = product.photo?.src;
  if (!primary) return [];
  const extras = (TYPE_EXTRAS[product.productType.slug] ?? []).filter((src) => src !== primary);
  const seen = new Set<string>();
  const shots: { src: string; focus?: 'center' }[] = [];
  for (const src of [primary, ...extras]) {
    if (seen.has(src)) continue;
    seen.add(src);
    shots.push({ src, focus: 'center' });
  }
  return shots;
}

export const STATUS_FILL = { available_now: 'full', coming_soon: 'half', unconfirmed: 'hollow' } as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return m ? `${twelve}:${String(m).padStart(2, '0')}${suffix}` : `${twelve}${suffix}`;
}

/** "Sat", "Tue and Sat". Short, for cards. */
export function scheduleDays(schedule: OpeningHours[]): string {
  const days = [...new Set(schedule.map((s) => s.day))].sort().map((d) => DAYS[d]);
  if (days.length <= 1) return days.join('');
  return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

/** "Saturday 8am to 12pm". Full, for lists. */
export function scheduleLines(schedule: OpeningHours[]): string[] {
  return [...schedule]
    .sort((a, b) => a.day - b.day)
    .map((s) => `${DAYS_LONG[s.day]} ${hour(s.opens)} to ${hour(s.closes)}`);
}

/** The one line a card gives to "where and when can I get it". */
export function pickupSummary(options: PublicPickupOption[]): string | null {
  const place = options.find((o) => o.kind !== 'own_delivery' && o.name);
  const delivers = options.some((o) => o.kind === 'own_delivery');
  if (place?.name) {
    const line = copy.product.pickupAt(place.name, scheduleDays(place.schedule));
    return delivers ? `${line}. ${copy.product.delivery}.` : line;
  }
  return delivers ? copy.product.delivery : null;
}

const UNIT_PLURAL: Record<string, string> = {
  lb: 'lb',
  oz: 'oz',
  each: '',
  dozen: 'dozen',
  bunch: 'bunches',
  basket: 'baskets',
  box: 'boxes',
  bag: 'bags',
  jar: 'jars',
  bottle: 'bottles',
  carton: 'cartons',
  flat: 'flats',
  pint: 'pints',
  quart: 'quarts',
  half_gallon: 'half gallons',
  gallon: 'gallons',
  bushel: 'bushels',
  pack: 'packs',
};

/** The plural label for a count of this unit: "bunches", "lb", "" for each. */
export function unitPlural(unit: string): string {
  return UNIT_PLURAL[unit] ?? unit;
}

/** "about 20 lb" or "3 dozen". Null when the farmer entered no quantity. */
export function statedAmount(product: PublicProduct): string | null {
  const q = product.quantity;
  if (!q) return null;
  const amount = `${q.amount} ${unitPlural(q.unit)}`.trim();
  return q.approximate ? `about ${amount}` : amount;
}

/** "About 20 lb available · confirmed 12 Nov". Null when the farmer entered no quantity. */
export function quantityLine(product: PublicProduct): string | null {
  const q = product.quantity;
  if (!q) return null;
  const amount = `${q.amount} ${UNIT_PLURAL[q.unit] ?? q.unit}`.trim();
  const stated = q.approximate ? copy.product.about(amount) : copy.product.exactly(amount);
  return `${stated} · ${copy.product.confirmed(format(new Date(q.lastConfirmedAt), 'd MMM'))}`;
}

/** "confirmed 3 days ago" or "expected June". */
export function statusDetail(product: PublicProduct, now: Date): string | null {
  const a = product.availability;
  if (a.status === 'coming_soon' && a.expectedMonth) {
    return copy.product.expected(format(new Date(`${a.expectedMonth}-01T12:00:00`), 'MMMM'));
  }
  if (a.status === 'available_now' && a.lastConfirmedAt) {
    return copy.product.confirmed(formatDistanceStrict(new Date(a.lastConfirmedAt), now, { addSuffix: true }));
  }
  return null;
}
