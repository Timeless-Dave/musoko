import { z } from 'zod';
import type { SellingUnit } from '../types';

/**
 * The inquiry form's one schema. The form, the demo store and the live server
 * action all validate with it. Messages are codes, not sentences: the words a
 * buyer reads live in src/content/copy.ts.
 */
export const INQUIRY_LIMITS = { nameMax: 80, messageMax: 500, emailMax: 120, quantityMax: 10_000 } as const;

export type InquiryFieldError =
  | 'farm_required'
  | 'name_required'
  | 'name_too_long'
  | 'quantity_invalid'
  | 'phone_required'
  | 'phone_invalid'
  | 'email_required'
  | 'email_invalid'
  | 'message_too_long';

const SELLING_UNITS = [
  'lb', 'oz', 'each', 'dozen', 'bunch', 'basket', 'box', 'bag', 'jar', 'bottle', 'carton', 'flat',
  'pint', 'quart', 'half_gallon', 'gallon', 'bushel', 'pack',
] as const satisfies readonly SellingUnit[];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ten digits, or eleven with a leading 1. Returns the digits, or null. */
export function phoneDigits(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return null;
}

/** 870-555-0100. Null when the input is not a ten-digit number. */
export function formatPhone(input: string): string | null {
  const d = phoneDigits(input);
  return d === null ? null : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

const code = (value: InquiryFieldError): string => value;

export const inquiryRequestSchema = z
  .object({
    farmerProfileId: z.string().min(1, code('farm_required')),
    productId: z.string().min(1).nullable(),
    pickupOptionId: z.string().min(1).nullable(),
    communityId: z.string().min(1).nullable(),
    requestedQuantity: z
      .object({
        amount: z.number(code('quantity_invalid')).positive(code('quantity_invalid')).max(INQUIRY_LIMITS.quantityMax, code('quantity_invalid')),
        unit: z.enum(SELLING_UNITS, code('quantity_invalid')),
      })
      .nullable(),
    replyChannel: z.enum(['text', 'email']),
    name: z
      .string()
      .trim()
      .min(1, code('name_required'))
      .max(INQUIRY_LIMITS.nameMax, code('name_too_long')),
    phone: z.string().trim().max(40).nullable(),
    email: z.string().trim().max(INQUIRY_LIMITS.emailMax).nullable(),
    message: z.string().trim().max(INQUIRY_LIMITS.messageMax, code('message_too_long')),
  })
  .superRefine((value, ctx) => {
    // The buyer chose how the answer comes back, so that detail is required and the other is optional.
    if (value.replyChannel === 'text') {
      if (!value.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: code('phone_required') });
      else if (phoneDigits(value.phone) === null) ctx.addIssue({ code: 'custom', path: ['phone'], message: code('phone_invalid') });
    } else if (!value.email) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: code('email_required') });
    } else if (!EMAIL.test(value.email)) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: code('email_invalid') });
    }
    if (value.replyChannel === 'text' && value.email && !EMAIL.test(value.email)) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: code('email_invalid') });
    }
    if (value.replyChannel === 'email' && value.phone && phoneDigits(value.phone) === null) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: code('phone_invalid') });
    }
  });

export type InquiryRequest = z.infer<typeof inquiryRequestSchema>;
/** What the form hands over before parsing. Same shape, nothing trusted. */
export type InquiryRequestInput = z.input<typeof inquiryRequestSchema>;

/** Signals the form sends beside the request. None identifies the buyer; the session key lives only in the browser tab. */
export interface InquirySignals {
  /** The hidden field. A person leaves it empty. */
  honeypot: string;
  /** When the form was opened. */
  openedAt: string;
  /** Random per browser tab. Used only to count attempts. Never stored with the inquiry. */
  sessionKey: string;
}
