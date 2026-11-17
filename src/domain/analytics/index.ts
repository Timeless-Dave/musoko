import { effectiveStatus } from '../availability';
import { isPubliclyVisible } from '../privacy';
import type {
  AggregateCount,
  CommunityId,
  Database,
  Inquiry,
  IsoDate,
  OutcomeKind,
  ProductTypeId,
  Settings,
} from '../types';

/**
 * Pilot metrics (Section 4) and the one rule every analytics view goes through:
 * a figure that rests on fewer than the minimum number of farms, searches or
 * inquiries is not shown at all (DPRIV-3).
 */

export type Suppressed<T> =
  | { shown: true; value: T }
  /** "Not enough data". The basis is how many records stand behind it; the figure itself is not carried. */
  | { shown: false; basis: number; minimum: number };

/**
 * The single gate. `basis` is the number of farms, searches or inquiries the
 * figure rests on, which is not always the figure itself (a count of no-result
 * searches rests on all the searches). Below the minimum the value is dropped, so
 * nothing downstream can print it by mistake.
 */
export function suppress<T>(value: T, basis: number, settings: Pick<Settings, 'minimumSampleSize'>): Suppressed<T> {
  if (basis < settings.minimumSampleSize) return { shown: false, basis, minimum: settings.minimumSampleSize };
  return { shown: true, value };
}

export interface OutcomeCounts {
  recorded: number;
  sale: number;
  new_potential_customer: number;
  no: number;
  still_discussing: number;
}
export interface PlaceCount {
  kind: 'farmers_market' | 'pickup_location';
  id: string;
  name: string;
  count: number;
}
export interface ProductCount {
  productTypeId: ProductTypeId;
  name: string;
  count: number;
}

/** The figures for the whole pilot, or for one community. Every field has been through `suppress`. */
export interface ScopeMetrics {
  /** Null for the whole pilot. */
  communityId: CommunityId | null;
  name: string;

  // METRIC-3, METRIC-4: the farms. Basis: the listed farms in scope.
  farmsListed: Suppressed<number>;
  /** Listed farms with at least one listing confirmed inside the availability window. */
  activeFarmers: Suppressed<number>;
  /** Listings confirmed inside the availability window. */
  listingsConfirmed: Suppressed<number>;
  /** Farmer-reported. Never a count of farms Musoko checked. */
  snapEbtFarms: Suppressed<number>;

  // METRIC-5: searches. Basis: all searches in scope, raw events and the aggregates that replaced old ones.
  searches: Suppressed<number>;
  searchesWithNoResults: Suppressed<number>;

  // METRIC-1: inquiries. Basis: the inquiries sent in scope.
  inquiriesSent: Suppressed<number>;
  inquiriesAnswered: Suppressed<number>;
  /** Basis: the inquiries that were answered. */
  medianReplyHours: Suppressed<number | null>;
  closedWithoutResponse: Suppressed<number>;

  // METRIC-2: outcomes, all self-reported. Basis: the outcomes recorded.
  outcomes: Suppressed<OutcomeCounts>;

  // METRIC-5: most-inquired products and most-chosen places rest on the inquiries; most-opened places on the opens.
  mostInquiredProducts: Suppressed<ProductCount[]>;
  mostChosenPlaces: Suppressed<PlaceCount[]>;
  mostOpenedPlaces: Suppressed<PlaceCount[]>;
}

/** Anonymous discovery clicks from cards, profiles and contact (DATA-4). Not small-sample suppressed. */
export interface DiscoveryOpens {
  farmProfiles: number;
  farmCards: number;
  listingCards: number;
  contactClicks: number;
  placePreviews: number;
}

export function discoveryOpens(db: Database): DiscoveryOpens {
  const tally: DiscoveryOpens = {
    farmProfiles: 0,
    farmCards: 0,
    listingCards: 0,
    contactClicks: 0,
    placePreviews: 0,
  };
  for (const p of db.preview_events) {
    if (p.targetKind === 'farm' && p.surface === 'profile') tally.farmProfiles += p.count;
    else if (p.targetKind === 'farm' && p.surface === 'card') tally.farmCards += p.count;
    else if (p.targetKind === 'farm' && p.surface === 'inquiry') tally.contactClicks += p.count;
    else if (p.targetKind === 'product' && p.surface === 'card') tally.listingCards += p.count;
    else if (p.targetKind === 'product' && p.surface === 'inquiry') tally.contactClicks += p.count;
    else if (p.targetKind === 'farmers_market' || p.targetKind === 'pickup_location') tally.placePreviews += p.count;
  }
  return tally;
}

export interface PilotMetrics {
  /** The availability window the "confirmed" figures use, so the page can say it. */
  availabilityWindowDays: number;
  minimumSampleSize: number;
  discovery: DiscoveryOpens;
  overall: ScopeMetrics;
  /** Communities with any farm, search or inquiry, by name. */
  communities: ScopeMetrics[];
}

const HOUR_MS = 3_600_000;
const TOP = 5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function ranked<T extends { count: number; name: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, TOP);
}

function scopeMetrics(
  db: Database,
  now: Date,
  settings: Settings,
  communityId: CommunityId | null,
  name: string,
): ScopeMetrics {
  const inScope = (id: CommunityId | null) => communityId === null || id === communityId;

  // ---- farms
  const farms = db.farmer_profiles.filter((f) => isPubliclyVisible(f) && inScope(f.communityId));
  const farmIds = new Set(farms.map((f) => f.id));
  const confirmed = db.products.filter((p) => {
    if (!farmIds.has(p.farmerProfileId) || p.moderationStatus !== 'visible') return false;
    const availability = db.product_availability.find((a) => a.productId === p.id);
    return availability !== undefined && effectiveStatus(availability, now, settings) === 'available_now';
  });
  const activeFarmIds = new Set(confirmed.map((p) => p.farmerProfileId));
  const snapFarmIds = new Set(
    db.claims.filter((c) => c.type === 'snap_ebt' && farmIds.has(c.farmerProfileId)).map((c) => c.farmerProfileId),
  );

  // ---- searches: raw events plus the aggregates that replaced the old ones
  const aggregate = (metric: AggregateCount['metric']) =>
    db.aggregate_counts.filter((a) => a.metric === metric && inScope(a.communityId)).reduce((sum, a) => sum + a.count, 0);
  const rawSearches = db.search_events.filter((e) => inScope(e.communityId));
  const searches = rawSearches.length + aggregate('searches');
  const noResults = rawSearches.filter((e) => e.resultCount === 0).length + aggregate('zero_result_searches');

  // ---- inquiries
  const inquiries: Inquiry[] = db.inquiries.filter((i) => inScope(i.communityId));
  const answered = inquiries.filter((i) => i.respondedAt !== null);
  const closedUnanswered = inquiries.filter((i) => i.status === 'closed' && i.closedReason === 'unanswered');
  const outcomes = db.inquiry_outcomes.filter((o) => inquiries.some((i) => i.id === o.inquiryId));
  const outcomeCount = (kind: OutcomeKind) => outcomes.filter((o) => o.outcome === kind).length;

  const byType = new Map<ProductTypeId, number>();
  for (const i of inquiries) if (i.productTypeId) byType.set(i.productTypeId, (byType.get(i.productTypeId) ?? 0) + 1);
  const products: ProductCount[] = [...byType].map(([productTypeId, count]) => ({
    productTypeId,
    count,
    name: db.product_types.find((t) => t.id === productTypeId)?.name ?? '',
  }));

  // ---- places
  const marketName = (id: string) => db.farmers_markets.find((m) => m.id === id)?.name ?? '';
  const pickupName = (id: string) => db.pickup_locations.find((l) => l.id === id)?.name ?? '';
  const chosen = new Map<string, PlaceCount>();
  for (const i of inquiries) {
    const target =
      i.marketId !== null
        ? ({ kind: 'farmers_market', id: i.marketId, name: marketName(i.marketId) } as const)
        : i.pickupLocationId !== null
          ? ({ kind: 'pickup_location', id: i.pickupLocationId, name: pickupName(i.pickupLocationId) } as const)
          : null;
    if (!target) continue;
    const key = `${target.kind}:${target.id}`;
    chosen.set(key, { ...target, count: (chosen.get(key)?.count ?? 0) + 1 });
  }
  const placeCommunity = (kind: PlaceCount['kind'], id: string): CommunityId | null =>
    (kind === 'farmers_market'
      ? db.farmers_markets.find((m) => m.id === id)?.communityId
      : db.pickup_locations.find((l) => l.id === id)?.communityId) ?? null;
  const opened = new Map<string, PlaceCount>();
  const addOpen = (kind: PlaceCount['kind'], id: string, count: number) => {
    if (!inScope(placeCommunity(kind, id))) return;
    const key = `${kind}:${id}`;
    opened.set(key, {
      kind,
      id,
      name: kind === 'farmers_market' ? marketName(id) : pickupName(id),
      count: (opened.get(key)?.count ?? 0) + count,
    });
  };
  for (const p of db.preview_events) {
    if (p.targetKind === 'farmers_market' || p.targetKind === 'pickup_location') addOpen(p.targetKind, p.targetId, p.count);
  }
  for (const a of db.aggregate_counts) {
    if (a.metric !== 'preview_opens') continue;
    if (a.marketId !== null) addOpen('farmers_market', a.marketId, a.count);
    else if (a.pickupLocationId !== null) addOpen('pickup_location', a.pickupLocationId, a.count);
  }
  const totalOpens = [...opened.values()].reduce((sum, p) => sum + p.count, 0);

  const s = <T>(value: T, basis: number) => suppress(value, basis, settings);
  return {
    communityId,
    name,
    farmsListed: s(farms.length, farms.length),
    activeFarmers: s(activeFarmIds.size, farms.length),
    listingsConfirmed: s(confirmed.length, farms.length),
    snapEbtFarms: s(snapFarmIds.size, farms.length),
    searches: s(searches, searches),
    searchesWithNoResults: s(noResults, searches),
    inquiriesSent: s(inquiries.length, inquiries.length),
    inquiriesAnswered: s(answered.length, inquiries.length),
    medianReplyHours: s(
      median(answered.map((i) => (Date.parse(i.respondedAt!) - Date.parse(i.createdAt)) / HOUR_MS)),
      answered.length,
    ),
    closedWithoutResponse: s(closedUnanswered.length, inquiries.length),
    outcomes: s(
      {
        recorded: outcomes.length,
        sale: outcomeCount('sale'),
        new_potential_customer: outcomeCount('new_potential_customer'),
        no: outcomeCount('no'),
        still_discussing: outcomeCount('still_discussing'),
      },
      outcomes.length,
    ),
    mostInquiredProducts: s(ranked(products), inquiries.length),
    mostChosenPlaces: s(ranked([...chosen.values()]), inquiries.length),
    mostOpenedPlaces: s(ranked([...opened.values()]), totalOpens),
  };
}

/** METRIC-1 to METRIC-5 for the whole pilot and for each community that has any activity. */
export function buildPilotMetrics(db: Database, now: Date, settings: Settings): PilotMetrics {
  const active = new Set<CommunityId>();
  for (const f of db.farmer_profiles) if (isPubliclyVisible(f)) active.add(f.communityId);
  for (const e of db.search_events) if (e.communityId) active.add(e.communityId);
  for (const a of db.aggregate_counts) if (a.communityId && (a.metric === 'searches' || a.metric === 'zero_result_searches')) active.add(a.communityId);
  for (const i of db.inquiries) if (i.communityId) active.add(i.communityId);

  const communities = db.communities
    .filter((c) => active.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => scopeMetrics(db, now, settings, c.id, c.name));
  return {
    availabilityWindowDays: settings.availabilityWindowDays,
    minimumSampleSize: settings.minimumSampleSize,
    discovery: discoveryOpens(db),
    overall: scopeMetrics(db, now, settings, null, ''),
    communities,
  };
}

// ---------------------------------------------------------------- searches with no results (DATA-2)

export interface NoResultSearch {
  terms: string;
  communityId: CommunityId | null;
  communityName: string | null;
  count: number;
  lastDay: IsoDate;
}

/**
 * The terms people searched for and found nothing, most repeated first. These are
 * the raw search events, so they are for administrators only (DPRIV-4). They hold
 * no person: terms were scrubbed on the way in, and there is no identifier to group by.
 */
export function noResultSearches(db: Database): NoResultSearch[] {
  const groups = new Map<string, NoResultSearch>();
  for (const e of db.search_events) {
    if (e.resultCount !== 0 || e.terms.trim() === '') continue;
    const key = `${e.communityId ?? ''}|${e.terms.toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (e.day > existing.lastDay) existing.lastDay = e.day;
    } else {
      groups.set(key, {
        terms: e.terms,
        communityId: e.communityId,
        communityName: e.communityId ? (db.communities.find((c) => c.id === e.communityId)?.name ?? null) : null,
        count: 1,
        lastDay: e.day,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.lastDay.localeCompare(a.lastDay) || a.terms.localeCompare(b.terms));
}
