import type { JobEvent } from '@/domain/jobs';
import type { IsoDateTime, TableName, UserRole } from '@/domain/types';
import type { Session } from './auth';
import type { DemoOutboxMessage } from './notifications';

export interface DemoNotice {
  kind: 'reseeded_after_version_change' | 'reseeded_after_corrupt_state';
  at: IsoDateTime;
}

export interface DemoControls {
  /** Resolves once the store is hydrated or seeded. */
  ready(): Promise<void>;
  reset(): Promise<void>;
  switchRole(role: UserRole): Promise<Session>;
  getTableCounts(): Promise<Record<TableName, number>>;
  getNotice(): Promise<DemoNotice | null>;
  dismissNotice(): Promise<void>;
  listOutbox(): Promise<DemoOutboxMessage[]>;
  /**
   * Runs the scheduled rules (reminders, auto-close, retention) once, now. The
   * app calls it on load and on a slow interval. Live mode runs the same rules
   * as a scheduled database function, so this is demo only.
   */
  runScheduledJobs(): Promise<JobEvent[]>;
  /** Fires after every committed change. */
  subscribe(listener: () => void): () => void;
}
