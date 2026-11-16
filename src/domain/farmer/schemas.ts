import { z } from 'zod';
import { phoneDigits } from '../inquiry/schema';
import type { ClaimType, PickupOptionKind, ProductCategory, SellingUnit } from '../types';

/**
 * The farmer-side forms' schemas. The form, the demo store and the live server
 * action all validate with them. Messages are codes, not sentences: the words
 * a farmer reads live in src/content/copy.ts.
 */
export const FARMER_LIMITS = {
  farmNameMax: 80,
  nameMax: 80,
  introMax: 200,
  storyMax: 800,
  emailMax: 120,
  addressMax: 140,
  titleMax: 80,
  descriptionMax: 300,
  priceMaxCents: 100_000,
  noteMax: 200,
  replyMessageMax: 200,
  claimLabelMax: 100,
  claimsMax: 12,
  quantityMax: 100_000,
} as const;

export type FarmerFieldError =
  | 'farm_name_required'
  | 'farm_name_too_long'
  | 'farmer_name_required'
  | 'farmer_name_too_long'
  | 'community_required'
  | 'intro_required'
  | 'intro_too_long'
  | 'story_too_long'
  | 'phone_invalid'
  | 'email_invalid'
  | 'contact_required'
  | 'address_too_long'
  | 'consent_required'
  | 'share_phone_needs_phone'
  | 'share_email_needs_email'
  | 'share_location_needs_address'
  | 'type_required'
  | 'title_required'
  | 'title_too_long'
  | 'description_too_long'
  | 'price_invalid'
  | 'unit_required'
  | 'licence_required'
  | 'month_invalid'
  | 'quantity_invalid'
  | 'note_too_long'
  | 'claim_label_required'
  | 'claim_label_too_long'
  | 'too_many_claims'
  | 'option_target_required'
  | 'message_too_long'
  | 'message_has_contact'
  | 'confirm_required'
  | 'phone_missing'
  | 'reply_closed';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const code = (value: FarmerFieldError): string => value;
const blank = (value: string | null | undefined): boolean => value === null || value === undefined || value.trim() === '';

/** The unit list is the same as the inquiry form's; kept here so this file stands alone. */
export const SELLING_UNITS = [
  'lb', 'oz', 'each', 'dozen', 'bunch', 'basket', 'box', 'bag', 'jar', 'bottle', 'carton', 'flat',
  'pint', 'quart', 'half_gallon', 'gallon', 'bushel', 'pack',
] as const satisfies readonly SellingUnit[];

// ---------------------------------------------------------------- profile

const profileShape = {
  farmName: z.string().trim().min(1, code('farm_name_required')).max(FARMER_LIMITS.farmNameMax, code('farm_name_too_long')),
  farmerName: z.string().trim().min(1, code('farmer_name_required')).max(FARMER_LIMITS.nameMax, code('farmer_name_too_long')),
  communityId: z.string().min(1, code('community_required')),
  intro: z.string().trim().min(1, code('intro_required')).max(FARMER_LIMITS.introMax, code('intro_too_long')),
  story: z.string().trim().max(FARMER_LIMITS.storyMax, code('story_too_long')),
  phone: z.string().trim().max(40).nullable(),
  email: z.string().trim().max(FARMER_LIMITS.emailMax).nullable(),
  /** Private. Never public, and kept apart from the profile. */
  streetAddress: z.string().trim().max(FARMER_LIMITS.addressMax, code('address_too_long')).nullable(),
  openToWholesale: z.boolean(),
};

function checkContact(
  value: { phone: string | null; email: string | null },
  ctx: z.RefinementCtx,
): void {
  if (!blank(value.phone) && phoneDigits(value.phone!) === null) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: code('phone_invalid') });
  }
  if (!blank(value.email) && !EMAIL.test(value.email!)) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: code('email_invalid') });
  }
  // A farmer with no way to be reached cannot receive an inquiry.
  if (blank(value.phone) && blank(value.email)) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: code('contact_required') });
  }
}

/** Editing an existing profile. */
export const farmProfileSchema = z.object(profileShape).superRefine(checkContact);
export type FarmProfileInput = z.input<typeof farmProfileSchema>;

/** What the farmer chooses to make public. Everything defaults to off. */
const privacyShape = {
  showPhone: z.boolean(),
  showEmail: z.boolean(),
  showExactLocation: z.boolean(),
};

/** Sharing something that is not on file is refused: the toggle would promise what it cannot do. */
export function checkPrivacyAgainstFile(
  privacy: { showPhone: boolean; showEmail: boolean; showExactLocation: boolean },
  onFile: { phone: string | null; email: string | null; streetAddress: string | null },
): Partial<Record<keyof typeof privacyShape, FarmerFieldError>> {
  const errors: Partial<Record<keyof typeof privacyShape, FarmerFieldError>> = {};
  if (privacy.showPhone && blank(onFile.phone)) errors.showPhone = 'share_phone_needs_phone';
  if (privacy.showEmail && blank(onFile.email)) errors.showEmail = 'share_email_needs_email';
  if (privacy.showExactLocation && blank(onFile.streetAddress)) errors.showExactLocation = 'share_location_needs_address';
  return errors;
}

export const privacySchema = z.object(privacyShape);
export type PrivacyInput = z.input<typeof privacySchema>;

/** A new farmer. Consent to publish is part of registering, and is recorded with the date. */
export const registrationSchema = z
  .object({
    ...profileShape,
    ...privacyShape,
    consentToPublish: z.boolean(),
  })
  .superRefine((value, ctx) => {
    checkContact(value, ctx);
    if (!value.consentToPublish) ctx.addIssue({ code: 'custom', path: ['consentToPublish'], message: code('consent_required') });
    for (const [path, error] of Object.entries(checkPrivacyAgainstFile(value, value))) {
      ctx.addIssue({ code: 'custom', path: [path], message: code(error) });
    }
  });
export type RegistrationInput = z.input<typeof registrationSchema>;

// ---------------------------------------------------------------- claims

const CLAIM_TYPES = ['snap_ebt', 'practice', 'licence', 'certification'] as const satisfies readonly ClaimType[];

/** The farmer's own claims. Always stored as "farmer-reported"; only an administrator can verify one. */
export const farmerClaimsSchema = z
  .array(
    z.object({
      type: z.enum(CLAIM_TYPES),
      label: z.string().trim().min(1, code('claim_label_required')).max(FARMER_LIMITS.claimLabelMax, code('claim_label_too_long')),
    }),
  )
  .max(FARMER_LIMITS.claimsMax, code('too_many_claims'));
export type FarmerClaimsInput = z.input<typeof farmerClaimsSchema>;

// ---------------------------------------------------------------- pickup

const OPTION_KINDS = ['pickup_location', 'farmers_market', 'own_delivery'] as const satisfies readonly PickupOptionKind[];

export const pickupOptionsSchema = z.array(
  z
    .object({
      kind: z.enum(OPTION_KINDS),
      pickupLocationId: z.string().min(1).nullable(),
      marketId: z.string().min(1).nullable(),
      note: z.string().trim().max(FARMER_LIMITS.noteMax, code('note_too_long')),
    })
    .superRefine((value, ctx) => {
      if (value.kind === 'pickup_location' && value.pickupLocationId === null) {
        ctx.addIssue({ code: 'custom', path: ['pickupLocationId'], message: code('option_target_required') });
      }
      if (value.kind === 'farmers_market' && value.marketId === null) {
        ctx.addIssue({ code: 'custom', path: ['marketId'], message: code('option_target_required') });
      }
    }),
);
export type PickupOptionsInput = z.input<typeof pickupOptionsSchema>;

// ---------------------------------------------------------------- listings

export const quantityInputSchema = z.object({
  amount: z.number(code('quantity_invalid')).positive(code('quantity_invalid')).max(FARMER_LIMITS.quantityMax, code('quantity_invalid')),
  unit: z.enum(SELLING_UNITS, code('quantity_invalid')),
  /** The farmer's estimate. Musoko never presents it as exact unless the farmer says so. */
  approximate: z.boolean(),
});
export type QuantityInput = z.input<typeof quantityInputSchema>;

/** Categories where the farmer confirms they hold the licence or permit the sale needs. */
const LICENCE_CATEGORIES: readonly ProductCategory[] = ['meat_poultry', 'dairy', 'eggs'];
export function categoryAsksLicence(category: ProductCategory): boolean {
  return LICENCE_CATEGORIES.includes(category);
}

const listingShape = {
  productTypeId: z.string().min(1, code('type_required')),
  title: z.string().trim().min(1, code('title_required')).max(FARMER_LIMITS.titleMax, code('title_too_long')),
  description: z.string().trim().max(FARMER_LIMITS.descriptionMax, code('description_too_long')),
  priceCents: z
    .number(code('price_invalid'))
    .int(code('price_invalid'))
    .positive(code('price_invalid'))
    .max(FARMER_LIMITS.priceMaxCents, code('price_invalid')),
  /** A preset id for the product type, or "keep" to leave an older listing's unit alone. */
  presetId: z.string().min(1, code('unit_required')),
  licenceSelfConfirmed: z.boolean(),
};

export const listingUpdateSchema = z.object(listingShape);
export type ListingUpdateInput = z.input<typeof listingUpdateSchema>;

/** A new listing also says whether it is available now or coming soon, and may state a quantity. */
export const listingCreateSchema = z
  .object({
    ...listingShape,
    status: z.enum(['available_now', 'coming_soon']),
    expectedMonth: z.string().nullable(),
    quantity: quantityInputSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'coming_soon' && blank(value.expectedMonth)) {
      ctx.addIssue({ code: 'custom', path: ['expectedMonth'], message: code('month_invalid') });
    }
  });
export type ListingCreateInput = z.input<typeof listingCreateSchema>;

/** The three one-tap changes on a listing (AVAIL-5, QTY-4). */
export const availabilityChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('still_available'),
    /** undefined leaves the quantity alone; null clears it; a value replaces it in the same step (QTY-4). */
    quantity: quantityInputSchema.nullable().optional(),
  }),
  z.object({ kind: z.literal('coming_soon'), expectedMonth: z.string().min(1, code('month_invalid')) }),
  z.object({ kind: z.literal('not_available') }),
]);
export type AvailabilityChange = z.input<typeof availabilityChangeSchema>;
