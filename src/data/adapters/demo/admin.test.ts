import { describe, expect, it } from 'vitest';
import type { FarmProfileInput } from '@/domain/farmer';
import { buildPublicCatalogue } from '@/domain/privacy';
import { findPrivateLeaks } from '@/domain/privacy/leaks';
import { asId, type ClaimId, type Database, type FarmerProfileId } from '@/domain/types';
import type { Suppressed } from '@/domain/analytics';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import { DEMO_ACCOUNTS } from '../../seed';
import { createDemoServices } from './index';
import { createMemoryStorage, DEMO_STORAGE_KEY, type DemoState, type DemoStorage } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const DAY = 86_400_000;

function setup(storage: DemoStorage = createMemoryStorage(), clock: { now: () => Date } = { now: () => NOW }) {
  const services = createDemoServices({ clock, storage });
  const state = () => (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!) as { state: DemoState }).state;
  return { services, storage, state, db: (): Database => state().db, gateway: services.gateway };
}

const admin: Actor = { role: 'administrator', userId: DEMO_ACCOUNTS.administrator.userId, farmerProfileId: null };
const farmer: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: DEMO_ACCOUNTS.farmer.farmerProfileId! };
const buyer: Actor = { role: 'buyer', userId: DEMO_ACCOUNTS.buyer.userId, farmerProfileId: null };
/** A farmer who says they are an administrator. The role on record is what counts. */
const forged: Actor = { role: 'administrator', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: DEMO_ACCOUNTS.farmer.farmerProfileId };

const farm = (id: string) => asId<FarmerProfileId>(id);
const input: FarmProfileInput = {
  farmName: 'Fennel Row Farm', farmerName: 'Mateo Brandvold', communityId: 'com-wynne', intro: 'Turnips and kale.', story: '',
  phone: '870-555-0111', email: null, streetAddress: '9 Demo Road 12', openToWholesale: false,
};
const consent = { method: 'in_person' as const, date: '2026-11-10' };

const failure = async (promise: Promise<unknown>): Promise<GatewayError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof GatewayError) return error;
    throw error;
  }
  throw new Error('expected the call to reject');
};
const shown = <T,>(figure: Suppressed<T>): T => {
  if (!figure.shown) throw new Error('expected a figure, got "not enough data"');
  return figure.value;
};

describe('who may use the administrator methods', () => {
  it('refuses a farmer, a buyer and a forged role, on every method, and returns nothing', async () => {
    const { gateway } = setup();
    const calls = (actor: Actor): Array<() => Promise<unknown>> => [
      () => gateway.listFarmsForAdmin(actor),
      () => gateway.getFarmForAdmin(actor, farm('farm-01')),
      () => gateway.createFarmForFarmer(actor, input),
      () => gateway.updateFarmAsAdmin(actor, farm('farm-01'), input),
      () => gateway.recordFarmConsent(actor, farm('farm-11'), consent),
      () => gateway.recordFarmReview(actor, farm('farm-08'), consent),
      () => gateway.approveFarmRegistration(actor, farm('farm-11')),
      () => gateway.declineFarmRegistration(actor, farm('farm-01')),
      () => gateway.listClaimsForAdmin(actor),
      () => gateway.verifyClaim(actor, asId<ClaimId>('claim-01'), { evidenceChecked: 'Sighted the card.', verifiedOn: '2026-11-10' }),
      () => gateway.removeClaimVerification(actor, asId<ClaimId>('claim-18')),
      () => gateway.listModerationItems(actor),
      () => gateway.setModeration(actor, { kind: 'product', id: 'prod-001', status: 'hidden' }),
      () => gateway.getPilotMetrics(actor),
      () => gateway.listNoResultSearches(actor),
      () => gateway.getRetentionView(actor),
      () => gateway.updateRetentionSettings(actor, { searchEventRetentionDays: 30, buyerContactRetentionDays: 30, minimumSampleSize: 5 }),
      () => gateway.runRetention(actor),
      // INQ-5, DPRIV-4: the inquiry list with buyer contact is administrators only, and farmers get their own.
      () => gateway.listInquiriesForActor(buyer),
    ];
    for (const actor of [farmer, buyer, forged]) {
      for (const call of calls(actor)) expect((await failure(call())).code).toBe('forbidden');
    }
  });

  it('lets the administrator through', async () => {
    const { gateway } = setup();
    expect((await gateway.listFarmsForAdmin(admin)).length).toBe(12);
    expect((await gateway.listInquiriesForActor(admin)).length).toBe(10);
  });
});

describe('profiles started by an administrator (CONS-1, CONS-2, TRUST-1)', () => {
  it('creates a draft with no consent, no account and nothing public', async () => {
    const { gateway, db } = setup();
    const before = await gateway.listPublicFarms();
    const created = await gateway.createFarmForFarmer(admin, input);

    expect(created.state).toBe('needs_consent');
    expect(created.profile).toMatchObject({
      userId: null, createdBy: admin.userId, createdByRole: 'administrator', publicationStatus: 'draft',
      consentMethod: null, showPhone: false, showEmail: false, showExactLocation: false, isDemo: true,
    });
    expect(created.createdByName).toBe('Demo Administrator');
    expect(created.contact.phone).toBe('870-555-0111');
    expect(created.streetAddress).toBe('9 Demo Road 12');
    expect(db().farm_private_locations.some((l) => l.farmerProfileId === created.profile.id)).toBe(true);

    expect(await gateway.listPublicFarms()).toEqual(before);
    expect(await gateway.getPublicFarmBySlug(created.profile.slug)).toBeNull();
  });

  it('rejects an incomplete form with codes and stores nothing', async () => {
    const { gateway, db } = setup();
    await gateway.listPublicFarms();
    const count = db().farmer_profiles.length;
    const error = await failure(gateway.createFarmForFarmer(admin, { ...input, farmName: '', phone: null, email: null }));
    expect(error.detail.fields).toMatchObject({ farmName: 'farm_name_required', phone: 'contact_required' });
    expect(db().farmer_profiles).toHaveLength(count);
  });

  it('CONS-2: records the method, the day and who recorded it, and still publishes nothing', async () => {
    const { gateway } = setup();
    const created = await gateway.createFarmForFarmer(admin, input);
    const after = await gateway.recordFarmConsent(admin, created.profile.id, consent);
    expect(after.profile).toMatchObject({ consentMethod: 'in_person', consentDate: '2026-11-10', consentRecordedBy: admin.userId, publicationStatus: 'draft' });
    expect(after.consentRecordedByName).toBe('Demo Administrator');
    expect(after.state).toBe('pending_review');
    expect(await gateway.getPublicFarmBySlug(created.profile.slug)).toBeNull();
    // Not overwritten.
    expect((await failure(gateway.recordFarmConsent(admin, created.profile.id, { method: 'by_phone', date: '2026-11-11' }))).detail.fields).toEqual({ form: 'consent_exists' });
  });

  it('CONS-2: a method is needed, and the day has to be a real day that is not in the future', async () => {
    const { gateway } = setup();
    const id = farm('farm-11');
    expect((await failure(gateway.recordFarmConsent(admin, id, { method: 'farmer_signed_in' as 'in_person', date: '2026-11-10' }))).detail.fields).toEqual({ method: 'method_required' });
    expect((await failure(gateway.recordFarmConsent(admin, id, { method: 'by_phone', date: '2026-11-16' }))).detail.fields).toEqual({ date: 'date_future' });
    expect((await failure(gateway.recordFarmConsent(admin, id, { method: 'by_phone', date: '2026-02-31' }))).detail.fields).toEqual({ date: 'date_invalid' });
    expect((await gateway.getFarmForAdmin(admin, id)).profile.consentMethod).toBeNull();
  });

  it('TRUST-1: approval needs consent first; then the profile is Listed at the town centre, with nothing private public', async () => {
    const { gateway, db } = setup();
    const created = await gateway.createFarmForFarmer(admin, { ...input, email: 'mateo@fennel.example' });
    expect((await failure(gateway.approveFarmRegistration(admin, created.profile.id))).detail.fields).toEqual({ form: 'consent_missing' });
    expect(await gateway.getPublicFarmBySlug(created.profile.slug)).toBeNull();

    await gateway.recordFarmConsent(admin, created.profile.id, consent);
    const listed = await gateway.approveFarmRegistration(admin, created.profile.id);
    expect(listed.state).toBe('listed');
    expect(listed.profile).toMatchObject({ registrationStatus: 'approved', publicationStatus: 'published' });

    const publicFarm = (await gateway.getPublicFarmBySlug(created.profile.slug))!;
    expect(publicFarm.location.precision).toBe('town_centre');
    expect(publicFarm.contact).toEqual({ phone: null, email: null });
    const json = JSON.stringify(await gateway.listPublicFarms());
    for (const secret of ['9 Demo Road 12', '870-555-0111', 'mateo@fennel.example']) expect(json).not.toContain(secret);
    expect(findPrivateLeaks(buildPublicCatalogue(db(), NOW, db().settings), db())).toEqual([]);
    // Approving never produces a "Verified" anything on the profile.
    expect(JSON.stringify(publicFarm)).not.toMatch(/verified/i);
    expect(publicFarm.claims).toEqual([]);
  });

  it('declining takes a listed profile off the site and keeps it; approving again lists it', async () => {
    const { gateway } = setup();
    const id = farm('farm-02');
    expect(await gateway.getPublicFarmBySlug('willowmere-hens')).not.toBeNull();
    const off = await gateway.declineFarmRegistration(admin, id);
    expect(off.state).toBe('rejected');
    expect(await gateway.getPublicFarmBySlug('willowmere-hens')).toBeNull();
    expect((await gateway.listPublicProducts()).some((p) => p.farm.id === id)).toBe(false);
    expect((await failure(gateway.declineFarmRegistration(admin, id))).detail.fields).toEqual({ form: 'already_decided' });
    expect((await gateway.getFarmForAdmin(admin, id)).claims.length).toBeGreaterThan(0);

    await gateway.approveFarmRegistration(admin, id);
    expect(await gateway.getPublicFarmBySlug('willowmere-hens')).not.toBeNull();
  });

  it('a farm that registered itself is in the queue, with its own consent, until Musoko approves it', async () => {
    const { gateway } = setup();
    const { farmerProfileId } = await gateway.registerFarmer({
      farmName: 'Cypress Row Farm', farmerName: 'Ada Marsh', communityId: 'com-pine-bluff', intro: 'Greens.', story: '', phone: '870-555-0142',
      email: null, streetAddress: null, openToWholesale: false, showPhone: false, showEmail: false, showExactLocation: false, consentToPublish: true,
    });
    const row = (await gateway.listFarmsForAdmin(admin)).find((r) => r.id === farmerProfileId)!;
    expect(row).toMatchObject({ state: 'pending_review', createdByRole: 'farmer', consentMethod: 'farmer_signed_in', registrationStatus: 'pending_review' });
    expect((await gateway.approveFarmRegistration(admin, farmerProfileId)).state).toBe('listed');
  });
});

describe('editing on a farmer’s behalf (CONS-3)', () => {
  it('marks a listed profile awaiting farmer review when public words change, and the change is live', async () => {
    const { gateway } = setup();
    const id = farm('farm-02');
    const before = await gateway.getFarmForAdmin(admin, id);
    expect(before.awaitingFarmerReview).toBe(false);

    const after = await gateway.updateFarmAsAdmin(admin, id, {
      farmName: before.profile.farmName, farmerName: before.profile.farmerName, communityId: before.profile.communityId,
      intro: 'Pasture-raised hens and eggs by the dozen.', story: before.profile.story, phone: before.contact.phone, email: before.contact.email,
      streetAddress: before.streetAddress, openToWholesale: before.profile.openToWholesale,
    });
    expect(after.state).toBe('listed_awaiting_review');
    expect(after.awaitingFarmerReview).toBe(true);
    expect(after.profile).toMatchObject({ farmerReviewedLatestChanges: false, reviewMethod: null, reviewRecordedBy: null });
    expect((await gateway.getPublicFarmBySlug('willowmere-hens'))!.intro).toBe('Pasture-raised hens and eggs by the dozen.');
    const row = (await gateway.listFarmsForAdmin(admin)).find((r) => r.id === id)!;
    expect(row).toMatchObject({ state: 'listed_awaiting_review', awaitingFarmerReview: true });
  });

  it('does not touch the farmer’s privacy choices, and a private-only change asks for no review', async () => {
    const { gateway } = setup();
    const id = farm('farm-02');
    const before = await gateway.getFarmForAdmin(admin, id);
    const after = await gateway.updateFarmAsAdmin(admin, id, {
      farmName: before.profile.farmName, farmerName: before.profile.farmerName, communityId: before.profile.communityId,
      intro: before.profile.intro, story: before.profile.story, phone: '870-555-0188', email: before.contact.email,
      streetAddress: before.streetAddress, openToWholesale: before.profile.openToWholesale,
    });
    expect(after.awaitingFarmerReview).toBe(false);
    expect(after.contact.phone).toBe('870-555-0188');
    expect(after.profile).toMatchObject({ showPhone: before.profile.showPhone, showEmail: before.profile.showEmail, showExactLocation: before.profile.showExactLocation });
  });

  it('CONS-3: the farmer’s review is recorded the same way, and then the mark goes', async () => {
    const { gateway } = setup();
    // Seed: farm-08 is listed with the farmer's review outstanding.
    const id = farm('farm-08');
    expect((await gateway.getFarmForAdmin(admin, id)).state).toBe('listed_awaiting_review');
    const after = await gateway.recordFarmReview(admin, id, { method: 'by_phone', date: '2026-11-14' });
    expect(after.state).toBe('listed');
    expect(after.profile).toMatchObject({ farmerReviewedLatestChanges: true, reviewMethod: 'by_phone', reviewDate: '2026-11-14', reviewRecordedBy: admin.userId });
    expect(after.reviewRecordedByName).toBe('Demo Administrator');
    expect((await failure(gateway.recordFarmReview(admin, id, consent))).detail.fields).toEqual({ form: 'nothing_to_review' });
  });

  it('the farmer’s own review through their dashboard clears the same mark (MODE-2)', async () => {
    const { gateway } = setup();
    const id = farm('farm-01');
    const own = await gateway.getFarmForAdmin(admin, id);
    await gateway.updateFarmAsAdmin(admin, id, {
      farmName: own.profile.farmName, farmerName: own.profile.farmerName, communityId: own.profile.communityId, intro: 'A new line from Musoko.',
      story: own.profile.story, phone: own.contact.phone, email: own.contact.email, streetAddress: own.streetAddress, openToWholesale: own.profile.openToWholesale,
    });
    expect((await gateway.getOwnFarm(farmer)).state).toBe('listed_awaiting_review');
    await gateway.confirmOwnReview(farmer);
    expect((await gateway.getFarmForAdmin(admin, id)).awaitingFarmerReview).toBe(false);
  });
});

describe('claims (TRUST-1, TRUST-2)', () => {
  const claimId = asId<ClaimId>('claim-01');

  it('verifies one claim with the evidence and the day, and the public sees "verified" and the day only', async () => {
    const { gateway } = setup();
    const row = await gateway.verifyClaim(admin, claimId, { evidenceChecked: 'SNAP/EBT authorisation letter sighted by an administrator.', verifiedOn: '2026-11-12' });
    expect(row.claim).toMatchObject({
      status: 'verified',
      verification: { evidenceChecked: 'SNAP/EBT authorisation letter sighted by an administrator.', verifiedOn: '2026-11-12', verifiedBy: admin.userId },
    });
    expect(row.verifiedByName).toBe('Demo Administrator');

    const publicFarm = (await gateway.getPublicFarmBySlug('cypress-knee-gardens'))!;
    expect(publicFarm.claims.find((c) => c.id === claimId)).toMatchObject({ status: 'verified', verifiedOn: '2026-11-12' });
    // Other claims on the same farm stay farmer-reported: "verified" belongs to one claim, never to the farm.
    expect(publicFarm.claims.filter((c) => c.id !== claimId).every((c) => c.status === 'farmer_reported')).toBe(true);
    expect(JSON.stringify(publicFarm)).not.toContain('authorisation letter');
    expect(Object.keys(publicFarm)).not.toContain('verified');
  });

  it('refuses a verification with no evidence, a vague one, or a future day, and changes nothing', async () => {
    const { gateway, db } = setup();
    const status = () => db().claims.find((c) => c.id === claimId)!.status;
    await gateway.listClaimsForAdmin(admin);
    expect((await failure(gateway.verifyClaim(admin, claimId, { evidenceChecked: '   ', verifiedOn: '2026-11-12' }))).detail.fields).toEqual({ evidenceChecked: 'evidence_required' });
    expect((await failure(gateway.verifyClaim(admin, claimId, { evidenceChecked: 'ok', verifiedOn: '2026-11-12' }))).detail.fields).toEqual({ evidenceChecked: 'evidence_too_short' });
    expect((await failure(gateway.verifyClaim(admin, claimId, { evidenceChecked: 'Letter sighted by an administrator.', verifiedOn: '2026-11-16' }))).detail.fields).toEqual({ verifiedOn: 'date_future' });
    expect((await failure(gateway.verifyClaim(admin, asId<ClaimId>('nope'), { evidenceChecked: 'Letter sighted by an administrator.', verifiedOn: '2026-11-12' }))).code).toBe('not_found');
    expect(status()).toBe('farmer_reported');
  });

  it('takes a verification off and goes back to farmer-reported', async () => {
    const { gateway } = setup();
    const verified = asId<ClaimId>('claim-18');
    expect((await gateway.listClaimsForAdmin(admin)).find((r) => r.claim.id === verified)!.claim.status).toBe('verified');
    const back = await gateway.removeClaimVerification(admin, verified);
    expect(back.claim).toMatchObject({ status: 'farmer_reported', verification: null });
    expect((await gateway.getPublicFarmBySlug('willowmere-hens'))!.claims.find((c) => c.id === verified)).toMatchObject({ status: 'farmer_reported', verifiedOn: null });
  });

  it('lists the claims to check before the verified ones, and a farmer cannot verify their own', async () => {
    const { gateway } = setup();
    const rows = await gateway.listClaimsForAdmin(admin);
    const firstVerified = rows.findIndex((r) => r.claim.status === 'verified');
    expect(firstVerified).toBeGreaterThan(0);
    expect(rows.slice(0, firstVerified).every((r) => r.claim.status === 'farmer_reported')).toBe(true);
    // A farmer editing their claims only ever produces farmer-reported ones, and verified ones are kept.
    await gateway.setOwnClaims(farmer, [{ type: 'practice', label: 'Hand harvested' }]);
    expect((await gateway.getOwnFarm(farmer)).claims.every((c) => c.status === 'farmer_reported')).toBe(true);
  });
});

describe('moderation', () => {
  it('hides a listing from buyers and shows it again, and the farmer is told on their own page', async () => {
    const { gateway } = setup();
    const target = (await gateway.listPublicProducts()).find((p) => p.title === 'Collard greens')!;
    const hidden = await gateway.setModeration(admin, { kind: 'product', id: target.id, status: 'hidden' });
    expect(hidden).toMatchObject({ status: 'hidden', kind: 'product', title: 'Collard greens' });
    expect((await gateway.listPublicProducts()).some((p) => p.id === target.id)).toBe(false);
    expect((await gateway.listOwnListings(farmer)).find((l) => l.product.id === target.id)!.product.moderationStatus).toBe('hidden');
    expect((await gateway.listModerationItems(admin))[0]).toMatchObject({ id: target.id, status: 'hidden' });

    await gateway.setModeration(admin, { kind: 'product', id: target.id, status: 'visible' });
    expect((await gateway.listPublicProducts()).some((p) => p.id === target.id)).toBe(true);
  });

  it('hides a farmers market and a pickup location from the public lists', async () => {
    const { gateway } = setup();
    const market = (await gateway.listPublicMarkets())[0]!;
    const place = (await gateway.listPublicPickupLocations())[0]!;
    await gateway.setModeration(admin, { kind: 'market', id: market.id, status: 'hidden' });
    await gateway.setModeration(admin, { kind: 'pickup_location', id: place.id, status: 'hidden' });
    expect((await gateway.listPublicMarkets()).some((m) => m.id === market.id)).toBe(false);
    expect((await gateway.listPublicPickupLocations()).some((l) => l.id === place.id)).toBe(false);
  });

  it('refuses what does not exist and anything but hide or show', async () => {
    const { gateway } = setup();
    expect((await failure(gateway.setModeration(admin, { kind: 'product', id: 'nope', status: 'hidden' }))).code).toBe('not_found');
    expect((await failure(gateway.setModeration(admin, { kind: 'product', id: 'prod-001', status: 'removed' as 'hidden' }))).code).toBe('invalid');
  });
});

describe('pilot metrics and searches (METRIC, DPRIV-3, DPRIV-4, DATA-2)', () => {
  it('shows a figure where the sample is big enough and "not enough data" where it is not, in the seed', async () => {
    const { gateway } = setup();
    const metrics = await gateway.getPilotMetrics(admin);
    expect(metrics.minimumSampleSize).toBe(5);
    expect(metrics.availabilityWindowDays).toBe(14);
    expect(shown(metrics.overall.farmsListed)).toBe(11);
    expect(shown(metrics.overall.inquiriesSent)).toBeGreaterThanOrEqual(5);

    const lakeVillage = metrics.communities.find((c) => c.name === 'Lake Village')!;
    expect(lakeVillage.searches.shown).toBe(false);
    expect(lakeVillage.inquiriesSent.shown).toBe(false);
    expect(lakeVillage.snapEbtFarms.shown).toBe(false);
    expect(lakeVillage.outcomes.shown).toBe(false);
    expect(JSON.stringify(lakeVillage)).not.toMatch(/"value"/);
    // Clarendon has searches and no farm.
    const clarendon = metrics.communities.find((c) => c.name === 'Clarendon')!;
    expect(shown(clarendon.searches)).toBeGreaterThanOrEqual(5);
    expect(shown(clarendon.searchesWithNoResults)).toBeGreaterThanOrEqual(1);
    expect(clarendon.farmsListed.shown).toBe(false);
  });

  it('shows the figures to an administrator only, and the owner can lower the minimum to see more', async () => {
    const { gateway } = setup();
    expect((await failure(gateway.getPilotMetrics(farmer))).code).toBe('forbidden');
    await gateway.updateRetentionSettings(admin, { searchEventRetentionDays: 90, buyerContactRetentionDays: 30, minimumSampleSize: 1 });
    const lakeVillage = (await gateway.getPilotMetrics(admin)).communities.find((c) => c.name === 'Lake Village')!;
    expect(shown(lakeVillage.farmsListed)).toBe(1);
  });

  it('reflects a new inquiry and a farmer’s reply (MODE-2)', async () => {
    const { gateway } = setup();
    const before = shown((await gateway.getPilotMetrics(admin)).overall.inquiriesSent);
    const farmView = (await gateway.listPublicFarms()).find((f) => f.slug === 'cypress-knee-gardens')!;
    const option = farmView.pickupOptions[0]!;
    await gateway.submitInquiry(
      { farmerProfileId: farmView.id, productId: null, communityId: 'com-helena-west-helena', pickupOptionId: option.id, requestedQuantity: null, replyChannel: 'text', name: 'Lena Cho', phone: '501-555-0166', email: '', message: '' },
      { honeypot: '', openedAt: new Date(NOW.getTime() - 60_000).toISOString(), sessionKey: 'k1' },
    );
    expect(shown((await gateway.getPilotMetrics(admin)).overall.inquiriesSent)).toBe(before + 1);
    const records = await gateway.listInquiriesForActor(admin);
    expect(records.filter((r) => r.inquiry.status === 'awaiting_response').length).toBe(4);
  });

  it('DATA-2, DPRIV-4: lists the raw terms of searches with no results to an administrator, with no person in them', async () => {
    const { gateway } = setup();
    const terms = await gateway.listNoResultSearches(admin);
    expect(terms.map((t) => t.terms)).toEqual(expect.arrayContaining(['goat milk', 'catfish', 'pears']));
    for (const t of terms) expect(Object.keys(t).sort()).toEqual(['communityId', 'communityName', 'count', 'lastDay', 'terms']);
    expect((await failure(gateway.listNoResultSearches(buyer))).code).toBe('forbidden');
  });
});

describe('retention (DPRIV-2)', () => {
  const settings = { buyerContactRetentionDays: 30, minimumSampleSize: 5 };

  it('shows what is held and what is due, with counts only', async () => {
    const { gateway } = setup();
    const view = await gateway.getRetentionView(admin);
    expect(view.settings).toEqual({ searchEventRetentionDays: 90, buyerContactRetentionDays: 30, minimumSampleSize: 5 });
    expect(view.status.searchEvents.held).toBeGreaterThanOrEqual(30);
    expect(view.status.searchEvents.due).toBe(0);
    expect(JSON.stringify(view)).not.toMatch(/goat milk/);
  });

  it('rolls old searches into aggregates on demand, deletes them, and leaves the figures as they were', async () => {
    const { gateway, db, storage } = setup();
    const before = (await gateway.getPilotMetrics(admin)).overall;
    const held = db().search_events.length;

    const view = await gateway.updateRetentionSettings(admin, { ...settings, searchEventRetentionDays: 10 });
    expect(view.status.searchEvents.due).toBeGreaterThan(0);
    const due = view.status.searchEvents.due;

    const result = await gateway.runRetention(admin);
    expect(result.searchEventsRolledUp).toBe(due);
    expect(db().search_events).toHaveLength(held - due);
    expect(db().search_events.every((e) => NOW.getTime() - Date.parse(e.day) < 10 * DAY)).toBe(true);

    const after = (await gateway.getPilotMetrics(admin)).overall;
    expect(shown(after.searches)).toBe(shown(before.searches));
    expect(shown(after.searchesWithNoResults)).toBe(shown(before.searchesWithNoResults));

    // Nothing to do the second time, and it survives a reload.
    expect((await gateway.runRetention(admin)).searchEventsRolledUp).toBe(0);
    const reopened = setup(storage);
    expect((await reopened.gateway.getRetentionView(admin)).settings.searchEventRetentionDays).toBe(10);
    expect(reopened.db().search_events).toHaveLength(held - due);
  });

  it('deletes buyer contacts a set time after an inquiry closed, and keeps the inquiry', async () => {
    const { gateway, db } = setup();
    await gateway.listFarmsForAdmin(admin);
    const contacts = db().inquiry_buyer_contacts.length;
    const closed = db().inquiries.filter((i) => i.status === 'closed' && db().inquiry_buyer_contacts.some((c) => c.inquiryId === i.id));
    expect(closed.length).toBeGreaterThan(0);
    const inquiries = db().inquiries.length;

    const view = await gateway.updateRetentionSettings(admin, { searchEventRetentionDays: 90, buyerContactRetentionDays: 1, minimumSampleSize: 5 });
    expect(view.status.buyerContacts.due).toBeGreaterThan(0);
    const result = await gateway.runRetention(admin);
    expect(result.buyerContactsDeleted).toBe(view.status.buyerContacts.due);
    expect(db().inquiry_buyer_contacts.length).toBe(contacts - result.buyerContactsDeleted);
    expect(db().inquiries).toHaveLength(inquiries);
  });

  it('refuses settings outside a sane range and stores nothing', async () => {
    const { gateway } = setup();
    for (const bad of [{ searchEventRetentionDays: 0 }, { buyerContactRetentionDays: 4000 }, { minimumSampleSize: 0 }, { minimumSampleSize: 2.5 }]) {
      const error = await failure(gateway.updateRetentionSettings(admin, { searchEventRetentionDays: 90, buyerContactRetentionDays: 30, minimumSampleSize: 5, ...bad }));
      expect(error.code).toBe('invalid');
    }
    expect((await gateway.getRetentionView(admin)).settings.minimumSampleSize).toBe(5);
  });
});

describe('MODE-1: administrator actions survive a reload and a role switch', () => {
  it('keeps a consent, an approval, a verification and a hidden listing', async () => {
    const storage = createMemoryStorage();
    const first = setup(storage);
    const { gateway } = first;
    await gateway.recordFarmConsent(admin, farm('farm-11'), consent);
    await gateway.approveFarmRegistration(admin, farm('farm-11'));
    await gateway.verifyClaim(admin, asId<ClaimId>('claim-01'), { evidenceChecked: 'Letter sighted by an administrator.', verifiedOn: '2026-11-12' });
    await gateway.setModeration(admin, { kind: 'product', id: 'prod-001', status: 'hidden' });
    await first.services.demo!.switchRole('buyer');
    await first.services.demo!.switchRole('administrator');

    const second = setup(storage);
    expect((await second.gateway.getFarmForAdmin(admin, farm('farm-11'))).state).toBe('listed');
    expect(await second.gateway.getPublicFarmBySlug('fennel-and-flint-farm')).not.toBeNull();
    expect((await second.gateway.listClaimsForAdmin(admin)).find((r) => r.claim.id === 'claim-01')!.claim.status).toBe('verified');
    expect((await second.gateway.listPublicProducts()).some((p) => p.id === 'prod-001')).toBe(false);
  });
});
