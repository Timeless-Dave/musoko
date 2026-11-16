import { inquiryRequestSchema, type InquiryRequestInput } from '@/domain/inquiry';
import type { SellingUnit } from '@/domain/types';

/** The listing radio's value when the buyer is asking about something not listed. */
export const OTHER_LISTING = '__other';

/** What the form holds while the buyer types. Every value is a string a field can show. */
export interface InquiryFormValues {
  listing: string;
  pickupOptionId: string;
  quantity: string;
  replyChannel: 'text' | 'email';
  name: string;
  phone: string;
  email: string;
  message: string;
  /** The honeypot. Named like a field a bot wants to fill. */
  website: string;
}
export type FormField = keyof InquiryFormValues;
export type FormErrors = Partial<Record<FormField, string>>;
export type Step = 1 | 2;

export const STEP_FIELDS: Record<Step, readonly FormField[]> = {
  1: ['listing', 'pickupOptionId', 'quantity'],
  2: ['name', 'phone', 'email', 'message'],
};

/** What the screen knows that the form values do not. */
export interface FormContext {
  farmerProfileId: string;
  communityId: string | null;
  /** The unit a quantity is counted in: the chosen listing's selling unit. Null when no listing is chosen. */
  unit: SellingUnit | null;
  /** The buyer must pick a listing (or "something else"): the farm has listings and none was preselected. */
  listingRequired: boolean;
  optionRequired: boolean;
}

/** The schema's paths, as the form's fields. */
const FIELD_OF_PATH: Record<string, FormField> = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  message: 'message',
  pickupOptionId: 'pickupOptionId',
  productId: 'listing',
  'requestedQuantity.amount': 'quantity',
  'requestedQuantity.unit': 'quantity',
};

const blank = (text: string): string | null => (text.trim() === '' ? null : text.trim());

/** Turns the typed values into the request the gateway takes. Nothing here is trusted: the schema judges it. */
export function toRequest(values: InquiryFormValues, ctx: FormContext): InquiryRequestInput {
  const quantityText = values.quantity.trim().replace(',', '.');
  const productId = values.listing === '' || values.listing === OTHER_LISTING ? null : values.listing;
  return {
    farmerProfileId: ctx.farmerProfileId,
    productId,
    pickupOptionId: blank(values.pickupOptionId),
    communityId: ctx.communityId,
    requestedQuantity:
      quantityText === '' || ctx.unit === null || productId === null ? null : { amount: Number(quantityText), unit: ctx.unit },
    replyChannel: values.replyChannel,
    name: values.name,
    phone: blank(values.phone),
    email: blank(values.email),
    message: values.message,
  };
}

/** One validation code per field for the fields on `steps`. The schema is the single source of the rules. */
export function validate(values: InquiryFormValues, ctx: FormContext, steps: readonly Step[]): FormErrors {
  const wanted = new Set<FormField>(steps.flatMap((s) => STEP_FIELDS[s]));
  const errors: FormErrors = {};
  const result = inquiryRequestSchema.safeParse(toRequest(values, ctx));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = FIELD_OF_PATH[issue.path.join('.')];
      if (field && wanted.has(field)) errors[field] ??= issue.message;
    }
  }
  if (wanted.has('listing') && ctx.listingRequired && values.listing === '') errors.listing = 'listing_required';
  if (wanted.has('pickupOptionId') && ctx.optionRequired && values.pickupOptionId === '') errors.pickupOptionId = 'option_required';
  return errors;
}

/** The form field a gateway field name refers to, so a server-side refusal lands beside the right input. */
export function fieldForGatewayName(name: string): FormField | null {
  return FIELD_OF_PATH[name] ?? null;
}

/** The step a field is on. */
export function stepOf(field: FormField): Step | null {
  return STEP_FIELDS[1].includes(field) ? 1 : STEP_FIELDS[2].includes(field) ? 2 : null;
}
