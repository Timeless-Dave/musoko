import type {
  AdminClaimRow,
  AdminFarm,
  AdminFarmRow,
  ConsentRecordInput,
  ModerationInput,
  ModerationItem,
  RetentionSettingsInput,
} from '@/domain/admin';
import type { NoResultSearch, PilotMetrics } from '@/domain/analytics';
import type { FarmProfileInput } from '@/domain/farmer';
import type { VerifyClaimInput } from '@/domain/claims';
import type { RetentionStatus } from '@/domain/jobs';
import type { ClaimId, FarmerProfileId, Settings } from '@/domain/types';
import type { Actor } from './auth';

export interface RetentionView {
  settings: Pick<Settings, 'searchEventRetentionDays' | 'buyerContactRetentionDays' | 'minimumSampleSize'>;
  status: RetentionStatus;
}

/** What one retention run did. Counts only. */
export interface RetentionRunResult {
  searchEventsRolledUp: number;
  buyerContactsDeleted: number;
  inquiriesClosed: number;
  remindersSent: number;
}

/**
 * The administrator side of the gateway. Every method takes the acting user and
 * is refused unless that user is an administrator: a farmer, a buyer or nobody
 * gets `forbidden` and nothing back. Administrators see private contact and
 * address (they are the people who run the service), buyer contact on inquiries
 * (INQ-5) and raw search events (DPRIV-4); none of it is ever returned by a public method.
 *
 * Rejects with GatewayError: `forbidden`, `not_found`, `invalid` (fields in
 * `detail.fields`, as codes the form turns into words).
 */
export interface AdminGateway {
  // ----- profiles -----
  /** Every profile in every state, newest change first. No phone, email or address. */
  listFarmsForAdmin(actor: Actor): Promise<AdminFarmRow[]>;
  getFarmForAdmin(actor: Actor, farmId: FarmerProfileId): Promise<AdminFarm>;
  /**
   * CONS-1. Starts a profile for a farmer: a draft, no consent, no account, every privacy
   * choice off. Nothing about it is public until consent is recorded and Musoko lists it.
   */
  createFarmForFarmer(actor: Actor, input: FarmProfileInput): Promise<AdminFarm>;
  /**
   * CONS-3. Edits a profile for the farmer. When something the public reads changed and the
   * farmer had agreed to publication, the profile is marked "awaiting farmer review".
   */
  updateFarmAsAdmin(actor: Actor, farmId: FarmerProfileId, input: FarmProfileInput): Promise<AdminFarm>;
  /** CONS-2. Logs how the farmer agreed (in person, by phone, signed form), the day, and who recorded it. */
  recordFarmConsent(actor: Actor, farmId: FarmerProfileId, input: ConsentRecordInput): Promise<AdminFarm>;
  /** CONS-3. Logs the farmer's review of an administrator's changes the same way. */
  recordFarmReview(actor: Actor, farmId: FarmerProfileId, input: ConsentRecordInput): Promise<AdminFarm>;
  /** TRUST-1. Musoko's review: needs consent on record, lists the profile. Never produces "Verified". */
  approveFarmRegistration(actor: Actor, farmId: FarmerProfileId): Promise<AdminFarm>;
  /** Declines a registration, or takes a listed profile off the site. Nothing is deleted. */
  declineFarmRegistration(actor: Actor, farmId: FarmerProfileId): Promise<AdminFarm>;

  // ----- claims -----
  /** Every claim, the ones not yet checked first. Includes the evidence on verified ones. */
  listClaimsForAdmin(actor: Actor): Promise<AdminClaimRow[]>;
  /** TRUST-2. "Verified" attaches to this one claim, with the evidence checked and the day. */
  verifyClaim(actor: Actor, claimId: ClaimId, input: VerifyClaimInput): Promise<AdminClaimRow>;
  /** Back to "farmer-reported". */
  removeClaimVerification(actor: Actor, claimId: ClaimId): Promise<AdminClaimRow>;

  // ----- moderation -----
  /** Listings, markets and pickup locations, what is hidden first. */
  listModerationItems(actor: Actor): Promise<ModerationItem[]>;
  /** Hides a listing, market or pickup location from buyers, or shows it again. */
  setModeration(actor: Actor, input: ModerationInput): Promise<ModerationItem>;

  // ----- metrics -----
  /** METRIC-1 to 6. Every figure has been through small-sample suppression (DPRIV-3). */
  getPilotMetrics(actor: Actor): Promise<PilotMetrics>;
  /** DATA-2, DPRIV-4. The raw terms of searches that found nothing. */
  listNoResultSearches(actor: Actor): Promise<NoResultSearch[]>;

  // ----- retention -----
  getRetentionView(actor: Actor): Promise<RetentionView>;
  /** The three settings an owner still has to decide: how long raw searches and buyer contacts are kept, and the smallest sample shown. */
  updateRetentionSettings(actor: Actor, input: RetentionSettingsInput): Promise<RetentionView>;
  /** DPRIV-2. Runs the scheduled rules now: raw searches become aggregates, old buyer contacts are deleted. */
  runRetention(actor: Actor): Promise<RetentionRunResult>;
}
