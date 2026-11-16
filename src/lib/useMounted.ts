'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Use it to hold back
 * UI that depends on cached client data: another component may have filled the
 * query cache before this one hydrates, and the first render must match the server.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
