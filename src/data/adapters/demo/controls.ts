import type { Database, TableName } from '@/domain/types';
import type { DemoControls } from '../../ports/demo';
import { sessionFor } from './auth';
import type { DemoRuntime } from './store';

export function createDemoControls(runtime: DemoRuntime, runJobs: DemoControls['runScheduledJobs']): DemoControls {
  return {
    ready: () => runtime.ready(),
    reset: () => runtime.reset(),
    async switchRole(role) {
      await runtime.commit((s) => ({ ...s, session: { ...s.session, role } }));
      return sessionFor(runtime.read());
    },
    async getTableCounts() {
      await runtime.ready();
      const { db } = runtime.read();
      const counts = {} as Record<TableName, number>;
      for (const key of Object.keys(db) as Array<keyof Database>) {
        if (key === 'settings') continue;
        counts[key] = db[key].length;
      }
      return counts;
    },
    async getNotice() {
      await runtime.ready();
      const notice = runtime.read().notice;
      return notice ? { ...notice } : null;
    },
    async dismissNotice() {
      await runtime.commit((s) => ({ ...s, notice: null }));
    },
    async listOutbox() {
      await runtime.ready();
      return runtime.read().outbox.map((m) => ({ ...m }));
    },
    runScheduledJobs: runJobs,
    subscribe: (listener) => runtime.subscribe(listener),
  };
}
