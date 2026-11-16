import { describe, expect, it } from 'vitest';
import {
  asId,
  type Database,
  type FarmerProfileId,
  type Inquiry,
  type InquiryBuyerContact,
  type InquiryId,
  type CommunityId,
  type EventId,
  type ProductTypeId,
  type SearchEvent,
} from '../types';
import { isBuyerContactDue, isSearchEventDue, retentionStatus, rollUpSearchEvents, runScheduledJobs } from './index';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date('2026-11-15T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const settings = { inquiryReminderHours: 48, inquiryAutoCloseDays: 14, buyerContactRetentionDays: 30, searchEventRetentionDays: 90 };

const inquiry = (n: number, over: Partial<Inquiry>): Inquiry => ({
  id: asId<InquiryId>(`inq-${n}`), statusToken: `t${n}`, productId: null, productTypeId: null,
  farmerProfileId: asId<FarmerProfileId>('farm-01'), communityId: null, pickupOptionId: null, chosenOptionKind: null,
  pickupLocationId: null, marketId: null, status: 'awaiting_response', requestedQuantity: null, replyChannel: 'text',
  createdAt: ago(HOUR), respondedAt: null, reminderSentAt: null, closedAt: null, closedReason: null, ...over,
});
const contact = (n: number): InquiryBuyerContact => ({
  inquiryId: asId<InquiryId>(`inq-${n}`), name: `Buyer ${n}`, phone: '870-555-0100', email: null, message: '',
});
const world = (inquiries: Inquiry[], contacts = inquiries.map((_, i) => contact(i + 1))) =>
  ({ inquiries, inquiry_buyer_contacts: contacts, search_events: [], aggregate_counts: [] }) as unknown as Database;
const byId = (db: Database, n: number) => db.inquiries.find((i) => i.id === `inq-${n}`)!;

describe('runScheduledJobs', () => {
  it('changes nothing and returns the same object when nothing is due', () => {
    const db = world([inquiry(1, {})]);
    const result = runScheduledJobs(db, now, settings);
    expect(result.events).toEqual([]);
    expect(result.db).toBe(db);
  });

  it('STAT-3: sends one reminder at 48 hours and records it', () => {
    const db = world([inquiry(1, { createdAt: ago(49 * HOUR) })]);
    const first = runScheduledJobs(db, now, settings);
    expect(first.events).toEqual([{ kind: 'reminder', inquiryId: 'inq-1' }]);
    expect(byId(first.db, 1)).toMatchObject({ status: 'awaiting_response', reminderSentAt: now.toISOString() });
    const second = runScheduledJobs(first.db, now, settings);
    expect(second.events).toEqual([]);
  });

  it('STAT-3: never reminds about an inquiry that was answered or has had its reminder', () => {
    const db = world([
      inquiry(1, { createdAt: ago(60 * HOUR), status: 'responded', respondedAt: ago(10 * HOUR) }),
      inquiry(2, { createdAt: ago(60 * HOUR), reminderSentAt: ago(10 * HOUR) }),
    ]);
    expect(runScheduledJobs(db, now, settings).events).toEqual([]);
  });

  it('STAT-4: closes an unanswered inquiry at 14 days, dated to when it fell due', () => {
    const db = world([inquiry(1, { createdAt: ago(15 * DAY), reminderSentAt: ago(13 * DAY) })]);
    const result = runScheduledJobs(db, now, settings);
    expect(result.events).toEqual([{ kind: 'closed_unanswered', inquiryId: 'inq-1' }]);
    expect(byId(result.db, 1)).toMatchObject({
      status: 'closed', closedReason: 'unanswered', closedAt: new Date(now.getTime() - DAY).toISOString(),
    });
  });

  it('STAT-4: a long-neglected inquiry closes without a pointless reminder first', () => {
    const db = world([inquiry(1, { createdAt: ago(40 * DAY) })]);
    expect(runScheduledJobs(db, now, settings).events).toEqual([{ kind: 'closed_unanswered', inquiryId: 'inq-1' }]);
  });

  it('STAT-5: closes a responded inquiry 14 days after the reply', () => {
    const db = world([
      inquiry(1, { createdAt: ago(20 * DAY), status: 'responded', respondedAt: ago(15 * DAY) }),
      inquiry(2, { createdAt: ago(20 * DAY), status: 'responded', respondedAt: ago(13 * DAY) }),
    ]);
    const result = runScheduledJobs(db, now, settings);
    expect(result.events).toEqual([{ kind: 'closed_after_response', inquiryId: 'inq-1' }]);
    expect(byId(result.db, 1)).toMatchObject({ status: 'closed', closedReason: 'auto_after_response' });
    expect(byId(result.db, 2).status).toBe('responded');
  });

  it('DPRIV-2: deletes buyer contact 30 days after closing and keeps the inquiry', () => {
    const closed = (n: number, daysAgoClosed: number) =>
      inquiry(n, { createdAt: ago(60 * DAY), status: 'closed', closedAt: ago(daysAgoClosed * DAY), closedReason: 'unanswered' });
    const db = world([closed(1, 31), closed(2, 29), inquiry(3, {})]);
    const result = runScheduledJobs(db, now, settings);
    expect(result.events).toEqual([{ kind: 'buyer_contact_deleted', inquiryId: 'inq-1' }]);
    expect(result.db.inquiry_buyer_contacts.map((c) => c.inquiryId)).toEqual(['inq-2', 'inq-3']);
    expect(result.db.inquiries).toHaveLength(3);
    expect(runScheduledJobs(result.db, now, settings).events).toEqual([]);
  });

  it('a close and the deletion can land in one run when the app was closed a long time', () => {
    const db = world([inquiry(1, { createdAt: ago(100 * DAY) })]);
    const result = runScheduledJobs(db, now, settings);
    expect(result.events.map((e) => e.kind)).toEqual(['closed_unanswered', 'buyer_contact_deleted']);
    expect(result.db.inquiry_buyer_contacts).toEqual([]);
  });

  it('is idempotent at one instant', () => {
    const db = world([
      inquiry(1, { createdAt: ago(49 * HOUR) }),
      inquiry(2, { createdAt: ago(16 * DAY) }),
      inquiry(3, { createdAt: ago(100 * DAY) }),
    ]);
    const once = runScheduledJobs(db, now, settings);
    const twice = runScheduledJobs(once.db, now, settings);
    expect(twice.events).toEqual([]);
    expect(twice.db).toBe(once.db);
  });
});

describe('DPRIV-2 retention of raw search events', () => {
  const day = (n: number) => ago(n * DAY).slice(0, 10);
  const search = (n: number, ago: number, over: Partial<SearchEvent> = {}): SearchEvent => ({
    id: asId<EventId>(`s-${n}`), day: day(ago), terms: `term ${n}`, matchedProductTypeId: asId<ProductTypeId>('eggs'),
    filters: {}, communityId: asId<CommunityId>('helena'), resultCount: 3, ...over,
  });
  const withSearches = (events: SearchEvent[]) => ({ ...world([]), search_events: events }) as Database;

  it('treats an event as due only once it is older than the period', () => {
    expect(isSearchEventDue({ day: day(89) }, now, 90)).toBe(false);
    expect(isSearchEventDue({ day: day(91) }, now, 90)).toBe(true);
    expect(isBuyerContactDue({ status: 'closed', closedAt: ago(31 * DAY) }, now, 30)).toBe(true);
    expect(isBuyerContactDue({ status: 'awaiting_response', closedAt: null }, now, 30)).toBe(false);
  });

  it('counts old events into aggregates by month, product type and community, then deletes them', () => {
    const db = withSearches([search(1, 100), search(2, 100), search(3, 101, { resultCount: 0, matchedProductTypeId: null }), search(4, 5)]);
    const result = runScheduledJobs(db, now, settings);
    expect(result.events).toContainEqual({ kind: 'search_events_rolled_up', count: 3 });
    expect(result.db.search_events.map((e) => e.id)).toEqual(['s-4']);

    const total = (metric: string) =>
      result.db.aggregate_counts.filter((a) => a.metric === metric).reduce((sum, a) => sum + a.count, 0);
    expect(total('searches')).toBe(3);
    expect(total('zero_result_searches')).toBe(1);
    // An aggregate carries a count and where it belongs: no terms, no filters, no day.
    for (const a of result.db.aggregate_counts) {
      expect(Object.keys(a).sort()).toEqual(
        ['communityId', 'count', 'id', 'marketId', 'metric', 'periodEnd', 'periodStart', 'pickupLocationId', 'productTypeId'].sort(),
      );
      expect(a.periodStart <= a.periodEnd).toBe(true);
    }
  });

  it('adds to an existing aggregate of the same month rather than starting a second one, and is idempotent', () => {
    const first = runScheduledJobs(withSearches([search(1, 100), search(2, 100)]), now, settings);
    const again = rollUpSearchEvents({ search_events: [search(3, 100)], aggregate_counts: first.db.aggregate_counts }, now, 90);
    const rows = again.aggregate_counts.filter((a) => a.metric === 'searches');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(3);
    const twice = runScheduledJobs(first.db, now, settings);
    expect(twice.events).toEqual([]);
    expect(twice.db).toBe(first.db);
  });

  it('reports what is held and what is due without carrying any term or contact', () => {
    const db = {
      ...world([inquiry(1, { status: 'closed', closedAt: ago(40 * DAY) }), inquiry(2, { status: 'closed', closedAt: ago(2 * DAY) })]),
      search_events: [search(1, 100), search(2, 3)],
      aggregate_counts: [],
    } as unknown as Database;
    const status = retentionStatus(db, now, { searchEventRetentionDays: 90, buyerContactRetentionDays: 30 });
    expect(status).toEqual({
      searchEvents: { held: 2, due: 1, oldestDay: day(100) },
      buyerContacts: { held: 2, due: 1 },
      aggregates: 0,
    });
  });
});
