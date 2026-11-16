import type {
  MeasureKind,
  MeasureUnit,
  NormalizedUnitPrice,
  Product,
  ProductType,
} from '../types';

export const MEASURE_KIND: Record<MeasureUnit, MeasureKind> = {
  lb: 'weight',
  oz: 'weight',
  gallon: 'volume',
  quart: 'volume',
  pint: 'volume',
  fl_oz: 'volume',
  each: 'count',
  dozen: 'count',
};

/** How many base units (oz, fl_oz, each) one of each unit holds. */
const TO_BASE: Record<MeasureUnit, number> = {
  oz: 1,
  lb: 16,
  fl_oz: 1,
  pint: 16,
  quart: 32,
  gallon: 128,
  each: 1,
  dozen: 12,
};

export function measureKind(unit: MeasureUnit): MeasureKind {
  return MEASURE_KIND[unit];
}

/** null when the two units are of different kinds. */
export function convertMeasure(amount: number, from: MeasureUnit, to: MeasureUnit): number | null {
  if (MEASURE_KIND[from] !== MEASURE_KIND[to]) return null;
  return (amount * TO_BASE[from]) / TO_BASE[to];
}

export function normalizedUnitPrice(
  product: Pick<Product, 'priceCents' | 'unitSize'>,
  productType: Pick<ProductType, 'comparisonUnit'>,
): NormalizedUnitPrice | null {
  const size = product.unitSize;
  if (size === null) return null;
  if (!Number.isFinite(size.amount) || size.amount <= 0) return null;
  if (!Number.isFinite(product.priceCents) || product.priceCents < 0) return null;
  const sizeInComparison = convertMeasure(size.amount, size.measure, productType.comparisonUnit);
  if (sizeInComparison === null || sizeInComparison <= 0) return null;
  return {
    cents: Math.round(product.priceCents / sizeInComparison),
    per: productType.comparisonUnit,
  };
}

export * from './presets';
