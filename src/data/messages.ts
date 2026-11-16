import { copy } from '@/content/copy';
import type { InquiryBuyerContact, FarmerPrivateContact, Inquiry } from '@/domain/types';
import type { OutboundNotification } from './ports/notifications';

/**
 * Builds the notices an inquiry sends. Shared by the demo adapter and, later,
 * the live one, so the wording and the choice of channel are written once. The
 * words themselves are in src/content/copy.ts.
 */

/** The private status link. Absolute in a browser; a path where no origin is known. */
export function statusLink(token: string): string {
  const path = `/inquiry/${token}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path}`;
}

/** Text if the farmer gave a phone, otherwise email. Null when they gave neither. */
function farmerChannel(contact: Pick<FarmerPrivateContact, 'phone' | 'email'> | null): Pick<OutboundNotification, 'channel' | 'to'> | null {
  if (contact?.phone) return { channel: 'sms', to: contact.phone };
  if (contact?.email) return { channel: 'email', to: contact.email };
  return null;
}

/** The channel the buyer chose, with the detail they gave for it. */
function buyerChannel(
  inquiry: Pick<Inquiry, 'replyChannel'>,
  contact: Pick<InquiryBuyerContact, 'phone' | 'email'> | null,
): Pick<OutboundNotification, 'channel' | 'to'> | null {
  if (inquiry.replyChannel === 'text') return contact?.phone ? { channel: 'sms', to: contact.phone } : null;
  return contact?.email ? { channel: 'email', to: contact.email } : null;
}

export function farmerReceivedNotice(args: {
  inquiry: Inquiry;
  buyer: InquiryBuyerContact;
  farmer: FarmerPrivateContact | null;
  what: string | null;
}): OutboundNotification | null {
  const to = farmerChannel(args.farmer);
  if (!to) return null;
  return {
    ...to,
    template: 'inquiry_received',
    body: copy.notify.farmerReceived(args.buyer.name, args.what ?? copy.notify.aboutNothing),
    relatedInquiryId: args.inquiry.id,
  };
}

export function farmerReminderNotice(args: {
  inquiry: Inquiry;
  buyer: InquiryBuyerContact | null;
  farmer: FarmerPrivateContact | null;
  what: string | null;
}): OutboundNotification | null {
  const to = farmerChannel(args.farmer);
  if (!to) return null;
  return {
    ...to,
    template: 'inquiry_reminder',
    body: copy.notify.farmerReminder(args.buyer?.name ?? 'A buyer', args.what ?? copy.notify.aboutNothing),
    relatedInquiryId: args.inquiry.id,
  };
}

export function buyerConfirmationNotice(args: {
  inquiry: Inquiry;
  buyer: InquiryBuyerContact;
  farmName: string;
}): OutboundNotification | null {
  const to = buyerChannel(args.inquiry, args.buyer);
  if (!to) return null;
  return {
    ...to,
    template: 'inquiry_confirmation',
    body: copy.notify.buyerConfirmation(args.farmName, statusLink(args.inquiry.statusToken)),
    relatedInquiryId: args.inquiry.id,
  };
}

export function buyerClosedNotice(args: {
  inquiry: Inquiry;
  buyer: InquiryBuyerContact | null;
  farmName: string;
}): OutboundNotification | null {
  const to = buyerChannel(args.inquiry, args.buyer);
  if (!to) return null;
  return {
    ...to,
    template: 'inquiry_closed',
    body: copy.notify.buyerClosed(args.farmName, statusLink(args.inquiry.statusToken)),
    relatedInquiryId: args.inquiry.id,
  };
}
