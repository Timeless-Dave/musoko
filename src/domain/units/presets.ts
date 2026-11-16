import type { MeasureKind, Product, ProductType, SellingUnit, UnitSize } from '../types';
import { measureKind } from './index';

/**
 * A way of selling, chosen from a short list instead of typed. The label is a
 * plain description the farmer reads; the unit and size feed the unit price.
 */
export interface UnitPreset {
  id: string;
  sellingUnit: SellingUnit;
  /** null for bunch, basket and unsized each: no unit price is shown for those. */
  unitSize: UnitSize | null;
}

const unsized: UnitPreset[] = [
  { id: 'bunch', sellingUnit: 'bunch', unitSize: null },
  { id: 'basket', sellingUnit: 'basket', unitSize: null },
  { id: 'each', sellingUnit: 'each', unitSize: null },
];

const WEIGHT: UnitPreset[] = [
  { id: 'lb', sellingUnit: 'lb', unitSize: { amount: 1, measure: 'lb' } },
  { id: 'bag-1lb', sellingUnit: 'bag', unitSize: { amount: 1, measure: 'lb' } },
  { id: 'bag-2lb', sellingUnit: 'bag', unitSize: { amount: 2, measure: 'lb' } },
  { id: 'bag-5lb', sellingUnit: 'bag', unitSize: { amount: 5, measure: 'lb' } },
  { id: 'box-5lb', sellingUnit: 'box', unitSize: { amount: 5, measure: 'lb' } },
  { id: 'box-10lb', sellingUnit: 'box', unitSize: { amount: 10, measure: 'lb' } },
  { id: 'pack-8oz', sellingUnit: 'pack', unitSize: { amount: 8, measure: 'oz' } },
  { id: 'pack-12oz', sellingUnit: 'pack', unitSize: { amount: 12, measure: 'oz' } },
  { id: 'pack-1lb', sellingUnit: 'pack', unitSize: { amount: 1, measure: 'lb' } },
  { id: 'jar-12oz', sellingUnit: 'jar', unitSize: { amount: 12, measure: 'oz' } },
  { id: 'jar-1lb', sellingUnit: 'jar', unitSize: { amount: 1, measure: 'lb' } },
  { id: 'bag-4oz', sellingUnit: 'bag', unitSize: { amount: 4, measure: 'oz' } },
  ...unsized,
];

const VOLUME: UnitPreset[] = [
  { id: 'pint', sellingUnit: 'pint', unitSize: { amount: 1, measure: 'pint' } },
  { id: 'quart', sellingUnit: 'quart', unitSize: { amount: 1, measure: 'quart' } },
  { id: 'half-gallon', sellingUnit: 'half_gallon', unitSize: { amount: 0.5, measure: 'gallon' } },
  { id: 'gallon', sellingUnit: 'gallon', unitSize: { amount: 1, measure: 'gallon' } },
  { id: 'bottle-16floz', sellingUnit: 'bottle', unitSize: { amount: 16, measure: 'fl_oz' } },
  { id: 'jar-12floz', sellingUnit: 'jar', unitSize: { amount: 12, measure: 'fl_oz' } },
  { id: 'each', sellingUnit: 'each', unitSize: null },
];

const COUNT: UnitPreset[] = [
  { id: 'dozen', sellingUnit: 'dozen', unitSize: { amount: 1, measure: 'dozen' } },
  { id: 'half-dozen', sellingUnit: 'carton', unitSize: { amount: 6, measure: 'each' } },
  { id: 'flat-30', sellingUnit: 'flat', unitSize: { amount: 30, measure: 'each' } },
  { id: 'each-1', sellingUnit: 'each', unitSize: { amount: 1, measure: 'each' } },
  { id: 'bunch', sellingUnit: 'bunch', unitSize: null },
  { id: 'basket', sellingUnit: 'basket', unitSize: null },
];

const BY_KIND: Record<MeasureKind, UnitPreset[]> = { weight: WEIGHT, volume: VOLUME, count: COUNT };

/**
 * The ways to sell this product type, in a sensible order. Every sized preset
 * measures in the type's own kind (weight, volume or count), so a unit price can
 * always be worked out for it; unsized ones never produce one.
 */
export function unitPresetsFor(productType: Pick<ProductType, 'comparisonUnit'>): UnitPreset[] {
  return BY_KIND[measureKind(productType.comparisonUnit)].map((p) => ({ ...p }));
}

/** The preset a stored product matches, or null for an older listing sold some other way. */
export function matchUnitPreset(
  presets: readonly UnitPreset[],
  product: Pick<Product, 'sellingUnit' | 'unitSize'>,
): UnitPreset | null {
  return (
    presets.find(
      (p) =>
        p.sellingUnit === product.sellingUnit &&
        (p.unitSize === null
          ? product.unitSize === null
          : product.unitSize !== null &&
            p.unitSize.amount === product.unitSize.amount &&
            p.unitSize.measure === product.unitSize.measure),
    ) ?? null
  );
}
