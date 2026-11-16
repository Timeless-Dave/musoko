import { isPubliclyVisible, toPublicPickupOption } from '../privacy';
import type {
  CommunityId,
  Database,
  FarmerPickupOption,
  FarmerPrivateContact,
  FarmerProfile,
  FarmerProfileId,
  Inquiry,
  InquiryBuyerContact,
  InquiryClosedReason,
  InquiryId,
  InquiryReply,
  Product,
  PublicProduct,
  Settings,
} from '../types';
import { asId } from '../types';
import { formatPhone, type InquiryRequest } from './schema';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------- creation

export type TargetProblem = 'farm_not_listed' | 'product_not_found' | 'option_not_found' | 'option_required';

export type ResolvedTargets =
  | { ok: true; farm: FarmerProfile; product: Product | null; option: FarmerPickupOption | null }
  | { ok: false; problem: TargetProblem };

/**
 * Checks that what the buyer wrote to still exists in public: a listed farm, one
 * of its visible products, one of its visible pickup options. DATA-3: when a
 * farm offers any pickup or delivery option, the buyer must have chosen one.
 */
export function resolveInquiryTargets(db: Database, request: InquiryRequest): ResolvedTargets {
  const farm = db.farmer_profiles.find((f) => f.id === request.farmerProfileId);
  if (!farm || !isPubliclyVisible(farm)) return { ok: false, problem: 'farm_not_listed' };

  let product: Product | null = null;
  if (request.productId !== null) {
    product = db.products.find((p) => p.id === request.productId) ?? null;
    if (!product || product.farmerProfileId !== farm.id || product.moderationStatus !== 'visible') {
      return { ok: false, problem: 'product_not_found' };
    }
  }

  const offered = db.farmer_pickup_options.filter((o) => o.farmerProfileId === farm.id).filter((option) => {
    const market = option.marketId ? db.farmers_markets.find((m) => m.id === option.marketId) ?? null : null;
    const place = option.pickupLocationId ? db.pickup_locations.find((l) => l.id === option.pickupLocationId) ?? null : null;
    return toPublicPickupOption({ option, market, pickupLocation: place }) !== null;
  });

  let option: FarmerPickupOption | null = null;
  if (request.pickupOptionId !== null) {
    option = offered.find((o) => o.id === request.pickupOptionId) ?? null;
    if (!option) return { ok: false, problem: 'option_not_found' };
  } else if (offered.length > 0) {
    return { ok: false, problem: 'option_required' };
  }
  return { ok: true, farm, product, option };
}

/** Builds the stored inquiry and its private contact row. Pure: the id, token and time come in. */
export function buildInquiry(input: {
  id: InquiryId;
  statusToken: string;
  now: Date;
  request: InquiryRequest;
  product: Product | null;
  option: FarmerPickupOption | null;
}): { inquiry: Inquiry; contact: InquiryBuyerContact } {
  const { request, product, option } = input;
  const inquiry: Inquiry = {
    id: input.id,
    statusToken: input.statusToken,
    productId: product?.id ?? null,
    productTypeId: product?.productTypeId ?? null,
    farmerProfileId: asId<FarmerProfileId>(request.farmerProfileId),
    communityId: request.communityId === null ? null : asId<CommunityId>(request.communityId),
    pickupOptionId: option?.id ?? null,
    chosenOptionKind: option?.kind ?? null,
    pickupLocationId: option?.pickupLocationId ?? null,
    marketId: option?.marketId ?? null,
    status: 'awaiting_response',
    requestedQuantity: request.requestedQuantity,
    replyChannel: request.replyChannel,
    createdAt: input.now.toISOString(),
    respondedAt: null,
    reminderSentAt: null,
    closedAt: null,
    closedReason: null,
  };
  const contact: InquiryBuyerContact = {
    inquiryId: input.id,
    name: request.name,
    phone: request.phone ? (formatPhone(request.phone) ?? request.phone) : null,
    email: request.email || null,
    message: request.message,
  };
  return { inquiry, contact };
}

// ---------------------------------------------------------------- deadlines

/** When the one reminder to the farmer is due. */
export function reminderDueAt(inquiry: Pick<Inquiry, 'createdAt'>, settings: Pick<Settings, 'inquiryReminderHours'>): Date {
  return new Date(Date.parse(inquiry.createdAt) + settings.inquiryReminderHours * HOUR_MS);
}

/**
 * When an open inquiry closes by itself. Unanswered: the auto-close period after
 * it was sent (STAT-4). Responded without an outcome: the same period after the
 * reply (STAT-5). Null once closed.
 */
export function autoCloseAt(
  inquiry: Pick<Inquiry, 'status' | 'createdAt' | 'respondedAt'>,
  settings: Pick<Settings, 'inquiryAutoCloseDays'>,
): Date | null {
  if (inquiry.status === 'closed') return null;
  const from = inquiry.status === 'responded' && inquiry.respondedAt ? inquiry.respondedAt : inquiry.createdAt;
  return new Date(Date.parse(from) + settings.inquiryAutoCloseDays * DAY_MS);
}

export function isReminderDue(inquiry: Inquiry, now: Date, settings: Pick<Settings, 'inquiryReminderHours'>): boolean {
  return (
    inquiry.status === 'awaiting_response' &&
    inquiry.reminderSentAt === null &&
    now.getTime() >= reminderDueAt(inquiry, settings).getTime()
  );
}

export function isAutoCloseDue(inquiry: Inquiry, now: Date, settings: Pick<Settings, 'inquiryAutoCloseDays'>): boolean {
  const at = autoCloseAt(inquiry, settings);
  return at !== null && now.getTime() >= at.getTime();
}

// ---------------------------------------------------------------- transitions

/** awaiting response, then responded, then closed. Nothing goes back. */
const ALLOWED: Record<Inquiry['status'], readonly Inquiry['status'][]> = {
  awaiting_response: ['responded', 'closed'],
  responded: ['closed'],
  closed: [],
};

export function canTransition(from: Inquiry['status'], to: Inquiry['status']): boolean {
  return ALLOWED[from].includes(to);
}

/** The first reply moves an awaiting inquiry to responded. A later reply or a closed inquiry is left as it is. */
export function inquiryAfterReply(inquiry: Inquiry, now: Date): Inquiry {
  if (!canTransition(inquiry.status, 'responded')) return inquiry;
  return { ...inquiry, status: 'responded', respondedAt: now.toISOString() };
}

/** Closes an open inquiry. Closing a closed one changes nothing. */
export function closeInquiry(inquiry: Inquiry, reason: InquiryClosedReason, at: Date): Inquiry {
  if (!canTransition(inquiry.status, 'closed')) return inquiry;
  return { ...inquiry, status: 'closed', closedAt: at.toISOString(), closedReason: reason };
}

/** STAT-5: recording an outcome closes a responded inquiry. An unanswered one cannot take an outcome. */
export function inquiryAfterOutcome(inquiry: Inquiry, now: Date): Inquiry {
  if (inquiry.status !== 'responded') return inquiry;
  return closeInquiry(inquiry, 'outcome_recorded', now);
}

// ---------------------------------------------------------------- contact sharing

/**
 * INQ-4. The farmer's phone goes to the buyer only for a "Contact me" reply the
 * farmer confirmed, and only onto that inquiry's own status page. Any other
 * reply returns null, whatever the farmer's public settings.
 */
export function releasedFarmerPhone(
  reply: Pick<InquiryReply, 'kind' | 'phoneShared'> | null,
  contact: Pick<FarmerPrivateContact, 'phone'> | null,
): string | null {
  if (!reply || reply.kind !== 'contact_me' || !reply.phoneShared) return null;
  return contact?.phone ?? null;
}

// ---------------------------------------------------------------- alternatives

/**
 * STAT-4. Other listings of the same product type that are available now,
 * nearest to the buyer's town first, then most recently confirmed.
 */
export function closedAlternatives(
  inquiry: Pick<Inquiry, 'productId' | 'productTypeId' | 'communityId'>,
  products: readonly PublicProduct[],
  limit = 4,
): PublicProduct[] {
  if (inquiry.productTypeId === null) return [];
  const sameTown = (p: PublicProduct) => (inquiry.communityId !== null && p.farm.communityId === inquiry.communityId ? 0 : 1);
  const confirmed = (p: PublicProduct) => Date.parse(p.availability.lastConfirmedAt ?? p.availability.updatedAt);
  return products
    .filter(
      (p) =>
        p.productType.id === inquiry.productTypeId &&
        p.id !== inquiry.productId &&
        p.availability.status === 'available_now',
    )
    .sort((a, b) => sameTown(a) - sameTown(b) || confirmed(b) - confirmed(a))
    .slice(0, limit);
}
