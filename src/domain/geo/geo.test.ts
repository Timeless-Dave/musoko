import { describe, expect, it } from 'vitest';
import { distanceKm, kmToMiles } from '.';

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 34.5, lng: -90.6 }, { lat: 34.5, lng: -90.6 })).toBe(0);
  });
  it('is about 111 km for one degree of latitude', () => {
    expect(distanceKm({ lat: 34, lng: -90 }, { lat: 35, lng: -90 })).toBeCloseTo(111.2, 0);
  });
  it('is symmetric', () => {
    const a = { lat: 34.529, lng: -90.592 };
    const b = { lat: 34.228, lng: -92.003 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });
  it('converts to miles', () => {
    expect(kmToMiles(100)).toBeCloseTo(62.14, 1);
  });
});
