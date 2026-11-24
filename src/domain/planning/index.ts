import { buildPublicInstitutions, monthlyAmount, needActiveIn } from '../institutions';
import { distanceKm, kmToMiles } from '../geo';
import { buildPublicCatalogue } from '../privacy';
import type {
  CommunityId,
  Database,
  FarmerProfileId,
  InstitutionKind,
  MeasureUnit,
  ProductTypeId,
  Settings,
  YearMonth,
} from '../types';

/**
 * Planning help for a farmer: what people nearby are looking for, what
 * institutions plan to buy, and how the farmer's prices sit against other
 * listings of the same food. Plain numbers and plain sentences, not a model.
 * Search counts below the minimum sample size are not shown, so no single
 * visitor's searches can be picked out.
 */

export const PLANNING_RADIUS_MILES = 60;
const HORIZON_MONTHS = 6;

export interface PriceGuide {
  /** The farmer's own lowest unit price for this food, in cents per `per`. */
  yours: number | null;
  low: number;
  median: number;
  high: number;
  per: MeasureUnit;
  /** Other farms' comparable listings behind the range. */
  basis: number;
}

export interface DemandRow {
  productTypeId: ProductTypeId;
  name: string;
  unit: MeasureUnit;
  youList: boolean;
  /** Searches in the window that matched this food; null when below the minimum sample. */
  searches: number | null;
  /** Of those, searches that found nothing. */
  unmet: number | null;
  /** Institutions within the radius: summed monthly amount in each of the next months. */
  institutionByMonth: { month: YearMonth; amount: number }[];
  institutionBuyers: { label: string; kind: InstitutionKind; town: string; miles: number | null }[];
  seasonTotal: number;
  price: PriceGuide | null;
  /** Plain-language next steps, most useful first. */
  advice: string[];
  /** For ordering: higher is more worth the farmer's attention. */
  score: number;
}

export interface FarmerPlanning {
  windowDays: number;
  radiusMiles: number;
  months: YearMonth[];
  rows: DemandRow[];
  minimumSampleSize: number;
}

function monthsFrom(now: Date, n: number): YearMonth[] {
  const out: YearMonth[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < n; i += 1) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: YearMonth) => MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m;
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const UNIT_WORD: Record<MeasureUnit, string> = { lb: 'lb', oz: 'oz', gallon: 'gallon', quart: 'quart', pint: 'pint', fl_oz: 'fl oz', each: 'each', dozen: 'dozen' };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function buildFarmerPlanning(db: Database, farmId: FarmerProfileId, now: Date, settings: Settings): FarmerPlanning {
  const farm = db.farmer_profiles.find((f) => f.id === farmId);
  const months = monthsFrom(now, HORIZON_MONTHS);
  const windowDays = settings.farmerNumbersWindowDays;
  const empty: FarmerPlanning = { windowDays, radiusMiles: PLANNING_RADIUS_MILES, months, rows: [], minimumSampleSize: settings.minimumSampleSize };
  if (!farm) return empty;

  const centre = new Map<CommunityId, { lat: number; lng: number }>(db.communities.map((c) => [c.id, c.centre]));
  const home = centre.get(farm.communityId) ?? null;
  const milesTo = (id: CommunityId) => {
    const to = centre.get(id);
    return home && to ? Math.round(kmToMiles(distanceKm(home, to))) : null;
  };
  const near = (id: CommunityId) => {
    const m = milesTo(id);
    return m === null || m <= PLANNING_RADIUS_MILES;
  };

  const { products } = buildPublicCatalogue(db, now, settings);
  const ownTypes = new Set(db.products.filter((p) => p.farmerProfileId === farmId && p.moderationStatus === 'visible').map((p) => p.productTypeId));

  // Searches in the window, by matched food, from towns within the radius.
  const since = new Date(now.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const searches = new Map<string, { all: number; unmet: number }>();
  for (const e of db.search_events) {
    if (e.day < since || !e.matchedProductTypeId) continue;
    if (e.communityId && !near(e.communityId)) continue;
    const s = searches.get(e.matchedProductTypeId) ?? { all: 0, unmet: 0 };
    s.all += 1;
    if (e.resultCount === 0) s.unmet += 1;
    searches.set(e.matchedProductTypeId, s);
  }

  const institutions = buildPublicInstitutions(db).filter((i) => near(i.communityId));
  const typeIds = new Set<string>([
    ...ownTypes,
    ...searches.keys(),
    ...institutions.flatMap((i) => i.needs.filter((n) => months.some((m) => needActiveIn(n, m))).map((n) => n.productType.id)),
  ]);

  const min = settings.minimumSampleSize;
  const rows: DemandRow[] = [];
  for (const id of typeIds) {
    const type = db.product_types.find((t) => t.id === id);
    if (!type) continue;
    const youList = ownTypes.has(type.id);
    const s = searches.get(type.id) ?? { all: 0, unmet: 0 };
    const shownSearches = s.all >= min ? s.all : null;
    const shownUnmet = shownSearches !== null ? s.unmet : null;

    const needs = institutions.flatMap((i) => i.needs.filter((n) => n.productType.id === type.id));
    const institutionByMonth = months.map((month) => ({
      month,
      amount: Math.round(needs.filter((n) => needActiveIn(n, month)).reduce((sum, n) => sum + monthlyAmount(n), 0)),
    }));
    const seasonTotal = institutionByMonth.reduce((sum, m) => sum + m.amount, 0);
    const buyers = [...new Map(needs.map((n) => [n.institutionId, { label: n.buyerLabel, kind: n.kind, town: n.town, miles: milesTo(n.communityId) }])).values()];

    const comparable = products.filter((p) => p.productType.id === type.id && p.normalizedUnitPrice);
    const others = comparable.filter((p) => p.farm.id !== farmId).map((p) => p.normalizedUnitPrice!.cents);
    const mine = comparable.filter((p) => p.farm.id === farmId).map((p) => p.normalizedUnitPrice!.cents);
    const price: PriceGuide | null =
      others.length >= 2
        ? { yours: mine.length ? Math.min(...mine) : null, low: Math.min(...others), median: median(others), high: Math.max(...others), per: type.comparisonUnit, basis: others.length }
        : null;

    const unit = UNIT_WORD[type.comparisonUnit];
    const advice: string[] = [];
    const peak = institutionByMonth.reduce((a, b) => (b.amount > a.amount ? b : a), institutionByMonth[0]);
    if (seasonTotal > 0) {
      const active = institutionByMonth.filter((m) => m.amount > 0);
      const span = active.length > 1 ? `${monthName(active[0].month)} to ${monthName(active[active.length - 1].month)}` : monthName(active[0].month);
      advice.push(
        `${buyers.length === 1 ? 'One buyer near you plans' : `${buyers.length} buyers near you plan`} to buy about ${seasonTotal.toLocaleString('en-US')} ${unit} of ${type.name.toLowerCase()} from ${span}, most in ${monthName(peak.month)} (${peak.amount.toLocaleString('en-US')} ${unit}).`,
      );
      advice.push(
        youList
          ? `If you can grow more, plan a harvest for ${monthName(peak.month)} and tell these buyers early. Even part of the amount helps; Musoko splits big orders across farms.`
          : `You do not list ${type.name.toLowerCase()} yet. If it fits your land, it is a crop with buyers waiting.`,
      );
    }
    if (shownUnmet && shownUnmet > 0 && !youList) {
      advice.push(`${shownUnmet} searches for ${type.name.toLowerCase()} near you found nothing in the last ${windowDays} days.`);
    } else if (shownSearches !== null) {
      advice.push(`${shownSearches} searches for ${type.name.toLowerCase()} near you in the last ${windowDays} days.`);
    }
    if (price && price.yours !== null) {
      if (price.yours > price.high) advice.push(`Your price (${dollars(price.yours)} per ${unit}) is above every other listing (${dollars(price.low)} to ${dollars(price.high)}). Say what makes yours different, or check your unit size.`);
      else if (price.yours < price.low) advice.push(`Your price (${dollars(price.yours)} per ${unit}) is below every other listing (${dollars(price.low)} to ${dollars(price.high)}). You may have room to charge more.`);
      else advice.push(`Your price (${dollars(price.yours)} per ${unit}) sits inside the range on Musoko (${dollars(price.low)} to ${dollars(price.high)}, middle ${dollars(price.median)}).`);
    } else if (price && !youList && seasonTotal + (shownSearches ?? 0) > 0) {
      advice.push(`Listings on Musoko run ${dollars(price.low)} to ${dollars(price.high)} per ${unit}, middle ${dollars(price.median)}.`);
    }
    if (!advice.length) continue;

    rows.push({
      productTypeId: type.id, name: type.name, unit: type.comparisonUnit, youList,
      searches: shownSearches, unmet: shownUnmet, institutionByMonth, institutionBuyers: buyers, seasonTotal,
      price, advice,
      score: seasonTotal / 10 + (shownSearches ?? 0) * 2 + (shownUnmet ?? 0) * 3 + (youList ? 5 : 0),
    });
  }
  // The farmer's own foods first, then the biggest opportunities they do not grow yet.
  rows.sort((a, b) => Number(b.youList) - Number(a.youList) || b.score - a.score || a.name.localeCompare(b.name));
  return { ...empty, rows };
}
