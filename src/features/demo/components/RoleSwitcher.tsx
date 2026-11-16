'use client';

import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { services } from '@/data';
import type { UserRole } from '@/domain/types';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { useSession, SESSION_KEY } from '@/features/auth';

const ROLES: UserRole[] = ['buyer', 'farmer', 'administrator'];

/** A choice of three, never a typed field. The change is stored before it is shown as final. */
export function RoleSwitcher({ layout }: { layout: 'inline' | 'stacked' }) {
  const name = useId();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [pending, setPending] = useState<UserRole | null>(null);
  const [failed, setFailed] = useState(false);
  const selected = pending ?? session?.role;

  async function choose(role: UserRole) {
    if (!services.demo) return;
    setPending(role);
    setFailed(false);
    try {
      await services.demo.switchRole(role);
      await queryClient.refetchQueries({ queryKey: SESSION_KEY });
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <fieldset className={cn('role-switcher', `role-switcher--${layout}`)} aria-busy={pending ? true : undefined}>
      <legend className="role-switcher__legend">{copy.demo.roleLabel}</legend>
      <div className="role-switcher__options">
        {ROLES.map((role) => (
          <label className="role-switcher__option" key={role}>
            <input
              className="visually-hidden"
              type="radio"
              name={name}
              value={role}
              checked={selected === role}
              onChange={() => void choose(role)}
            />
            <span className="role-switcher__text">{copy.demo.roles[role]}</span>
          </label>
        ))}
      </div>
      {failed ? (
        <p className="role-switcher__error" role="alert">
          {copy.demo.roleFailed}
        </p>
      ) : null}
    </fieldset>
  );
}
