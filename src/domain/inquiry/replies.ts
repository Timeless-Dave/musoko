import { z } from 'zod';
import { containsContactDetail } from '../search';
import type { Inquiry, InquiryId, InquiryOutcome, InquiryReply, InquiryReplyId, OutcomeKind, ReplyKind, Settings } from '../types';
import { asId } from '../types';
import { inquiryAfterOutcome } from './lifecycle';

const DAY_MS = 24 * 3_600_000;
export const REPLY_MESSAGE_MAX = 200;

export const REPLY_KINDS = ['available', 'sold_out', 'contact_me'] as const satisfies readonly ReplyKind[];
export const OUTCOME_KINDS = ['sale', 'new_potential_customer', 'no', 'still_discussing'] as const satisfies readonly OutcomeKind[];

export type ReplyFieldError = 'message_too_long' | 'message_has_contact' | 'confirm_required' | 'phone_missing' | 'reply_closed';

/**
 * A farmer's reply (INQ-3). Three one-tap kinds and an optional short note. The
 * note may not carry a phone number, email or address: the only way a number
 * reaches a buyer is "Contact me" after the farmer confirms (INQ-4).
 */
export const replyInputSchema = z
  .object({
    kind: z.enum(REPLY_KINDS),
    message: z.string().trim().max(REPLY_MESSAGE_MAX, 'message_too_long'),
    /** The farmer's own confirmation that this one buyer may see their phone. Only "Contact me" reads it. */
    confirmSharePhone: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.message && containsContactDetail(value.message)) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'message_has_contact' });
    }
    if (value.kind === 'contact_me' && !value.confirmSharePhone) {
      ctx.addIssue({ code: 'custom', path: ['confirmSharePhone'], message: 'confirm_required' });
    }
  });
export type ReplyInput = z.input<typeof replyInputSchema>;

export const outcomeInputSchema = z.object({ outcome: z.enum(OUTCOME_KINDS) });

/** A reply can be sent until the inquiry closes. */
export function canReply(inquiry: Pick<Inquiry, 'status'>): boolean {
  return inquiry.status !== 'closed';
}

export type BuiltReply = { ok: true; reply: InquiryReply } | { ok: false; fields: Record<string, ReplyFieldError> };

/**
 * Builds the stored reply. "Contact me" releases the phone only when the farmer
 * confirmed and has a phone on file; every other kind is stored with
 * `phoneShared` false whatever else was sent (INQ-4).
 */
export function buildReply(input: {
  id: InquiryReplyId | string;
  inquiry: Pick<Inquiry, 'id' | 'status'>;
  values: z.output<typeof replyInputSchema>;
  farmerPhone: string | null;
  now: Date;
}): BuiltReply {
  const { values, inquiry } = input;
  if (!canReply(inquiry)) return { ok: false, fields: { form: 'reply_closed' } };
  const share = values.kind === 'contact_me' && values.confirmSharePhone;
  if (share && !input.farmerPhone) return { ok: false, fields: { confirmSharePhone: 'phone_missing' } };
  return {
    ok: true,
    reply: {
      id: asId<InquiryReplyId>(input.id),
      inquiryId: inquiry.id as InquiryId,
      kind: values.kind,
      message: values.message === '' ? null : values.message,
      phoneShared: share,
      createdAt: input.now.toISOString(),
    },
  };
}

// ---------------------------------------------------------------- outcome follow-up (OUT-1)

/**
 * Some days after the farmer answered, the dashboard asks once whether it led to
 * a sale or a new customer. Never for an unanswered inquiry, and never again once
 * an outcome is on record. Skipping costs nothing.
 */
export function outcomePromptDue(
  inquiry: Pick<Inquiry, 'status' | 'respondedAt'>,
  outcome: Pick<InquiryOutcome, 'outcome'> | null,
  now: Date,
  settings: Pick<Settings, 'outcomePromptDays'>,
): boolean {
  if (outcome !== null || inquiry.status !== 'responded' || inquiry.respondedAt === null) return false;
  return now.getTime() >= Date.parse(inquiry.respondedAt) + settings.outcomePromptDays * DAY_MS;
}

/**
 * An outcome may be recorded on a responded inquiry, or on one that closed by
 * itself after a reply and never got one. It may be changed while it is only
 * "still discussing". An unanswered inquiry cannot take one.
 */
export function canRecordOutcome(
  inquiry: Pick<Inquiry, 'status' | 'closedReason'>,
  existing: Pick<InquiryOutcome, 'outcome'> | null,
): boolean {
  if (existing !== null && existing.outcome !== 'still_discussing') return false;
  if (inquiry.status === 'responded') return true;
  return inquiry.status === 'closed' && inquiry.closedReason === 'auto_after_response';
}

/** STAT-5: an outcome closes a responded inquiry. "Still discussing" keeps it open. */
export function inquiryAfterRecordedOutcome(inquiry: Inquiry, outcome: OutcomeKind, now: Date): Inquiry {
  return outcome === 'still_discussing' ? inquiry : inquiryAfterOutcome(inquiry, now);
}
