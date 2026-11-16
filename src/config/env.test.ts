import { describe, expect, it } from 'vitest';
import { readEnv } from './env';

describe('readEnv', () => {
  it('treats a missing mode as demo', () => {
    expect(readEnv({})).toEqual({ dataMode: 'demo', supabaseUrl: null, supabaseAnonKey: null });
  });
  it('treats an empty mode as demo', () => {
    expect(readEnv({ NEXT_PUBLIC_DATA_MODE: '' }).dataMode).toBe('demo');
  });
  it('throws naming the variable on a typo', () => {
    expect(() => readEnv({ NEXT_PUBLIC_DATA_MODE: 'demmo' })).toThrow(/NEXT_PUBLIC_DATA_MODE/);
  });
  it('throws naming each missing live value', () => {
    expect(() => readEnv({ NEXT_PUBLIC_DATA_MODE: 'live' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() =>
      readEnv({ NEXT_PUBLIC_DATA_MODE: 'live', NEXT_PUBLIC_SUPABASE_URL: 'https://x.example' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
  it('accepts live with both values', () => {
    const e = readEnv({
      NEXT_PUBLIC_DATA_MODE: 'live',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.example',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    expect(e.dataMode).toBe('live');
  });
});
