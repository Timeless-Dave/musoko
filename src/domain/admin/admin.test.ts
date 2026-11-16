import { describe, expect, it } from 'vitest';
import { farmProfileSchema } from '../farmer';
import type { InquiryRecord } from '../inquiry';
import {
  asId,
  type Community,
  type CommunityId,
  type Database,
  type FarmerProfile,
  type FarmerProfileId,
  type Inquiry,
  type InquiryId,
  type RegionId,
  type UserId,
} from '../types';
import {
  applyAdminProfileEdit,
  awaitingFarmerReview,
  awaitingResponseRows,
  buildAdminDraftFarm,
  consentRecordSchema,
  moderationSchema,
  registrationQueue,
  retentionSettingsSchema,
  toAdminFarmRows,
  toModerationItems,
  type AdminFarmRow,
} from './index';

const now = new Date('2026-11-16T12:00:00.000Z');
const HOUR = 3_600_000;
const admin = asId<UserId>('u-admin');
const farmer = asId<UserId>('u-farmer');
const town: Community = {
  id: asId<CommunityId>('c1'), regionId: asId<RegionId>('r1'), slug: 'helena', name: 'Helena', county: 'Phillips', kind: 'town',
  centre: { lat: 34.5, lng: -90.6 },
};

function profile(over: Partial<FarmerProfile> = {}): FarmerProfile {
  return {
    id: asId<FarmerProfileId>('f1'), userId: farmer, slug: 'f', farmName: 'Cypress Knee', farmerName: 'Odell', intro: 'Greens.', story: 'Story.',
    photos: [], regionId: town.regionId, communityId: town.id, createdBy: farmer, createdByRole: 'farmer', registrationStatus: 'approved',
    publicationStatus: 'published', consentMethod: 'farmer_signed_in', consentDate: '2026-10-01', consentRecordedBy: farmer,
    farmerReviewedLatestChanges: true, reviewMethod: 'farmer_signed_in', reviewDate: '2026-10-01', reviewRecordedBy: farmer,
    openToWholesale: false, showExactLocation: false, showPhone: true, showEmail: false, isDemo: true,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
  };
}
const valid = (over: Record<string, unknown> = {}) =>
  farmProfileSchema.parse({
    farmName: 'Cypress Knee', farmerName: 'Odell', communityId: town.id, intro: 'Greens.', story: 'Story.', phone: '870-555-0101',
    email: null, streetAddress: null, openToWholesale: false, ...over,
  });

describe('buildAdminDraftFarm (CONS-1)', () => {
  const built = buildAdminDraftFarm({
    values: valid({ farmName: 'Fennel and Flint', phone: '(870) 555-0111', streetAddress: ' 9 Demo Road ' }),
    community: town, adminUserId: admin, profileId: asId<FarmerProfileId>('new'), takenSlugs: ['fennel-and-flint'], now, isDemo: true,
    exactPoint: { lat: 34.51, lng: -90.61 },
  });

  it('is a draft created by the administrator, with no account, no consent and nothing public', () => {
    expect(built.profile).toMatchObject({
      userId: null, createdBy: admin, createdByRole: 'administrator', registrationStatus: 'pending_review', publicationStatus: 'draft',
      consentMethod: null, consentDate: null, consentRecordedBy: null, farmerReviewedLatestChanges: false,
      showPhone: false, showEmail: false, showExactLocation: false, slug: 'fennel-and-flint-2',
    });
  });

  it('keeps the phone and the street address in the private rows, and the public location at the town centre', () => {
    expect(built.contact).toEqual({ farmerProfileId: 'new', phone: '870-555-0111', email: null });
    expect(built.privateLocation).toMatchObject({ streetAddress: '9 Demo Road' });
    expect(built.publicLocation.coarsePoint).toEqual(town.centre);
    expect(JSON.stringify(built.profile)).not.toContain('Demo Road');
    expect(JSON.stringify(built.profile)).not.toContain('555-0111');
  });
});

describe('applyAdminProfileEdit (CONS-3)', () => {
  it('marks the profile awaiting farmer review when something the public reads changed', () => {
    const edit = applyAdminProfileEdit(profile(), valid({ intro: 'Greens and sweet potatoes.' }), town, now);
    expect(edit.publicChange).toBe(true);
    expect(edit.profile).toMatchObject({ farmerReviewedLatestChanges: false, reviewMethod: null, reviewDate: null, reviewRecordedBy: null });
  });

  it('counts every public field: name, story, town and wholesale', () => {
    for (const change of [{ farmName: 'New name' }, { farmerName: 'Someone else' }, { story: 'Changed.' }, { openToWholesale: true }]) {
      expect(applyAdminProfileEdit(profile(), valid(change), town, now).publicChange).toBe(true);
    }
    const other = { ...town, id: asId<CommunityId>('c2') };
    expect(applyAdminProfileEdit(profile(), valid({ communityId: other.id }), other, now).publicChange).toBe(true);
  });

  it('asks for no review when only private details changed or nothing changed', () => {
    const phoneOnly = applyAdminProfileEdit(profile(), valid({ phone: '870-555-0188', streetAddress: '1 Road' }), town, now);
    expect(phoneOnly.publicChange).toBe(false);
    expect(phoneOnly.profile.farmerReviewedLatestChanges).toBe(true);
    expect(applyAdminProfileEdit(profile(), valid(), town, now).publicChange).toBe(false);
  });

  it('does not touch the farmer’s privacy choices', () => {
    const edit = applyAdminProfileEdit(profile({ showPhone: true }), valid({ intro: 'Changed.' }), town, now);
    expect(edit.profile).toMatchObject({ showPhone: true, showEmail: false, showExactLocation: false });
  });

  it('leaves a draft with no consent as it is: there is nothing for the farmer to review yet', () => {
    const draft = profile({ consentMethod: null, consentDate: null, consentRecordedBy: null, farmerReviewedLatestChanges: false });
    const edit = applyAdminProfileEdit(draft, valid({ intro: 'Changed.' }), town, now);
    expect(edit.profile.farmerReviewedLatestChanges).toBe(false);
    expect(edit.profile.consentMethod).toBeNull();
  });
});

describe('schemas', () => {
  it('consent takes an administrator method and a real day, never "farmer signed in"', () => {
    expect(consentRecordSchema.safeParse({ method: 'by_phone', date: '2026-11-10' }).success).toBe(true);
    expect(consentRecordSchema.safeParse({ method: 'farmer_signed_in', date: '2026-11-10' }).success).toBe(false);
    expect(consentRecordSchema.safeParse({ method: 'in_person', date: '10/11/2026' }).success).toBe(false);
  });
  it('moderation can hide or show, not delete', () => {
    expect(moderationSchema.safeParse({ kind: 'product', id: 'p1', status: 'hidden' }).success).toBe(true);
    expect(moderationSchema.safeParse({ kind: 'product', id: 'p1', status: 'removed' }).success).toBe(false);
  });
  it('retention settings stay in a sane range', () => {
    expect(retentionSettingsSchema.safeParse({ searchEventRetentionDays: 90, buyerContactRetentionDays: 30, minimumSampleSize: 5 }).success).toBe(true);
    for (const bad of [{ searchEventRetentionDays: 0 }, { buyerContactRetentionDays: 1.5 }, { minimumSampleSize: 0 }, { minimumSampleSize: 500 }]) {
      expect(retentionSettingsSchema.safeParse({ searchEventRetentionDays: 90, buyerContactRetentionDays: 30, minimumSampleSize: 5, ...bad }).success).toBe(false);
    }
  });
});

describe('the lists', () => {
  const db = {
    farmer_profiles: [
      profile({ id: asId<FarmerProfileId>('a'), farmName: 'Listed' }),
      profile({ id: asId<FarmerProfileId>('b'), farmName: 'Waiting for consent', registrationStatus: 'pending_review', publicationStatus: 'draft', consentMethod: null, consentDate: null, consentRecordedBy: null, farmerReviewedLatestChanges: false, createdAt: '2026-11-01T00:00:00.000Z' }),
      profile({ id: asId<FarmerProfileId>('c'), farmName: 'Waiting for review', registrationStatus: 'pending_review', publicationStatus: 'draft', createdAt: '2026-10-20T00:00:00.000Z' }),
      profile({ id: asId<FarmerProfileId>('d'), farmName: 'Changed by admin', farmerReviewedLatestChanges: false, updatedAt: '2026-11-10T00:00:00.000Z' }),
    ],
    farm_public_locations: [],
    products: [],
    claims: [],
    farmers_markets: [],
    pickup_locations: [],
  } as unknown as Database;

  it('the registration queue holds what waits on Musoko, longest waiting first', () => {
    expect(registrationQueue(toAdminFarmRows(db)).map((r) => r.farmName)).toEqual(['Waiting for review', 'Waiting for consent']);
  });

  it('the awaiting-farmer-review list holds listed profiles an administrator changed', () => {
    const rows: AdminFarmRow[] = toAdminFarmRows(db);
    expect(awaitingFarmerReview(rows).map((r) => r.farmName)).toEqual(['Changed by admin']);
    expect(rows.find((r) => r.farmName === 'Changed by admin')!.state).toBe('listed_awaiting_review');
    expect(rows.find((r) => r.farmName === 'Waiting for consent')!.state).toBe('needs_consent');
  });

  it('rows carry no phone, email or street address', () => {
    expect(Object.keys(toAdminFarmRows(db)[0]!)).not.toEqual(expect.arrayContaining(['phone', 'email', 'streetAddress']));
  });
});

describe('moderation items', () => {
  it('puts what is hidden first so it is not lost', () => {
    const db = {
      products: [
        { id: 'p1', title: 'Collards', farmerProfileId: 'f1', moderationStatus: 'visible', isDemo: true },
        { id: 'p2', title: 'Eggs', farmerProfileId: 'f1', moderationStatus: 'hidden', isDemo: true },
      ],
      farmer_profiles: [{ id: 'f1', farmName: 'Cypress' }],
      farm_public_locations: [{ farmerProfileId: 'f1', town: 'Helena' }],
      farmers_markets: [{ id: 'm1', name: 'Market', town: 'Helena', moderationStatus: 'visible', isDemo: true }],
      pickup_locations: [{ id: 'l1', name: 'Lot', town: 'Helena', moderationStatus: 'hidden', isDemo: true }],
    } as unknown as Database;
    expect(toModerationItems(db).map((i) => `${i.kind}:${i.title}:${i.status}`)).toEqual([
      'pickup_location:Lot:hidden',
      'product:Eggs:hidden',
      'market:Market:visible',
      'product:Collards:visible',
    ]);
  });
});

describe('awaiting-response list (STAT-1)', () => {
  const record = (n: number, hoursAgo: number, over: Partial<Inquiry> = {}): InquiryRecord =>
    ({
      inquiry: {
        id: asId<InquiryId>(`i${n}`), status: 'awaiting_response', createdAt: new Date(now.getTime() - hoursAgo * HOUR).toISOString(),
        respondedAt: null, reminderSentAt: null, ...over,
      } as Inquiry,
      buyer: null, productTitle: null, productTypeName: null, farmName: 'F', pickupName: null, reply: null, outcome: null,
    }) as InquiryRecord;

  it('lists only what still waits, longest first, with the reminder and the day it closes by itself', () => {
    const rows = awaitingResponseRows(
      [record(1, 5), record(2, 100, { reminderSentAt: '2026-11-14T00:00:00.000Z' }), record(3, 30, { status: 'responded', respondedAt: '2026-11-15T00:00:00.000Z' }), record(4, 60, { status: 'closed' })],
      now,
      { inquiryAutoCloseDays: 14 },
    );
    expect(rows.map((r) => r.record.inquiry.id)).toEqual(['i2', 'i1']);
    expect(rows[0]).toMatchObject({ waitingHours: 100, reminderSentAt: '2026-11-14T00:00:00.000Z' });
    // Fourteen days after it was sent, not after the reminder.
    expect(rows[0]!.closesAt).toBe(new Date(now.getTime() - 100 * HOUR + 14 * 24 * HOUR).toISOString());
  });
});
