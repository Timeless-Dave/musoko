import { format } from 'date-fns';

/** Whole dollars read "$15"; anything else reads "$4.50". */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

const PER_LABEL: Record<string, string> = {
  lb: 'lb',
  oz: 'oz',
  gallon: 'gallon',
  quart: 'quart',
  pint: 'pint',
  fl_oz: 'fl oz',
  each: 'each',
  dozen: 'dozen',
};

/** "$3.00 per lb". Unit prices always carry two decimals so columns align. */
export function formatUnitPrice(unitPrice: { cents: number; per: string }): string {
  return `$${(unitPrice.cents / 100).toFixed(2)} per ${PER_LABEL[unitPrice.per] ?? unitPrice.per}`;
}

const SELLING_UNIT_LABEL: Record<string, string> = {
  half_gallon: 'half gallon',
};
const CONTAINERS = new Set(['box', 'bag', 'jar', 'bottle', 'carton', 'flat', 'pack', 'basket']);

function article(size: string): 'a' | 'an' {
  return /^(8|11|18|80)\b/.test(size) ? 'an' : 'a';
}

/** "$15 for a 5 lb box", "$5 a dozen", "$4 for an 8 oz bag". */
export function formatListingPrice(
  priceCents: number,
  sellingUnit: string,
  unitSize: { amount: number; measure: string } | null,
): string {
  const price = formatMoney(priceCents);
  const unit = SELLING_UNIT_LABEL[sellingUnit] ?? sellingUnit;
  if (unitSize && CONTAINERS.has(sellingUnit)) {
    const size = `${unitSize.amount} ${PER_LABEL[unitSize.measure] ?? unitSize.measure}`;
    return `${price} for ${article(size)} ${size} ${unit}`;
  }
  return `${price} a ${unit}`;
}

/** "3 Nov 2026": day, short month, year. No weekday, no ordinal. */
export function formatDate(value: string | Date): string {
  return format(typeof value === 'string' ? new Date(value) : value, 'd MMM yyyy');
}

/**
 * "4.50" or "$4" to whole cents. Null for anything that is not a plain amount
 * with at most two decimals, so a typo is caught rather than rounded.
 */
export function parseDollars(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** 450 to "4.50", 1500 to "15", for filling a price field. */
export function centsToDollarsText(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}
