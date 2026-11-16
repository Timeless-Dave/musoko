import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/config/settings';
import { buildSeed } from '../../data/seed';
import { matchProductType, scrubSearchTerms } from './index';

const types = buildSeed(new Date('2026-11-15T15:00:00.000Z'), defaultSettings).product_types;

describe('scrubSearchTerms', () => {
  it('trims and collapses whitespace', () => {
    expect(scrubSearchTerms('  sweet   potatoes  ', defaultSettings)).toBe('sweet potatoes');
  });

  it('strips email, phone and street-like fragments', () => {
    expect(scrubSearchTerms('eggs buyer@mail.com', defaultSettings)).toBe('eggs');
    expect(scrubSearchTerms('honey 870-555-0100', defaultSettings)).toBe('honey');
    expect(scrubSearchTerms('tomatoes 42 Demo Road', defaultSettings)).toBe('tomatoes');
  });

  it('respects searchTermMaxLength', () => {
    const long = 'a'.repeat(defaultSettings.searchTermMaxLength + 10);
    expect(scrubSearchTerms(long, defaultSettings).length).toBe(defaultSettings.searchTermMaxLength);
  });
});

describe('matchProductType', () => {
  it('picks the longest type name that appears in the terms', () => {
    expect(matchProductType('collard greens basket', types)?.slug).toBe('collard-greens');
    expect(matchProductType('farm eggs', types)?.slug).toBe('eggs');
    expect(matchProductType('pawpaw', types)).toBeNull();
  });
});