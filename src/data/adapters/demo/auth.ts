import type { AuthService, Session } from '../../ports/auth';
import { DEMO_ACCOUNTS } from '../../seed';
import type { DemoRuntime, DemoState } from './store';

export function sessionFor(state: DemoState): Session {
  const role = state.session.role;
  const account = DEMO_ACCOUNTS[role];
  const user = state.db.users.find((u) => u.id === account.userId);
  return {
    user: { id: account.userId, displayName: user?.displayName ?? 'Demo user' },
    role,
    farmerProfileId: account.farmerProfileId,
  };
}

export function createDemoAuth(runtime: DemoRuntime): AuthService {
  return {
    async getSession() {
      await runtime.ready();
      return sessionFor(runtime.read());
    },
    async signOut() {
      await runtime.commit((s) => ({ ...s, session: { role: 'buyer' } }));
    },
    subscribe(listener) {
      let last: string = runtime.read().session.role;
      return runtime.subscribe(() => {
        const session = sessionFor(runtime.read());
        if (session.role === last) return;
        last = session.role;
        listener(session);
      });
    },
  };
}
