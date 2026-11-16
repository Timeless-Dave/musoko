import type { AvailabilityStatus, ProductAvailability, Settings } from '../types';

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
