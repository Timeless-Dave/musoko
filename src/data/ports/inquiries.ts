import type { BuyerInquiryView, InquiryRecord, InquiryRequestInput, InquirySignals } from '@/domain/inquiry';
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
}
