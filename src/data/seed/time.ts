import type { IsoDate, IsoDateTime, YearMonth } from '@/domain/types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** An instant `days` before now (fractions allowed). */
export function daysAgo(now: Date, days: number): IsoDateTime {
  return new Date(now.getTime() - days * DAY).toISOString();
}
export function hoursAgo(now: Date, hours: number): IsoDateTime {
  return new Date(now.getTime() - hours * HOUR).toISOString();
}
/** A calendar day (UTC) `days` before now. */
export function dayOnly(now: Date, days = 0): IsoDate {
  return daysAgo(now, days).slice(0, 10);
}
/** The month `months` after the current UTC month. */
export function monthsAhead(now: Date, months: number): YearMonth {
  const index = now.getUTCFullYear() * 12 + now.getUTCMonth() + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}
