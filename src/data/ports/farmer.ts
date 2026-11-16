import type {
  AvailabilityChange,
  FarmProfileInput,
  FarmerClaimsInput,
  ListingCreateInput,
  ListingUpdateInput,
  OwnFarm,
  OwnListing,
  FarmerNumbers,
  PickupOptionsInput,
  PrivacyInput,
  RegistrationInput,
} from '@/domain/farmer';
import type { FarmerProfileId, ProductId, UserId } from '@/domain/types';
import type { Actor } from './auth';

export interface RegistrationReceipt {
  farmerProfileId: FarmerProfileId;
  userId: UserId;
}

/**
 * The farmer side of the gateway. Every method except `registerFarmer` takes the
 * acting user and is refused unless that user is a farmer acting on their own
 * farm. They return the farmer's own view, which includes their private contact
 * and address: those are theirs, and no public method returns them.
 *
 * Rejects with GatewayError: `forbidden`, `not_found`, `invalid` (fields in
 * `detail.fields`, as codes the form turns into words).
 */
export interface FarmerGateway {
  /**
   * A new farmer registers. Consent to publish is recorded now (CONS-2). The
   * profile is a draft until Musoko reviews it (TRUST-1); nothing is public.
   * In demo mode the browser is signed in as the new farmer.
   */
  registerFarmer(input: RegistrationInput): Promise<RegistrationReceipt>;

  getOwnFarm(actor: Actor): Promise<OwnFarm>;
  updateOwnProfile(actor: Actor, input: FarmProfileInput): Promise<OwnFarm>;
  /** Phone, email and exact location are public only when switched on here (PRIV-1, PRIV-3). */
  updateOwnPrivacy(actor: Actor, input: PrivacyInput): Promise<OwnFarm>;
  /** Replaces the farmer's own claims. Always "farmer-reported"; verified ones are untouched. */
  setOwnClaims(actor: Actor, claims: FarmerClaimsInput): Promise<OwnFarm>;
  setOwnPickupOptions(actor: Actor, options: PickupOptionsInput): Promise<OwnFarm>;
  /** CONS-4: take the profile off the public site, or put it back while consent and approval stand. */
  setOwnPublication(actor: Actor, published: boolean): Promise<OwnFarm>;
  /** CONS-2: the farmer approves a profile an administrator started, after signing in. */
  approveOwnProfile(actor: Actor): Promise<OwnFarm>;
  /** CONS-3: the farmer reviews an administrator's changes. */
  confirmOwnReview(actor: Actor): Promise<OwnFarm>;

  listOwnListings(actor: Actor): Promise<OwnListing[]>;
  createListing(actor: Actor, input: ListingCreateInput): Promise<OwnListing>;
  updateListing(actor: Actor, productId: ProductId, input: ListingUpdateInput): Promise<OwnListing>;
  removeListing(actor: Actor, productId: ProductId): Promise<void>;
  /** AVAIL-5 and QTY-4: one tap for "still available", with the quantity in the same step; coming soon; none right now. */
  farmerSetAvailability(actor: Actor, productId: ProductId, change: AvailabilityChange): Promise<OwnListing>;

  getFarmerNumbers(actor: Actor): Promise<FarmerNumbers>;
}
