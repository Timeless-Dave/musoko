import { z } from 'zod';
import { formatPhone } from '../inquiry/schema';
import { normalizedUnitPrice } from '../units';
import { matchUnitPreset, unitPresetsFor } from '../units/presets';
import type {
  Community,
  Coordinates,
  EventId,
  FarmPrivateLocation,
  FarmPublicLocation,
  FarmerPrivateContact,
  FarmerProfile,
  FarmerProfileId,
  Product,
  ProductAvailability,
  ProductAvailabilityHistoryEntry,
  ProductId,
  ProductQuantity,
  ProductType,
  User,
  UserId,
  UserRoleAssignment,
} from '../types';
import {
  categoryAsksLicence,
  type FarmProfileInput,
  type ListingCreateInput,
  type ListingUpdateInput,
  type QuantityInput,
  type RegistrationInput,
  farmProfileSchema,
  listingCreateSchema,
  listingUpdateSchema,
  quantityInputSchema,
  registrationSchema,
} from './schemas';
import { uniqueSlug } from './slug';

const dayOf = (now: Date): string => now.toISOString().slice(0, 10);
const orNull = (value: string | null | undefined): string | null => (value && value.trim() !== '' ? value.trim() : null);

export type Parsed<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> };

/** One validation code per field, the first that applies. */
export function fieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

export function parseWith<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, fields: fieldErrors(result.error.issues) };
}

export const parseRegistration = (input: RegistrationInput) => parseWith(registrationSchema, input);
export const parseProfile = (input: FarmProfileInput) => parseWith(farmProfileSchema, input);
export const parseListingCreate = (input: ListingCreateInput) => parseWith(listingCreateSchema, input);
export const parseListingUpdate = (input: ListingUpdateInput) => parseWith(listingUpdateSchema, input);
export const parseQuantity = (input: QuantityInput) => parseWith(quantityInputSchema, input);

// ---------------------------------------------------------------- registration

export interface RegisteredFarm {
  user: User;
  role: UserRoleAssignment;
  profile: FarmerProfile;
  publicLocation: FarmPublicLocation;
  privateLocation: FarmPrivateLocation | null;
  contact: FarmerPrivateContact;
}

/**
 * A farmer registering themselves. Consent to publish is recorded now, as
 * "farmer signed in", with today's date and the farmer as the person who
 * recorded it (CONS-2). The profile stays a draft until Musoko approves the
 * registration: "Listed" is Musoko's review, never the farmer's own claim (TRUST-1).
 * Privacy starts from what the farmer chose, and the form starts everything off.
 */
export function buildRegisteredFarm(input: {
  values: z.output<typeof registrationSchema>;
  community: Community;
  userId: UserId;
  profileId: FarmerProfileId;
  takenSlugs: Iterable<string>;
  now: Date;
  isDemo: boolean;
  /** Where the farm is exactly. A geocoder's answer in live mode; invented in the demo. */
  exactPoint: Coordinates | null;
}): RegisteredFarm {
  const { values, community, userId, profileId, now } = input;
  const stamp = now.toISOString();
  const phone = orNull(values.phone) === null ? null : (formatPhone(values.phone!) ?? values.phone!.trim());
  const email = orNull(values.email);
  const street = orNull(values.streetAddress);

  const profile: FarmerProfile = {
    id: profileId,
    userId,
    slug: uniqueSlug(values.farmName, input.takenSlugs),
    farmName: values.farmName,
    farmerName: values.farmerName,
    intro: values.intro,
    story: values.story,
    photos: [],
    regionId: community.regionId,
    communityId: community.id,
    createdBy: userId,
    createdByRole: 'farmer',
    registrationStatus: 'pending_review',
    publicationStatus: 'draft',
    consentMethod: 'farmer_signed_in',
    consentDate: dayOf(now),
    consentRecordedBy: userId,
    farmerReviewedLatestChanges: true,
    reviewMethod: 'farmer_signed_in',
    reviewDate: dayOf(now),
    reviewRecordedBy: userId,
    openToWholesale: values.openToWholesale,
    showExactLocation: values.showExactLocation && street !== null,
    showPhone: values.showPhone && phone !== null,
    showEmail: values.showEmail && email !== null,
    isDemo: input.isDemo,
    createdAt: stamp,
    updatedAt: stamp,
  };
  return {
    user: { id: userId, displayName: values.farmerName, createdAt: stamp },
    role: { userId, role: 'farmer' },
    profile,
    publicLocation: {
      farmerProfileId: profileId,
      communityId: community.id,
      town: community.name,
      county: community.county,
      coarsePoint: community.centre,
    },
    privateLocation:
      street !== null && input.exactPoint !== null ? { farmerProfileId: profileId, streetAddress: street, exactPoint: input.exactPoint } : null,
    contact: { farmerProfileId: profileId, phone, email },
  };
}

// ---------------------------------------------------------------- started by an administrator

/**
 * CONS-1: a profile an administrator starts for a farmer. It is a draft with no
 * consent on record, no account, and every privacy choice off, so nothing about
 * it is public until consent is recorded and Musoko lists it. The administrator
 * is the one who created it.
 */
export function buildAdminDraftFarm(input: {
  values: z.output<typeof farmProfileSchema>;
  community: Community;
  adminUserId: UserId;
  profileId: FarmerProfileId;
  takenSlugs: Iterable<string>;
  now: Date;
  isDemo: boolean;
  exactPoint: Coordinates | null;
}): Omit<RegisteredFarm, 'user' | 'role'> {
  const { values, community, profileId, now } = input;
  const stamp = now.toISOString();
  const phone = orNull(values.phone) === null ? null : (formatPhone(values.phone!) ?? values.phone!.trim());
  const email = orNull(values.email);
  const street = orNull(values.streetAddress);

  return {
    profile: {
      id: profileId,
      userId: null,
      slug: uniqueSlug(values.farmName, input.takenSlugs),
      farmName: values.farmName,
      farmerName: values.farmerName,
      intro: values.intro,
      story: values.story,
      photos: [],
      regionId: community.regionId,
      communityId: community.id,
      createdBy: input.adminUserId,
      createdByRole: 'administrator',
      registrationStatus: 'pending_review',
      publicationStatus: 'draft',
      consentMethod: null,
      consentDate: null,
      consentRecordedBy: null,
      farmerReviewedLatestChanges: false,
      reviewMethod: null,
      reviewDate: null,
      reviewRecordedBy: null,
      openToWholesale: values.openToWholesale,
      showExactLocation: false,
      showPhone: false,
      showEmail: false,
      isDemo: input.isDemo,
      createdAt: stamp,
      updatedAt: stamp,
    },
    publicLocation: {
      farmerProfileId: profileId,
      communityId: community.id,
      town: community.name,
      county: community.county,
      coarsePoint: community.centre,
    },
    privateLocation:
      street !== null && input.exactPoint !== null ? { farmerProfileId: profileId, streetAddress: street, exactPoint: input.exactPoint } : null,
    contact: { farmerProfileId: profileId, phone, email },
  };
}

// ---------------------------------------------------------------- profile edit

/** The farmer's own edit. It does not touch consent, review, or what is public beyond the words they changed. */
export function applyProfileEdit(
  profile: FarmerProfile,
  values: z.output<typeof farmProfileSchema>,
  community: Community,
  now: Date,
): { profile: FarmerProfile; contact: { phone: string | null; email: string | null }; streetAddress: string | null } {
  const phone = orNull(values.phone) === null ? null : (formatPhone(values.phone!) ?? values.phone!.trim());
  const email = orNull(values.email);
  const streetAddress = orNull(values.streetAddress);
  return {
    profile: {
      ...profile,
      farmName: values.farmName,
      farmerName: values.farmerName,
      intro: values.intro,
      story: values.story,
      communityId: community.id,
      regionId: community.regionId,
      openToWholesale: values.openToWholesale,
      // Sharing something that is no longer on file switches itself off.
      showPhone: profile.showPhone && phone !== null,
      showEmail: profile.showEmail && email !== null,
      showExactLocation: profile.showExactLocation && streetAddress !== null,
      updatedAt: now.toISOString(),
    },
    contact: { phone, email },
    streetAddress,
  };
}

// ---------------------------------------------------------------- listings

export type ListingFields = Pick<
  Product,
  | 'productTypeId'
  | 'title'
  | 'description'
  | 'priceCents'
  | 'sellingUnit'
  | 'unitSize'
  | 'normalizedUnitPriceCents'
  | 'licenceSelfConfirmed'
>;

export const KEEP_UNIT = 'keep';

/**
 * Turns the form's choices into stored fields: the preset becomes a selling unit
 * and size, the unit price is worked out, and a licence confirmation is demanded
 * where the category needs one (CLAIM-2).
 */
export function resolveListingFields(
  values: z.output<typeof listingUpdateSchema>,
  type: ProductType,
  existing: Pick<Product, 'sellingUnit' | 'unitSize'> | null,
): Parsed<ListingFields> {
  let sellingUnit: Product['sellingUnit'];
  let unitSize: Product['unitSize'];
  if (values.presetId === KEEP_UNIT && existing) {
    sellingUnit = existing.sellingUnit;
    unitSize = existing.unitSize;
  } else {
    const preset = unitPresetsFor(type).find((p) => p.id === values.presetId);
    if (!preset) return { ok: false, fields: { presetId: 'unit_required' } };
    sellingUnit = preset.sellingUnit;
    unitSize = preset.unitSize;
  }
  const asks = categoryAsksLicence(type.category);
  if (asks && !values.licenceSelfConfirmed) return { ok: false, fields: { licenceSelfConfirmed: 'licence_required' } };

  const normalized = normalizedUnitPrice({ priceCents: values.priceCents, unitSize }, type);
  return {
    ok: true,
    value: {
      productTypeId: type.id,
      title: values.title,
      description: values.description,
      priceCents: values.priceCents,
      sellingUnit,
      unitSize,
      normalizedUnitPriceCents: normalized?.cents ?? null,
      licenceSelfConfirmed: asks ? true : null,
    },
  };
}

/** The preset id a stored listing shows as selected, or "keep" for an older listing sold some other way. */
export function presetIdFor(type: ProductType, product: Pick<Product, 'sellingUnit' | 'unitSize'>): string {
  return matchUnitPreset(unitPresetsFor(type), product)?.id ?? KEEP_UNIT;
}

export function buildQuantityRow(productId: ProductId, input: z.output<typeof quantityInputSchema>, now: Date): ProductQuantity {
  return {
    productId,
    amount: input.amount,
    unit: input.unit,
    approximate: input.approximate,
    lastConfirmedAt: now.toISOString(),
  };
}

export interface NewListing {
  product: Product;
  availability: ProductAvailability;
  history: ProductAvailabilityHistoryEntry;
  quantity: ProductQuantity | null;
}

export function buildListing(input: {
  productId: ProductId;
  historyId: EventId;
  farmerProfileId: FarmerProfileId;
  userId: UserId;
  fields: ListingFields;
  status: 'available_now' | 'coming_soon';
  expectedMonth: string | null;
  quantity: z.output<typeof quantityInputSchema> | null;
  now: Date;
  isDemo: boolean;
}): NewListing {
  const stamp = input.now.toISOString();
  const available = input.status === 'available_now';
  return {
    product: {
      id: input.productId,
      farmerProfileId: input.farmerProfileId,
      ...input.fields,
      photo: null,
      moderationStatus: 'visible',
      isDemo: input.isDemo,
      createdAt: stamp,
      updatedAt: stamp,
    },
    availability: {
      productId: input.productId,
      status: input.status,
      lastConfirmedAt: available ? stamp : null,
      expectedMonth: available ? null : input.expectedMonth,
      updatedAt: stamp,
    },
    history: { id: input.historyId, productId: input.productId, status: input.status, changedAt: stamp, changedBy: input.userId },
    quantity: input.quantity && available ? buildQuantityRow(input.productId, input.quantity, input.now) : null,
  };
}
