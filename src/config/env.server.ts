import 'server-only';
import { env } from './env';

/** Server-only checks. Never import this from client code. */
export function assertServerEnv(): void {
  if (env.dataMode !== 'live') return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when NEXT_PUBLIC_DATA_MODE is "live".');
  }
}
