import { autoCloseAt, closeInquiry, isAutoCloseDue, isReminderDue } from '../inquiry/lifecycle';
import {
  asId,
  type AggregateCount,
  type AggregateMetric,
  type CommunityId,
  type Database,
  type EventId,
  type Inquiry,
  type InquiryId,
  type IsoDate,
  type ProductTypeId,
  type SearchEvent,
  type Settings,
} from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type JobEvent =
  /** The one reminder to the farmer went due. The reminder is recorded as sent. */
  | { kind: 'reminder'; inquiryId: InquiryId }
  /** Closed with no reply. The buyer is told and pointed to alternatives. */
  | { kind: 'closed_unanswered'; inquiryId: InquiryId }
  /** A responded inquiry with no outcome closed after the period. */
  | { kind: 'closed_after_response'; inquiryId: InquiryId }
  /** The buyer's contact row was deleted a set period after closing. */
  | { kind: 'buyer_contact_deleted'; inquiryId: InquiryId }
  /** DPRIV-2: raw search events older than the retention period were counted into the aggregates and deleted. */
  | { kind: 'search_events_rolled_up'; count: number };

export interface JobResult {
  db: Database;
  events: JobEvent[];
}

type JobSettings = Pick<
  Settings,
  'inquiryReminderHours' | 'inquiryAutoCloseDays' | 'buyerContactRetentionDays' | 'searchEventRetentionDays'
>;

// ---------------------------------------------------------------- retention

/** True when a raw search event is older than the retention period. The day is the event's whole timestamp. */
export function isSearchEventDue(event: Pick<SearchEvent, 'day'>, now: Date, retentionDays: number): boolean {
  return now.getTime() - Date.parse(event.day) >= retentionDays * DAY_MS;
}

/** True when a closed inquiry has outlived the buyer contact retention period. */
export function isBuyerContactDue(inquiry: Pick<Inquiry, 'status' | 'closedAt'>, now: Date, retentionDays: number): boolean {
  return inquiry.status === 'closed' && inquiry.closedAt !== null && now.getTime() >= Date.parse(inquiry.closedAt) + retentionDays * DAY_MS;
}

function monthBounds(day: IsoDate): { start: IsoDate; end: IsoDate } {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

/**
 * DPRIV-2. Raw search events past the retention period are added to the
 * aggregate counts (by month, product type and community) and then deleted.
 * An aggregate has no terms, no filters and no day: only a count, so it can
 * be kept. Running it again changes nothing.
 */
export function rollUpSearchEvents(
  db: Pick<Database, 'search_events' | 'aggregate_counts'>,
  now: Date,
  retentionDays: number,
): { search_events: SearchEvent[]; aggregate_counts: AggregateCount[]; rolledUp: number } {
  const due = db.search_events.filter((e) => isSearchEventDue(e, now, retentionDays));
  if (due.length === 0) return { search_events: db.search_events, aggregate_counts: db.aggregate_counts, rolledUp: 0 };

  const rows = new Map<string, AggregateCount>(db.aggregate_counts.map((a) => [a.id, a]));
  const add = (metric: AggregateMetric, day: IsoDate, productTypeId: ProductTypeId | null, communityId: CommunityId | null) => {
    const { start, end } = monthBounds(day);
    const id = asId<EventId>(`aggregate-${metric}-${start}-${productTypeId ?? 'any'}-${communityId ?? 'any'}`);
    const existing = rows.get(id);
    rows.set(
      id,
      existing
        ? { ...existing, count: existing.count + 1 }
        : { id, metric, periodStart: start, periodEnd: end, productTypeId, communityId, pickupLocationId: null, marketId: null, count: 1 },
    );
  };
  for (const e of due) {
    add('searches', e.day, e.matchedProductTypeId, e.communityId);
    if (e.resultCount === 0) add('zero_result_searches', e.day, e.matchedProductTypeId, e.communityId);
  }
  const dueIds = new Set(due.map((e) => e.id));
  return {
    search_events: db.search_events.filter((e) => !dueIds.has(e.id)),
    aggregate_counts: [...rows.values()],
    rolledUp: due.length,
  };
}

/** What retention holds now and what it will clear next. Counts only: it shows no search term or contact. */
export interface RetentionStatus {
  searchEvents: { held: number; due: number; oldestDay: IsoDate | null };
  buyerContacts: { held: number; due: number };
  aggregates: number;
}

export function retentionStatus(
  db: Pick<Database, 'search_events' | 'aggregate_counts' | 'inquiries' | 'inquiry_buyer_contacts'>,
  now: Date,
  settings: Pick<Settings, 'searchEventRetentionDays' | 'buyerContactRetentionDays'>,
): RetentionStatus {
  const dueInquiries = new Set(
    db.inquiries.filter((i) => isBuyerContactDue(i, now, settings.buyerContactRetentionDays)).map((i) => i.id),
  );
  const days = db.search_events.map((e) => e.day).sort();
  return {
    searchEvents: {
      held: db.search_events.length,
      due: db.search_events.filter((e) => isSearchEventDue(e, now, settings.searchEventRetentionDays)).length,
      oldestDay: days[0] ?? null,
    },
    buyerContacts: {
      held: db.inquiry_buyer_contacts.length,
      due: db.inquiry_buyer_contacts.filter((c) => dueInquiries.has(c.inquiryId)).length,
    },
    aggregates: db.aggregate_counts.length,
  };
}

/**
 * Everything that happens because time passed, as one pure function. Demo mode
 * runs it on app load and on a slow interval. Live mode runs the same rules as a
 * scheduled database function.
 *
 *  - STAT-3: an unanswered inquiry past the reminder period gets one reminder.
 *  - STAT-4: an unanswered inquiry past the auto-close period closes.
 *  - STAT-5: a responded inquiry with no outcome closes after the same period.
 *  - DPRIV-2: buyer contact details are deleted a set period after closing, and raw
 *    search events are reduced to aggregate counts and deleted after their period.
 *
 * It is idempotent: running it twice at one `now` changes nothing the second time.
 * Availability lapse (AVAIL-4) is not a stored change: `effectiveStatus` computes it on read.
 */
export function runScheduledJobs(db: Database, now: Date, settings: JobSettings): JobResult {
  const events: JobEvent[] = [];
  let inquiries: Inquiry[] = db.inquiries;

  inquiries = inquiries.map((inquiry) => {
    if (isAutoCloseDue(inquiry, now, settings)) {
      const at = autoCloseAt(inquiry, settings)!;
      const wasUnanswered = inquiry.status === 'awaiting_response';
      events.push({ kind: wasUnanswered ? 'closed_unanswered' : 'closed_after_response', inquiryId: inquiry.id });
      // Recorded at the moment it fell due, so a late run does not stretch the retention clock.
      return closeInquiry(inquiry, wasUnanswered ? 'unanswered' : 'auto_after_response', at);
    }
    if (isReminderDue(inquiry, now, settings)) {
      events.push({ kind: 'reminder', inquiryId: inquiry.id });
      return { ...inquiry, reminderSentAt: now.toISOString() };
    }
    return inquiry;
  });

  const expired = new Set(
    inquiries.filter((i) => isBuyerContactDue(i, now, settings.buyerContactRetentionDays)).map((i) => i.id),
  );
  const contacts = db.inquiry_buyer_contacts.filter((c) => !expired.has(c.inquiryId));
  for (const removed of db.inquiry_buyer_contacts.filter((c) => expired.has(c.inquiryId))) {
    events.push({ kind: 'buyer_contact_deleted', inquiryId: removed.inquiryId });
  }

  const rolled = rollUpSearchEvents(db, now, settings.searchEventRetentionDays);
  if (rolled.rolledUp > 0) events.push({ kind: 'search_events_rolled_up', count: rolled.rolledUp });

  if (events.length === 0) return { db, events };
  return {
    db: {
      ...db,
      inquiries,
      inquiry_buyer_contacts: contacts,
      search_events: rolled.search_events,
      aggregate_counts: rolled.aggregate_counts,
    },
    events,
  };
}
