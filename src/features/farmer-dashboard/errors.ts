import { copy } from '@/content/copy';
import { GatewayError } from '@/data/ports';

const WORDS = copy.farmerErrors as Record<string, string>;

/** The sentence for a validation code. Unknown codes read as a plain "try again". */
export function words(code: string | undefined, fallback: string): string {
  return (code && WORDS[code]) || fallback;
}

/** Field name to sentence, from a rejected gateway call. Empty when the failure was not about fields. */
export function fieldWords(error: unknown): Record<string, string> {
  if (!(error instanceof GatewayError) || !error.detail.fields) return {};
  return Object.fromEntries(Object.entries(error.detail.fields).map(([field, code]) => [field, words(code, copy.dashboard.notice.failed)]));
}

/**
 * One sentence for a whole-form failure: the form's own code, or the fallback. Null
 * when the failure is about named fields, which already show their own sentence
 * beside the field, so the same words are not said twice.
 */
export function failureWords(error: unknown, fallback: string): string | null {
  if (error instanceof GatewayError && error.detail.fields) {
    const fields = error.detail.fields;
    if (fields.form) return words(fields.form, fallback);
    if (Object.keys(fields).length > 0) return null;
  }
  return fallback;
}
