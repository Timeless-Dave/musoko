/**
 * The one place the public environment is read. Client-safe: only NEXT_PUBLIC_*
 * values, each read by literal `process.env.NEXT_PUBLIC_X` access so Next can
 * inline it. Server secrets live in env.server.ts.
 */
export interface Env {
  dataMode: 'demo' | 'live';
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

export function readEnv(raw: {
  NEXT_PUBLIC_DATA_MODE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): Env {
  const mode = (raw.NEXT_PUBLIC_DATA_MODE ?? '').trim();
  if (mode !== '' && mode !== 'demo' && mode !== 'live') {
    throw new Error(
      `NEXT_PUBLIC_DATA_MODE must be "demo" or "live" (or left empty for demo). Received "${mode}".`,
    );
  }
  const dataMode: Env['dataMode'] = mode === 'live' ? 'live' : 'demo';
  const url = (raw.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const anon = (raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (dataMode === 'live') {
    if (url === '') throw new Error('NEXT_PUBLIC_SUPABASE_URL is required when NEXT_PUBLIC_DATA_MODE is "live".');
    if (anon === '') throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required when NEXT_PUBLIC_DATA_MODE is "live".');
  }
  return { dataMode, supabaseUrl: url || null, supabaseAnonKey: anon || null };
}

export const env: Env = readEnv({
  NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
