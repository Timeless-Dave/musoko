import type { AvailabilityStatus, ProductAvailability, Settings, YearMonth } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WindowSettings = Pick<Settings, 'availabilityWindowDays'>;

function currentUtcMonth(now: Date): string {
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${m}`;
}

export function effectiveStatus(
  availability: Pick<ProductAvailability, 'status' | 'lastConfirmedAt' | 'expectedMonth'>,
  now: Date,
  settings: WindowSettings,
): AvailabilityStatus {
  switch (availability.status) {
    case 'available_now': {
      if (availability.lastConfirmedAt === null) return 'unconfirmed';
      const confirmed = Date.parse(availability.lastConfirmedAt);
      if (Number.isNaN(confirmed)) return 'unconfirmed';
      const age = now.getTime() - confirmed;
      return age <= settings.availabilityWindowDays * MS_PER_DAY ? 'available_now' : 'unconfirmed';
    }
    case 'coming_soon': {
      // YYYY-MM strings compare correctly as text.
      if (availability.expectedMonth === null) return 'unconfirmed';
      return availability.expectedMonth >= currentUtcMonth(now) ? 'coming_soon' : 'unconfirmed';
    }
    case 'unconfirmed':
      return 'unconfirmed';
  }
}

export function availabilityRank(status: AvailabilityStatus): 0 | 1 | 2 {
  switch (status) {
    case 'available_now':
      return 0;
    case 'coming_soon':
      return 1;
    case 'unconfirmed':
      return 2;
  }
}

export function compareByAvailability(a: AvailabilityStatus, b: AvailabilityStatus): number {
  return availabilityRank(a) - availabilityRank(b);
}

export function confirmAvailability(
  availability: ProductAvailability,
  now: Date,
  settings: WindowSettings,
): { availability: ProductAvailability; statusChanged: boolean } {
  const before = effectiveStatus(availability, now, settings);
  const stamp = now.toISOString();
  return {
    availability: {
      ...availability,
      status: 'available_now',
      lastConfirmedAt: stamp,
      expectedMonth: null,
      updatedAt: stamp,
    },
    statusChanged: before !== 'available_now',
  };
}

// ---------------------------------------------------------------- farmer changes (AVAIL-5)

/**
 * The months a farmer may choose for "Coming soon": this month and the next
 * `horizon - 1`, as YYYY-MM strings in order.
 */
export function comingSoonMonths(now: Date, settings: Pick<Settings, 'comingSoonHorizonMonths'>): YearMonth[] {
  const months: YearMonth[] = [];
  for (let i = 0; i < settings.comingSoonHorizonMonths; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push(currentUtcMonth(d));
  }
  return months;
}

export function isValidComingSoonMonth(
  month: string,
  now: Date,
  settings: Pick<Settings, 'comingSoonHorizonMonths'>,
): boolean {
  return comingSoonMonths(now, settings).includes(month);
}

/** The farmer says it will be ready in a month. Confirmation time is cleared: nothing is available yet. */
export function markComingSoon(
  availability: ProductAvailability,
  expectedMonth: YearMonth,
  now: Date,
): { availability: ProductAvailability; statusChanged: boolean } {
  return {
    availability: {
      ...availability,
      status: 'coming_soon',
      lastConfirmedAt: null,
      expectedMonth,
      updatedAt: now.toISOString(),
    },
    statusChanged: availability.status !== 'coming_soon',
  };
}

/** The farmer has none right now. The listing stays, as "Availability unconfirmed". */
export function markUnavailable(
  availability: ProductAvailability,
  now: Date,
): { availability: ProductAvailability; statusChanged: boolean } {
  return {
    availability: {
      ...availability,
      status: 'unconfirmed',
      lastConfirmedAt: null,
      expectedMonth: null,
      updatedAt: now.toISOString(),
    },
    statusChanged: availability.status !== 'unconfirmed',
  };
}
