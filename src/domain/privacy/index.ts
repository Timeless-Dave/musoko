import { compareByAvailability, effectiveStatus } from '../availability';
import type {
  Claim,
  Database,
  FarmerPickupOption,
  FarmerPrivateContact,
  FarmerProfile,
  FarmersMarket,
  FarmersMarketId,
  FarmPrivateLocation,
  FarmPublicLocation,
  PickupLocation,
  Product,
  ProductAvailability,
  ProductQuantity,
  ProductType,
  PublicCatalogue,
  PublicClaim,
  PublicFarm,
  PublicFarmLocation,
  PublicFarmSummary,
  PublicMarket,
  PublicPickupLocation,
  PublicPickupOption,
  PublicProduct,
  Settings,
} from '../types';
import { normalizedUnitPrice } from '../units';

export function isPubliclyVisible(profile: FarmerProfile): boolean {
  return (
    // "Listed" is Musoko's review (TRUST-1): declining a profile takes it off the site whatever else is set.
    profile.registrationStatus === 'approved' &&
    profile.publicationStatus === 'published' &&
    profile.consentMethod !== null &&
    profile.consentDate !== null &&
    profile.consentRecordedBy !== null
  );
}

function toPublicClaim(claim: Claim): PublicClaim {
  return {
    id: claim.id,
    type: claim.type,
    label: claim.label,
    status: claim.status,
    verifiedOn: claim.status === 'verified' ? claim.verification.verifiedOn : null,
  };
}

export function toPublicFarm(input: {
  profile: FarmerProfile;
  publicLocation: FarmPublicLocation;
  privateLocation: FarmPrivateLocation | null;
  privateContact: FarmerPrivateContact | null;
  claims: Claim[];
  pickupOptions: PublicPickupOption[];
  marketIds: FarmersMarketId[];
}): PublicFarm | null {
  const { profile, publicLocation, privateLocation, privateContact } = input;
  if (!isPubliclyVisible(profile)) return null;

  const exact = profile.showExactLocation && privateLocation !== null;
  const location: PublicFarmLocation = {
    communityId: publicLocation.communityId,
    town: publicLocation.town,
    county: publicLocation.county,
    point: exact ? privateLocation.exactPoint : publicLocation.coarsePoint,
    precision: exact ? 'exact' : 'town_centre',
  };

  return {
    id: profile.id,
    slug: profile.slug,
    farmName: profile.farmName,
    farmerName: profile.farmerName,
    intro: profile.intro,
    story: profile.story,
    photos: profile.photos,
    location,
    contact: {
      phone: profile.showPhone ? (privateContact?.phone ?? null) : null,
      email: profile.showEmail ? (privateContact?.email ?? null) : null,
    },
    openToWholesale: profile.openToWholesale,
    claims: input.claims.map(toPublicClaim),
    pickupOptions: input.pickupOptions,
    marketIds: input.marketIds,
    isDemo: profile.isDemo,
  };
}

export function toPublicPickupOption(input: {
  option: FarmerPickupOption;
  market: FarmersMarket | null;
  pickupLocation: PickupLocation | null;
}): PublicPickupOption | null {
  const { option, market, pickupLocation } = input;
  let name: string | null = null;
  let town: string | null = null;

  if (option.kind === 'farmers_market') {
    if (market === null || market.moderationStatus !== 'visible') return null;
    name = market.name;
    town = market.town;
  } else if (option.kind === 'pickup_location') {
    if (pickupLocation === null || pickupLocation.moderationStatus !== 'visible') return null;
    name = pickupLocation.name;
    town = pickupLocation.town;
  }

  return {
    id: option.id,
    kind: option.kind,
    name,
    town,
    pickupLocationId: option.pickupLocationId,
    marketId: option.marketId,
    schedule: option.schedule,
    note: option.note,
  };
}

function toFarmSummary(farm: PublicFarm): PublicFarmSummary {
  return {
    id: farm.id,
    slug: farm.slug,
    farmName: farm.farmName,
    town: farm.location.town,
    communityId: farm.location.communityId,
  };
}

export function toPublicProduct(
  input: {
    product: Product;
    productType: ProductType;
    availability: ProductAvailability;
    quantity: ProductQuantity | null;
    farm: PublicFarm;
  },
  now: Date,
  settings: Settings,
): PublicProduct | null {
  const { product, productType, availability, quantity, farm } = input;
  if (product.moderationStatus !== 'visible') return null;

  return {
    id: product.id,
    farm: toFarmSummary(farm),
    productType,
    title: product.title,
    description: product.description,
    photo: product.photo,
    priceCents: product.priceCents,
    sellingUnit: product.sellingUnit,
    unitSize: product.unitSize,
    normalizedUnitPrice: normalizedUnitPrice(product, productType),
    availability: {
      status: effectiveStatus(availability, now, settings),
      lastConfirmedAt: availability.lastConfirmedAt,
      expectedMonth: availability.expectedMonth,
      updatedAt: availability.updatedAt,
    },
    quantity:
      quantity === null
        ? null
        : {
            amount: quantity.amount,
            unit: quantity.unit,
            approximate: quantity.approximate,
            lastConfirmedAt: quantity.lastConfirmedAt,
          },
    licenceSelfConfirmed: product.licenceSelfConfirmed,
    pickupOptions: farm.pickupOptions,
    isDemo: product.isDemo,
  };
}

export function toPublicMarket(market: FarmersMarket, farms: PublicFarm[]): PublicMarket | null {
  if (market.moderationStatus !== 'visible') return null;
  return {
    id: market.id,
    slug: market.slug,
    name: market.name,
    communityId: market.communityId,
    town: market.town,
    point: market.point,
    venue: market.venue,
    schedule: market.schedule,
    seasonNote: market.seasonNote,
    contactPhone: market.contactPhone,
    contactEmail: market.contactEmail,
    directionsUrl: market.directionsUrl,
    farms: farms.filter((f) => f.marketIds.includes(market.id)).map(toFarmSummary),
    isDemo: market.isDemo,
  };
}

export function toPublicPickupLocation(location: PickupLocation): PublicPickupLocation | null {
  if (location.moderationStatus !== 'visible') return null;
  return {
    id: location.id,
    slug: location.slug,
    name: location.name,
    communityId: location.communityId,
    town: location.town,
    point: location.point,
    description: location.description,
    isDemo: location.isDemo,
  };
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

export function buildPublicCatalogue(db: Database, now: Date, settings: Settings): PublicCatalogue {
  const marketById = new Map(db.farmers_markets.map((m) => [m.id, m]));
  const locationById = new Map(db.pickup_locations.map((l) => [l.id, l]));

  const farms: PublicFarm[] = db.farmer_profiles
    .map((profile) => {
      if (!isPubliclyVisible(profile)) return null;
      const publicLocation = db.farm_public_locations.find((l) => l.farmerProfileId === profile.id);
      if (publicLocation === undefined) return null;

      const pickupOptions = db.farmer_pickup_options
        .filter((o) => o.farmerProfileId === profile.id)
        .map((option) =>
          toPublicPickupOption({
            option,
            market: option.marketId === null ? null : (marketById.get(option.marketId) ?? null),
            pickupLocation:
              option.pickupLocationId === null ? null : (locationById.get(option.pickupLocationId) ?? null),
          }),
        )
        .filter(notNull);

      const marketIds = db.farmer_market_links
        .filter((l) => l.farmerProfileId === profile.id)
        .map((l) => l.marketId)
        .filter((id) => marketById.get(id)?.moderationStatus === 'visible');

      return toPublicFarm({
        profile,
        publicLocation,
        privateLocation: db.farm_private_locations.find((l) => l.farmerProfileId === profile.id) ?? null,
        privateContact: db.farmer_private_contacts.find((c) => c.farmerProfileId === profile.id) ?? null,
        claims: db.claims.filter((c) => c.farmerProfileId === profile.id),
        pickupOptions,
        marketIds,
      });
    })
    .filter(notNull);

  const farmById = new Map(farms.map((f) => [f.id, f]));
  const typeById = new Map(db.product_types.map((t) => [t.id, t]));
  const availabilityById = new Map(db.product_availability.map((a) => [a.productId, a]));
  const quantityById = new Map(db.product_quantities.map((q) => [q.productId, q]));

  const products = db.products
    .map((product) => {
      const farm = farmById.get(product.farmerProfileId);
      const productType = typeById.get(product.productTypeId);
      const availability = availabilityById.get(product.id);
      if (farm === undefined || productType === undefined || availability === undefined) return null;
      return toPublicProduct(
        { product, productType, availability, quantity: quantityById.get(product.id) ?? null, farm },
        now,
        settings,
      );
    })
    .filter(notNull)
    .sort(
      (a, b) =>
        compareByAvailability(a.availability.status, b.availability.status) ||
        Date.parse(b.availability.updatedAt) - Date.parse(a.availability.updatedAt),
    );

  return {
    farms,
    products,
    markets: db.farmers_markets.map((m) => toPublicMarket(m, farms)).filter(notNull),
    pickupLocations: db.pickup_locations.map(toPublicPickupLocation).filter(notNull),
  };
}
