import { describe, expect, it } from 'vitest';
import { asId, type Inquiry, type InquiryId } from '../types';
import { releasedFarmerPhone } from './lifecycle';
import {
  buildReply,
  canRecordOutcome,
  canReply,
  inquiryAfterRecordedOutcome,
  outcomePromptDue,
  replyInputSchema,
  type ReplyInput,
} from './replies';

const now = new Date('2026-11-16T12:00:00.000Z');
const DAY = 24 * 3_600_000;
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const inquiry = (over: Partial<Inquiry> = {}): Inquiry =>
  ({ id: asId<InquiryId>('inq-1'), status: 'awaiting_response', respondedAt: null, closedReason: null, ...over }) as Inquiry;

const parse = (input: ReplyInput) => {
  const r = replyInputSchema.safeParse(input);
  return r.success ? { ok: true as const, value: r.data } : { ok: false as const, codes: r.error.issues.map((i) => `${i.path.join('.')}:${i.message}`) };
};

describe('reply input (INQ-3)', () => {
  it('takes one tap for Available and Sold out, with no note', () => {
    expect(parse({ kind: 'available', message: '', confirmSharePhone: false }).ok).toBe(true);
    expect(parse({ kind: 'sold_out', message: '', confirmSharePhone: false }).ok).toBe(true);
  });
  it('keeps the note short', () => {
    expect(parse({ kind: 'available', message: 'x'.repeat(201), confirmSharePhone: false })).toMatchObject({ ok: false, codes: ['message:message_too_long'] });
  });
  it('refuses a note that carries a phone number, email or address', () => {
    for (const message of ['Call 870-555-0101', 'write me at odell@farm.example', 'Come to 412 Demo Road 7']) {
      expect(parse({ kind: 'available', message, confirmSharePhone: false })).toMatchObject({ ok: false, codes: ['message:message_has_contact'] });
    }
  });
});

describe('Contact me shares the phone with that buyer only after the farmer confirms (INQ-4)', () => {
  const values = (kind: ReplyInput['kind'], confirm: boolean) => {
    const r = parse({ kind, message: '', confirmSharePhone: confirm });
    if (!r.ok) throw new Error(r.codes.join());
    return r.value;
  };

  it('refuses Contact me without the confirmation', () => {
    expect(parse({ kind: 'contact_me', message: '', confirmSharePhone: false })).toMatchObject({ ok: false, codes: ['confirmSharePhone:confirm_required'] });
  });
  it('shares the phone once confirmed', () => {
    const built = buildReply({ id: 'r1', inquiry: inquiry(), values: values('contact_me', true), farmerPhone: '870-555-0101', now });
    expect(built).toMatchObject({ ok: true, reply: { kind: 'contact_me', phoneShared: true } });
    if (built.ok) expect(releasedFarmerPhone(built.reply, { phone: '870-555-0101' })).toBe('870-555-0101');
  });
  it('cannot share a phone the farmer has not got', () => {
    expect(buildReply({ id: 'r1', inquiry: inquiry(), values: values('contact_me', true), farmerPhone: null, now })).toEqual({
      ok: false,
      fields: { confirmSharePhone: 'phone_missing' },
    });
  });
  it('never shares on any other reply, even when the confirmation flag is sent', () => {
    for (const kind of ['available', 'sold_out'] as const) {
      const built = buildReply({ id: 'r1', inquiry: inquiry(), values: values(kind, true), farmerPhone: '870-555-0101', now });
      expect(built).toMatchObject({ ok: true, reply: { phoneShared: false } });
      if (built.ok) expect(releasedFarmerPhone(built.reply, { phone: '870-555-0101' })).toBeNull();
    }
  });
  it('stores an empty note as null', () => {
    const built = buildReply({ id: 'r1', inquiry: inquiry(), values: values('available', false), farmerPhone: null, now });
    expect(built).toMatchObject({ ok: true, reply: { message: null } });
  });
});

describe('who can still reply', () => {
  it('an open inquiry can, a closed one cannot', () => {
    expect(canReply(inquiry({ status: 'awaiting_response' }))).toBe(true);
    expect(canReply(inquiry({ status: 'responded' }))).toBe(true);
    expect(canReply(inquiry({ status: 'closed' }))).toBe(false);
    const closed = buildReply({
      id: 'r', inquiry: inquiry({ status: 'closed' }), values: { kind: 'available', message: '', confirmSharePhone: false }, farmerPhone: null, now,
    });
    expect(closed).toEqual({ ok: false, fields: { form: 'reply_closed' } });
  });
});

describe('the outcome follow-up (OUT-1, OUT-2)', () => {
  const settings = { outcomePromptDays: 3 };
  const responded = (ms: number) => inquiry({ status: 'responded', respondedAt: ago(ms) });

  it('asks some days after the reply, on the configured number', () => {
    expect(outcomePromptDue(responded(2 * DAY), null, now, settings)).toBe(false);
    expect(outcomePromptDue(responded(3 * DAY), null, now, settings)).toBe(true);
    expect(outcomePromptDue(responded(2 * DAY), null, now, { outcomePromptDays: 1 })).toBe(true);
  });
  it('never asks about an unanswered or closed inquiry, or twice', () => {
    expect(outcomePromptDue(inquiry(), null, now, settings)).toBe(false);
    expect(outcomePromptDue({ ...responded(5 * DAY), status: 'closed' }, null, now, settings)).toBe(false);
    expect(outcomePromptDue(responded(5 * DAY), { outcome: 'sale' }, now, settings)).toBe(false);
  });
  it('closes a responded inquiry once an outcome is recorded (STAT-5)', () => {
    const after = inquiryAfterRecordedOutcome(responded(5 * DAY), 'sale', now);
    expect(after).toMatchObject({ status: 'closed', closedReason: 'outcome_recorded' });
  });
  it('keeps it open for "Still discussing"', () => {
    expect(inquiryAfterRecordedOutcome(responded(5 * DAY), 'still_discussing', now).status).toBe('responded');
  });
  it('takes an outcome on a responded inquiry, or one that closed itself after a reply', () => {
    expect(canRecordOutcome(responded(DAY), null)).toBe(true);
    expect(canRecordOutcome(inquiry({ status: 'closed', closedReason: 'auto_after_response' }), null)).toBe(true);
    expect(canRecordOutcome(inquiry({ status: 'closed', closedReason: 'unanswered' }), null)).toBe(false);
    expect(canRecordOutcome(inquiry(), null)).toBe(false);
  });
  it('lets "Still discussing" be changed later, and nothing else', () => {
    expect(canRecordOutcome(responded(DAY), { outcome: 'still_discussing' })).toBe(true);
    expect(canRecordOutcome(inquiry({ status: 'closed', closedReason: 'outcome_recorded' }), { outcome: 'sale' })).toBe(false);
  });
});
