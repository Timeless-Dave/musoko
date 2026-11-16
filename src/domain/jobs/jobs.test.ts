import { describe, expect, it } from 'vitest';
import {
  asId,
  type Database,
  type FarmerProfileId,
  type Inquiry,
  type InquiryBuyerContact,
  type InquiryId,
} from '../types';
import { runScheduledJobs } from './index';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date('2026-11-15T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const settings = { inquiryReminderHours: 48, inquiryAutoCloseDays: 14, buyerContactRetentionDays: 30 };

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
  ({ inquiries, inquiry_buyer_contacts: contacts }) as unknown as Database;
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
