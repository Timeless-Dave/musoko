import { createStore } from 'zustand/vanilla';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { defaultSettings } from '@/config/settings';
import type { Database, IsoDateTime, UserId, UserRole } from '@/domain/types';
import { buildSeed } from '../../seed';
import { GatewayError } from '../../ports/errors';
import type { Clock } from '../../ports/clock';
import type { DemoNotice } from '../../ports/demo';
import type { DemoOutboxMessage } from '../../ports/notifications';

export const DEMO_STORAGE_KEY = 'musoko.demo.v1';

/**
 * Bump this on ANY change to the seed or to the Database shape. A stored state
 * with a different version is replaced by a fresh seed and the visitor sees a
 * notice. Nothing is wiped silently.
 */
export const DEMO_SCHEMA_VERSION = 5;

/**
 * One accepted inquiry from one browser tab, kept only to apply the hourly limit.
 * The key is a random value the tab made up. It is never stored with an inquiry.
 */
export interface InquiryAttempt {
  key: string;
  at: IsoDateTime;
}

export interface DemoState {
  schemaVersion: number;
  /** The "now" the seed offsets were resolved against. */
  seededAt: IsoDateTime;
  db: Database;
  /**
   * `farmerUserId` is the farmer account this browser registered. Switching to the
   * farmer role uses it; null means the seeded demo farmer.
   */
  session: { role: UserRole; farmerUserId: UserId | null };
  outbox: DemoOutboxMessage[];
  notice: DemoNotice | null;
  /** Rate-limit bookkeeping for the inquiry form (INQ-6). */
  inquiryAttempts: InquiryAttempt[];
}

export interface DemoStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): DemoStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const serverFallback = createMemoryStorage();

/** Chosen at call time, never at module scope, so the server and tests never touch localStorage. */
function browserOrMemory(): DemoStorage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // Storage blocked (private mode, policy): fall through to memory.
  }
  return serverFallback;
}

export function freshState(now: Date, role: UserRole = 'buyer', notice: DemoNotice | null = null): DemoState {
  return {
    schemaVersion: DEMO_SCHEMA_VERSION,
    seededAt: now.toISOString(),
    db: buildSeed(now, defaultSettings),
    session: { role, farmerUserId: null },
    outbox: [],
    notice,
    inquiryAttempts: [],
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function looksLikeDemoState(v: unknown): v is DemoState {
  if (!isRecord(v) || !isRecord(v.db) || !isRecord(v.session) || !Array.isArray(v.outbox)) return false;
  if (!Array.isArray(v.inquiryAttempts)) return false;
  const roles = ['buyer', 'farmer', 'administrator'];
  if (typeof v.session.role !== 'string' || !roles.includes(v.session.role)) return false;
  if (v.session.farmerUserId !== null && typeof v.session.farmerUserId !== 'string') return false;
  for (const key of ['farmer_profiles', 'products', 'product_availability', 'communities', 'farm_private_locations']) {
    if (!Array.isArray(v.db[key])) return false;
  }
  return isRecord(v.db.settings);
}

export interface DemoRuntime {
  ready(): Promise<void>;
  /** The current state. Call ready() first. */
  read(): DemoState;
  /**
   * Apply a change. Resolves only after the store holds it and the storage
   * write has succeeded; on a failed write the change is rolled back and this rejects.
   */
  commit(change: (state: DemoState) => DemoState): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: () => void): () => void;
  clock: Clock;
}

export function createDemoRuntime(clock: Clock, storageOverride?: DemoStorage): DemoRuntime {
  const getStorage = (): DemoStorage => storageOverride ?? browserOrMemory();
  let lastRead: 'none' | 'ok' | 'corrupt' = 'none';
  let writeError: unknown = null;
  const listeners = new Set<() => void>();

  const storage: PersistStorage<DemoState> = {
    getItem: (name) => {
      lastRead = 'none';
      let raw: string | null;
      try {
        raw = getStorage().getItem(name);
      } catch {
        return null;
      }
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !isRecord(parsed.state) || typeof parsed.version !== 'number') throw new Error('shape');
        lastRead = 'ok';
        return parsed as unknown as StorageValue<DemoState>;
      } catch {
        lastRead = 'corrupt';
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        getStorage().setItem(name, JSON.stringify(value));
      } catch (error) {
        writeError = error;
      }
    },
    removeItem: (name) => {
      try {
        getStorage().removeItem(name);
      } catch (error) {
        writeError = error;
      }
    },
  };

  const store = createStore<DemoState>()(
    persist(() => freshState(clock.now()), {
      name: DEMO_STORAGE_KEY,
      version: DEMO_SCHEMA_VERSION,
      storage,
      skipHydration: true,
      // A different stored version is replaced, never read. The notice says so.
      migrate: (stored) => {
        const previous = isRecord(stored) && isRecord(stored.session) ? stored.session.role : null;
        const role: UserRole = previous === 'farmer' || previous === 'administrator' ? previous : 'buyer';
        return freshState(clock.now(), role, { kind: 'reseeded_after_version_change', at: clock.now().toISOString() });
      },
    }),
  );

  const notify = () => listeners.forEach((l) => l());

  let readyPromise: Promise<void> | null = null;
  function ready(): Promise<void> {
    readyPromise ??= (async () => {
      await store.persist.rehydrate();
      if (lastRead === 'corrupt') {
        store.setState(freshState(clock.now(), 'buyer', { kind: 'reseeded_after_corrupt_state', at: clock.now().toISOString() }), true);
      } else if (lastRead === 'none') {
        store.setState(freshState(clock.now()), true);
      } else if (!looksLikeDemoState(store.getState())) {
        store.setState(freshState(clock.now(), 'buyer', { kind: 'reseeded_after_corrupt_state', at: clock.now().toISOString() }), true);
      } else if (store.getState().notice?.kind === 'reseeded_after_version_change') {
        store.setState({ ...store.getState() }, true); // persist the migrated state
      }
      notify();
    })();
    return readyPromise;
  }

  async function commit(change: (state: DemoState) => DemoState): Promise<void> {
    await ready();
    const previous = store.getState();
    const next = change(previous);
    writeError = null;
    store.setState(next, true);
    if (writeError !== null) {
      writeError = null;
      store.setState(previous, true);
      writeError = null;
      throw new GatewayError('invalid', 'The demo could not save this change in the browser. Storage may be full or blocked.');
    }
    notify();
  }

  async function reset(): Promise<void> {
    await ready();
    const role = store.getState().session.role;
    writeError = null;
    try {
      getStorage().removeItem(DEMO_STORAGE_KEY);
    } catch {
      // The write below decides success.
    }
    store.setState(freshState(clock.now(), role), true);
    if (writeError !== null) {
      writeError = null;
      throw new GatewayError('invalid', 'The demo could not be reset in the browser. Storage may be blocked.');
    }
    notify();
  }

  return {
    ready,
    read: () => store.getState(),
    commit,
    reset,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    clock,
  };
}
