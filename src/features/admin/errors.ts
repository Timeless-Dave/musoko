import { copy } from '@/content/copy';
import { GatewayError } from '@/data/ports';

/** Profile form codes and administrator codes, in one place. Unknown codes read as "try again". */
const WORDS: Record<string, string> = { ...copy.farmerErrors, ...copy.adminErrors };

export function words(code: string | undefined, fallback: string): string {
  return (code && WORDS[code]) || fallback;
}

/** Field name to sentence, from a rejected gateway call. Empty when the failure was not about fields. */
export function fieldWords(error: unknown): Record<string, string> {
  if (!(error instanceof GatewayError) || !error.detail.fields) return {};
  return Object.fromEntries(Object.entries(error.detail.fields).map(([field, code]) => [field, words(code, copy.admin.failed)]));
}

/**
 * One sentence for a whole-form failure: the form's own code, or the fallback.
 * Null when the failure is about named fields, which show their own sentence beside the field.
 */
export function failureWords(error: unknown, fallback: string = copy.admin.failed): string | null {
  if (error instanceof GatewayError && error.detail.fields) {
    const fields = error.detail.fields;
    if (fields.form) return words(fields.form, fallback);
    if (Object.keys(fields).length > 0) return null;
  }
  return fallback;
}
