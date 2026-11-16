import { describe, expect, it } from 'vitest';
import {
  asId,
  type Community,
  type CommunityId,
  type Database,
  type FarmerProfileId,
  type Inquiry,
  type InquiryId,
  type ProductType,
  type ProductTypeId,
  type RegionId,
  type UserId,
} from '../types';
import { matchUnitPreset, unitPresetsFor } from '../units';
import {
  availabilityChangeSchema,
  buildListing,
  buildRegisteredFarm,
  categoryAsksLicence,
  checkPrivacyAgainstFile,
  farmerNumbers,
  KEEP_UNIT,
  parseListingCreate,
  parseListingUpdate,
  parseProfile,
  parseRegistration,
  pickupOptionsSchema,
  resolveListingFields,
  slugify,
  uniqueSlug,
  type RegistrationInput,
} from './index';

const now = new Date('2026-11-16T12:00:00.000Z');
const community: Community = {
  id: asId<CommunityId>('helena'), regionId: asId<RegionId>('delta'), slug: 'helena', name: 'Helena-West Helena', county: 'Phillips',
  kind: 'town', centre: { lat: 34.53, lng: -90.6 },
};
const type = (category: ProductType['category'], comparisonUnit: ProductType['comparisonUnit']): ProductType => ({
  id: asId<ProductTypeId>('t'), slug: 't', name: 'T', category, comparisonUnit,
});

const valid: RegistrationInput = {
  farmName: 'Cypress Row Farm', farmerName: 'Ada Marsh', communityId: 'helena', intro: 'Greens and eggs.', story: '',
  phone: '870-555-0142', email: null, streetAddress: null, openToWholesale: false,
  showPhone: false, showEmail: false, showExactLocation: false, consentToPublish: true,
};
const codes = (input: RegistrationInput) => {
  const r = parseRegistration(input);
  return r.ok ? [] : Object.entries(r.fields).map(([k, v]) => `${k}:${v}`);
};

describe('registration (CONS-2, PRIV-3)', () => {
  it('accepts a farmer with one way to be reached, and everything private by default', () => {
    expect(codes(valid)).toEqual([]);
  });
  it('asks for the words that make a profile', () => {
    expect(codes({ ...valid, farmName: ' ', farmerName: '', intro: '', communityId: '' })).toEqual(
      expect.arrayContaining(['farmName:farm_name_required', 'farmerName:farmer_name_required', 'intro:intro_required', 'communityId:community_required']),
    );
  });
  it('needs a phone or an email, and checks each', () => {
    expect(codes({ ...valid, phone: null, email: null })).toEqual(['phone:contact_required']);
    expect(codes({ ...valid, phone: '12345' })).toEqual(['phone:phone_invalid']);
    expect(codes({ ...valid, phone: null, email: 'not-an-email' })).toEqual(['email:email_invalid']);
    expect(codes({ ...valid, phone: null, email: 'ada@farm.example' })).toEqual([]);
  });
  it('requires the consent to publish', () => {
    expect(codes({ ...valid, consentToPublish: false })).toEqual(['consentToPublish:consent_required']);
  });
  it('refuses to share what is not on file', () => {
    expect(codes({ ...valid, showEmail: true })).toEqual(['showEmail:share_email_needs_email']);
    expect(codes({ ...valid, showExactLocation: true })).toEqual(['showExactLocation:share_location_needs_address']);
    expect(checkPrivacyAgainstFile({ showPhone: true, showEmail: false, showExactLocation: false }, { phone: null, email: null, streetAddress: null })).toEqual({
      showPhone: 'share_phone_needs_phone',
    });
  });

  it('builds a draft with consent recorded and no verified label (TRUST-1)', () => {
    const parsed = parseRegistration({ ...valid, streetAddress: '9 Demo Road', showPhone: true });
    if (!parsed.ok) throw new Error('invalid');
    const built = buildRegisteredFarm({
      values: parsed.value, community, userId: asId<UserId>('u1'), profileId: asId<FarmerProfileId>('f1'),
      takenSlugs: ['cypress-row-farm'], now, isDemo: true, exactPoint: { lat: 34.6, lng: -90.7 },
    });
    expect(built.profile).toMatchObject({
      slug: 'cypress-row-farm-2',
      registrationStatus: 'pending_review',
      publicationStatus: 'draft',
      createdByRole: 'farmer',
      consentMethod: 'farmer_signed_in',
      consentDate: '2026-11-16',
      consentRecordedBy: 'u1',
      showPhone: true,
      showEmail: false,
      showExactLocation: false,
    });
    expect(built.contact).toEqual({ farmerProfileId: 'f1', phone: '870-555-0142', email: null });
    expect(built.privateLocation).toMatchObject({ streetAddress: '9 Demo Road', exactPoint: { lat: 34.6, lng: -90.7 } });
    // The public location is the town centre, never the exact point.
    expect(built.publicLocation.coarsePoint).toEqual(community.centre);
    expect(built.role).toEqual({ userId: 'u1', role: 'farmer' });
  });
});

describe('profile edit', () => {
  it('uses the same rules as registration, without consent', () => {
    const { consentToPublish: _c, showPhone: _a, showEmail: _b, showExactLocation: _d, ...profile } = valid;
    void [_c, _a, _b, _d];
    expect(parseProfile(profile).ok).toBe(true);
    expect(parseProfile({ ...profile, phone: null, email: null }).ok).toBe(false);
  });
});

describe('slugs', () => {
  it('lowercases, drops accents and punctuation', () => {
    expect(slugify('  Chloé’s Fennel & Flint Farm! ')).toBe('chloes-fennel-and-flint-farm');
    expect(slugify('***')).toBe('farm');
  });
  it('avoids a taken slug', () => {
    expect(uniqueSlug('Ada Farm', ['ada-farm', 'ada-farm-2'])).toBe('ada-farm-3');
  });
});

describe('listing presets and unit price (PRICE)', () => {
  it('offers sized presets that always convert, and unsized ones that never do', () => {
    for (const unit of ['lb', 'oz', 'dozen', 'each', 'gallon', 'fl_oz', 'pint', 'quart'] as const) {
      const t = type('vegetables', unit);
      for (const preset of unitPresetsFor(t)) {
        const result = resolveListingFields(
          { productTypeId: t.id, title: 'x', description: '', priceCents: 1000, presetId: preset.id, licenceSelfConfirmed: true },
          t,
          null,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.normalizedUnitPriceCents === null).toBe(preset.unitSize === null);
      }
    }
  });
  it('works the unit price from the preset: a 5 lb box at $15 is $3.00 per lb', () => {
    const t = type('vegetables', 'lb');
    const r = resolveListingFields({ productTypeId: t.id, title: 'Tomatoes', description: '', priceCents: 1500, presetId: 'box-5lb', licenceSelfConfirmed: false }, t, null);
    expect(r).toMatchObject({ ok: true, value: { sellingUnit: 'box', unitSize: { amount: 5, measure: 'lb' }, normalizedUnitPriceCents: 300, licenceSelfConfirmed: null } });
  });
  it('gives no unit price for a bunch', () => {
    const t = type('vegetables', 'lb');
    expect(resolveListingFields({ productTypeId: t.id, title: 'Collards', description: '', priceCents: 400, presetId: 'bunch', licenceSelfConfirmed: false }, t, null)).toMatchObject({
      ok: true,
      value: { sellingUnit: 'bunch', unitSize: null, normalizedUnitPriceCents: null },
    });
  });
  it('keeps an older listing’s unit when asked to', () => {
    const t = type('other', 'lb');
    const existing = { sellingUnit: 'pack' as const, unitSize: { amount: 7, measure: 'oz' as const } };
    expect(matchUnitPreset(unitPresetsFor(t), existing)).toBeNull();
    const r = resolveListingFields({ productTypeId: t.id, title: 'x', description: '', priceCents: 700, presetId: KEEP_UNIT, licenceSelfConfirmed: false }, t, existing);
    expect(r).toMatchObject({ ok: true, value: { sellingUnit: 'pack', unitSize: { amount: 7, measure: 'oz' } } });
  });
  it('rejects a preset that does not belong to the product type', () => {
    const t = type('eggs', 'dozen');
    expect(resolveListingFields({ productTypeId: t.id, title: 'x', description: '', priceCents: 500, presetId: 'box-5lb', licenceSelfConfirmed: true }, t, null)).toEqual({
      ok: false,
      fields: { presetId: 'unit_required' },
    });
  });
});

describe('licence self-confirmation (CLAIM-2)', () => {
  it('asks for meat, poultry, dairy and eggs only', () => {
    expect(['meat_poultry', 'dairy', 'eggs'].every((c) => categoryAsksLicence(c as ProductType['category']))).toBe(true);
    expect(['vegetables', 'fruits', 'herbs', 'grains_legumes', 'other'].some((c) => categoryAsksLicence(c as ProductType['category']))).toBe(false);
  });
  it('refuses such a listing without the farmer’s confirmation, and stores it as farmer-reported true', () => {
    const t = type('dairy', 'gallon');
    const base = { productTypeId: t.id, title: 'Milk', description: '', priceCents: 800, presetId: 'gallon' };
    expect(resolveListingFields({ ...base, licenceSelfConfirmed: false }, t, null)).toEqual({ ok: false, fields: { licenceSelfConfirmed: 'licence_required' } });
    expect(resolveListingFields({ ...base, licenceSelfConfirmed: true }, t, null)).toMatchObject({ ok: true, value: { licenceSelfConfirmed: true } });
  });
});

describe('listing forms', () => {
  const base = { productTypeId: 't', title: 'Tomatoes', description: '', priceCents: 300, presetId: 'lb', licenceSelfConfirmed: false };
  it('needs a price in whole cents above zero', () => {
    expect(parseListingUpdate({ ...base, priceCents: 0 })).toMatchObject({ ok: false, fields: { priceCents: 'price_invalid' } });
    expect(parseListingUpdate({ ...base, priceCents: 2.5 })).toMatchObject({ ok: false });
    expect(parseListingUpdate(base).ok).toBe(true);
  });
  it('needs a month for coming soon', () => {
    const create = { ...base, status: 'coming_soon' as const, expectedMonth: null, quantity: null };
    expect(parseListingCreate(create)).toMatchObject({ ok: false, fields: { expectedMonth: 'month_invalid' } });
    expect(parseListingCreate({ ...create, expectedMonth: '2027-06' }).ok).toBe(true);
  });
  it('stores a quantity only on a listing that is available now (QTY-2)', () => {
    const parsed = parseListingCreate({ ...base, status: 'coming_soon', expectedMonth: '2027-06', quantity: { amount: 5, unit: 'lb', approximate: true } });
    if (!parsed.ok) throw new Error('invalid');
    const built = buildListing({
      productId: 'p1' as never, historyId: 'h1' as never, farmerProfileId: 'f1' as never, userId: 'u1' as never,
      fields: { productTypeId: 't' as never, title: 'x', description: '', priceCents: 300, sellingUnit: 'lb', unitSize: null, normalizedUnitPriceCents: null, licenceSelfConfirmed: null },
      status: parsed.value.status, expectedMonth: parsed.value.expectedMonth, quantity: parsed.value.quantity, now, isDemo: true,
    });
    expect(built.quantity).toBeNull();
    expect(built.availability).toMatchObject({ status: 'coming_soon', expectedMonth: '2027-06', lastConfirmedAt: null });
  });
  it('a new available-now listing is confirmed now, with its own quantity time (QTY-1)', () => {
    const built = buildListing({
      productId: 'p1' as never, historyId: 'h1' as never, farmerProfileId: 'f1' as never, userId: 'u1' as never,
      fields: { productTypeId: 't' as never, title: 'x', description: '', priceCents: 300, sellingUnit: 'lb', unitSize: null, normalizedUnitPriceCents: null, licenceSelfConfirmed: null },
      status: 'available_now', expectedMonth: null, quantity: { amount: 20, unit: 'lb', approximate: true }, now, isDemo: true,
    });
    expect(built.availability.lastConfirmedAt).toBe(now.toISOString());
    expect(built.quantity).toMatchObject({ amount: 20, unit: 'lb', approximate: true, lastConfirmedAt: now.toISOString() });
    expect(built.product.moderationStatus).toBe('visible');
    expect(built.product.photo).toBeNull();
  });
});

describe('availability changes (AVAIL-5, QTY-4)', () => {
  it('takes one tap, with or without a quantity in the same step', () => {
    expect(availabilityChangeSchema.safeParse({ kind: 'still_available' }).success).toBe(true);
    expect(availabilityChangeSchema.safeParse({ kind: 'still_available', quantity: { amount: 12, unit: 'dozen', approximate: true } }).success).toBe(true);
    expect(availabilityChangeSchema.safeParse({ kind: 'still_available', quantity: null }).success).toBe(true);
    expect(availabilityChangeSchema.safeParse({ kind: 'still_available', quantity: { amount: 0, unit: 'dozen', approximate: true } }).success).toBe(false);
  });
  it('needs a month for coming soon', () => {
    expect(availabilityChangeSchema.safeParse({ kind: 'coming_soon', expectedMonth: '' }).success).toBe(false);
    expect(availabilityChangeSchema.safeParse({ kind: 'coming_soon', expectedMonth: '2027-03' }).success).toBe(true);
  });
});

describe('pickup options', () => {
  it('needs a place for a market or pickup point, and nothing for delivery', () => {
    expect(pickupOptionsSchema.safeParse([{ kind: 'farmers_market', marketId: null, pickupLocationId: null, note: '' }]).success).toBe(false);
    expect(pickupOptionsSchema.safeParse([{ kind: 'own_delivery', marketId: null, pickupLocationId: null, note: 'Tuesdays' }]).success).toBe(true);
  });
});

describe('the farmer’s own numbers', () => {
  const farm = asId<FarmerProfileId>('f1');
  const HOUR = 3_600_000;
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR).toISOString();
  const inq = (n: number, over: Partial<Inquiry>): Inquiry =>
    ({ id: asId<InquiryId>(`i${n}`), farmerProfileId: farm, status: 'awaiting_response', createdAt: at(1), respondedAt: null, closedReason: null, ...over }) as Inquiry;
  const db = {
    inquiries: [
      inq(1, {}),
      inq(2, { status: 'responded', createdAt: at(10), respondedAt: at(8) }),
      inq(3, { status: 'closed', closedReason: 'outcome_recorded', createdAt: at(30), respondedAt: at(24) }),
      inq(4, { status: 'closed', closedReason: 'unanswered', createdAt: at(24 * 40) }),
      { ...inq(5, {}), farmerProfileId: asId<FarmerProfileId>('someone-else') },
    ],
    inquiry_outcomes: [{ inquiryId: asId<InquiryId>('i3'), outcome: 'sale', recordedAt: at(1) }],
    products: [], product_availability: [], product_types: [], product_quantities: [],
  } as unknown as Database;

  it('counts only this farm’s inquiries, by status, and the recent window', () => {
    const n = farmerNumbers(db, farm, now, { farmerNumbersWindowDays: 30, availabilityWindowDays: 14 });
    expect(n.inquiries).toEqual({ total: 4, recent: 3, awaiting: 1, responded: 1, closed: 2, closedUnanswered: 1 });
  });
  it('works the typical time to reply from the inquiries that were answered', () => {
    const n = farmerNumbers(db, farm, now, { farmerNumbersWindowDays: 30, availabilityWindowDays: 14 });
    expect(n.replies).toEqual({ answered: 2, medianHours: 4 });
  });
  it('counts outcomes as the farmer reported them', () => {
    const n = farmerNumbers(db, farm, now, { farmerNumbersWindowDays: 30, availabilityWindowDays: 14 });
    expect(n.outcomes).toEqual({ recorded: 1, sale: 1, new_potential_customer: 0, no: 0, still_discussing: 0 });
  });
  it('has no typical time when nothing was answered', () => {
    const empty = { ...db, inquiries: [inq(1, {})] } as Database;
    expect(farmerNumbers(empty, farm, now, { farmerNumbersWindowDays: 30, availabilityWindowDays: 14 }).replies.medianHours).toBeNull();
  });
});
