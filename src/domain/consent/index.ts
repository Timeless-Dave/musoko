import type { FarmerProfile, UserId } from '../types';

/**
 * Consent to publish, and the review that follows an administrator's edit.
 * Pure: the time and the person come in as arguments.
 */

const dayOf = (now: Date): string => now.toISOString().slice(0, 10);

/** Method, date and who recorded it, all three. Anything less is not consent (CONS-2). */
export function hasRecordedConsent(
  profile: Pick<FarmerProfile, 'consentMethod' | 'consentDate' | 'consentRecordedBy'>,
): boolean {
  return profile.consentMethod !== null && profile.consentDate !== null && profile.consentRecordedBy !== null;
}

/** Consent is recorded and Musoko has approved the registration. Only then may a profile go public. */
export function canPublish(
  profile: Pick<FarmerProfile, 'consentMethod' | 'consentDate' | 'consentRecordedBy' | 'registrationStatus'>,
): boolean {
  return hasRecordedConsent(profile) && profile.registrationStatus === 'approved';
}

export type ProfileState =
  /** Started by an administrator. Not public until the farmer, or the administrator, records consent. */
  | 'needs_consent'
  /** Consent recorded; waiting for Musoko to review it for listing. */
  | 'pending_review'
  | 'rejected'
  | 'listed'
  /** Public, and an administrator changed something the farmer has not yet reviewed (CONS-3). */
  | 'listed_awaiting_review'
  | 'unpublished';

export function profileState(profile: FarmerProfile): ProfileState {
  if (profile.registrationStatus === 'rejected') return 'rejected';
  if (profile.publicationStatus === 'published' && hasRecordedConsent(profile)) {
    return profile.farmerReviewedLatestChanges ? 'listed' : 'listed_awaiting_review';
  }
  if (profile.publicationStatus === 'unpublished') return 'unpublished';
  return hasRecordedConsent(profile) ? 'pending_review' : 'needs_consent';
}

/**
 * The farmer approves a profile an administrator started, after signing in. Records
 * the method, the day and who recorded it. Publication still waits for Musoko's review.
 */
export function recordFarmerConsent(profile: FarmerProfile, farmerUserId: UserId, now: Date): FarmerProfile {
  if (hasRecordedConsent(profile)) return profile;
  return {
    ...profile,
    consentMethod: 'farmer_signed_in',
    consentDate: dayOf(now),
    consentRecordedBy: farmerUserId,
    farmerReviewedLatestChanges: true,
    reviewMethod: 'farmer_signed_in',
    reviewDate: dayOf(now),
    reviewRecordedBy: farmerUserId,
    updatedAt: now.toISOString(),
  };
}

/** CONS-3: the farmer's review of an administrator's changes, recorded the same way as consent. */
export function recordFarmerReview(profile: FarmerProfile, farmerUserId: UserId, now: Date): FarmerProfile {
  if (profile.farmerReviewedLatestChanges) return profile;
  return {
    ...profile,
    farmerReviewedLatestChanges: true,
    reviewMethod: 'farmer_signed_in',
    reviewDate: dayOf(now),
    reviewRecordedBy: farmerUserId,
    updatedAt: now.toISOString(),
  };
}

/** An administrator changed public information: the profile awaits the farmer's review. */
export function markAwaitingFarmerReview(profile: FarmerProfile, now: Date): FarmerProfile {
  return {
    ...profile,
    farmerReviewedLatestChanges: false,
    reviewMethod: null,
    reviewDate: null,
    reviewRecordedBy: null,
    updatedAt: now.toISOString(),
  };
}

/** CONS-4: a farmer takes their own profile off the public site at any time. */
export function unpublishProfile(profile: FarmerProfile, now: Date): FarmerProfile {
  if (profile.publicationStatus !== 'published') return profile;
  return { ...profile, publicationStatus: 'unpublished', updatedAt: now.toISOString() };
}

/** The farmer puts an unpublished profile back. Refused unless consent and approval still stand. */
export function republishProfile(profile: FarmerProfile, now: Date): FarmerProfile | null {
  if (profile.publicationStatus === 'published') return profile;
  if (profile.publicationStatus !== 'unpublished' || !canPublish(profile)) return null;
  return { ...profile, publicationStatus: 'published', updatedAt: now.toISOString() };
}
