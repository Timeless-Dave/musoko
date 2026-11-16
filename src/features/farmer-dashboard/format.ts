import { format } from 'date-fns';
import { copy } from '@/content/copy';
import type { UnitPreset } from '@/domain/units';
import type { MeasureUnit, SellingUnit, YearMonth } from '@/domain/types';

const UNIT_NAME: Record<SellingUnit, string> = {
  lb: 'lb', oz: 'oz', each: 'each', dozen: 'dozen', bunch: 'bunch', basket: 'basket', box: 'box', bag: 'bag', jar: 'jar',
  bottle: 'bottle', carton: 'carton', flat: 'flat', pint: 'pint', quart: 'quart', half_gallon: 'half gallon', gallon: 'gallon',
  bushel: 'bushel', pack: 'pack',
};
const MEASURE_NAME: Record<MeasureUnit, string> = {
  lb: 'lb', oz: 'oz', gallon: 'gallon', quart: 'quart', pint: 'pint', fl_oz: 'fl oz', each: '', dozen: 'dozen',
};
const PLURAL: Record<SellingUnit, string> = {
  lb: 'lb', oz: 'oz', each: 'each', dozen: 'dozen', bunch: 'bunches', basket: 'baskets', box: 'boxes', bag: 'bags', jar: 'jars',
  bottle: 'bottles', carton: 'cartons', flat: 'flats', pint: 'pints', quart: 'quarts', half_gallon: 'half gallons', gallon: 'gallons',
  bushel: 'bushels', pack: 'packs',
};

/** "box", "half gallon". For "for one ___". */
export const unitName = (unit: SellingUnit): string => UNIT_NAME[unit];
/** "boxes", "lb", "each". For counting. */
export const unitCount = (unit: SellingUnit): string => PLURAL[unit];

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const SELF_MEASURED = new Set<SellingUnit>(['lb', 'oz', 'pint', 'quart', 'gallon', 'half_gallon', 'dozen']);

/** The plain description of a preset: "5 lb box", "Dozen", "By the bunch". */
export function presetLabel(preset: UnitPreset): string {
  const words = copy.dashboard.listingForm;
  if (preset.id === 'lb') return words.sellLb;
  if (preset.unitSize === null) {
    const unsized = words.sellUnsized as Record<string, string>;
    return unsized[preset.sellingUnit] ?? capital(unitName(preset.sellingUnit));
  }
  if (SELF_MEASURED.has(preset.sellingUnit)) return capital(unitName(preset.sellingUnit));
  if (preset.unitSize.measure === 'each') {
    return preset.sellingUnit === 'each' ? 'Each' : `${capital(unitName(preset.sellingUnit))} of ${preset.unitSize.amount}`;
  }
  return `${preset.unitSize.amount} ${MEASURE_NAME[preset.unitSize.measure]} ${unitName(preset.sellingUnit)}`;
}

/** "June 2027" from "2027-06". */
export function monthName(month: YearMonth): string {
  return format(new Date(`${month}-01T12:00:00`), 'MMMM yyyy');
}

/** "June" for a short line. */
export function monthShort(month: YearMonth): string {
  return format(new Date(`${month}-01T12:00:00`), 'MMMM');
}
