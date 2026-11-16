export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertServerEnv } = await import('./config/env.server');
    assertServerEnv();
  }
}
