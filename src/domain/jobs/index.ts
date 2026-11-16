import { autoCloseAt, closeInquiry, isAutoCloseDue, isReminderDue } from '../inquiry/lifecycle';
import type { Database, Inquiry, InquiryId, Settings } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type JobEvent =
  /** The one reminder to the farmer went due. The reminder is recorded as sent. */
  | { kind: 'reminder'; inquiryId: InquiryId }
  /** Closed with no reply. The buyer is told and pointed to alternatives. */
  | { kind: 'closed_unanswered'; inquiryId: InquiryId }
  /** A responded inquiry with no outcome closed after the period. */
  | { kind: 'closed_after_response'; inquiryId: InquiryId }
  /** The buyer's contact row was deleted a set period after closing. */
  | { kind: 'buyer_contact_deleted'; inquiryId: InquiryId };

export interface JobResult {
  db: Database;
  events: JobEvent[];
}

type JobSettings = Pick<
  Settings,
  'inquiryReminderHours' | 'inquiryAutoCloseDays' | 'buyerContactRetentionDays'
>;

/**
 * Everything that happens because time passed, as one pure function. Demo mode
 * runs it on app load and on a slow interval. Live mode runs the same rules as a
 * scheduled database function.
 *
 *  - STAT-3: an unanswered inquiry past the reminder period gets one reminder.
 *  - STAT-4: an unanswered inquiry past the auto-close period closes.
 *  - STAT-5: a responded inquiry with no outcome closes after the same period.
 *  - DPRIV-2: buyer contact details are deleted a set period after closing.
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
    inquiries
      .filter(
        (i) =>
          i.status === 'closed' &&
          i.closedAt !== null &&
          now.getTime() >= Date.parse(i.closedAt) + settings.buyerContactRetentionDays * DAY_MS,
      )
      .map((i) => i.id),
  );
  const contacts = db.inquiry_buyer_contacts.filter((c) => !expired.has(c.inquiryId));
  for (const removed of db.inquiry_buyer_contacts.filter((c) => expired.has(c.inquiryId))) {
    events.push({ kind: 'buyer_contact_deleted', inquiryId: removed.inquiryId });
  }

  if (events.length === 0) return { db, events };
  return { db: { ...db, inquiries, inquiry_buyer_contacts: contacts }, events };
}
