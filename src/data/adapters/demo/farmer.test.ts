import { describe, expect, it } from 'vitest';
import { findPrivateLeaks } from '@/domain/privacy/leaks';
import type { RegistrationInput } from '@/domain/farmer';
import { asId, type Database, type FarmerProfileId, type InquiryId, type ProductId } from '@/domain/types';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import { DEMO_ACCOUNTS } from '../../seed';
import { createDemoServices } from './index';
import { createMemoryStorage, DEMO_STORAGE_KEY, type DemoState, type DemoStorage } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');

function setup(storage: DemoStorage = createMemoryStorage()) {
  const services = createDemoServices({ clock: { now: () => NOW }, storage });
  const state = () => (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!) as { state: DemoState }).state;
  return { services, storage, state, db: (): Database => state().db };
}

const farmer: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: DEMO_ACCOUNTS.farmer.farmerProfileId! };
const otherFarmer: Actor = { role: 'farmer', userId: asId('user-other'), farmerProfileId: asId<FarmerProfileId>('farm-02') };
const buyer: Actor = { role: 'buyer', userId: DEMO_ACCOUNTS.buyer.userId, farmerProfileId: null };
const admin: Actor = { role: 'administrator', userId: DEMO_ACCOUNTS.administrator.userId, farmerProfileId: null };

const registration: RegistrationInput = {
  farmName: 'Cypress Row Farm', farmerName: 'Ada Marsh', communityId: 'com-pine-bluff', intro: 'Greens and eggs.', story: '',
  phone: '870-555-0142', email: 'ada@cypressrow.example', streetAddress: '14 Demo Lane', openToWholesale: false,
  showPhone: false, showEmail: false, showExactLocation: false, consentToPublish: true,
};

const failure = async (promise: Promise<unknown>): Promise<GatewayError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof GatewayError) return error;
    throw error;
  }
  throw new Error('expected the call to reject');
};

describe('registering (CONS-2, TRUST-1, MODE-1)', () => {
  it('stores a draft with consent recorded, signs the browser in as the new farmer, and survives a reload', async () => {
    const storage = createMemoryStorage();
    const { services, db } = setup(storage);
    const publicBefore = (await services.gateway.listPublicFarms()).length;
    const receipt = await services.gateway.registerFarmer(registration);

    const profile = db().farmer_profiles.find((f) => f.id === receipt.farmerProfileId)!;
    expect(profile).toMatchObject({
      userId: receipt.userId, slug: 'cypress-row-farm', registrationStatus: 'pending_review', publicationStatus: 'draft',
      consentMethod: 'farmer_signed_in', consentDate: '2026-11-15', consentRecordedBy: receipt.userId,
      showPhone: false, showEmail: false, showExactLocation: false, isDemo: true,
    });
    expect(db().user_roles).toContainEqual({ userId: receipt.userId, role: 'farmer' });

    // Not public: a draft awaiting Musoko's review.
    expect(await services.gateway.listPublicFarms()).toHaveLength(publicBefore);
    expect(await services.gateway.getPublicFarmBySlug('cypress-row-farm')).toBeNull();

    // The browser is the new farmer, and a reload keeps it.
    const reopened = setup(storage).services;
    const session = (await reopened.auth.getSession())!;
    expect(session).toMatchObject({ role: 'farmer', farmerProfileId: receipt.farmerProfileId });
    expect(session.user.displayName).toBe('Ada Marsh');
  });

  it('keeps the new farmer when the role is switched away and back, and the demo farmer after a reset', async () => {
    const { services } = setup();
    const receipt = await services.gateway.registerFarmer(registration);
    await services.demo!.switchRole('buyer');
    expect((await services.auth.getSession())!.role).toBe('buyer');
    await services.demo!.switchRole('farmer');
    expect((await services.auth.getSession())!.farmerProfileId).toBe(receipt.farmerProfileId);
    await services.demo!.reset();
    expect((await services.auth.getSession())!.farmerProfileId).toBe(DEMO_ACCOUNTS.farmer.farmerProfileId);
  });

  it('rejects an incomplete form with codes per field and stores nothing', async () => {
    const { services, db } = setup();
    await services.demo!.ready();
    const before = db().farmer_profiles.length;
    const error = await failure(services.gateway.registerFarmer({ ...registration, farmName: '', phone: null, email: null, consentToPublish: false }));
    expect(error.code).toBe('invalid');
    expect(error.detail.fields).toMatchObject({ farmName: 'farm_name_required', phone: 'contact_required', consentToPublish: 'consent_required' });
    expect(db().farmer_profiles).toHaveLength(before);
  });

  it('keeps the street address and exact point private, and the town centre public once Musoko lists the farm', async () => {
    const { services, state } = setup();
    const receipt = await services.gateway.registerFarmer({ ...registration, showExactLocation: false });
    const s = state();
    expect(s.db.farm_private_locations.find((l) => l.farmerProfileId === receipt.farmerProfileId)?.streetAddress).toBe('14 Demo Lane');
    // Simulate step 7's approval, to look at what the public would see.
    const listed: Database = {
      ...s.db,
      farmer_profiles: s.db.farmer_profiles.map((f) =>
        f.id === receipt.farmerProfileId ? { ...f, registrationStatus: 'approved' as const, publicationStatus: 'published' as const } : f,
      ),
    };
    const farms = (await import('@/domain/privacy')).buildPublicCatalogue(listed, NOW, listed.settings);
    const farm = farms.farms.find((f) => f.id === receipt.farmerProfileId)!;
    expect(farm.location.precision).toBe('town_centre');
    expect(farm.contact).toEqual({ phone: null, email: null });
    expect(findPrivateLeaks(farms, listed)).toEqual([]);
  });
});

describe('the farmer’s own profile', () => {
  it('shows the farmer their private contact and address, and refuses anyone else', async () => {
    const { services } = setup();
    const own = await services.gateway.getOwnFarm(farmer);
    expect(own.contact).toEqual({ phone: '870-555-0101', email: 'odell@cypressknee.example' });
    expect(own.streetAddress).toContain('412 Demo Road 7');
    expect(own.state).toBe('listed');
    for (const actor of [buyer, admin, otherFarmer, { ...farmer, userId: buyer.userId }]) {
      expect((await failure(services.gateway.getOwnFarm(actor))).code).toBe('forbidden');
    }
  });

  it('saves edits so they survive a reload (MODE-1)', async () => {
    const storage = createMemoryStorage();
    const { services } = setup(storage);
    await services.gateway.updateOwnProfile(farmer, {
      farmName: 'Cypress Knee Gardens', farmerName: 'Odell Fairweather', communityId: 'com-pine-bluff', intro: 'New intro.', story: 'New story.',
      phone: '870-555-0199', email: null, streetAddress: null, openToWholesale: false,
    });
    const after = (await setup(storage).services.gateway.getOwnFarm(farmer));
    expect(after.profile).toMatchObject({ intro: 'New intro.', story: 'New story.', openToWholesale: false, showEmail: false });
    expect(after.town).toBe('Pine Bluff');
    expect(after.contact).toEqual({ phone: '870-555-0199', email: null });
    expect(after.streetAddress).toBeNull();
    // Sharing something that is no longer on file switched itself off.
    expect(after.profile.showExactLocation).toBe(false);
    // An edit by the farmer is not an administrator edit: no review flag.
    expect(after.profile.farmerReviewedLatestChanges).toBe(true);
  });

  it('refuses an invalid profile with codes', async () => {
    const { services } = setup();
    const error = await failure(
      services.gateway.updateOwnProfile(farmer, {
        farmName: '', farmerName: 'x', communityId: 'com-pine-bluff', intro: 'x', story: '', phone: null, email: null, streetAddress: null, openToWholesale: false,
      }),
    );
    expect(error.detail.fields).toMatchObject({ farmName: 'farm_name_required', phone: 'contact_required' });
  });
});

describe('privacy settings (PRIV-1, PRIV-3)', () => {
  it('shows the phone publicly only while the farmer has it switched on', async () => {
    const { services } = setup();
    const slug = 'cypress-knee-gardens';
    expect((await services.gateway.getPublicFarmBySlug(slug))!.contact.phone).toBe('870-555-0101');
    await services.gateway.updateOwnPrivacy(farmer, { showPhone: false, showEmail: false, showExactLocation: false });
    const hidden = (await services.gateway.getPublicFarmBySlug(slug))!;
    expect(hidden.contact).toEqual({ phone: null, email: null });
    expect(hidden.location.precision).toBe('town_centre');
    expect(JSON.stringify(hidden)).not.toContain('870-555-0101');
    await services.gateway.updateOwnPrivacy(farmer, { showPhone: true, showEmail: false, showExactLocation: true });
    const shown = (await services.gateway.getPublicFarmBySlug(slug))!;
    expect(shown.contact.phone).toBe('870-555-0101');
    expect(shown.location.precision).toBe('exact');
  });

  it('refuses to switch on what is not on file', async () => {
    const { services } = setup();
    await services.gateway.updateOwnProfile(farmer, {
      farmName: 'Cypress Knee Gardens', farmerName: 'Odell Fairweather', communityId: 'com-helena-west-helena', intro: 'x', story: '',
      phone: '870-555-0101', email: null, streetAddress: null, openToWholesale: true,
    });
    const error = await failure(services.gateway.updateOwnPrivacy(farmer, { showPhone: true, showEmail: true, showExactLocation: true }));
    expect(error.detail.fields).toEqual({ showEmail: 'share_email_needs_email', showExactLocation: 'share_location_needs_address' });
  });
});

describe('unpublishing (CONS-4) and consent (CONS-2, CONS-3)', () => {
  it('lets the farmer unpublish and republish their own profile', async () => {
    const { services } = setup();
    const slug = 'cypress-knee-gardens';
    expect(await services.gateway.getPublicFarmBySlug(slug)).not.toBeNull();
    const off = await services.gateway.setOwnPublication(farmer, false);
    expect(off.state).toBe('unpublished');
    expect(await services.gateway.getPublicFarmBySlug(slug)).toBeNull();
    expect((await services.gateway.listPublicProducts()).some((p) => p.farm.slug === slug)).toBe(false);
    const on = await services.gateway.setOwnPublication(farmer, true);
    expect(on.state).toBe('listed');
    expect(await services.gateway.getPublicFarmBySlug(slug)).not.toBeNull();
  });

  it('cannot publish a registration Musoko has not approved', async () => {
    const { services } = setup();
    const receipt = await services.gateway.registerFarmer(registration);
    const actor: Actor = { role: 'farmer', userId: receipt.userId, farmerProfileId: receipt.farmerProfileId };
    expect((await services.gateway.getOwnFarm(actor)).state).toBe('pending_review');
    expect((await failure(services.gateway.setOwnPublication(actor, true))).code).toBe('invalid');
    expect(await services.gateway.getPublicFarmBySlug('cypress-row-farm')).toBeNull();
  });

  it('records the farmer approving an administrator’s draft, with method, date and who', async () => {
    const storage = createMemoryStorage();
    const { services, state } = setup(storage);
    await services.demo!.ready();
    const s = state();
    // Make the demo farmer's profile look like one an administrator started.
    s.db.farmer_profiles = s.db.farmer_profiles.map((f) =>
      f.id === farmer.farmerProfileId
        ? { ...f, createdByRole: 'administrator' as const, registrationStatus: 'pending_review' as const, publicationStatus: 'draft' as const,
            consentMethod: null, consentDate: null, consentRecordedBy: null, farmerReviewedLatestChanges: false }
        : f,
    );
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: s, version: (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!) as { version: number }).version }));
    const reopened = setup(storage).services;
    expect((await reopened.gateway.getOwnFarm(farmer)).state).toBe('needs_consent');
    const approved = await reopened.gateway.approveOwnProfile(farmer);
    expect(approved.profile).toMatchObject({ consentMethod: 'farmer_signed_in', consentDate: '2026-11-15', consentRecordedBy: farmer.userId });
    expect(approved.state).toBe('pending_review');
  });

  it('records the farmer’s review of an administrator’s changes the same way', async () => {
    const storage = createMemoryStorage();
    const { services, state } = setup(storage);
    await services.demo!.ready();
    const s = state();
    s.db.farmer_profiles = s.db.farmer_profiles.map((f) =>
      f.id === farmer.farmerProfileId ? { ...f, farmerReviewedLatestChanges: false, reviewMethod: null, reviewDate: null, reviewRecordedBy: null } : f,
    );
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: s, version: (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!) as { version: number }).version }));
    const reopened = setup(storage).services;
    expect((await reopened.gateway.getOwnFarm(farmer)).state).toBe('listed_awaiting_review');
    const reviewed = await reopened.gateway.confirmOwnReview(farmer);
    expect(reviewed.state).toBe('listed');
    expect(reviewed.profile).toMatchObject({ reviewMethod: 'farmer_signed_in', reviewDate: '2026-11-15', reviewRecordedBy: farmer.userId });
  });
});

describe('claims (TRUST-1, TRUST-3)', () => {
  it('stores everything the farmer enters as farmer-reported and leaves verified claims alone', async () => {
    const { services, db } = setup();
    await services.demo!.ready();
    const before = db().claims.filter((c) => c.status === 'verified');
    await services.gateway.setOwnClaims(farmer, [
      { type: 'snap_ebt', label: 'Accepts SNAP/EBT' },
      { type: 'practice', label: 'No-spray garden' },
      { type: 'practice', label: 'no-spray garden' },
    ]);
    const mine = db().claims.filter((c) => c.farmerProfileId === farmer.farmerProfileId);
    expect(mine.every((c) => c.status === 'farmer_reported')).toBe(true);
    expect(mine.map((c) => c.label)).toEqual(['Accepts SNAP/EBT', 'No-spray garden']);
    expect(db().claims.filter((c) => c.status === 'verified')).toEqual(before);
  });
});

describe('pickup options', () => {
  it('keeps the days and hours of an option the farmer keeps, and follows markets in the “sells at” list', async () => {
    const { services, db } = setup();
    const own = await services.gateway.getOwnFarm(farmer);
    const market = own.pickupOptions.find((o) => o.kind === 'farmers_market')!;
    expect(market.schedule.length).toBeGreaterThan(0);
    await services.gateway.setOwnPickupOptions(farmer, [
      { kind: 'farmers_market', marketId: market.marketId, pickupLocationId: null, note: 'Green awning' },
      { kind: 'own_delivery', marketId: null, pickupLocationId: null, note: 'Tuesdays in town' },
    ]);
    const after = await services.gateway.getOwnFarm(farmer);
    expect(after.pickupOptions).toHaveLength(2);
    expect(after.pickupOptions.find((o) => o.kind === 'farmers_market')).toMatchObject({ id: market.id, schedule: market.schedule, note: 'Green awning' });

    await services.gateway.setOwnPickupOptions(farmer, [{ kind: 'own_delivery', marketId: null, pickupLocationId: null, note: '' }]);
    expect(db().farmer_market_links.some((l) => l.farmerProfileId === farmer.farmerProfileId && l.marketId === market.marketId)).toBe(false);
    expect((await services.gateway.getPublicFarmBySlug('cypress-knee-gardens'))!.marketIds).toEqual([]);
  });

  it('refuses a market that is not listed', async () => {
    const { services } = setup();
    const error = await failure(
      services.gateway.setOwnPickupOptions(farmer, [{ kind: 'farmers_market', marketId: 'market-nope', pickupLocationId: null, note: '' }]),
    );
    expect(error.code).toBe('invalid');
  });
});

describe('listings (QTY-4, AVAIL-5, PRICE, CLAIM-2)', () => {
  const create = {
    productTypeId: 'ptype-tomatoes', title: 'Slicing tomatoes, 5 lb box', description: 'Picked this morning.', priceCents: 1500,
    presetId: 'box-5lb', licenceSelfConfirmed: false, status: 'available_now' as const, expectedMonth: null,
    quantity: { amount: 8, unit: 'box' as const, approximate: true },
  };

  it('creates a listing with a unit price, a status and a quantity with its own date, and it is public at once', async () => {
    const { services, db } = setup();
    const created = await services.gateway.createListing(farmer, create);
    expect(created.status).toBe('available_now');
    expect(created.product).toMatchObject({ sellingUnit: 'box', unitSize: { amount: 5, measure: 'lb' }, normalizedUnitPriceCents: 300, licenceSelfConfirmed: null });
    expect(created.quantity).toMatchObject({ amount: 8, unit: 'box', approximate: true, lastConfirmedAt: NOW.toISOString() });
    expect(db().product_availability_history.filter((h) => h.productId === created.product.id)).toHaveLength(1);
    const pub = (await services.gateway.listPublicProducts()).find((p) => p.id === created.product.id)!;
    expect(pub.normalizedUnitPrice).toEqual({ cents: 300, per: 'lb' });
    expect(pub.availability.status).toBe('available_now');
    expect(pub.isDemo).toBe(true);
  });

  it('asks for the licence confirmation on eggs, meat and dairy, and stores it as farmer-reported', async () => {
    const { services } = setup();
    const eggs = { ...create, productTypeId: 'ptype-eggs', title: 'Eggs', presetId: 'dozen', quantity: null };
    expect((await failure(services.gateway.createListing(farmer, eggs))).detail.fields).toEqual({ licenceSelfConfirmed: 'licence_required' });
    const ok = await services.gateway.createListing(farmer, { ...eggs, licenceSelfConfirmed: true });
    expect(ok.product.licenceSelfConfirmed).toBe(true);
  });

  it('refuses a coming-soon month outside the list', async () => {
    const { services } = setup();
    const soon = { ...create, status: 'coming_soon' as const, quantity: null };
    expect((await failure(services.gateway.createListing(farmer, { ...soon, expectedMonth: '2026-10' }))).detail.fields).toEqual({ expectedMonth: 'month_invalid' });
    const ok = await services.gateway.createListing(farmer, { ...soon, expectedMonth: '2027-06' });
    expect(ok).toMatchObject({ status: 'coming_soon', availability: { expectedMonth: '2027-06' }, quantity: null });
  });

  it('edits a listing and keeps its status', async () => {
    const { services } = setup();
    const created = await services.gateway.createListing(farmer, create);
    const edited = await services.gateway.updateListing(farmer, created.product.id, {
      productTypeId: 'ptype-tomatoes', title: 'Slicing tomatoes', description: '', priceCents: 2000, presetId: 'box-10lb', licenceSelfConfirmed: false,
    });
    expect(edited.product).toMatchObject({ title: 'Slicing tomatoes', priceCents: 2000, sellingUnit: 'box', unitSize: { amount: 10, measure: 'lb' }, normalizedUnitPriceCents: 200 });
    expect(edited.status).toBe('available_now');
    expect(edited.quantity).not.toBeNull();
  });

  it('confirms in one tap and updates the quantity in the same step (AVAIL-5, QTY-4)', async () => {
    const { services, db } = setup();
    const lapsed = asId<ProductId>('prod-004');
    expect((await services.gateway.listOwnListings(farmer)).find((l) => l.product.id === lapsed)!.status).toBe('unconfirmed');
    const done = await services.gateway.farmerSetAvailability(farmer, lapsed, {
      kind: 'still_available',
      quantity: { amount: 20, unit: 'lb', approximate: true },
    });
    expect(done.status).toBe('available_now');
    expect(done.quantity).toMatchObject({ amount: 20, unit: 'lb', lastConfirmedAt: NOW.toISOString() });
    expect(db().product_availability_history.filter((h) => h.productId === lapsed).at(-1)).toMatchObject({ status: 'available_now', changedBy: farmer.userId });
  });

  it('leaves the quantity alone when none is sent, and clears it when told to', async () => {
    const { services } = setup();
    const id = asId<ProductId>('prod-007');
    const before = (await services.gateway.listOwnListings(farmer)).find((l) => l.product.id === id)!;
    expect(before.quantity).not.toBeNull();
    const kept = await services.gateway.farmerSetAvailability(farmer, id, { kind: 'still_available' });
    expect(kept.quantity).toEqual(before.quantity);
    const cleared = await services.gateway.farmerSetAvailability(farmer, id, { kind: 'still_available', quantity: null });
    expect(cleared.quantity).toBeNull();
  });

  it('sets Coming soon with a month, and drops a quantity that no longer applies', async () => {
    const { services } = setup();
    const id = asId<ProductId>('prod-001');
    const soon = await services.gateway.farmerSetAvailability(farmer, id, { kind: 'coming_soon', expectedMonth: '2027-03' });
    expect(soon).toMatchObject({ status: 'coming_soon', availability: { expectedMonth: '2027-03', lastConfirmedAt: null }, quantity: null });
    const pub = (await services.gateway.listPublicProducts()).find((p) => p.id === id)!;
    expect(pub.availability).toMatchObject({ status: 'coming_soon', expectedMonth: '2027-03' });
    expect(pub.quantity).toBeNull();
    expect((await failure(services.gateway.farmerSetAvailability(farmer, id, { kind: 'coming_soon', expectedMonth: '2025-01' }))).code).toBe('invalid');
  });

  it('marks a listing as not available right now', async () => {
    const { services } = setup();
    const id = asId<ProductId>('prod-001');
    const none = await services.gateway.farmerSetAvailability(farmer, id, { kind: 'not_available' });
    expect(none.status).toBe('unconfirmed');
    expect((await services.gateway.listPublicProducts()).find((p) => p.id === id)!.availability.status).toBe('unconfirmed');
  });

  it('removes a listing and keeps the inquiries about it as questions about the product type', async () => {
    const { services, db } = setup();
    const id = asId<ProductId>('prod-001');
    await services.gateway.removeListing(farmer, id);
    expect(db().products.some((p) => p.id === id)).toBe(false);
    expect(db().product_availability.some((a) => a.productId === id)).toBe(false);
    expect(db().product_quantities.some((q) => q.productId === id)).toBe(false);
    const inquiry = db().inquiries.find((i) => i.id === 'inq-01')!;
    expect(inquiry.productId).toBeNull();
    expect(inquiry.productTypeId).not.toBeNull();
    expect((await services.gateway.listPublicProducts()).some((p) => p.id === id)).toBe(false);
  });

  it('lets a farmer change only their own listings', async () => {
    const { services } = setup();
    const mine = asId<ProductId>('prod-001');
    const theirs = asId<ProductId>('prod-008'); // farm-02
    for (const actor of [buyer, admin, otherFarmer]) {
      expect((await failure(services.gateway.farmerSetAvailability(actor, mine, { kind: 'still_available' }))).code).toBe('forbidden');
      expect((await failure(services.gateway.createListing(actor, create))).code).toBe('forbidden');
    }
    expect((await failure(services.gateway.farmerSetAvailability(farmer, theirs, { kind: 'still_available' }))).code).toBe('forbidden');
    expect((await failure(services.gateway.removeListing(farmer, theirs))).code).toBe('forbidden');
    expect((await failure(services.gateway.listOwnListings(buyer))).code).toBe('forbidden');
  });
});

describe('replying (INQ-3, INQ-4, STAT-1, MODE-2)', () => {
  const id = (n: number) => asId<InquiryId>(`inq-${String(n).padStart(2, '0')}`);
  const none = { message: '', confirmSharePhone: false };

  it('one tap moves an awaiting inquiry to responded, and the buyer hears by the channel they chose', async () => {
    const { services, db, state } = setup();
    const record = await services.gateway.replyToInquiry(farmer, id(1), { kind: 'available', ...none });
    expect(record.inquiry.status).toBe('responded');
    expect(record.inquiry.respondedAt).toBe(NOW.toISOString());
    expect(record.reply).toMatchObject({ kind: 'available', message: null, phoneShared: false });
    expect(db().inquiry_replies.filter((r) => r.inquiryId === id(1))).toHaveLength(1);

    // inq-01 asked for a text; the notice goes to the buyer's phone, and carries a link, not the farmer's phone.
    const sent = state().outbox.at(-1)!;
    expect(sent).toMatchObject({ template: 'inquiry_reply', channel: 'sms' });
    expect(sent.body).toContain('/inquiry/status-token-01');
    expect(sent.body).not.toContain('870-555-0101');
  });

  it('answers an email inquiry by email', async () => {
    const { services, state } = setup();
    await services.gateway.replyToInquiry(farmer, id(2), { kind: 'sold_out', message: 'Back next week.', confirmSharePhone: false });
    expect(state().outbox.at(-1)).toMatchObject({ template: 'inquiry_reply', channel: 'email' });
  });

  it('shows the reply on the buyer’s status page, with no phone for Available or Sold out', async () => {
    const { services } = setup();
    await services.gateway.replyToInquiry(farmer, id(1), { kind: 'available', message: 'See you Saturday.', confirmSharePhone: true });
    const view = (await services.gateway.getBuyerInquiry('status-token-01'))!;
    expect(view.status).toBe('responded');
    expect(view.reply).toMatchObject({ kind: 'available', message: 'See you Saturday.', farmerPhone: null });
    expect(JSON.stringify(view)).not.toContain('870-555-0101');
  });

  it('Contact me shares the phone with that buyer’s page only, after the farmer confirms', async () => {
    const { services } = setup();
    const unconfirmed = await failure(services.gateway.replyToInquiry(farmer, id(1), { kind: 'contact_me', message: '', confirmSharePhone: false }));
    expect(unconfirmed.detail.fields).toEqual({ confirmSharePhone: 'confirm_required' });
    expect((await services.gateway.getBuyerInquiry('status-token-01'))!.status).toBe('awaiting_response');

    await services.gateway.replyToInquiry(farmer, id(1), { kind: 'contact_me', message: 'Call me.', confirmSharePhone: true });
    expect((await services.gateway.getBuyerInquiry('status-token-01'))!.reply).toMatchObject({ kind: 'contact_me', farmerPhone: '870-555-0101' });
    // Another buyer's page does not carry it.
    expect((await services.gateway.getBuyerInquiry('status-token-03'))!.reply).toBeNull();
    expect(JSON.stringify(await services.gateway.getBuyerInquiry('status-token-03'))).not.toContain('870-555-0101');
  });

  it('refuses a note that carries a phone number', async () => {
    const { services } = setup();
    const error = await failure(services.gateway.replyToInquiry(farmer, id(1), { kind: 'available', message: 'Text 870-555-0101', confirmSharePhone: false }));
    expect(error.detail.fields).toEqual({ message: 'message_has_contact' });
  });

  it('refuses a reply to a closed inquiry, and to someone else’s', async () => {
    const { services } = setup();
    expect((await failure(services.gateway.replyToInquiry(farmer, id(7), { kind: 'available', ...none }))).detail.fields).toEqual({ form: 'reply_closed' });
    expect((await failure(services.gateway.replyToInquiry(farmer, id(9), { kind: 'available', ...none }))).code).toBe('forbidden');
    expect((await failure(services.gateway.replyToInquiry(farmer, asId('inq-99'), { kind: 'available', ...none }))).code).toBe('not_found');
    for (const actor of [buyer, admin, otherFarmer]) {
      expect((await failure(services.gateway.replyToInquiry(actor, id(1), { kind: 'available', ...none }))).code).toBe('forbidden');
    }
  });

  it('appears for the farmer in the inquiry list with the buyer’s details (INQ-5)', async () => {
    const { services } = setup();
    await services.gateway.replyToInquiry(farmer, id(1), { kind: 'available', ...none });
    const records = await services.gateway.listInquiriesForActor(farmer);
    expect(records.find((r) => r.inquiry.id === id(1))).toMatchObject({ buyer: { name: 'Renata Voss' }, reply: { kind: 'available' } });
  });
});

describe('the outcome question (OUT-1, OUT-2, STAT-5)', () => {
  const id = (n: number) => asId<InquiryId>(`inq-${String(n).padStart(2, '0')}`);

  it('records the answer, closes the inquiry, and holds no amount', async () => {
    const { services, db } = setup();
    const record = await services.gateway.recordInquiryOutcome(farmer, id(5), 'sale');
    expect(record.outcome).toMatchObject({ outcome: 'sale' });
    expect(Object.keys(record.outcome!).sort()).toEqual(['inquiryId', 'outcome', 'recordedAt']);
    expect(record.inquiry).toMatchObject({ status: 'closed', closedReason: 'outcome_recorded' });
    expect(db().inquiry_outcomes.filter((o) => o.inquiryId === id(5))).toHaveLength(1);
  });

  it('keeps the inquiry open for "Still discussing", and lets the farmer change it once', async () => {
    const { services } = setup();
    const first = await services.gateway.recordInquiryOutcome(farmer, id(5), 'still_discussing');
    expect(first.inquiry.status).toBe('responded');
    const later = await services.gateway.recordInquiryOutcome(farmer, id(5), 'new_potential_customer');
    expect(later.inquiry.status).toBe('closed');
    expect((await failure(services.gateway.recordInquiryOutcome(farmer, id(5), 'no'))).code).toBe('invalid');
  });

  it('refuses an unanswered inquiry, a closed unanswered one, and someone else’s', async () => {
    const { services } = setup();
    expect((await failure(services.gateway.recordInquiryOutcome(farmer, id(1), 'sale'))).code).toBe('invalid');
    expect((await failure(services.gateway.recordInquiryOutcome(farmer, id(7), 'sale'))).code).toBe('invalid');
    expect((await failure(services.gateway.recordInquiryOutcome(farmer, id(9), 'sale'))).code).toBe('forbidden');
    expect((await failure(services.gateway.recordInquiryOutcome(buyer, id(5), 'sale'))).code).toBe('forbidden');
  });

  it('is visible on the farmer’s own list and in their numbers (MODE-2)', async () => {
    const { services } = setup();
    const before = await services.gateway.getFarmerNumbers(farmer);
    await services.gateway.recordInquiryOutcome(farmer, id(5), 'sale');
    const after = await services.gateway.getFarmerNumbers(farmer);
    expect(after.outcomes.sale).toBe(before.outcomes.sale + 1);
    expect(after.inquiries.closed).toBe(before.inquiries.closed + 1);
  });
});

describe('the farmer’s numbers', () => {
  it('counts the farm’s own inquiries, replies and listings, and refuses anyone else', async () => {
    const { services } = setup();
    const n = await services.gateway.getFarmerNumbers(farmer);
    expect(n.inquiries).toMatchObject({ total: 9, awaiting: 3, responded: 3, closed: 3 });
    expect(n.replies.answered).toBe(5);
    expect(n.listings.total).toBeGreaterThan(0);
    expect(n.outcomes.recorded).toBe(1);
    expect((await failure(services.gateway.getFarmerNumbers(otherFarmer))).code).toBe('forbidden');
  });

  it('gives each own listing its own figures, adding up to no more than the farm’s', async () => {
    const { services } = setup();
    const n = await services.gateway.getFarmerNumbers(farmer);
    const listings = await services.gateway.listOwnListings(farmer);
    const visible = listings.filter((l) => l.product.moderationStatus === 'visible');
    expect(Object.keys(n.byListing).sort()).toEqual(visible.map((l) => l.product.id).sort());
    const all = Object.values(n.byListing);
    expect(all.reduce((s, l) => s + l.inquiriesTotal, 0)).toBeLessThanOrEqual(n.inquiries.total);
    expect(all.reduce((s, l) => s + l.awaiting, 0)).toBeLessThanOrEqual(n.inquiries.awaiting);
    expect(all.reduce((s, l) => s + l.views, 0)).toBe(n.views.listingCards);
    expect(all.some((l) => l.inquiriesTotal > 0)).toBe(true);
  });

  it('gives one entry per day in the window, oldest first, and the days add up to the window totals', async () => {
    const { services } = setup();
    const n = await services.gateway.getFarmerNumbers(farmer);
    expect(n.daily).toHaveLength(n.windowDays);
    expect([...n.daily].map((d) => d.day).sort()).toEqual(n.daily.map((d) => d.day));
    const views = n.daily.reduce((s, d) => s + d.views, 0);
    expect(views).toBe(n.views.farmProfile + n.views.listingCards);
    expect(views).toBeGreaterThan(0);
    for (const l of Object.values(n.byListing)) {
      expect(l.daily.reduce((s, d) => s + d.views, 0)).toBe(l.views);
    }
  });
});
