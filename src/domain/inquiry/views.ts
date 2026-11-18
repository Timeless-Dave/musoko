import { isPubliclyVisible } from '../privacy';
import type {
  Database,
  Inquiry,
  InquiryClosedReason,
  InquiryFolder,
  InquiryOutcome,
  InquiryReply,
  InquiryStatus,
  IsoDateTime,
  PickupOptionKind,
  PublicProduct,
  ReplyChannel,
  ReplyKind,
  SellingUnit,
} from '../types';
import { closedAlternatives, releasedFarmerPhone } from './lifecycle';

/**
 * What a buyer sees on the private status page. It carries no buyer contact
 * detail and no farm id or exact place. The farm's slug is present only while
 * the farm is publicly listed. The farmer's phone is present only when the
 * farmer confirmed a "Contact me" reply for this inquiry.
 */
export interface BuyerInquiryView {
  statusToken: string;
  status: InquiryStatus;
  closedReason: InquiryClosedReason | null;
  createdAt: IsoDateTime;
  respondedAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
  replyChannel: ReplyChannel;
  farm: { name: string; town: string; slug: string | null };
  product: { title: string; sellingUnit: SellingUnit } | null;
  productTypeName: string | null;
  requestedQuantity: { amount: number; unit: SellingUnit } | null;
  pickup: { kind: PickupOptionKind; name: string | null; town: string | null } | null;
  reply: { kind: ReplyKind; message: string | null; at: IsoDateTime; farmerPhone: string | null } | null;
  /** Filled only for an inquiry that closed without a reply. */
  alternatives: PublicProduct[];
  isDemo: boolean;
}

/** One inquiry as the farmer it was sent to, or an administrator, sees it. Buyer contact is null once retention has deleted it. */
export interface InquiryRecord {
  inquiry: Inquiry;
  buyer: { name: string; phone: string | null; email: string | null; message: string } | null;
  productTitle: string | null;
  productTypeName: string | null;
  farmName: string;
  pickupName: string | null;
  reply: InquiryReply | null;
  outcome: InquiryOutcome | null;
  /** The farmer's own filing: inbox, buyers or done. */
  folder: InquiryFolder;
}

function latestReply(db: Database, inquiry: Inquiry): InquiryReply | null {
  const replies = db.inquiry_replies.filter((r) => r.inquiryId === inquiry.id);
  return replies.reduce<InquiryReply | null>((a, r) => (a === null || r.createdAt > a.createdAt ? r : a), null);
}

function pickupName(db: Database, inquiry: Inquiry): { name: string | null; town: string | null } {
  if (inquiry.marketId) {
    const market = db.farmers_markets.find((m) => m.id === inquiry.marketId);
    return { name: market?.name ?? null, town: market?.town ?? null };
  }
  if (inquiry.pickupLocationId) {
    const place = db.pickup_locations.find((l) => l.id === inquiry.pickupLocationId);
    return { name: place?.name ?? null, town: place?.town ?? null };
  }
  return { name: null, town: null };
}

/** Null when the token matches no inquiry. `products` is the public catalogue's product list. */
export function toBuyerInquiryView(
  db: Database,
  token: string,
  products: readonly PublicProduct[],
): BuyerInquiryView | null {
  const inquiry = db.inquiries.find((i) => i.statusToken === token);
  if (!inquiry) return null;
  const farm = db.farmer_profiles.find((f) => f.id === inquiry.farmerProfileId);
  if (!farm) return null;
  const location = db.farm_public_locations.find((l) => l.farmerProfileId === farm.id);
  const product = inquiry.productId ? (db.products.find((p) => p.id === inquiry.productId) ?? null) : null;
  const type = inquiry.productTypeId ? (db.product_types.find((t) => t.id === inquiry.productTypeId) ?? null) : null;
  const reply = latestReply(db, inquiry);
  const farmerContact = db.farmer_private_contacts.find((c) => c.farmerProfileId === farm.id) ?? null;
  const place = pickupName(db, inquiry);

  return {
    statusToken: inquiry.statusToken,
    status: inquiry.status,
    closedReason: inquiry.closedReason,
    createdAt: inquiry.createdAt,
    respondedAt: inquiry.respondedAt,
    closedAt: inquiry.closedAt,
    replyChannel: inquiry.replyChannel,
    farm: { name: farm.farmName, town: location?.town ?? '', slug: isPubliclyVisible(farm) ? farm.slug : null },
    product: product ? { title: product.title, sellingUnit: product.sellingUnit } : null,
    productTypeName: type?.name ?? null,
    requestedQuantity: inquiry.requestedQuantity,
    pickup: inquiry.chosenOptionKind
      ? { kind: inquiry.chosenOptionKind, name: place.name, town: place.town }
      : null,
    reply: reply
      ? {
          kind: reply.kind,
          message: reply.message,
          at: reply.createdAt,
          farmerPhone: releasedFarmerPhone(reply, farmerContact),
        }
      : null,
    alternatives:
      inquiry.status === 'closed' && inquiry.closedReason === 'unanswered' ? closedAlternatives(inquiry, products) : [],
    isDemo: farm.isDemo,
  };
}

export function toInquiryRecord(db: Database, inquiry: Inquiry): InquiryRecord {
  const contact = db.inquiry_buyer_contacts.find((c) => c.inquiryId === inquiry.id) ?? null;
  const farm = db.farmer_profiles.find((f) => f.id === inquiry.farmerProfileId);
  const product = inquiry.productId ? db.products.find((p) => p.id === inquiry.productId) : undefined;
  const type = inquiry.productTypeId ? db.product_types.find((t) => t.id === inquiry.productTypeId) : undefined;
  return {
    inquiry,
    buyer: contact ? { name: contact.name, phone: contact.phone, email: contact.email, message: contact.message } : null,
    productTitle: product?.title ?? null,
    productTypeName: type?.name ?? null,
    farmName: farm?.farmName ?? '',
    pickupName: pickupName(db, inquiry).name,
    reply: latestReply(db, inquiry),
    outcome: db.inquiry_outcomes.find((o) => o.inquiryId === inquiry.id) ?? null,
    folder: (db.inquiry_folders ?? []).find((f) => f.inquiryId === inquiry.id)?.folder ?? 'inbox',
  };
}
