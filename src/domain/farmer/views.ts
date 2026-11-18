import { effectiveStatus } from '../availability';
import { profileState, type ProfileState } from '../consent';
import { toPublicPickupOption } from '../privacy';
import type {
  AvailabilityStatus,
  Claim,
  Database,
  FarmerProfile,
  FarmerProfileId,
  OutcomeKind,
  Product,
  ProductId,
  ProductAvailability,
  ProductQuantity,
  ProductType,
  PublicPickupOption,
  Settings,
} from '../types';

/**
 * The farmer's own view of their own farm. It carries the private contact and
 * street address, because they are the farmer's own; no public method returns it.
 */
export interface OwnFarm {
  profile: FarmerProfile;
  state: ProfileState;
  town: string;
  contact: { phone: string | null; email: string | null };
  streetAddress: string | null;
  claims: Claim[];
  pickupOptions: PublicPickupOption[];
}

export function toOwnFarm(db: Database, farmId: FarmerProfileId): OwnFarm | null {
  const profile = db.farmer_profiles.find((f) => f.id === farmId);
  if (!profile) return null;
  const contact = db.farmer_private_contacts.find((c) => c.farmerProfileId === farmId);
  const location = db.farm_public_locations.find((l) => l.farmerProfileId === farmId);
  const community = db.communities.find((c) => c.id === profile.communityId);
  const privateLocation = db.farm_private_locations.find((l) => l.farmerProfileId === farmId);
  return {
    profile,
    state: profileState(profile),
    town: location?.town ?? community?.name ?? '',
    contact: { phone: contact?.phone ?? null, email: contact?.email ?? null },
    streetAddress: privateLocation?.streetAddress ?? null,
    claims: db.claims.filter((c) => c.farmerProfileId === farmId),
    pickupOptions: db.farmer_pickup_options
      .filter((o) => o.farmerProfileId === farmId)
      .map((option) =>
        toPublicPickupOption({
          option,
          market: option.marketId ? (db.farmers_markets.find((m) => m.id === option.marketId) ?? null) : null,
          pickupLocation: option.pickupLocationId
            ? (db.pickup_locations.find((l) => l.id === option.pickupLocationId) ?? null)
            : null,
        }),
      )
      .filter((o): o is PublicPickupOption => o !== null),
  };
}

/** One of the farmer's own listings, with its stored status and the status buyers see. */
export interface OwnListing {
  product: Product;
  productType: ProductType;
  availability: ProductAvailability;
  /** What buyers see now: "Available now" lapses to "Availability unconfirmed" by itself. */
  status: AvailabilityStatus;
  quantity: ProductQuantity | null;
}

export function toOwnListings(db: Database, farmId: FarmerProfileId, now: Date): OwnListing[] {
  const listings: OwnListing[] = [];
  for (const product of db.products) {
    if (product.farmerProfileId !== farmId) continue;
    const productType = db.product_types.find((t) => t.id === product.productTypeId);
    const availability = db.product_availability.find((a) => a.productId === product.id);
    if (!productType || !availability) continue;
    listings.push({
      product,
      productType,
      availability,
      status: effectiveStatus(availability, now, db.settings),
      quantity: db.product_quantities.find((q) => q.productId === product.id) ?? null,
    });
  }
  // Needs a tap first: lapsed, then coming soon, then fresh; newest change first within each.
  const order: Record<AvailabilityStatus, number> = { unconfirmed: 0, coming_soon: 1, available_now: 2 };
  return listings.sort(
    (a, b) => order[a.status] - order[b.status] || Date.parse(b.availability.updatedAt) - Date.parse(a.availability.updatedAt),
  );
}

// ---------------------------------------------------------------- numbers

/** Counts about one farm's own activity. Not community figures: those go through small-sample suppression. */
export interface FarmerNumbers {
  windowDays: number;
  inquiries: { total: number; recent: number; awaiting: number; responded: number; closed: number; closedUnanswered: number };
  replies: { answered: number; medianHours: number | null };
  listings: { total: number; availableNow: number; comingSoon: number; unconfirmed: number };
  /** Anonymous opens of the farm profile and its listing cards, counted in the window. */
  views: { farmProfile: number; listingCards: number; contactClicks: number };
  outcomes: Record<OutcomeKind, number> & { recorded: number };
  /** The same figures for each of the farm's own listings, by product id. */
  byListing: Record<string, ListingNumbers>;
  /** One entry per day in the window, oldest first: anonymous views and inquiries received. */
  daily: DailyCount[];
}

export interface DailyCount {
  /** YYYY-MM-DD */
  day: string;
  views: number;
  inquiries: number;
}

/** One listing's figures. Views and contact taps are in the window; inquiries are in the window and in all. */
export interface ListingNumbers {
  views: number;
  contactTaps: number;
  inquiriesRecent: number;
  inquiriesTotal: number;
  awaiting: number;
  salesReported: number;
  daily: DailyCount[];
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function farmerNumbers(
  db: Database,
  farmId: FarmerProfileId,
  now: Date,
  settings: Pick<Settings, 'farmerNumbersWindowDays' | 'availabilityWindowDays'>,
): FarmerNumbers {
  const inquiries = db.inquiries.filter((i) => i.farmerProfileId === farmId);
  const since = now.getTime() - settings.farmerNumbersWindowDays * DAY_MS;
  const answered = inquiries.filter((i) => i.respondedAt !== null);
  const outcomes = db.inquiry_outcomes.filter((o) => inquiries.some((i) => i.id === o.inquiryId));
  const listings = toOwnListings(db, farmId, now).filter((l) => l.product.moderationStatus === 'visible');
  const count = (kind: OutcomeKind) => outcomes.filter((o) => o.outcome === kind).length;
  const productIds = new Set<ProductId>(listings.map((l) => l.product.id));
  const sinceDay = new Date(since).toISOString().slice(0, 10);
  const inWindow = (day: string) => day >= sinceDay;
  const previews = db.preview_events ?? [];
  const sumPreviews = (match: (e: (typeof previews)[number]) => boolean) =>
    previews.filter((e) => inWindow(e.day) && match(e)).reduce((n, e) => n + e.count, 0);
  const farmProfile = sumPreviews((e) => e.targetKind === 'farm' && e.targetId === farmId);
  const listingCards = sumPreviews(
    (e) => e.targetKind === 'product' && productIds.has(e.targetId as ProductId) && e.surface !== 'inquiry',
  );
  const contactClicks = sumPreviews(
    (e) =>
      (e.targetKind === 'product' && productIds.has(e.targetId as ProductId) && e.surface === 'inquiry') ||
      (e.targetKind === 'farm' && e.targetId === farmId && e.surface === 'inquiry'),
  );
  // Every day in the window, oldest first, so a quiet day shows as zero rather than going missing.
  const days = Array.from({ length: settings.farmerNumbersWindowDays }, (_, i) =>
    new Date(now.getTime() - (settings.farmerNumbersWindowDays - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
  const series = (isView: (e: (typeof previews)[number]) => boolean, isInquiry: (i: (typeof inquiries)[number]) => boolean): DailyCount[] =>
    days.map((day) => ({
      day,
      views: previews.filter((e) => e.day === day && isView(e)).reduce((n, e) => n + e.count, 0),
      inquiries: inquiries.filter((i) => i.createdAt.slice(0, 10) === day && isInquiry(i)).length,
    }));
  const isFarmView = (e: (typeof previews)[number]) =>
    e.surface !== 'inquiry' &&
    ((e.targetKind === 'farm' && e.targetId === farmId) || (e.targetKind === 'product' && productIds.has(e.targetId as ProductId)));

  return {
    windowDays: settings.farmerNumbersWindowDays,
    inquiries: {
      total: inquiries.length,
      recent: inquiries.filter((i) => Date.parse(i.createdAt) >= since).length,
      awaiting: inquiries.filter((i) => i.status === 'awaiting_response').length,
      responded: inquiries.filter((i) => i.status === 'responded').length,
      closed: inquiries.filter((i) => i.status === 'closed').length,
      closedUnanswered: inquiries.filter((i) => i.status === 'closed' && i.closedReason === 'unanswered').length,
    },
    replies: {
      answered: answered.length,
      medianHours: median(answered.map((i) => (Date.parse(i.respondedAt!) - Date.parse(i.createdAt)) / HOUR_MS)),
    },
    listings: {
      total: listings.length,
      availableNow: listings.filter((l) => l.status === 'available_now').length,
      comingSoon: listings.filter((l) => l.status === 'coming_soon').length,
      unconfirmed: listings.filter((l) => l.status === 'unconfirmed').length,
    },
    views: { farmProfile, listingCards, contactClicks },
    outcomes: {
      recorded: outcomes.length,
      sale: count('sale'),
      new_potential_customer: count('new_potential_customer'),
      no: count('no'),
      still_discussing: count('still_discussing'),
    },
    byListing: Object.fromEntries(
      listings.map((l) => {
        const id = l.product.id;
        const asked = inquiries.filter((i) => i.productId === id);
        const sales = outcomes.filter((o) => o.outcome === 'sale' && asked.some((i) => i.id === o.inquiryId)).length;
        const numbers: ListingNumbers = {
          views: sumPreviews((e) => e.targetKind === 'product' && e.targetId === id && e.surface !== 'inquiry'),
          contactTaps: sumPreviews((e) => e.targetKind === 'product' && e.targetId === id && e.surface === 'inquiry'),
          inquiriesRecent: asked.filter((i) => Date.parse(i.createdAt) >= since).length,
          inquiriesTotal: asked.length,
          awaiting: asked.filter((i) => i.status === 'awaiting_response').length,
          salesReported: sales,
          daily: series(
            (e) => e.targetKind === 'product' && e.targetId === id && e.surface !== 'inquiry',
            (i) => i.productId === id,
          ),
        };
        return [id, numbers];
      }),
    ),
    daily: series(isFarmView, () => true),
  };
}
