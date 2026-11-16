import type { BuyerInquiryView, InquiryRecord, InquiryRequestInput, InquirySignals, ReplyInput } from '@/domain/inquiry';
import type { InquiryId, OutcomeKind } from '@/domain/types';
import type { Actor } from './auth';

export interface InquiryReceipt {
  /** The private link's token. Whoever holds it can see that one inquiry's status. */
  statusToken: string;
}

/**
 * The inquiry side of the gateway. Buyers are not signed in, so the buyer
 * methods take no actor: the inquiry's own status token is the only key.
 */
export interface InquiryGateway {
  /**
   * Validates, runs the abuse checks, stores the inquiry and the buyer's contact
   * in their separate tables, then sends the farmer a notice and the buyer a
   * confirmation through the notification port. Resolves only after the inquiry
   * is stored. A notification that fails to send does not undo the inquiry.
   *
   * Rejects with GatewayError: `invalid` (fields in `detail.fields`), `not_found`
   * (the farm, product or option is no longer listed), `rate_limited`, `spam_suspected`.
   */
  submitInquiry(request: InquiryRequestInput, signals: InquirySignals): Promise<InquiryReceipt>;

  /**
   * The buyer's private status page. Null for an unknown token. Carries no buyer
   * contact detail; carries the farmer's phone only for a confirmed "Contact me".
   */
  getBuyerInquiry(statusToken: string): Promise<BuyerInquiryView | null>;

  /**
   * Inquiries with the buyer's contact. A farmer gets only those sent to their own
   * farm; an administrator gets all; anyone else is refused (INQ-5, DPRIV-4).
   * Newest first.
   */
  listInquiriesForActor(actor: Actor): Promise<InquiryRecord[]>;

  /**
   * INQ-3. The farmer's one-tap reply to an inquiry sent to their own farm, with an
   * optional short note. Moves the inquiry to "responded" and tells the buyer by the
   * channel they chose, through the notification port. "Contact me" releases the
   * farmer's phone to that buyer's status page only when `confirmSharePhone` is true
   * and the farmer has a phone on file (INQ-4); no other reply does.
   *
   * Rejects with GatewayError: `forbidden`, `not_found`, `invalid` (`message`,
   * `confirmSharePhone`, or `form` when the inquiry is already closed).
   */
  replyToInquiry(actor: Actor, inquiryId: InquiryId, reply: ReplyInput): Promise<InquiryRecord>;

  /**
   * OUT-1, OUT-2. The farmer's answer to "Did this inquiry result in a sale or new
   * customer relationship?". No amount, no payment detail. Closes a responded
   * inquiry (STAT-5) unless the answer is "Still discussing".
   */
  recordInquiryOutcome(actor: Actor, inquiryId: InquiryId, outcome: OutcomeKind): Promise<InquiryRecord>;
}
