import { z } from 'zod';
import { checkVerificationDay, isRealDay, type ClaimEvidenceError } from '../claims';
import { ADMIN_CONSENT_METHODS, hasRecordedConsent, isAwaitingFarmerReview, profileState, type ProfileState } from '../consent';
import { applyProfileEdit, buildAdminDraftFarm, toOwnFarm, type farmProfileSchema, type OwnFarm } from '../farmer';
import type { InquiryRecord } from '../inquiry';
import { autoCloseAt } from '../inquiry/lifecycle';
import type {
  Claim,
  Community,
  Database,
  FarmerProfile,
  FarmerProfileId,
  IsoDate,
  IsoDateTime,
  ModerationStatus,
  Settings,
  UserId,
} from '../types';

/**
 * The administrator's side: what the dashboard lists, and the small rules and
 * schemas its actions use. The bigger rules live next to what they govern:
 * consent in `consent`, claim evidence in `claims`, figures in `analytics`,
 * retention in `jobs`.
 */

// ---------------------------------------------------------------- input schemas

export type AdminErrorCode =
  | ClaimEvidenceError
  | 'method_required'
  | 'consent_exists'
  | 'consent_missing'
  | 'nothing_to_review'
  | 'already_decided'
  | 'target_missing'
  | 'retention_invalid'
  | 'sample_invalid';

/** Method and day for consent, or for the farmer's review of a change. The administrator who writes it is the actor. */
export const consentRecordSchema = z.object({
  method: z.enum(ADMIN_CONSENT_METHODS, 'method_required'),
  date: z.string().refine(isRealDay, 'date_invalid'),
});
export type ConsentRecordInput = z.input<typeof consentRecordSchema>;

/** Null when the day can be logged, else the code. A consent day cannot be in the future. */
export const checkRecordDay = checkVerificationDay;

export const MODERATION_KINDS = ['product', 'market', 'pickup_location'] as const;
export const moderationSchema = z.object({
  kind: z.enum(MODERATION_KINDS),
  id: z.string().min(1),
  status: z.enum(['visible', 'hidden']),
});
export type ModerationInput = z.input<typeof moderationSchema>;

export const RETENTION_LIMITS = { daysMin: 1, daysMax: 3650, sampleMin: 1, sampleMax: 100 } as const;
export const retentionSettingsSchema = z.object({
  searchEventRetentionDays: z
    .number('retention_invalid')
    .int('retention_invalid')
    .min(RETENTION_LIMITS.daysMin, 'retention_invalid')
    .max(RETENTION_LIMITS.daysMax, 'retention_invalid'),
  buyerContactRetentionDays: z
    .number('retention_invalid')
    .int('retention_invalid')
    .min(RETENTION_LIMITS.daysMin, 'retention_invalid')
    .max(RETENTION_LIMITS.daysMax, 'retention_invalid'),
  minimumSampleSize: z
    .number('sample_invalid')
    .int('sample_invalid')
    .min(RETENTION_LIMITS.sampleMin, 'sample_invalid')
    .max(RETENTION_LIMITS.sampleMax, 'sample_invalid'),
});
export type RetentionSettingsInput = z.input<typeof retentionSettingsSchema>;

// ---------------------------------------------------------------- edit on a farmer's behalf

/** The words a visitor reads on the profile. A change to any of these has to be shown to the farmer (CONS-3). */
const PUBLIC_FIELDS = ['farmName', 'farmerName', 'intro', 'story', 'communityId', 'openToWholesale'] as const;

/**
 * An administrator edits a profile for the farmer. The privacy choices are the
 * farmer's and are not touched. When anything the public reads has changed and
 * the farmer had already agreed to publication, the profile is marked "awaiting
 * farmer review" until their review is recorded (CONS-3). Phone, email and
 * street address are private, so changing only those asks for no review.
 */
export function applyAdminProfileEdit(
  profile: FarmerProfile,
  values: z.output<typeof farmProfileSchema>,
  community: Community,
  now: Date,
): ReturnType<typeof applyProfileEdit> & { publicChange: boolean } {
  const edit = applyProfileEdit(profile, values, community, now);
  const publicChange = PUBLIC_FIELDS.some((field) => edit.profile[field] !== profile[field]);
  if (!publicChange || !hasRecordedConsent(profile)) return { ...edit, publicChange };
  return {
    ...edit,
    publicChange,
    profile: {
      ...edit.profile,
      farmerReviewedLatestChanges: false,
      reviewMethod: null,
      reviewDate: null,
      reviewRecordedBy: null,
    },
  };
}

export { buildAdminDraftFarm };

// ---------------------------------------------------------------- views

const nameOf = (db: Pick<Database, 'users'>, id: UserId | null): string | null =>
  id === null ? null : (db.users.find((u) => u.id === id)?.displayName ?? null);

/** One line in the registration queue and the profile list. Carries no phone, email or address. */
export interface AdminFarmRow {
  id: FarmerProfileId;
  slug: string;
  farmName: string;
  farmerName: string;
  town: string;
  state: ProfileState;
  awaitingFarmerReview: boolean;
  registrationStatus: FarmerProfile['registrationStatus'];
  createdByRole: FarmerProfile['createdByRole'];
  consentMethod: FarmerProfile['consentMethod'];
  consentDate: IsoDate | null;
  listingCount: number;
  claimsToCheck: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  isDemo: boolean;
}

export function toAdminFarmRows(db: Database): AdminFarmRow[] {
  return db.farmer_profiles.map((profile) => ({
    id: profile.id,
    slug: profile.slug,
    farmName: profile.farmName,
    farmerName: profile.farmerName,
    town: db.farm_public_locations.find((l) => l.farmerProfileId === profile.id)?.town ?? '',
    state: profileState(profile),
    awaitingFarmerReview: isAwaitingFarmerReview(profile),
    registrationStatus: profile.registrationStatus,
    createdByRole: profile.createdByRole,
    consentMethod: profile.consentMethod,
    consentDate: profile.consentDate,
    listingCount: db.products.filter((p) => p.farmerProfileId === profile.id).length,
    claimsToCheck: db.claims.filter((c) => c.farmerProfileId === profile.id && c.status === 'farmer_reported').length,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    isDemo: profile.isDemo,
  }));
}

/** The whole profile as an administrator sees it: the private contact and address included, and who recorded what. */
export interface AdminFarm extends OwnFarm {
  awaitingFarmerReview: boolean;
  createdByName: string | null;
  consentRecordedByName: string | null;
  reviewRecordedByName: string | null;
  listingCount: number;
}

export function toAdminFarm(db: Database, farmId: FarmerProfileId): AdminFarm | null {
  const own = toOwnFarm(db, farmId);
  if (!own) return null;
  const { profile } = own;
  return {
    ...own,
    awaitingFarmerReview: isAwaitingFarmerReview(profile),
    createdByName: nameOf(db, profile.createdBy),
    consentRecordedByName: nameOf(db, profile.consentRecordedBy),
    reviewRecordedByName: nameOf(db, profile.reviewRecordedBy),
    listingCount: db.products.filter((p) => p.farmerProfileId === farmId).length,
  };
}

/** The queue: every registration waiting on Musoko, longest waiting first. */
export function registrationQueue(rows: readonly AdminFarmRow[]): AdminFarmRow[] {
  return rows.filter((r) => r.registrationStatus === 'pending_review').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Listed profiles whose latest changes the farmer has not yet reviewed (CONS-3). */
export function awaitingFarmerReview(rows: readonly AdminFarmRow[]): AdminFarmRow[] {
  return rows.filter((r) => r.awaitingFarmerReview && r.registrationStatus === 'approved').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

// ---------------------------------------------------------------- claims

export interface AdminClaimRow {
  claim: Claim;
  farmName: string;
  town: string;
  /** Whether the farm is public now. A claim on a farm that is not listed is still checkable. */
  farmListed: boolean;
  verifiedByName: string | null;
}

export function toAdminClaimRows(db: Database): AdminClaimRow[] {
  return db.claims
    .map((claim) => {
      const farm = db.farmer_profiles.find((f) => f.id === claim.farmerProfileId);
      return {
        claim,
        farmName: farm?.farmName ?? '',
        town: db.farm_public_locations.find((l) => l.farmerProfileId === claim.farmerProfileId)?.town ?? '',
        farmListed: farm ? profileState(farm) === 'listed' || profileState(farm) === 'listed_awaiting_review' : false,
        verifiedByName: claim.status === 'verified' ? nameOf(db, claim.verification.verifiedBy) : null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.claim.status === 'verified') - Number(b.claim.status === 'verified') ||
        a.farmName.localeCompare(b.farmName) ||
        a.claim.label.localeCompare(b.claim.label),
    );
}

// ---------------------------------------------------------------- moderation

export interface ModerationItem {
  kind: (typeof MODERATION_KINDS)[number];
  id: string;
  title: string;
  /** The farm a listing belongs to. Null for a market or pickup location. */
  farmName: string | null;
  town: string;
  status: ModerationStatus;
  isDemo: boolean;
}

export function toModerationItems(db: Database): ModerationItem[] {
  const items: ModerationItem[] = [
    ...db.products.map((p) => {
      const farm = db.farmer_profiles.find((f) => f.id === p.farmerProfileId);
      return {
        kind: 'product' as const,
        id: p.id,
        title: p.title,
        farmName: farm?.farmName ?? '',
        town: db.farm_public_locations.find((l) => l.farmerProfileId === p.farmerProfileId)?.town ?? '',
        status: p.moderationStatus,
        isDemo: p.isDemo,
      };
    }),
    ...db.farmers_markets.map((m) => ({
      kind: 'market' as const, id: m.id, title: m.name, farmName: null, town: m.town, status: m.moderationStatus, isDemo: m.isDemo,
    })),
    ...db.pickup_locations.map((l) => ({
      kind: 'pickup_location' as const, id: l.id, title: l.name, farmName: null, town: l.town, status: l.moderationStatus, isDemo: l.isDemo,
    })),
  ];
  // What is hidden comes first, so it is not lost in the list.
  return items.sort(
    (a, b) =>
      Number(a.status === 'visible') - Number(b.status === 'visible') ||
      a.kind.localeCompare(b.kind) ||
      (a.farmName ?? '').localeCompare(b.farmName ?? '') ||
      a.title.localeCompare(b.title),
  );
}

// ---------------------------------------------------------------- awaiting-response list

export interface AwaitingRow {
  record: InquiryRecord;
  waitingHours: number;
  reminderSentAt: IsoDateTime | null;
  /** When the inquiry closes by itself if nobody replies. */
  closesAt: IsoDateTime;
}

/**
 * STAT-1 for administrators: the inquiries still waiting for a farmer, the
 * longest-waiting first, with the reminder and the date it closes by itself.
 * Musoko promises no reply time; this list is for noticing, not for blaming.
 */
export function awaitingResponseRows(
  records: readonly InquiryRecord[],
  now: Date,
  settings: Pick<Settings, 'inquiryAutoCloseDays'>,
): AwaitingRow[] {
  return records
    .filter((r) => r.inquiry.status === 'awaiting_response')
    .map((record) => ({
      record,
      waitingHours: Math.max(0, (now.getTime() - Date.parse(record.inquiry.createdAt)) / 3_600_000),
      reminderSentAt: record.inquiry.reminderSentAt,
      closesAt: autoCloseAt(record.inquiry, settings)!.toISOString(),
    }))
    .sort((a, b) => b.waitingHours - a.waitingHours);
}
