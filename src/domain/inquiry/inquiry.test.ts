import { describe, expect, it } from 'vitest';
import {
  asId,
  type FarmerPickupOption,
  type FarmerProfileId,
  type Inquiry,
  type InquiryId,
  type Product,
  type ProductId,
  type ProductTypeId,
  type PublicProduct,
} from '../types';
import { checkInquiryAbuse, pruneAttempts } from './abuse';
import {
  autoCloseAt,
  buildInquiry,
  canTransition,
  closedAlternatives,
  closeInquiry,
  inquiryAfterOutcome,
  inquiryAfterReply,
  isAutoCloseDue,
  isReminderDue,
  releasedFarmerPhone,
  reminderDueAt,
} from './lifecycle';
import { compareRequestedToStated } from './quantity';
import { formatPhone, inquiryRequestSchema, phoneDigits, type InquiryRequestInput } from './schema';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date('2026-11-15T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const settings = {
  inquiryReminderHours: 48,
  inquiryAutoCloseDays: 14,
  inquiryRateLimitPerHour: 5,
  inquiryMinFillSeconds: 3,
};

const valid: InquiryRequestInput = {
  farmerProfileId: 'farm-01',
  productId: 'prod-001',
  pickupOptionId: 'option-01',
  communityId: 'helena-west-helena',
  requestedQuantity: { amount: 3, unit: 'bunch' },
  replyChannel: 'text',
  name: 'Renata Voss',
  phone: '(870) 555-0171',
  email: null,
  message: '',
};
const issues = (input: InquiryRequestInput) => {
  const result = inquiryRequestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
};

describe('inquiry request schema (INQ-1)', () => {
  it('accepts a complete text inquiry', () => {
    expect(issues(valid)).toEqual([]);
  });
  it('requires a name', () => {
    expect(issues({ ...valid, name: '   ' })).toContain('name:name_required');
  });
  it('asks for the phone when the answer comes by text, and for nothing else', () => {
    expect(issues({ ...valid, phone: null })).toEqual(['phone:phone_required']);
    expect(issues({ ...valid, phone: '555-01' })).toEqual(['phone:phone_invalid']);
  });
  it('asks for the email when the answer comes by email, and not for the phone', () => {
    const email = { ...valid, replyChannel: 'email' as const, phone: null };
    expect(issues(email)).toEqual(['email:email_required']);
    expect(issues({ ...email, email: 'no-at-sign' })).toEqual(['email:email_invalid']);
    expect(issues({ ...email, email: 'renata@buyers.example' })).toEqual([]);
  });
  it('rejects a quantity that is zero, negative or enormous, and accepts none at all', () => {
    expect(issues({ ...valid, requestedQuantity: { amount: 0, unit: 'bunch' } })).toContain('requestedQuantity.amount:quantity_invalid');
    expect(issues({ ...valid, requestedQuantity: { amount: -2, unit: 'bunch' } })).toContain('requestedQuantity.amount:quantity_invalid');
    expect(issues({ ...valid, requestedQuantity: { amount: 1e9, unit: 'bunch' } })).toContain('requestedQuantity.amount:quantity_invalid');
    expect(issues({ ...valid, requestedQuantity: null })).toEqual([]);
  });
  it('limits the note', () => {
    expect(issues({ ...valid, message: 'x'.repeat(501) })).toContain('message:message_too_long');
  });
  it('reads ten digits, or eleven with a leading 1, as a phone number', () => {
    expect(phoneDigits('870.555.0171')).toBe('8705550171');
    expect(phoneDigits('+1 870 555 0171')).toBe('8705550171');
    expect(phoneDigits('555-0171')).toBeNull();
    expect(formatPhone('(870) 555-0171')).toBe('870-555-0171');
  });
});

describe('abuse protection (INQ-6)', () => {
  const base = { honeypot: '', openedAt: ago(20_000), name: 'Renata', message: 'Hello', attempts: [] as string[] };
  it('lets an ordinary inquiry through', () => {
    expect(checkInquiryAbuse(base, now, settings)).toEqual({ ok: true });
  });
  it('stops a filled honeypot', () => {
    expect(checkInquiryAbuse({ ...base, honeypot: 'http://spam.example' }, now, settings)).toEqual({ ok: false, reason: 'honeypot' });
  });
  it('stops a form filled faster than the minimum, and one with no start time', () => {
    expect(checkInquiryAbuse({ ...base, openedAt: ago(1_000) }, now, settings)).toEqual({ ok: false, reason: 'too_fast' });
    expect(checkInquiryAbuse({ ...base, openedAt: 'not a date' }, now, settings)).toEqual({ ok: false, reason: 'too_fast' });
    expect(checkInquiryAbuse({ ...base, openedAt: new Date(now.getTime() + DAY).toISOString() }, now, settings)).toEqual({ ok: false, reason: 'too_fast' });
  });
  it('allows exactly the minimum fill time', () => {
    expect(checkInquiryAbuse({ ...base, openedAt: ago(3_000) }, now, settings)).toEqual({ ok: true });
  });
  it('stops link spam in the note or the name', () => {
    const spam = 'buy now http://a.example and https://b.example';
    expect(checkInquiryAbuse({ ...base, message: spam }, now, settings)).toEqual({ ok: false, reason: 'spam_content' });
    expect(checkInquiryAbuse({ ...base, name: 'www.cheap.example' }, now, settings)).toEqual({ ok: false, reason: 'spam_content' });
    expect(checkInquiryAbuse({ ...base, message: 'My list is at http://a.example' }, now, settings)).toEqual({ ok: true });
  });
  it('limits one session to the hourly number and says when it can try again', () => {
    const attempts = [50, 40, 30, 20, 10].map((m) => ago(m * 60_000));
    const verdict = checkInquiryAbuse({ ...base, attempts }, now, settings);
    expect(verdict).toEqual({ ok: false, reason: 'rate_limited', retryAt: new Date(now.getTime() - 50 * 60_000 + HOUR).toISOString() });
    expect(checkInquiryAbuse({ ...base, attempts: attempts.slice(1) }, now, settings)).toEqual({ ok: true });
  });
  it('stops counting attempts after an hour', () => {
    const attempts = [61, 62, 63, 64, 65].map((m) => ago(m * 60_000));
    expect(checkInquiryAbuse({ ...base, attempts }, now, settings)).toEqual({ ok: true });
    expect(pruneAttempts(attempts.map((at) => ({ at })), now)).toEqual([]);
  });
});

describe('requested quantity against the stated one (QTY-5)', () => {
  const bunch = { sellingUnit: 'bunch' as const, unitSize: null };
  const box = { sellingUnit: 'box' as const, unitSize: { amount: 5, measure: 'lb' as const } };
  it('flags more than the estimate in the same unit', () => {
    expect(compareRequestedToStated({ amount: 6, unit: 'bunch' }, { amount: 5, unit: 'bunch' }, bunch)).toBe('exceeds');
    expect(compareRequestedToStated({ amount: 5, unit: 'bunch' }, { amount: 5, unit: 'bunch' }, bunch)).toBe('within');
    expect(compareRequestedToStated({ amount: 2, unit: 'bunch' }, { amount: 5, unit: 'bunch' }, bunch)).toBe('within');
  });
  it('converts a box of known size into the unit the farmer stated', () => {
    expect(compareRequestedToStated({ amount: 5, unit: 'box' }, { amount: 20, unit: 'lb' }, box)).toBe('exceeds'); // 25 lb
    expect(compareRequestedToStated({ amount: 4, unit: 'box' }, { amount: 20, unit: 'lb' }, box)).toBe('within');
  });
  it('converts across weight and count units', () => {
    expect(compareRequestedToStated({ amount: 40, unit: 'oz' }, { amount: 2, unit: 'lb' }, { sellingUnit: 'lb', unitSize: null })).toBe('exceeds');
    expect(compareRequestedToStated({ amount: 12, unit: 'each' }, { amount: 1, unit: 'dozen' }, { sellingUnit: 'each', unitSize: null })).toBe('within');
    expect(compareRequestedToStated({ amount: 1, unit: 'gallon' }, { amount: 1, unit: 'half_gallon' }, { sellingUnit: 'gallon', unitSize: null })).toBe('exceeds');
  });
  it('says nothing when it cannot compare, or when no quantity was entered', () => {
    expect(compareRequestedToStated({ amount: 2, unit: 'bunch' }, { amount: 5, unit: 'lb' }, bunch)).toBe('not_comparable');
    expect(compareRequestedToStated({ amount: 2, unit: 'bunch' }, null, bunch)).toBe('not_stated');
    expect(compareRequestedToStated(null, { amount: 5, unit: 'bunch' }, bunch)).toBe('not_stated');
  });
});

const inquiry = (over: Partial<Inquiry> = {}): Inquiry => ({
  id: asId<InquiryId>('inq-x'), statusToken: 't', productId: null, productTypeId: null,
  farmerProfileId: asId<FarmerProfileId>('farm-01'), communityId: null, pickupOptionId: null, chosenOptionKind: null,
  pickupLocationId: null, marketId: null, status: 'awaiting_response', requestedQuantity: null, replyChannel: 'text',
  createdAt: ago(0), respondedAt: null, reminderSentAt: null, closedAt: null, closedReason: null, ...over,
});

describe('building an inquiry (INQ-2, DATA-3)', () => {
  it('stores the choice, copies the option kind, and keeps contact apart', () => {
    const product = { id: asId<ProductId>('prod-001'), productTypeId: asId<ProductTypeId>('ptype-collards') } as Product;
    const option = {
      id: 'option-01', kind: 'farmers_market', marketId: 'market-01', pickupLocationId: null,
    } as unknown as FarmerPickupOption;
    const request = inquiryRequestSchema.parse(valid);
    const { inquiry: built, contact } = buildInquiry({ id: asId<InquiryId>('inq-new'), statusToken: 'tok', now, request, product, option });
    expect(built).toMatchObject({
      status: 'awaiting_response', productId: 'prod-001', productTypeId: 'ptype-collards',
      pickupOptionId: 'option-01', chosenOptionKind: 'farmers_market', marketId: 'market-01',
      replyChannel: 'text', statusToken: 'tok', createdAt: now.toISOString(), reminderSentAt: null, closedAt: null,
    });
    expect(JSON.stringify(built)).not.toContain('Renata');
    expect(JSON.stringify(built)).not.toContain('555');
    expect(contact).toEqual({ inquiryId: 'inq-new', name: 'Renata Voss', phone: '870-555-0171', email: null, message: '' });
  });
});

describe('lifecycle (STAT-3 to STAT-5)', () => {
  const sent = (hoursAgo: number, over: Partial<Inquiry> = {}) => inquiry({ createdAt: ago(hoursAgo * HOUR), ...over });

  it('is due for its reminder at 48 hours and only once', () => {
    expect(isReminderDue(sent(47.9), now, settings)).toBe(false);
    expect(isReminderDue(sent(48), now, settings)).toBe(true);
    expect(isReminderDue(sent(60, { reminderSentAt: ago(HOUR) }), now, settings)).toBe(false);
    expect(isReminderDue(sent(60, { status: 'responded', respondedAt: ago(HOUR) }), now, settings)).toBe(false);
    expect(reminderDueAt(sent(0), settings).getTime()).toBe(now.getTime() + 48 * HOUR);
  });
  it('closes an unanswered inquiry 14 days after it was sent', () => {
    expect(isAutoCloseDue(sent(14 * 24 - 1), now, settings)).toBe(false);
    expect(isAutoCloseDue(sent(14 * 24), now, settings)).toBe(true);
  });
  it('closes a responded inquiry 14 days after the reply, not after the question', () => {
    const responded = sent(20 * 24, { status: 'responded', respondedAt: ago(13 * DAY) });
    expect(isAutoCloseDue(responded, now, settings)).toBe(false);
    expect(autoCloseAt(responded, settings)!.getTime()).toBe(now.getTime() + DAY);
    expect(isAutoCloseDue({ ...responded, respondedAt: ago(14 * DAY) }, now, settings)).toBe(true);
  });
  it('has no close time once closed', () => {
    expect(autoCloseAt(sent(500, { status: 'closed' }), settings)).toBeNull();
  });
  it('only moves forward', () => {
    expect(canTransition('awaiting_response', 'responded')).toBe(true);
    expect(canTransition('awaiting_response', 'closed')).toBe(true);
    expect(canTransition('responded', 'closed')).toBe(true);
    expect(canTransition('responded', 'awaiting_response')).toBe(false);
    expect(canTransition('closed', 'responded')).toBe(false);
    expect(canTransition('closed', 'closed')).toBe(false);
  });
  it('a first reply marks it responded; a later reply or a closed inquiry is unchanged', () => {
    const replied = inquiryAfterReply(inquiry(), now);
    expect(replied).toMatchObject({ status: 'responded', respondedAt: now.toISOString() });
    const later = new Date(now.getTime() + HOUR);
    expect(inquiryAfterReply(replied, later)).toBe(replied);
    const closed = closeInquiry(inquiry(), 'unanswered', now);
    expect(inquiryAfterReply(closed, later)).toBe(closed);
  });
  it('an outcome closes a responded inquiry and cannot be recorded on an unanswered one', () => {
    const responded = inquiry({ status: 'responded', respondedAt: ago(DAY) });
    expect(inquiryAfterOutcome(responded, now)).toMatchObject({ status: 'closed', closedReason: 'outcome_recorded', closedAt: now.toISOString() });
    const open = inquiry();
    expect(inquiryAfterOutcome(open, now)).toBe(open);
  });
});

describe('contact sharing (INQ-4)', () => {
  const contact = { phone: '870-555-0101' };
  it('releases the farmer phone only for a confirmed Contact me reply', () => {
    expect(releasedFarmerPhone({ kind: 'contact_me', phoneShared: true }, contact)).toBe('870-555-0101');
  });
  it('releases nothing for Contact me that the farmer has not confirmed, or for any other reply', () => {
    expect(releasedFarmerPhone({ kind: 'contact_me', phoneShared: false }, contact)).toBeNull();
    expect(releasedFarmerPhone({ kind: 'available', phoneShared: true }, contact)).toBeNull();
    expect(releasedFarmerPhone({ kind: 'sold_out', phoneShared: true }, contact)).toBeNull();
    expect(releasedFarmerPhone(null, contact)).toBeNull();
    expect(releasedFarmerPhone({ kind: 'contact_me', phoneShared: true }, null)).toBeNull();
  });
});

describe('alternatives for an unanswered inquiry (STAT-4)', () => {
  const listing = (id: string, over: { type?: string; status?: PublicProduct['availability']['status']; town?: string; at?: number } = {}) =>
    ({
      id, productType: { id: over.type ?? 'tomatoes' },
      farm: { communityId: over.town ?? 'pine-bluff' },
      availability: { status: over.status ?? 'available_now', lastConfirmedAt: ago((over.at ?? 1) * DAY), updatedAt: ago(DAY) },
    }) as unknown as PublicProduct;
  const asked = { productId: asId<ProductId>('p0'), productTypeId: asId<ProductTypeId>('tomatoes'), communityId: 'helena' as never };

  it('lists the same product type available now, never the one asked about', () => {
    const result = closedAlternatives(asked, [
      listing('p0'), listing('p1'), listing('p2', { type: 'eggs' }), listing('p3', { status: 'unconfirmed' }), listing('p4', { status: 'coming_soon' }),
    ]);
    expect(result.map((p) => p.id)).toEqual(['p1']);
  });
  it('puts the buyer’s own town first, then the most recently confirmed', () => {
    const result = closedAlternatives(asked, [
      listing('far-old', { at: 9 }), listing('far-new', { at: 1 }), listing('near-old', { town: 'helena', at: 8 }),
    ]);
    expect(result.map((p) => p.id)).toEqual(['near-old', 'far-new', 'far-old']);
  });
  it('is empty when the inquiry named no product, and is capped', () => {
    expect(closedAlternatives({ ...asked, productTypeId: null }, [listing('p1')])).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => listing(`p${i + 1}`));
    expect(closedAlternatives(asked, many)).toHaveLength(4);
  });
});
