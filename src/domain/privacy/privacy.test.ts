import { describe, expect, it } from 'vitest';
import {
  asId,
  type Claim,
  type ClaimId,
  type CommunityId,
  type Database,
  type FarmerPickupOption,
  type FarmerPickupOptionId,
  type FarmerProfile,
  type FarmerProfileId,
  type FarmersMarket,
  type FarmersMarketId,
  type InquiryId,
  type PickupLocation,
  type PickupLocationId,
  type Product,
  type ProductId,
  type ProductType,
  type ProductTypeId,
  type RegionId,
  type Settings,
  type UserId,
} from '../types';
import { buildPublicCatalogue, isPubliclyVisible, toPublicFarm, toPublicPickupOption } from './index';
import { findPrivateLeaks } from './leaks';

const now = new Date('2026-11-15T12:00:00.000Z');
const iso = (d: string) => `${d}T10:00:00.000Z`;
const settings: Settings = {
  availabilityWindowDays: 14, comingSoonHorizonMonths: 12, farmerNumbersWindowDays: 30, inquiryReminderHours: 48, inquiryAutoCloseDays: 14, outcomePromptDays: 3,
  searchEventRetentionDays: 90, buyerContactRetentionDays: 30, minimumSampleSize: 5,
  searchTermMaxLength: 60, inquiryRateLimitPerHour: 5, inquiryMinFillSeconds: 3,
  scheduledJobsIntervalMinutes: 5,
};

const region = asId<RegionId>('r1');
const community = asId<CommunityId>('c1');
const admin = asId<UserId>('u-admin');
const typeId = asId<ProductTypeId>('t1');

const productType: ProductType = {
  id: typeId, slug: 'tomatoes', name: 'Tomatoes', category: 'vegetables', comparisonUnit: 'lb',
};

function profile(n: string, over: Partial<FarmerProfile> = {}): FarmerProfile {
  return {
    id: asId<FarmerProfileId>(`f${n}`), userId: null, slug: `farm-${n}`, farmName: `Farm ${n}`,
    farmerName: `Farmer ${n}`, intro: 'intro', story: 'story', photos: [], regionId: region,
    communityId: community, createdBy: admin, createdByRole: 'administrator',
    registrationStatus: 'approved', publicationStatus: 'published', consentMethod: 'in_person',
    consentDate: '2026-10-01', consentRecordedBy: admin, farmerReviewedLatestChanges: true,
    reviewMethod: null, reviewDate: null, reviewRecordedBy: null, openToWholesale: false,
    showExactLocation: false, showPhone: false, showEmail: false, isDemo: true,
    createdAt: iso('2026-10-01'), updatedAt: iso('2026-10-01'), ...over,
  };
}

function product(n: string, farm: string, over: Partial<Product> = {}): Product {
  return {
    id: asId<ProductId>(`p${n}`), farmerProfileId: asId<FarmerProfileId>(`f${farm}`),
    productTypeId: typeId, title: `Product ${n}`, description: '', photo: null, priceCents: 300,
    sellingUnit: 'lb', unitSize: { amount: 1, measure: 'lb' }, normalizedUnitPriceCents: 300,
    licenceSelfConfirmed: null, moderationStatus: 'visible', isDemo: true,
    createdAt: iso('2026-10-01'), updatedAt: iso('2026-10-01'), ...over,
  };
}

const market: FarmersMarket = {
  id: asId<FarmersMarketId>('m1'), slug: 'm', name: 'Demo Market', communityId: community, town: 'Helena',
  point: { lat: 1, lng: 1 }, venue: 'Square', schedule: [], seasonNote: '', contactPhone: null,
  contactEmail: null, directionsUrl: 'https://example.test', moderationStatus: 'visible', isDemo: true,
};
const pickup: PickupLocation = {
  id: asId<PickupLocationId>('pl1'), slug: 'pl', name: 'Church lot', communityId: community, town: 'Helena',
  point: { lat: 2, lng: 2 }, description: '', moderationStatus: 'visible', isDemo: true,
};
const marketOption: FarmerPickupOption = {
  id: asId<FarmerPickupOptionId>('o1'), farmerProfileId: asId<FarmerProfileId>('f1'), kind: 'farmers_market',
  pickupLocationId: null, marketId: market.id, schedule: [], note: '',
};
const lotOption: FarmerPickupOption = {
  id: asId<FarmerPickupOptionId>('o2'), farmerProfileId: asId<FarmerProfileId>('f1'), kind: 'pickup_location',
  pickupLocationId: pickup.id, marketId: null, schedule: [], note: '',
};
const deliveryOption: FarmerPickupOption = {
  id: asId<FarmerPickupOptionId>('o3'), farmerProfileId: asId<FarmerProfileId>('f1'), kind: 'own_delivery',
  pickupLocationId: null, marketId: null, schedule: [], note: 'Within 10 miles',
};

const claims: Claim[] = [
  { id: asId<ClaimId>('cl1'), farmerProfileId: asId<FarmerProfileId>('f1'), type: 'practice', label: 'No spray', createdAt: iso('2026-10-01'), status: 'farmer_reported', verification: null },
  { id: asId<ClaimId>('cl2'), farmerProfileId: asId<FarmerProfileId>('f1'), type: 'licence', label: 'Egg licence', createdAt: iso('2026-10-01'), status: 'verified', verification: { evidenceChecked: 'SECRET evidence note', verifiedOn: '2026-10-05', verifiedBy: admin } },
];

function db(): Database {
  const fresh = (id: string, status: 'available_now' | 'coming_soon' | 'unconfirmed', updated: string, confirmed: string | null, month: string | null = null) => ({
    productId: asId<ProductId>(id), status, lastConfirmedAt: confirmed, expectedMonth: month, updatedAt: updated,
  });
  return {
    regions: [{ id: region, slug: 'delta', name: 'Delta', state: 'AR' }],
    communities: [],
    users: [],
    user_roles: [],
    farmer_profiles: [
      profile('1'),
      profile('2', { publicationStatus: 'draft', consentMethod: null, consentDate: null, consentRecordedBy: null }),
      profile('3', { publicationStatus: 'unpublished' }),
      profile('4', { consentMethod: null, consentDate: null, consentRecordedBy: null }),
    ],
    farm_public_locations: ['1', '2', '3', '4'].map((n) => ({
      farmerProfileId: asId<FarmerProfileId>(`f${n}`), communityId: community, town: 'Helena', county: 'Phillips', coarsePoint: { lat: 34.5, lng: -90.6 },
    })),
    farm_private_locations: ['1', '2', '3', '4'].map((n) => ({
      farmerProfileId: asId<FarmerProfileId>(`f${n}`), streetAddress: `${n}00 Hidden Road`, exactPoint: { lat: 34.5 + Number(n) / 100, lng: -90.6 - Number(n) / 100 },
    })),
    farmer_private_contacts: ['1', '2', '3', '4'].map((n) => ({
      farmerProfileId: asId<FarmerProfileId>(`f${n}`), phone: `870-555-010${n}`, email: `farm${n}@example.test`,
    })),
    product_types: [productType],
    products: [
      product('a', '1'), product('b', '1'), product('c', '1'), product('hidden', '1', { moderationStatus: 'hidden' }),
      product('draft', '2'), product('unpub', '3'), product('noconsent', '4'),
    ],
    product_availability: [
      fresh('pa', 'unconfirmed', iso('2026-11-14'), null),
      fresh('pb', 'available_now', iso('2026-11-01'), iso('2026-11-10')),
      fresh('pc', 'coming_soon', iso('2026-11-12'), null, '2026-12'),
      fresh('phidden', 'available_now', iso('2026-11-01'), iso('2026-11-10')),
      fresh('pdraft', 'available_now', iso('2026-11-01'), iso('2026-11-10')),
      fresh('punpub', 'available_now', iso('2026-11-01'), iso('2026-11-10')),
      fresh('pnoconsent', 'available_now', iso('2026-11-01'), iso('2026-11-10')),
    ],
    product_availability_history: [],
    product_quantities: [],
    farmers_markets: [{ ...market }],
    farmer_market_links: [{ farmerProfileId: asId<FarmerProfileId>('f1'), marketId: market.id }],
    pickup_locations: [pickup],
    farmer_pickup_options: [marketOption, lotOption, deliveryOption],
    inquiries: [],
    inquiry_buyer_contacts: [
      { inquiryId: asId<InquiryId>('i1'), name: 'Buyer Bea', phone: '501-555-0199', email: 'bea@example.test', message: 'Do you have okra left on Saturday?' },
    ],
    inquiry_replies: [],
    inquiry_outcomes: [],
    inquiry_folders: [],
    claims,
    search_events: [],
    preview_events: [],
    aggregate_counts: [],
    settings,
  };
}

function farmInput(over: Partial<FarmerProfile> = {}) {
  const d = db();
  return {
    profile: profile('1', over),
    publicLocation: d.farm_public_locations[0]!,
    privateLocation: d.farm_private_locations[0]!,
    privateContact: d.farmer_private_contacts[0]!,
    claims,
    pickupOptions: [],
    marketIds: [],
  };
}

describe('isPubliclyVisible', () => {
  it('requires published and all three consent fields', () => {
    expect(isPubliclyVisible(profile('1'))).toBe(true);
    expect(isPubliclyVisible(profile('1', { publicationStatus: 'draft' }))).toBe(false);
    // Musoko declining a profile takes it off the site whatever else is set.
    expect(isPubliclyVisible(profile('1', { registrationStatus: 'rejected' }))).toBe(false);
    expect(isPubliclyVisible(profile('1', { registrationStatus: 'pending_review' }))).toBe(false);
    expect(isPubliclyVisible(profile('1', { publicationStatus: 'unpublished' }))).toBe(false);
    expect(isPubliclyVisible(profile('1', { consentMethod: null }))).toBe(false);
    expect(isPubliclyVisible(profile('1', { consentDate: null }))).toBe(false);
    expect(isPubliclyVisible(profile('1', { consentRecordedBy: null }))).toBe(false);
  });
});

describe('toPublicFarm', () => {
  it('opted-out farm gets town-centre point and null contact', () => {
    const farm = toPublicFarm(farmInput())!;
    expect(farm.location.precision).toBe('town_centre');
    expect(farm.location.point).toEqual({ lat: 34.5, lng: -90.6 });
    expect(farm.contact).toEqual({ phone: null, email: null });
  });
  it('exact opt-in gets the exact point and still no address', () => {
    const farm = toPublicFarm(farmInput({ showExactLocation: true }))!;
    expect(farm.location.precision).toBe('exact');
    expect(farm.location.point).toEqual({ lat: 34.51, lng: -90.61 });
    expect(JSON.stringify(farm)).not.toContain('Hidden Road');
    expect(farm).not.toHaveProperty('streetAddress');
  });
  it('exact opt-in without a private location falls back to town centre', () => {
    const farm = toPublicFarm({ ...farmInput({ showExactLocation: true }), privateLocation: null })!;
    expect(farm.location.precision).toBe('town_centre');
  });
  it('phone-only opt-in leaves email null', () => {
    const farm = toPublicFarm(farmInput({ showPhone: true }))!;
    expect(farm.contact).toEqual({ phone: '870-555-0101', email: null });
  });
  it('email-only opt-in leaves phone null', () => {
    const farm = toPublicFarm(farmInput({ showEmail: true }))!;
    expect(farm.contact).toEqual({ phone: null, email: 'farm1@example.test' });
  });
  it('returns null for draft, unpublished and missing consent', () => {
    expect(toPublicFarm(farmInput({ publicationStatus: 'draft' }))).toBeNull();
    expect(toPublicFarm(farmInput({ publicationStatus: 'unpublished' }))).toBeNull();
    expect(toPublicFarm(farmInput({ consentDate: null }))).toBeNull();
  });
  it('maps claims without evidence or administrator id', () => {
    const farm = toPublicFarm(farmInput())!;
    expect(farm.claims).toEqual([
      { id: 'cl1', type: 'practice', label: 'No spray', status: 'farmer_reported', verifiedOn: null },
      { id: 'cl2', type: 'licence', label: 'Egg licence', status: 'verified', verifiedOn: '2026-10-05' },
    ]);
    expect(JSON.stringify(farm)).not.toContain('SECRET');
  });
});

describe('toPublicPickupOption', () => {
  it('drops an option pointing at a hidden market', () => {
    expect(toPublicPickupOption({ option: marketOption, market: { ...market, moderationStatus: 'hidden' }, pickupLocation: null })).toBeNull();
  });
  it('drops an option whose target is missing or hidden', () => {
    expect(toPublicPickupOption({ option: marketOption, market: null, pickupLocation: null })).toBeNull();
    expect(toPublicPickupOption({ option: lotOption, market: null, pickupLocation: { ...pickup, moderationStatus: 'removed' } })).toBeNull();
  });
  it('names the market, the pickup location, and leaves delivery unnamed', () => {
    expect(toPublicPickupOption({ option: marketOption, market, pickupLocation: null })?.name).toBe('Demo Market');
    expect(toPublicPickupOption({ option: lotOption, market: null, pickupLocation: pickup })?.name).toBe('Church lot');
    expect(toPublicPickupOption({ option: deliveryOption, market: null, pickupLocation: null })).toMatchObject({ name: null, town: null, note: 'Within 10 miles' });
  });
});

describe('buildPublicCatalogue', () => {
  it('drops products of draft, unpublished and no-consent farms, and hidden products', () => {
    const cat = buildPublicCatalogue(db(), now, settings);
    expect(cat.farms.map((f) => f.id)).toEqual(['f1']);
    expect(cat.products.map((p) => p.id).sort()).toEqual(['pa', 'pb', 'pc']);
  });
  it('orders by availability then newest update', () => {
    const cat = buildPublicCatalogue(db(), now, settings);
    expect(cat.products.map((p) => p.id)).toEqual(['pb', 'pc', 'pa']);
    const d = db();
    d.product_availability.find((a) => a.productId === 'pa')!.status = 'available_now';
    d.product_availability.find((a) => a.productId === 'pa')!.lastConfirmedAt = iso('2026-11-14');
    expect(buildPublicCatalogue(d, now, settings).products.map((p) => p.id)).toEqual(['pa', 'pb', 'pc']);
  });
  it('uses effective status and computed unit price, not stored values', () => {
    const d = db();
    d.product_availability.find((a) => a.productId === 'pb')!.lastConfirmedAt = iso('2026-09-01');
    d.products.find((p) => p.id === 'pb')!.normalizedUnitPriceCents = 9999;
    const pb = buildPublicCatalogue(d, now, settings).products.find((p) => p.id === 'pb')!;
    expect(pb.availability.status).toBe('unconfirmed');
    expect(pb.normalizedUnitPrice).toEqual({ cents: 300, per: 'lb' });
  });
  it('a hidden market drops the pickup option and the market itself', () => {
    const d = db();
    d.farmers_markets[0]!.moderationStatus = 'hidden';
    const cat = buildPublicCatalogue(d, now, settings);
    expect(cat.markets).toEqual([]);
    expect(cat.farms[0]!.pickupOptions.map((o) => o.kind)).toEqual(['pickup_location', 'own_delivery']);
    expect(cat.farms[0]!.marketIds).toEqual([]);
  });
  it('lists linked farms on a visible market', () => {
    const cat = buildPublicCatalogue(db(), now, settings);
    expect(cat.markets[0]!.farms.map((f) => f.id)).toEqual(['f1']);
  });
});

describe('findPrivateLeaks', () => {
  it('finds nothing in the public catalogue', () => {
    expect(findPrivateLeaks(buildPublicCatalogue(db(), now, settings), db())).toEqual([]);
  });
  it('finds nothing for an opted-in exact point, phone and email on a visible farm', () => {
    const d = db();
    Object.assign(d.farmer_profiles[0]!, { showExactLocation: true, showPhone: true, showEmail: true });
    const leaks = findPrivateLeaks(buildPublicCatalogue(d, now, settings), d);
    expect(leaks).toEqual([]);
  });
  it('reports every kind when given the raw database', () => {
    const kinds = new Set(findPrivateLeaks(db(), db()).map((l) => l.kind));
    expect(kinds).toEqual(new Set(['street_address', 'exact_coordinates', 'phone', 'email', 'unpublished_profile', 'buyer_contact']));
  });
  it('reports a street address smuggled into free text, with its path', () => {
    const leaks = findPrivateLeaks({ note: 'Come to 100 Hidden Road' }, db());
    expect(leaks).toEqual([{ kind: 'street_address', farmerProfileId: 'f1', path: 'note' }]);
  });
  it('reports exact coordinates of an opted-out farm only', () => {
    const d = db();
    expect(findPrivateLeaks({ point: { lat: 34.51, lng: -90.61 } }, d)).toHaveLength(1);
    d.farmer_profiles[0]!.showExactLocation = true;
    expect(findPrivateLeaks({ point: { lat: 34.51, lng: -90.61 } }, d)).toEqual([]);
  });
  it('reports phone when only email is opted in, and the id of an unpublished profile', () => {
    const d = db();
    d.farmer_profiles[0]!.showEmail = true;
    const leaks = findPrivateLeaks({ a: '870-555-0101', b: 'farm1@example.test', c: 'f2', d: 'farm-3' }, d);
    expect(leaks.map((l) => [l.kind, l.path])).toEqual([
      ['phone', 'a'],
      ['unpublished_profile', 'c'],
      ['unpublished_profile', 'd'],
    ]);
  });
  it('reports buyer name, phone, email and message', () => {
    const leaks = findPrivateLeaks(['Buyer Bea', '501-555-0199', 'bea@example.test', 'Do you have okra left on Saturday?'], db());
    expect(leaks.filter((l) => l.kind === 'buyer_contact')).toHaveLength(4);
  });
  it('survives circular values', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(findPrivateLeaks(a, db())).toEqual([]);
  });
});
