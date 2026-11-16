import { describe, expect, it } from 'vitest';
import {
  asId,
  type AggregateCount,
  type ClaimId,
  type CommunityId,
  type Database,
  type EventId,
  type FarmerProfileId,
  type FarmersMarketId,
  type Inquiry,
  type InquiryId,
  type PickupLocationId,
  type ProductId,
  type ProductTypeId,
  type SearchEvent,
  type Settings,
  type UserId,
} from '../types';
import { runScheduledJobs } from '../jobs';
import { buildPilotMetrics, noResultSearches, suppress, type Suppressed } from './index';

const now = new Date('2026-11-16T12:00:00.000Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
const day = (days: number) => ago(days).slice(0, 10);
const settings: Settings = {
  availabilityWindowDays: 14, comingSoonHorizonMonths: 12, farmerNumbersWindowDays: 30, inquiryReminderHours: 48,
  inquiryAutoCloseDays: 14, outcomePromptDays: 3, searchEventRetentionDays: 90, buyerContactRetentionDays: 30,
  minimumSampleSize: 5, searchTermMaxLength: 60, inquiryRateLimitPerHour: 5, inquiryMinFillSeconds: 3,
  scheduledJobsIntervalMinutes: 5,
};

const big = asId<CommunityId>('big');
const small = asId<CommunityId>('small');
const eggs = asId<ProductTypeId>('eggs');
const honey = asId<ProductTypeId>('honey');
const market = asId<FarmersMarketId>('m1');
const lot = asId<PickupLocationId>('p1');
const admin = asId<UserId>('admin');

const farm = (n: number, community: CommunityId) => ({
  id: asId<FarmerProfileId>(`f${n}`), communityId: community, registrationStatus: 'approved', publicationStatus: 'published',
  consentMethod: 'in_person', consentDate: '2026-10-01', consentRecordedBy: admin,
});
const product = (n: number, farmN: number) => ({ id: asId<ProductId>(`p${n}`), farmerProfileId: asId<FarmerProfileId>(`f${farmN}`), moderationStatus: 'visible' });
const available = (n: number, confirmedDaysAgo: number) => ({
  productId: asId<ProductId>(`p${n}`), status: 'available_now', lastConfirmedAt: ago(confirmedDaysAgo), expectedMonth: null,
});
const claim = (n: number, farmN: number, type = 'snap_ebt') =>
  ({ id: asId<ClaimId>(`c${n}`), farmerProfileId: asId<FarmerProfileId>(`f${farmN}`), type, status: 'farmer_reported', verification: null });
const inquiry = (n: number, community: CommunityId | null, over: Partial<Inquiry> = {}): Inquiry =>
  ({
    id: asId<InquiryId>(`i${n}`), productTypeId: eggs, communityId: community, status: 'awaiting_response', createdAt: ago(5),
    respondedAt: null, closedReason: null, marketId: null, pickupLocationId: null, ...over,
  }) as Inquiry;
const search = (n: number, community: CommunityId | null, resultCount = 2, daysAgo = 3, terms = 'eggs'): SearchEvent => ({
  id: asId<EventId>(`s${n}`), day: day(daysAgo), terms, matchedProductTypeId: null, filters: {}, communityId: community, resultCount,
});

/** Big has six listed farms and plenty of activity. Small has one farm and a little. */
function world(over: Partial<Database> = {}): Database {
  const farms = [1, 2, 3, 4, 5, 6].map((n) => farm(n, big)).concat([farm(7, small)]);
  return {
    communities: [
      { id: big, name: 'Big Town' }, { id: small, name: 'Small Town' },
    ],
    users: [{ id: admin, displayName: 'Admin' }],
    farmer_profiles: farms,
    products: [1, 2, 3, 4, 5, 6, 7].map((n) => product(n, n)),
    product_availability: [available(1, 2), available(2, 20), available(3, 5), available(4, 1), available(5, 30), available(6, 9), available(7, 2)],
    claims: [claim(1, 1), claim(2, 2), claim(3, 3), claim(4, 7), claim(5, 1, 'practice')],
    product_types: [{ id: eggs, name: 'Eggs' }, { id: honey, name: 'Honey' }],
    farmers_markets: [{ id: market, name: 'Cherry Street Market', communityId: big }],
    pickup_locations: [{ id: lot, name: 'Church lot', communityId: small }],
    inquiries: [
      inquiry(1, big, { respondedAt: ago(4.5), status: 'responded', marketId: market }),
      inquiry(2, big, { respondedAt: ago(4), status: 'closed', closedReason: 'outcome_recorded', marketId: market }),
      inquiry(3, big, { status: 'closed', closedReason: 'unanswered', productTypeId: honey }),
      inquiry(4, big),
      inquiry(5, big, { productTypeId: honey, marketId: market }),
      inquiry(6, small, { pickupLocationId: lot }),
      inquiry(7, null),
    ],
    inquiry_buyer_contacts: [],
    inquiry_outcomes: [
      { inquiryId: asId<InquiryId>('i2'), outcome: 'sale', recordedAt: ago(3) },
      { inquiryId: asId<InquiryId>('i6'), outcome: 'no', recordedAt: ago(1) },
    ],
    search_events: [
      ...[1, 2, 3, 4, 5, 6].map((n) => search(n, big, n <= 2 ? 0 : 3)),
      search(7, small, 0, 2, 'goat milk'),
      search(8, small, 4),
      search(9, null, 0, 1, 'pears'),
    ],
    preview_events: [
      { id: asId<EventId>('v1'), day: day(2), targetKind: 'farmers_market', targetId: market, surface: 'map', count: 4 },
      { id: asId<EventId>('v2'), day: day(3), targetKind: 'farmers_market', targetId: market, surface: 'list', count: 2 },
    ],
    aggregate_counts: [],
    settings,
    ...over,
  } as unknown as Database;
}

const metrics = (db = world(), s: Settings = settings) => buildPilotMetrics(db, now, s);
const shown = <T,>(figure: Suppressed<T>): T => {
  if (!figure.shown) throw new Error('expected a figure, got "not enough data"');
  return figure.value;
};
const bigScope = (m: ReturnType<typeof metrics>) => m.communities.find((c) => c.communityId === big)!;
const smallScope = (m: ReturnType<typeof metrics>) => m.communities.find((c) => c.communityId === small)!;

describe('suppress (DPRIV-3)', () => {
  it('shows a figure only when its basis reaches the minimum, and then carries nothing else', () => {
    expect(suppress(3, 5, settings)).toEqual({ shown: true, value: 3 });
    expect(suppress(3, 4, settings)).toEqual({ shown: false, basis: 4, minimum: 5 });
    // The figure itself is not carried below the minimum, so nothing can print it by mistake.
    expect(JSON.stringify(suppress(3, 4, settings))).not.toContain('3,');
    expect('value' in suppress(3, 4, settings)).toBe(false);
  });
  it('can rest on a larger basis than the figure: three no-result searches out of many are shown', () => {
    expect(suppress(2, 40, settings).shown).toBe(true);
    expect(suppress(40, 2, settings).shown).toBe(false);
  });
});

describe('pilot metrics', () => {
  it('METRIC-1: inquiries sent, answered with the median reply time, and closed without a response', () => {
    const scope = bigScope(metrics());
    expect(shown(scope.inquiriesSent)).toBe(5);
    expect(shown(scope.inquiriesAnswered)).toBe(2);
    expect(shown(scope.closedWithoutResponse)).toBe(1);
    // Two answered: 0.5 and 1 day after being sent. The median is 18 hours.
    expect(scope.medianReplyHours.shown).toBe(false); // only two answered, below the minimum
    expect(shown(metrics(world(), { ...settings, minimumSampleSize: 2 }).communities.find((c) => c.communityId === big)!.medianReplyHours)).toBeCloseTo(18);
  });

  it('METRIC-2: outcomes are counted only when enough were recorded, and carry the counts together', () => {
    const m = metrics();
    expect(m.overall.outcomes.shown).toBe(false);
    const open = metrics(world(), { ...settings, minimumSampleSize: 2 });
    expect(shown(open.overall.outcomes)).toEqual({ recorded: 2, sale: 1, new_potential_customer: 0, no: 1, still_discussing: 0 });
  });

  it('METRIC-3: listings confirmed inside the window, and active farmers by community', () => {
    const m = metrics();
    // Big: farms 1, 3, 4, 6 are confirmed within 14 days (2, 5, 1, 9). Farms 2 and 5 lapsed (20 and 30 days).
    expect(shown(bigScope(m).listingsConfirmed)).toBe(4);
    expect(shown(bigScope(m).activeFarmers)).toBe(4);
    expect(shown(bigScope(m).farmsListed)).toBe(6);
    expect(shown(m.overall.farmsListed)).toBe(7);
  });

  it('METRIC-4: farms reporting SNAP/EBT are counted once each, and a practice claim is not SNAP/EBT', () => {
    expect(shown(bigScope(metrics()).snapEbtFarms)).toBe(3);
    expect(shown(metrics().overall.snapEbtFarms)).toBe(4);
  });

  it('METRIC-5: most-inquired products, most-chosen places, searches with no results', () => {
    const scope = bigScope(metrics());
    expect(shown(scope.mostInquiredProducts).map((p) => [p.name, p.count])).toEqual([['Eggs', 3], ['Honey', 2]]);
    expect(shown(scope.mostChosenPlaces)).toEqual([{ kind: 'farmers_market', id: 'm1', name: 'Cherry Street Market', count: 3 }]);
    expect(shown(scope.searches)).toBe(6);
    expect(shown(scope.searchesWithNoResults)).toBe(2);
    expect(shown(scope.mostOpenedPlaces)).toEqual([{ kind: 'farmers_market', id: 'm1', name: 'Cherry Street Market', count: 6 }]);
  });

  it('DPRIV-3: a community with too little data shows "not enough data" for every figure, outcomes and SNAP/EBT included', () => {
    const scope = smallScope(metrics());
    for (const [key, figure] of Object.entries(scope)) {
      if (key === 'communityId' || key === 'name') continue;
      expect(figure, key).toMatchObject({ shown: false });
    }
  });

  it('an inquiry with no community counts for the pilot and for no town', () => {
    const m = metrics();
    expect(shown(m.overall.inquiriesSent)).toBe(7);
    expect(m.communities.reduce((n, c) => n + (c.inquiriesSent.shown ? c.inquiriesSent.value : 0), 0)).toBe(5);
  });

  it('lists a community only when it has some activity', () => {
    const db = world();
    db.communities.push({ id: asId<CommunityId>('empty'), name: 'Quiet Town' } as Database['communities'][number]);
    expect(metrics(db).communities.map((c) => c.name)).toEqual(['Big Town', 'Small Town']);
  });

  it('lowering the minimum shows what was hidden, which is why it is a setting', () => {
    const m = metrics(world(), { ...settings, minimumSampleSize: 1 });
    expect(shown(smallScope(m).farmsListed)).toBe(1);
  });

  it('DPRIV-2: counts do not change when old search events are rolled into aggregates and deleted', () => {
    const old = [1, 2, 3, 4, 5, 6].map((n) => search(100 + n, big, n <= 2 ? 0 : 3, 120 + n));
    const db = world({ search_events: [...world().search_events, ...old] });
    const before = bigScope(metrics(db));
    const rolled = runScheduledJobs(db, now, settings);
    expect(rolled.db.search_events.length).toBe(db.search_events.length - 6);
    const after = bigScope(metrics(rolled.db));
    expect(shown(after.searches)).toBe(shown(before.searches));
    expect(shown(after.searchesWithNoResults)).toBe(shown(before.searchesWithNoResults));
    expect(shown(after.searches)).toBe(12);
  });

  it('counts aggregates that outlived their raw events', () => {
    const aggregates: AggregateCount[] = [
      { id: asId<EventId>('a1'), metric: 'searches', periodStart: '2026-05-01', periodEnd: '2026-05-31', productTypeId: eggs, communityId: small, pickupLocationId: null, marketId: null, count: 30 },
      { id: asId<EventId>('a2'), metric: 'zero_result_searches', periodStart: '2026-05-01', periodEnd: '2026-05-31', productTypeId: null, communityId: small, pickupLocationId: null, marketId: null, count: 6 },
    ];
    const scope = smallScope(metrics(world({ aggregate_counts: aggregates })));
    expect(shown(scope.searches)).toBe(32);
    expect(shown(scope.searchesWithNoResults)).toBe(7);
  });
});

describe('searches with no results (DATA-2)', () => {
  it('groups the raw terms by town, most repeated first', () => {
    const db = world({ search_events: [search(1, big, 0, 4, 'Catfish'), search(2, big, 0, 1, 'catfish'), search(3, small, 0, 2, 'goat milk'), search(4, big, 3)] });
    expect(noResultSearches(db)).toEqual([
      { terms: 'Catfish', communityId: big, communityName: 'Big Town', count: 2, lastDay: day(1) },
      { terms: 'goat milk', communityId: small, communityName: 'Small Town', count: 1, lastDay: day(2) },
    ]);
  });
});
