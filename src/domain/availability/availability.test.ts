import { describe, expect, it } from 'vitest';
import { asId, type ProductAvailability, type ProductId } from '../types';
import {
  availabilityRank,
  compareByAvailability,
  comingSoonMonths,
  confirmAvailability,
  effectiveStatus,
  isValidComingSoonMonth,
  markComingSoon,
  markUnavailable,
} from './index';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-15T12:00:00.000Z');
const settings = { availabilityWindowDays: 14 };
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const avail = (over: Partial<ProductAvailability> = {}): ProductAvailability => ({
  productId: asId<ProductId>('p1'),
  status: 'available_now',
  lastConfirmedAt: ago(DAY),
  expectedMonth: null,
  updatedAt: ago(DAY),
  ...over,
});

describe('effectiveStatus', () => {
  it('is available_now just inside the window', () => {
    expect(effectiveStatus(avail({ lastConfirmedAt: ago(13 * DAY) }), now, settings)).toBe('available_now');
  });
  it('is still available_now at exactly the window length', () => {
    expect(effectiveStatus(avail({ lastConfirmedAt: ago(14 * DAY) }), now, settings)).toBe('available_now');
  });
  it('lapses one millisecond later', () => {
    expect(effectiveStatus(avail({ lastConfirmedAt: ago(14 * DAY + 1) }), now, settings)).toBe('unconfirmed');
  });
  it('takes the window from settings, not a constant', () => {
    const a = avail({ lastConfirmedAt: ago(5 * DAY) });
    expect(effectiveStatus(a, now, { availabilityWindowDays: 7 })).toBe('available_now');
    expect(effectiveStatus(a, now, { availabilityWindowDays: 5 })).toBe('available_now');
    expect(effectiveStatus(avail({ lastConfirmedAt: ago(5 * DAY + 1) }), now, { availabilityWindowDays: 5 })).toBe('unconfirmed');
    expect(effectiveStatus(a, now, { availabilityWindowDays: 3 })).toBe('unconfirmed');
  });
  it('null lastConfirmedAt is unconfirmed', () => {
    expect(effectiveStatus(avail({ lastConfirmedAt: null }), now, settings)).toBe('unconfirmed');
  });
  it('a future lastConfirmedAt is available_now', () => {
    expect(effectiveStatus(avail({ lastConfirmedAt: new Date(now.getTime() + DAY).toISOString() }), now, settings)).toBe('available_now');
  });
  it('coming_soon this month and next month stays coming_soon', () => {
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: '2026-11' }), now, settings)).toBe('coming_soon');
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: '2026-12' }), now, settings)).toBe('coming_soon');
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: '2027-06' }), now, settings)).toBe('coming_soon');
  });
  it('coming_soon last month or with no month is unconfirmed', () => {
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: '2026-10' }), now, settings)).toBe('unconfirmed');
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: null }), now, settings)).toBe('unconfirmed');
  });
  it('uses the UTC month at a month boundary', () => {
    const edge = new Date('2026-12-01T00:00:00.000Z');
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: '2026-11' }), edge, settings)).toBe('unconfirmed');
    expect(effectiveStatus(avail({ status: 'coming_soon', expectedMonth: '2026-12' }), edge, settings)).toBe('coming_soon');
  });
  it('stored unconfirmed stays unconfirmed even with a fresh date', () => {
    expect(effectiveStatus(avail({ status: 'unconfirmed' }), now, settings)).toBe('unconfirmed');
  });
});

describe('ranking', () => {
  it('ranks available_now, coming_soon, unconfirmed', () => {
    expect(availabilityRank('available_now')).toBe(0);
    expect(availabilityRank('coming_soon')).toBe(1);
    expect(availabilityRank('unconfirmed')).toBe(2);
  });
  it('sorts a mixed array', () => {
    const sorted = (['unconfirmed', 'available_now', 'coming_soon', 'unconfirmed', 'available_now'] as const)
      .slice()
      .sort(compareByAvailability);
    expect(sorted).toEqual(['available_now', 'available_now', 'coming_soon', 'unconfirmed', 'unconfirmed']);
  });
});

describe('confirmAvailability', () => {
  it('re-confirms a lapsed record and reports a change', () => {
    const lapsed = avail({ lastConfirmedAt: ago(30 * DAY) });
    const r = confirmAvailability(lapsed, now, settings);
    expect(r.statusChanged).toBe(true);
    expect(r.availability.status).toBe('available_now');
    expect(r.availability.lastConfirmedAt).toBe(now.toISOString());
    expect(r.availability.updatedAt).toBe(now.toISOString());
    expect(r.availability.expectedMonth).toBeNull();
  });
  it('re-confirming a fresh record reports no change but refreshes the date', () => {
    const r = confirmAvailability(avail(), now, settings);
    expect(r.statusChanged).toBe(false);
    expect(r.availability.lastConfirmedAt).toBe(now.toISOString());
  });
  it('turns coming_soon into available_now and clears the month', () => {
    const r = confirmAvailability(avail({ status: 'coming_soon', expectedMonth: '2026-12', lastConfirmedAt: null }), now, settings);
    expect(r.statusChanged).toBe(true);
    expect(r.availability.status).toBe('available_now');
    expect(r.availability.expectedMonth).toBeNull();
  });
  it('does not mutate its input', () => {
    const input = avail({ lastConfirmedAt: ago(30 * DAY) });
    const copy = structuredClone(input);
    confirmAvailability(input, now, settings);
    expect(input).toEqual(copy);
  });
});

describe('farmer changes (AVAIL-5)', () => {
  const settingsH = { comingSoonHorizonMonths: 12 };

  it('lists the months a farmer can choose, starting this month, from settings', () => {
    const months = comingSoonMonths(now, settingsH);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-11');
    expect(months[1]).toBe('2026-12');
    expect(months[2]).toBe('2027-01');
    expect(months[11]).toBe('2027-10');
    expect(comingSoonMonths(now, { comingSoonHorizonMonths: 3 })).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('accepts only those months', () => {
    expect(isValidComingSoonMonth('2027-06', now, settingsH)).toBe(true);
    expect(isValidComingSoonMonth('2026-10', now, settingsH)).toBe(false);
    expect(isValidComingSoonMonth('2028-01', now, settingsH)).toBe(false);
    expect(isValidComingSoonMonth('June', now, settingsH)).toBe(false);
  });
  it('marks coming soon with a month and no confirmation time', () => {
    const r = markComingSoon(avail(), '2027-06', now);
    expect(r.availability).toMatchObject({ status: 'coming_soon', expectedMonth: '2027-06', lastConfirmedAt: null });
    expect(r.statusChanged).toBe(true);
    expect(effectiveStatus(r.availability, now, settings)).toBe('coming_soon');
  });
  it('marks a listing as having none right now', () => {
    const r = markUnavailable(avail(), now);
    expect(r.availability).toMatchObject({ status: 'unconfirmed', lastConfirmedAt: null, expectedMonth: null });
    expect(effectiveStatus(r.availability, now, settings)).toBe('unconfirmed');
    expect(markUnavailable(r.availability, now).statusChanged).toBe(false);
  });
  it('still available moves a coming-soon listing to available now', () => {
    const coming = markComingSoon(avail(), '2027-06', now).availability;
    const r = confirmAvailability(coming, now, settings);
    expect(r.availability).toMatchObject({ status: 'available_now', expectedMonth: null, lastConfirmedAt: now.toISOString() });
    expect(r.statusChanged).toBe(true);
  });
});
