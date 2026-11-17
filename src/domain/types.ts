// ---------- brands and scalars ----------
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
export function asId<T extends string>(value: string): T { return value as T; }

export type RegionId = Brand<string, 'RegionId'>;
export type CommunityId = Brand<string, 'CommunityId'>;
export type UserId = Brand<string, 'UserId'>;
export type FarmerProfileId = Brand<string, 'FarmerProfileId'>;
export type ProductTypeId = Brand<string, 'ProductTypeId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type FarmersMarketId = Brand<string, 'FarmersMarketId'>;
export type PickupLocationId = Brand<string, 'PickupLocationId'>;
export type FarmerPickupOptionId = Brand<string, 'FarmerPickupOptionId'>;
export type InquiryId = Brand<string, 'InquiryId'>;
export type InquiryReplyId = Brand<string, 'InquiryReplyId'>;
export type ClaimId = Brand<string, 'ClaimId'>;
export type EventId = Brand<string, 'EventId'>;

export type IsoDateTime = string; // 2026-11-15T14:03:00.000Z
export type IsoDate = string;     // 2026-11-15
export type YearMonth = string;   // 2027-06

export interface Coordinates { lat: number; lng: number }
export interface ImageRef { src: string; alt: string; width: number; height: number }
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
export interface OpeningHours { day: Weekday; opens: string; closes: string } // 'HH:mm', local time

// ---------- reference tables (wholly public: no private field exists on them) ----------
export interface Region { id: RegionId; slug: string; name: string; state: string }
export interface Community {
  id: CommunityId; regionId: RegionId; slug: string; name: string; county: string;
  kind: 'town' | 'county'; centre: Coordinates;
}

export type UserRole = 'farmer' | 'buyer' | 'administrator';
export interface User { id: UserId; displayName: string; createdAt: IsoDateTime }
export interface UserRoleAssignment { userId: UserId; role: UserRole }

// ---------- farmers ----------
export type PublicationStatus = 'draft' | 'published' | 'unpublished';
export type RegistrationStatus = 'pending_review' | 'approved' | 'rejected';
export type ConsentMethod = 'farmer_signed_in' | 'in_person' | 'by_phone' | 'signed_form';
export type ModerationStatus = 'visible' | 'hidden' | 'removed';

export interface FarmerProfile {
  id: FarmerProfileId;
  userId: UserId | null;            // null until the farmer has an account
  slug: string;
  farmName: string;
  farmerName: string;
  intro: string;
  story: string;
  photos: ImageRef[];
  regionId: RegionId;
  communityId: CommunityId;
  createdBy: UserId;
  createdByRole: 'farmer' | 'administrator';
  registrationStatus: RegistrationStatus;
  publicationStatus: PublicationStatus;
  consentMethod: ConsentMethod | null;
  consentDate: IsoDate | null;
  consentRecordedBy: UserId | null;
  farmerReviewedLatestChanges: boolean;
  reviewMethod: ConsentMethod | null;
  reviewDate: IsoDate | null;
  reviewRecordedBy: UserId | null;
  openToWholesale: boolean;
  showExactLocation: boolean;
  showPhone: boolean;
  showEmail: boolean;
  isDemo: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface FarmPublicLocation {
  farmerProfileId: FarmerProfileId; communityId: CommunityId;
  town: string; county: string; coarsePoint: Coordinates; // the community centre
}
/** PRIVATE. Never returned by a public method. */
export interface FarmPrivateLocation {
  farmerProfileId: FarmerProfileId; streetAddress: string; exactPoint: Coordinates;
}
/** PRIVATE. Copied into a public projection only when the farmer opted in. */
export interface FarmerPrivateContact {
  farmerProfileId: FarmerProfileId; phone: string | null; email: string | null;
}

// ---------- products ----------
export type ProductCategory =
  | 'vegetables' | 'fruits' | 'herbs' | 'eggs'
  | 'meat_poultry' | 'dairy' | 'grains_legumes' | 'other';

export type MeasureKind = 'weight' | 'volume' | 'count';
export type MeasureUnit =
  | 'lb' | 'oz'                              // weight
  | 'gallon' | 'quart' | 'pint' | 'fl_oz'    // volume
  | 'each' | 'dozen';                        // count
/** The label the farmer sells by. Display only; conversion uses unitSize. */
export type SellingUnit =
  | 'lb' | 'oz' | 'each' | 'dozen' | 'bunch' | 'basket' | 'box' | 'bag' | 'jar'
  | 'bottle' | 'carton' | 'flat' | 'pint' | 'quart' | 'half_gallon' | 'gallon'
  | 'bushel' | 'pack';
export interface UnitSize { amount: number; measure: MeasureUnit }
export interface NormalizedUnitPrice { cents: number; per: MeasureUnit }

export interface ProductType {
  id: ProductTypeId; slug: string; name: string;
  category: ProductCategory; comparisonUnit: MeasureUnit;
}

export interface Product {
  id: ProductId;
  farmerProfileId: FarmerProfileId;
  productTypeId: ProductTypeId;
  title: string;
  description: string;
  photo: ImageRef | null;
  priceCents: number;
  sellingUnit: SellingUnit;
  unitSize: UnitSize | null;                 // null for bunch, basket, unsized each
  normalizedUnitPriceCents: number | null;   // stored copy of normalizedUnitPrice().cents
  licenceSelfConfirmed: boolean | null;      // null when the category does not ask
  moderationStatus: ModerationStatus;
  isDemo: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type AvailabilityStatus = 'available_now' | 'coming_soon' | 'unconfirmed';
export interface ProductAvailability {
  productId: ProductId;
  status: AvailabilityStatus;                // stored status; show effectiveStatus()
  lastConfirmedAt: IsoDateTime | null;
  expectedMonth: YearMonth | null;           // required when status is coming_soon
  updatedAt: IsoDateTime;
}
export interface ProductAvailabilityHistoryEntry {
  id: EventId; productId: ProductId; status: AvailabilityStatus;
  changedAt: IsoDateTime; changedBy: UserId | null;
}
export interface ProductQuantity {
  productId: ProductId; amount: number; unit: SellingUnit;
  approximate: boolean; lastConfirmedAt: IsoDateTime;
}

// ---------- markets and pickup ----------
export interface FarmersMarket {
  id: FarmersMarketId; slug: string; name: string; communityId: CommunityId; town: string;
  point: Coordinates; venue: string; schedule: OpeningHours[]; seasonNote: string;
  contactPhone: string | null; contactEmail: string | null; directionsUrl: string;
  moderationStatus: ModerationStatus; isDemo: boolean;
}
export interface FarmerMarketLink { farmerProfileId: FarmerProfileId; marketId: FarmersMarketId }
export interface PickupLocation {
  id: PickupLocationId; slug: string; name: string; communityId: CommunityId; town: string;
  point: Coordinates; description: string; moderationStatus: ModerationStatus; isDemo: boolean;
}
export type PickupOptionKind = 'pickup_location' | 'farmers_market' | 'own_delivery';
export interface FarmerPickupOption {
  id: FarmerPickupOptionId; farmerProfileId: FarmerProfileId; kind: PickupOptionKind;
  pickupLocationId: PickupLocationId | null;  // set when kind is pickup_location
  marketId: FarmersMarketId | null;           // set when kind is farmers_market
  schedule: OpeningHours[];
  note: string;                               // e.g. delivery area, in the farmer's words
}

// ---------- inquiries ----------
export type InquiryStatus = 'awaiting_response' | 'responded' | 'closed';
export type InquiryClosedReason = 'unanswered' | 'outcome_recorded' | 'auto_after_response';
export type ReplyChannel = 'text' | 'email';
export interface Inquiry {
  id: InquiryId;
  statusToken: string;
  productId: ProductId | null;
  productTypeId: ProductTypeId | null;
  farmerProfileId: FarmerProfileId;
  communityId: CommunityId | null;            // the buyer's selected community
  pickupOptionId: FarmerPickupOptionId | null;
  chosenOptionKind: PickupOptionKind | null;  // copied so counts survive option edits
  pickupLocationId: PickupLocationId | null;
  marketId: FarmersMarketId | null;
  status: InquiryStatus;
  requestedQuantity: { amount: number; unit: SellingUnit } | null;
  replyChannel: ReplyChannel;
  createdAt: IsoDateTime;
  respondedAt: IsoDateTime | null;
  reminderSentAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
  closedReason: InquiryClosedReason | null;
}
/** PRIVATE. Deleted on schedule; the inquiry row stays. The free-text message lives here too. */
export interface InquiryBuyerContact {
  inquiryId: InquiryId; name: string; phone: string | null; email: string | null; message: string;
}
export type ReplyKind = 'available' | 'sold_out' | 'contact_me';
export interface InquiryReply {
  id: InquiryReplyId; inquiryId: InquiryId; kind: ReplyKind;
  message: string | null; phoneShared: boolean; createdAt: IsoDateTime;
}
export type OutcomeKind = 'sale' | 'new_potential_customer' | 'no' | 'still_discussing';
export interface InquiryOutcome { inquiryId: InquiryId; outcome: OutcomeKind; recordedAt: IsoDateTime }

// ---------- claims ----------
export type ClaimType = 'snap_ebt' | 'practice' | 'licence' | 'certification';
export interface ClaimVerification { evidenceChecked: string; verifiedOn: IsoDate; verifiedBy: UserId }
interface ClaimBase {
  id: ClaimId; farmerProfileId: FarmerProfileId; type: ClaimType; label: string; createdAt: IsoDateTime;
}
export type Claim =
  | (ClaimBase & { status: 'farmer_reported'; verification: null })
  | (ClaimBase & { status: 'verified'; verification: ClaimVerification });

// ---------- anonymous events ----------
export interface SearchFilters {
  category?: ProductCategory; productTypeId?: ProductTypeId; availability?: AvailabilityStatus;
  maxPriceCents?: number; fulfilment?: 'pickup' | 'delivery'; snapEbt?: boolean;
  sort?: 'unit_price' | 'distance' | 'recently_updated';
}
/** No person, session, device or address field exists on this type, by design. */
export interface SearchEvent {
  id: EventId; day: IsoDate; terms: string; matchedProductTypeId: ProductTypeId | null;
  filters: SearchFilters; communityId: CommunityId | null; resultCount: number;
}
export interface PreviewEvent {
  id: EventId; day: IsoDate;
  targetKind: 'pickup_location' | 'farmers_market' | 'farm' | 'product';
  targetId: string;
  surface: 'map' | 'list' | 'card' | 'profile' | 'inquiry';
  count: number;
}
export type AggregateMetric = 'searches' | 'zero_result_searches' | 'inquiries' | 'preview_opens';
export interface AggregateCount {
  id: EventId; metric: AggregateMetric; periodStart: IsoDate; periodEnd: IsoDate;
  productTypeId: ProductTypeId | null; communityId: CommunityId | null;
  pickupLocationId: PickupLocationId | null; marketId: FarmersMarketId | null; count: number;
}

// ---------- settings ----------
export interface Settings {
  availabilityWindowDays: number;
  /** How many months ahead a farmer can set "Coming soon". */
  comingSoonHorizonMonths: number;
  /** How far back the farmer's own numbers look. */
  farmerNumbersWindowDays: number;
  inquiryReminderHours: number;
  inquiryAutoCloseDays: number;
  outcomePromptDays: number;
  searchEventRetentionDays: number;
  buyerContactRetentionDays: number;
  minimumSampleSize: number;
  searchTermMaxLength: number;
  inquiryRateLimitPerHour: number;
  inquiryMinFillSeconds: number;
  scheduledJobsIntervalMinutes: number;
}

// ---------- the whole data set ----------
export interface Database {
  regions: Region[];
  communities: Community[];
  users: User[];
  user_roles: UserRoleAssignment[];
  farmer_profiles: FarmerProfile[];
  farm_public_locations: FarmPublicLocation[];
  farm_private_locations: FarmPrivateLocation[];
  farmer_private_contacts: FarmerPrivateContact[];
  product_types: ProductType[];
  products: Product[];
  product_availability: ProductAvailability[];
  product_availability_history: ProductAvailabilityHistoryEntry[];
  product_quantities: ProductQuantity[];
  farmers_markets: FarmersMarket[];
  farmer_market_links: FarmerMarketLink[];
  pickup_locations: PickupLocation[];
  farmer_pickup_options: FarmerPickupOption[];
  inquiries: Inquiry[];
  inquiry_buyer_contacts: InquiryBuyerContact[];
  inquiry_replies: InquiryReply[];
  inquiry_outcomes: InquiryOutcome[];
  claims: Claim[];
  search_events: SearchEvent[];
  preview_events: PreviewEvent[];
  aggregate_counts: AggregateCount[];
  settings: Settings;
}
export type TableName = Exclude<keyof Database, 'settings'>;

// ---------- public projections: the only farm, product and market shapes a public method may return ----------
export interface PublicFarmLocation {
  communityId: CommunityId; town: string; county: string;
  point: Coordinates; precision: 'town_centre' | 'exact';
}
export interface PublicContact { phone: string | null; email: string | null }
export interface PublicClaim {
  id: ClaimId; type: ClaimType; label: string;
  status: 'farmer_reported' | 'verified'; verifiedOn: IsoDate | null;
}
export interface PublicPickupOption {
  id: FarmerPickupOptionId; kind: PickupOptionKind;
  name: string | null;                        // market or pickup location name; null for own delivery
  town: string | null;
  pickupLocationId: PickupLocationId | null; marketId: FarmersMarketId | null;
  schedule: OpeningHours[]; note: string;
}
export interface PublicFarmSummary {
  id: FarmerProfileId; slug: string; farmName: string; town: string; communityId: CommunityId;
}
export interface PublicFarm {
  id: FarmerProfileId; slug: string; farmName: string; farmerName: string;
  intro: string; story: string; photos: ImageRef[];
  location: PublicFarmLocation; contact: PublicContact;
  openToWholesale: boolean; claims: PublicClaim[];
  pickupOptions: PublicPickupOption[]; marketIds: FarmersMarketId[];
  isDemo: boolean;
}
export interface PublicProduct {
  id: ProductId; farm: PublicFarmSummary;
  productType: ProductType;
  title: string; description: string; photo: ImageRef | null;
  priceCents: number; sellingUnit: SellingUnit; unitSize: UnitSize | null;
  normalizedUnitPrice: NormalizedUnitPrice | null;
  availability: {
    status: AvailabilityStatus;               // effective, never the raw stored value
    lastConfirmedAt: IsoDateTime | null; expectedMonth: YearMonth | null; updatedAt: IsoDateTime;
  };
  quantity: { amount: number; unit: SellingUnit; approximate: boolean; lastConfirmedAt: IsoDateTime } | null;
  licenceSelfConfirmed: boolean | null;
  pickupOptions: PublicPickupOption[];
  isDemo: boolean;
}
export interface PublicMarket {
  id: FarmersMarketId; slug: string; name: string; communityId: CommunityId; town: string;
  point: Coordinates; venue: string; schedule: OpeningHours[]; seasonNote: string;
  contactPhone: string | null; contactEmail: string | null; directionsUrl: string;
  farms: PublicFarmSummary[]; isDemo: boolean;
}
export interface PublicPickupLocation {
  id: PickupLocationId; slug: string; name: string; communityId: CommunityId; town: string;
  point: Coordinates; description: string; isDemo: boolean;
}
export interface PublicCatalogue {
  farms: PublicFarm[]; products: PublicProduct[];
  markets: PublicMarket[]; pickupLocations: PublicPickupLocation[];
}
