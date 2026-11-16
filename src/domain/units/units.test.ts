import { describe, expect, it } from 'vitest';
import type { MeasureUnit, UnitSize } from '../types';
import { convertMeasure, measureKind, normalizedUnitPrice } from './index';

const price = (priceCents: number, unitSize: UnitSize | null, per: MeasureUnit) =>
  normalizedUnitPrice({ priceCents, unitSize }, { comparisonUnit: per });

describe('normalizedUnitPrice', () => {
  it('$3.00 per lb is 300 per lb', () => {
    expect(price(300, { amount: 1, measure: 'lb' }, 'lb')).toEqual({ cents: 300, per: 'lb' });
  });
  it('$15 for a 5 lb box is 300 per lb', () => {
    expect(price(1500, { amount: 5, measure: 'lb' }, 'lb')).toEqual({ cents: 300, per: 'lb' });
  });
  it('$4 for an 8 oz bag is 800 per lb', () => {
    expect(price(400, { amount: 8, measure: 'oz' }, 'lb')).toEqual({ cents: 800, per: 'lb' });
  });
  it('$5 a dozen eggs is 500 per dozen', () => {
    expect(price(500, { amount: 1, measure: 'dozen' }, 'dozen')).toEqual({ cents: 500, per: 'dozen' });
  });
  it('$3 for 6 each is 600 per dozen', () => {
    expect(price(300, { amount: 6, measure: 'each' }, 'dozen')).toEqual({ cents: 600, per: 'dozen' });
  });
  it('a flat of 30 each at $9 is 360 per dozen', () => {
    expect(price(900, { amount: 30, measure: 'each' }, 'dozen')).toEqual({ cents: 360, per: 'dozen' });
  });
  it('$4.50 for 0.5 gallon is 900 per gallon', () => {
    expect(price(450, { amount: 0.5, measure: 'gallon' }, 'gallon')).toEqual({ cents: 900, per: 'gallon' });
  });
  it('a pint against a lb comparison unit is null', () => {
    expect(price(500, { amount: 1, measure: 'pint' }, 'lb')).toBeNull();
  });
  it('bunch, basket and unsized each have no unit size and give null', () => {
    expect(price(300, null, 'lb')).toBeNull();
  });
  it('zero, negative and non-finite sizes give null', () => {
    expect(price(300, { amount: 0, measure: 'lb' }, 'lb')).toBeNull();
    expect(price(300, { amount: -2, measure: 'lb' }, 'lb')).toBeNull();
    expect(price(300, { amount: Number.NaN, measure: 'lb' }, 'lb')).toBeNull();
    expect(price(300, { amount: Infinity, measure: 'lb' }, 'lb')).toBeNull();
  });
  it('negative or non-finite price gives null; zero price is allowed', () => {
    expect(price(-1, { amount: 1, measure: 'lb' }, 'lb')).toBeNull();
    expect(price(Number.NaN, { amount: 1, measure: 'lb' }, 'lb')).toBeNull();
    expect(price(0, { amount: 1, measure: 'lb' }, 'lb')).toEqual({ cents: 0, per: 'lb' });
  });
  it('rounds: $10 for 3 lb is 333 per lb', () => {
    expect(price(1000, { amount: 3, measure: 'lb' }, 'lb')).toEqual({ cents: 333, per: 'lb' });
  });
});

describe('convertMeasure and measureKind', () => {
  it('converts within a kind', () => {
    expect(convertMeasure(16, 'oz', 'lb')).toBe(1);
    expect(convertMeasure(1, 'gallon', 'quart')).toBe(4);
    expect(convertMeasure(1, 'gallon', 'pint')).toBe(8);
    expect(convertMeasure(1, 'gallon', 'fl_oz')).toBe(128);
    expect(convertMeasure(1, 'dozen', 'each')).toBe(12);
  });
  it('returns null across kinds', () => {
    expect(convertMeasure(1, 'lb', 'gallon')).toBeNull();
    expect(convertMeasure(1, 'each', 'oz')).toBeNull();
  });
  it('classifies units', () => {
    expect(measureKind('lb')).toBe('weight');
    expect(measureKind('pint')).toBe('volume');
    expect(measureKind('dozen')).toBe('count');
  });
});
