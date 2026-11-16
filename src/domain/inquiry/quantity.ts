import { convertMeasure } from '../units';
import type { MeasureUnit, Product, ProductQuantity, SellingUnit } from '../types';

export type QuantityComparison = 'exceeds' | 'within' | 'not_comparable' | 'not_stated';

/** Selling units that are also measures, so they convert directly. */
const DIRECT: Partial<Record<SellingUnit, { amount: number; unit: MeasureUnit }>> = {
  lb: { amount: 1, unit: 'lb' },
  oz: { amount: 1, unit: 'oz' },
  each: { amount: 1, unit: 'each' },
  dozen: { amount: 1, unit: 'dozen' },
  pint: { amount: 1, unit: 'pint' },
  quart: { amount: 1, unit: 'quart' },
  half_gallon: { amount: 0.5, unit: 'gallon' },
  gallon: { amount: 1, unit: 'gallon' },
};

/** An amount in a selling unit, as an amount of a measure. Null when the unit has no known size. */
function asMeasure(
  amount: number,
  unit: SellingUnit,
  product: Pick<Product, 'sellingUnit' | 'unitSize'>,
): { amount: number; unit: MeasureUnit } | null {
  const direct = DIRECT[unit];
  if (direct) return { amount: amount * direct.amount, unit: direct.unit };
  // A box, bag or jar is only as big as this product says it is.
  if (unit === product.sellingUnit && product.unitSize) {
    return { amount: amount * product.unitSize.amount, unit: product.unitSize.measure };
  }
  return null;
}

/**
 * QTY-5. Whether what the buyer asks for is more than the farmer's stated
 * estimate. Only ever advice for the buyer: sending is always allowed, and an
 * inquiry never reduces the stated quantity (QTY-3).
 */
export function compareRequestedToStated(
  requested: { amount: number; unit: SellingUnit } | null,
  stated: Pick<ProductQuantity, 'amount' | 'unit'> | null,
  product: Pick<Product, 'sellingUnit' | 'unitSize'>,
): QuantityComparison {
  if (requested === null || stated === null) return 'not_stated';
  if (!Number.isFinite(requested.amount) || requested.amount <= 0) return 'not_stated';

  // The same unit needs no size: bunch against bunch is plain arithmetic.
  if (requested.unit === stated.unit) return requested.amount > stated.amount + 1e-9 ? 'exceeds' : 'within';

  const want = asMeasure(requested.amount, requested.unit, product);
  const have = asMeasure(stated.amount, stated.unit, product);
  if (want === null || have === null) return 'not_comparable';
  const wantInHaveUnit = convertMeasure(want.amount, want.unit, have.unit);
  if (wantInHaveUnit === null) return 'not_comparable';
  return wantInHaveUnit > have.amount + 1e-9 ? 'exceeds' : 'within';
}
