import { z } from 'zod';
import { distanceKm, kmToMiles } from '../geo';
import { convertMeasure } from '../units';
import type {
  Community,
  Database,
  FarmerProfileId,
  Institution,
  InstitutionKind,
  InstitutionNeed,
  MeasureUnit,
  NeedCadence,
  ProductId,
  ProductType,
  PublicInstitution,
  PublicInstitutionNeed,
  PublicProduct,
  SellingUnit,
  YearMonth,
} from '../types';

/**
 * Institutional buyers: schools, hospitals, restaurants, colleges and food
 * pantries buying in larger amounts. They keep a profile, share planned needs
 * so farmers can plan, and send one order that Musoko splits across farms.
 * Every order still goes to each farmer as an ordinary inquiry: no checkout,
 * no payment, no promise of supply.
 */

export const INSTITUTION_KINDS = ['school', 'hospital', 'restaurant', 'university', 'food_pantry', 'other'] as const satisfies readonly InstitutionKind[];
export const NEED_CADENCES = ['weekly', 'monthly', 'one_time'] as const satisfies readonly NeedCadence[];
export const INSTITUTION_LIMITS = { nameMax: 120, aboutMax: 400, noteMax: 200, amountMax: 100_000, linesMax: 8 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const digits = (v: string) => v.replace(/\D/g, '');
const validPhone = (v: string) => {
  const d = digits(v);
  return d.length === 10 || (d.length === 11 && d.startsWith('1'));
};

/** Messages are codes; the words live in src/content/copy.ts. */
export const institutionInputSchema = z
  .object({
    name: z.string().trim().min(1, 'name_required').max(INSTITUTION_LIMITS.nameMax, 'name_too_long'),
    kind: z.enum(INSTITUTION_KINDS),
    communityId: z.string().min(1, 'town_required'),
    about: z.string().trim().max(INSTITUTION_LIMITS.aboutMax, 'too_long'),
    receivingNote: z.string().trim().max(INSTITUTION_LIMITS.noteMax, 'too_long'),
    showName: z.boolean(),
    contactName: z.string().trim().min(1, 'contact_required').max(80, 'name_too_long'),
    phone: z.string().trim().max(40).nullable(),
    email: z.string().trim().max(120).nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'contact_way_required' });
    if (v.phone && !validPhone(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone_invalid' });
    if (v.email && !EMAIL.test(v.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_invalid' });
  });
export type InstitutionInput = z.infer<typeof institutionInputSchema>;

export const needInputSchema = z
  .object({
    productTypeId: z.string().min(1, 'type_required'),
    amount: z.number('amount_invalid').positive('amount_invalid').max(INSTITUTION_LIMITS.amountMax, 'amount_invalid'),
    cadence: z.enum(NEED_CADENCES),
    startMonth: z.string().regex(MONTH, 'month_invalid'),
    endMonth: z.string().regex(MONTH, 'month_invalid'),
    note: z.string().trim().max(INSTITUTION_LIMITS.noteMax, 'too_long'),
  })
  .refine((v) => v.endMonth >= v.startMonth, { path: ['endMonth'], message: 'months_order' });
export type NeedInput = z.infer<typeof needInputSchema>;

const SELLING_UNITS = [
  'lb', 'oz', 'each', 'dozen', 'bunch', 'basket', 'box', 'bag', 'jar', 'bottle', 'carton', 'flat',
  'pint', 'quart', 'half_gallon', 'gallon', 'bushel', 'pack',
] as const satisfies readonly SellingUnit[];

export const bulkRequestSchema = z
  .object({
    organisation: z.string().trim().min(1, 'name_required').max(INSTITUTION_LIMITS.nameMax, 'name_too_long'),
    institutionId: z.string().min(1).nullable(),
    communityId: z.string().min(1).nullable(),
    contactName: z.string().trim().min(1, 'contact_required').max(80, 'name_too_long'),
    replyChannel: z.enum(['text', 'email']),
    phone: z.string().trim().max(40).nullable(),
    email: z.string().trim().max(120).nullable(),
    neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    cadence: z.enum(NEED_CADENCES),
    message: z.string().trim().max(400, 'too_long'),
    lines: z
      .array(
        z.object({
          farmerProfileId: z.string().min(1),
          productId: z.string().min(1),
          pickupOptionId: z.string().min(1).nullable(),
          amount: z.number().positive().max(10_000),
          unit: z.enum(SELLING_UNITS),
        }),
      )
      .min(1, 'lines_required')
      .max(INSTITUTION_LIMITS.linesMax, 'too_many_lines'),
  })
  .superRefine((v, ctx) => {
    if (v.replyChannel === 'text' && !(v.phone && validPhone(v.phone))) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: v.phone ? 'phone_invalid' : 'phone_required' });
    }
    if (v.replyChannel === 'email' && !(v.email && EMAIL.test(v.email))) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: v.email ? 'email_invalid' : 'email_required' });
    }
  });
export type BulkRequestInput = z.infer<typeof bulkRequestSchema>;

// ------------------------------------------------------------ public views

const KIND_NOUN: Record<InstitutionKind, string> = {
  school: 'A school',
  hospital: 'A hospital',
  restaurant: 'A restaurant',
  university: 'A college',
  food_pantry: 'A food pantry',
  other: 'An organisation',
};

export function buyerLabel(institution: Pick<Institution, 'name' | 'kind' | 'showName'>, town: string): string {
  return institution.showName ? institution.name : `${KIND_NOUN[institution.kind]} in ${town}`;
}

/** Public institutions and their planned needs. Contact rows are never read here. */
export function buildPublicInstitutions(
  db: Pick<Database, 'institutions' | 'institution_needs' | 'communities' | 'product_types'>,
): PublicInstitution[] {
  const town = new Map(db.communities.map((c) => [c.id, c.name]));
  const type = new Map(db.product_types.map((t) => [t.id, t]));
  return db.institutions.map((inst) => {
    const where = town.get(inst.communityId) ?? '';
    const label = buyerLabel(inst, where);
    const needs: PublicInstitutionNeed[] = db.institution_needs
      .filter((n) => n.institutionId === inst.id)
      .flatMap((n) => {
        const productType = type.get(n.productTypeId);
        if (!productType) return [];
        return [{
          id: n.id, institutionId: inst.id, buyerLabel: label, kind: inst.kind,
          communityId: inst.communityId, town: where, productType,
          amount: n.amount, cadence: n.cadence, startMonth: n.startMonth, endMonth: n.endMonth,
          note: n.note, isDemo: inst.isDemo,
        }];
      })
      .sort((a, b) => a.startMonth.localeCompare(b.startMonth));
    return {
      id: inst.id, slug: inst.slug, buyerLabel: label, kind: inst.kind, communityId: inst.communityId,
      town: where, about: inst.about, receivingNote: inst.receivingNote, needs, isDemo: inst.isDemo,
    };
  });
}

/** True while `month` falls inside the need's months. */
export function needActiveIn(need: Pick<InstitutionNeed, 'startMonth' | 'endMonth'>, month: YearMonth): boolean {
  return need.startMonth <= month && month <= need.endMonth;
}

/** A need expressed per month, so weekly and monthly needs add up. One-time needs count once. */
export function monthlyAmount(need: Pick<InstitutionNeed, 'amount' | 'cadence'>): number {
  if (need.cadence === 'weekly') return Math.round(need.amount * 4.33 * 10) / 10;
  return need.amount;
}

// ------------------------------------------------------------ sourcing plan

export interface SourcingLine {
  productId: ProductId;
  farmerProfileId: FarmerProfileId;
  farmName: string;
  town: string;
  miles: number | null;
  title: string;
  /** How much of the request this farm could cover, in the comparison unit. */
  amount: number;
  /** The same amount in the farm's own selling unit, rounded up. */
  sellingUnits: number;
  sellingUnit: SellingUnit;
  /** sellingUnits x price. An estimate; the farmer confirms. */
  estimateCents: number;
  /** The farm stated how much it has. False means "ask". */
  quantityKnown: boolean;
  status: PublicProduct['availability']['status'];
}
export interface SourcingPlan {
  productType: ProductType;
  requested: number;
  unit: MeasureUnit;
  lines: SourcingLine[];
  /** Covered by farms that stated a quantity. */
  covered: number;
  /** Still needed after the stated quantities; the plan asks unstated farms for it. */
  shortfall: number;
  estimateCents: number;
}

/** One selling unit of `product`, in the type's comparison unit. Null when it cannot be converted. */
export function sizeInComparison(product: Pick<PublicProduct, 'unitSize' | 'sellingUnit'>, to: MeasureUnit): number | null {
  if (product.unitSize) return convertMeasure(product.unitSize.amount, product.unitSize.measure, to);
  const asMeasure = product.sellingUnit as MeasureUnit;
  return ['lb', 'oz', 'gallon', 'quart', 'pint', 'fl_oz', 'each', 'dozen'].includes(asMeasure) ? convertMeasure(1, asMeasure, to) : null;
}

/** The farm's stated quantity in the comparison unit, or null when unstated or not convertible. */
export function statedInComparison(product: PublicProduct, to: MeasureUnit): number | null {
  const q = product.quantity;
  if (!q) return null;
  if (q.unit === product.sellingUnit) {
    const size = sizeInComparison(product, to);
    return size === null ? null : q.amount * size;
  }
  return ['lb', 'oz', 'gallon', 'quart', 'pint', 'fl_oz', 'each', 'dozen'].includes(q.unit) ? convertMeasure(q.amount, q.unit as MeasureUnit, to) : null;
}

/**
 * Splits one large request across farms. Nearest first, then cheapest per unit.
 * Farms that stated a quantity are filled first; whatever is left is asked of
 * farms that did not state one, split evenly. Listings that cannot be converted
 * to the type's unit are left out, because the amount would be a guess.
 */
export function planSourcing(input: {
  productType: ProductType;
  amount: number;
  products: PublicProduct[];
  from: Community | null;
  communities: Community[];
  maxMiles?: number;
  includeComingSoon?: boolean;
}): SourcingPlan {
  const { productType, amount } = input;
  const unit = productType.comparisonUnit;
  const centre = new Map(input.communities.map((c) => [c.id, c.centre]));
  const milesTo = (p: PublicProduct) => {
    const to = centre.get(p.farm.communityId);
    return input.from && to ? Math.round(kmToMiles(distanceKm(input.from.centre, to))) : null;
  };
  const wanted = new Set<PublicProduct['availability']['status']>(input.includeComingSoon ? ['available_now', 'coming_soon'] : ['available_now']);
  const candidates = input.products
    .filter((p) => p.productType.id === productType.id && wanted.has(p.availability.status))
    .map((p) => ({ p, miles: milesTo(p), size: sizeInComparison(p, unit), stated: statedInComparison(p, unit) }))
    .filter((c) => c.size !== null && c.size > 0)
    .filter((c) => input.maxMiles == null || c.miles == null || c.miles <= input.maxMiles)
    .sort(
      (a, b) =>
        (a.miles ?? 9999) - (b.miles ?? 9999) ||
        (a.p.normalizedUnitPrice?.cents ?? Infinity) - (b.p.normalizedUnitPrice?.cents ?? Infinity),
    );

  const lines: SourcingLine[] = [];
  let remaining = amount;
  const line = (c: (typeof candidates)[number], take: number, known: boolean): SourcingLine => {
    const units = Math.ceil(take / (c.size as number) - 1e-9);
    return {
      productId: c.p.id, farmerProfileId: c.p.farm.id, farmName: c.p.farm.farmName, town: c.p.farm.town,
      miles: c.miles, title: c.p.title, amount: Math.round(take * 10) / 10, sellingUnits: units,
      sellingUnit: c.p.sellingUnit, estimateCents: units * c.p.priceCents, quantityKnown: known, status: c.p.availability.status,
    };
  };
  for (const c of candidates) {
    if (remaining <= 0) break;
    if (c.stated === null || c.stated <= 0) continue;
    const take = Math.min(remaining, c.stated);
    lines.push(line(c, take, true));
    remaining -= take;
  }
  const covered = amount - Math.max(remaining, 0);
  const unknown = candidates.filter((c) => c.stated === null).slice(0, Math.max(0, INSTITUTION_LIMITS.linesMax - lines.length));
  if (remaining > 0 && unknown.length) {
    const share = remaining / unknown.length;
    for (const c of unknown) lines.push(line(c, share, false));
  }
  return {
    productType, requested: amount, unit, lines,
    covered: Math.round(covered * 10) / 10,
    shortfall: Math.round(Math.max(remaining, 0) * 10) / 10,
    estimateCents: lines.reduce((sum, l) => sum + l.estimateCents, 0),
  };
}
