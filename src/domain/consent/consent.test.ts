import { describe, expect, it } from 'vitest';
import { asId, type FarmerProfile, type FarmerProfileId, type UserId, type CommunityId, type RegionId } from '../types';
import {
  canPublish,
  hasRecordedConsent,
  markAwaitingFarmerReview,
  profileState,
  recordFarmerConsent,
  recordFarmerReview,
  republishProfile,
  unpublishProfile,
} from './index';

const now = new Date('2026-11-16T10:00:00.000Z');
const admin = asId<UserId>('u-admin');
const farmer = asId<UserId>('u-farmer');

function profile(over: Partial<FarmerProfile> = {}): FarmerProfile {
  return {
    id: asId<FarmerProfileId>('f1'), userId: farmer, slug: 'f', farmName: 'F', farmerName: 'N', intro: '', story: '', photos: [],
    regionId: asId<RegionId>('r'), communityId: asId<CommunityId>('c'), createdBy: farmer, createdByRole: 'farmer',
    registrationStatus: 'approved', publicationStatus: 'published', consentMethod: 'farmer_signed_in', consentDate: '2026-10-01',
    consentRecordedBy: farmer, farmerReviewedLatestChanges: true, reviewMethod: 'farmer_signed_in', reviewDate: '2026-10-01',
    reviewRecordedBy: farmer, openToWholesale: false, showExactLocation: false, showPhone: false, showEmail: false, isDemo: true,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
  };
}
const draftByAdmin = () =>
  profile({
    userId: null, createdBy: admin, createdByRole: 'administrator', registrationStatus: 'pending_review', publicationStatus: 'draft',
    consentMethod: null, consentDate: null, consentRecordedBy: null, farmerReviewedLatestChanges: false,
    reviewMethod: null, reviewDate: null, reviewRecordedBy: null,
  });

describe('consent (CONS-2)', () => {
  it('needs method, date and who recorded it, all three', () => {
    expect(hasRecordedConsent(profile())).toBe(true);
    expect(hasRecordedConsent(profile({ consentMethod: null }))).toBe(false);
    expect(hasRecordedConsent(profile({ consentDate: null }))).toBe(false);
    expect(hasRecordedConsent(profile({ consentRecordedBy: null }))).toBe(false);
  });

  it('publishes only with consent and an approved registration', () => {
    expect(canPublish(profile())).toBe(true);
    expect(canPublish(profile({ registrationStatus: 'pending_review' }))).toBe(false);
    expect(canPublish(draftByAdmin())).toBe(false);
  });

  it('records the farmer approving an administrator draft after signing in', () => {
    const approved = recordFarmerConsent(draftByAdmin(), farmer, now);
    expect(approved).toMatchObject({
      consentMethod: 'farmer_signed_in',
      consentDate: '2026-11-16',
      consentRecordedBy: farmer,
      farmerReviewedLatestChanges: true,
    });
    // Consent alone does not publish: Musoko's review comes next (TRUST-1).
    expect(approved.publicationStatus).toBe('draft');
    expect(profileState(approved)).toBe('pending_review');
  });

  it('leaves consent already on record untouched', () => {
    const original = profile({ consentMethod: 'in_person', consentRecordedBy: admin });
    expect(recordFarmerConsent(original, farmer, now)).toBe(original);
  });
});

describe('administrator edits and the farmer review (CONS-3)', () => {
  it('marks a profile awaiting review and clears the old review record', () => {
    const marked = markAwaitingFarmerReview(profile(), now);
    expect(marked.farmerReviewedLatestChanges).toBe(false);
    expect(marked.reviewMethod).toBeNull();
    expect(profileState(marked)).toBe('listed_awaiting_review');
  });
  it('records the farmer’s review the same way as consent', () => {
    const reviewed = recordFarmerReview(markAwaitingFarmerReview(profile(), now), farmer, now);
    expect(reviewed).toMatchObject({ farmerReviewedLatestChanges: true, reviewMethod: 'farmer_signed_in', reviewDate: '2026-11-16', reviewRecordedBy: farmer });
    expect(profileState(reviewed)).toBe('listed');
  });
});

describe('unpublish and republish (CONS-4)', () => {
  it('lets a farmer unpublish at any time', () => {
    const off = unpublishProfile(profile(), now);
    expect(off.publicationStatus).toBe('unpublished');
    expect(profileState(off)).toBe('unpublished');
  });
  it('puts a profile back only while consent and approval stand', () => {
    const off = unpublishProfile(profile(), now);
    expect(republishProfile(off, now)?.publicationStatus).toBe('published');
    expect(republishProfile({ ...off, registrationStatus: 'pending_review' }, now)).toBeNull();
    expect(republishProfile({ ...off, consentDate: null }, now)).toBeNull();
  });
  it('does not publish a draft through republish', () => {
    expect(republishProfile(profile({ publicationStatus: 'draft' }), now)).toBeNull();
  });
});

describe('profileState', () => {
  it('names each stage a farmer can be in', () => {
    expect(profileState(draftByAdmin())).toBe('needs_consent');
    expect(profileState(profile({ registrationStatus: 'pending_review', publicationStatus: 'draft' }))).toBe('pending_review');
    expect(profileState(profile({ registrationStatus: 'rejected' }))).toBe('rejected');
    expect(profileState(profile())).toBe('listed');
  });
});
