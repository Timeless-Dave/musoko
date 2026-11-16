import type { AuthService, Session } from '../../ports/auth';
import { DEMO_ACCOUNTS } from '../../seed';
import type { DemoRuntime, DemoState } from './store';

export function sessionFor(state: DemoState): Session {
  const role = state.session.role;
  const registered = state.session.farmerUserId;
  if (role === 'farmer' && registered) {
    // A farmer who registered in this browser.
    const profile = state.db.farmer_profiles.find((f) => f.userId === registered);
    const user = state.db.users.find((u) => u.id === registered);
    if (profile && user) return { user: { id: user.id, displayName: user.displayName }, role, farmerProfileId: profile.id };
  }
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
      await runtime.commit((s) => ({ ...s, session: { role: 'buyer', farmerUserId: null } }));
    },
    subscribe(listener) {
      const keyOf = (s: Session) => `${s.role}:${s.user.id}`;
      let last: string = keyOf(sessionFor(runtime.read()));
      return runtime.subscribe(() => {
        const session = sessionFor(runtime.read());
        if (keyOf(session) === last) return;
        last = keyOf(session);
        listener(session);
      });
    },
  };
}
