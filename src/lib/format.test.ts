import { afterEach, describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it('reads a calendar day as that day, wherever the reader is', () => {
    for (const tz of ['UTC', 'America/Chicago', 'Pacific/Auckland']) {
      process.env.TZ = tz;
      expect(formatDate('2026-11-10')).toBe('10 Nov 2026');
      expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    }
  });

  it('shows an instant in the reader’s own day', () => {
    process.env.TZ = 'America/Chicago';
    expect(formatDate('2026-11-10T01:00:00.000Z')).toBe('9 Nov 2026');
    expect(formatDate(new Date(2026, 10, 10, 12))).toBe('10 Nov 2026');
  });
});
