import type { FarmerProfileId, UserId, UserRole } from '@/domain/types';

export interface Session {
  user: { id: UserId; displayName: string };
  role: UserRole;
  farmerProfileId: FarmerProfileId | null;
}
export type Actor = Pick<Session, 'role' | 'farmerProfileId'> & { userId: UserId };

export interface AuthService {
  getSession(): Promise<Session | null>;
  signOut(): Promise<void>;
  subscribe(listener: (session: Session | null) => void): () => void;
}
