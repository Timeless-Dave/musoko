'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/data';
import type { Actor, Session } from '@/data/ports';

export const SESSION_KEY = ['session'] as const;

/** The current session. Undefined while it loads. */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: SESSION_KEY,
    queryFn: () => services.auth.getSession(),
  });
}

/** The caller's role and ids in the shape privileged gateway methods take. */
export function useActor(): Actor | null {
  const { data } = useSession();
  if (!data) return null;
  return { role: data.role, farmerProfileId: data.farmerProfileId, userId: data.user.id };
}
