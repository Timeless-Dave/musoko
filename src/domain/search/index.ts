import type { ProductType, Settings } from '../types';

const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;
const PHONE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g;
/** Rough street-address shapes; terms after scrubbing should not carry locators. */
const STREET = /\b\d{1,6}\s+[\w.'\s]{2,40}\s(?:st|street|rd|road|ave|avenue|dr|drive|ln|lane|hwy|highway)\b/gi;

/**
 * Trim, shorten, and strip fragments that look like contact or address detail.
 * The stored string is what administrators see in raw search events.
 */
export function scrubSearchTerms(raw: string, settings: Settings): string {
  let terms = raw.trim().replace(/\s+/g, ' ');
  terms = terms.replace(EMAIL, ' ').replace(PHONE, ' ').replace(STREET, ' ');
  terms = terms.replace(/\s+/g, ' ').trim();
  if (terms.length > settings.searchTermMaxLength) {
    terms = terms.slice(0, settings.searchTermMaxLength).trim();
  }
  return terms;
}

/** Best-effort product-type match from scrubbed terms, used for aggregates only. */
export function matchProductType(terms: string, productTypes: readonly ProductType[]): ProductType | null {
  if (!terms) return null;
  const haystack = terms.toLowerCase();
  let best: ProductType | null = null;
  let bestLen = 0;
  for (const type of productTypes) {
    const name = type.name.toLowerCase();
    const slug = type.slug.replace(/-/g, ' ');
    if (haystack.includes(name) && name.length > bestLen) {
      best = type;
      bestLen = name.length;
    } else if (haystack.includes(slug) && slug.length > bestLen) {
      best = type;
      bestLen = slug.length;
    }
  }
  return best;
}