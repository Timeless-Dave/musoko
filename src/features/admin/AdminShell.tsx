'use client';

import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { services } from '@/data';
import { EmptyState } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';
import { useSession } from '@/features/auth';
import { useMounted } from '@/lib/useMounted';

/**
 * Wraps every administrator page. Only a signed-in administrator gets past it;
 * anyone else is told what this area is for and, in the demo, how to look around.
 * The gateway checks the role again on every call: this is the courtesy, not the lock.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const { data: session, isPending } = useSession();

  if (!mounted || isPending) {
    return (
      <Section pad="tight">
        <p role="status">{copy.admin.loading}</p>
      </Section>
    );
  }
  if (!session || session.role !== 'administrator') {
    return (
      <Section pad="tight" aria-labelledby="admin-guard">
        <EmptyState
          sentence={copy.admin.notAdminTitle}
          action={
            <div className="admin-stack">
              <p id="admin-guard" className="admin-note">
                {copy.admin.notAdminBody}
              </p>
              {services.mode === 'demo' ? <p className="admin-note">{copy.admin.notAdminDemo}</p> : null}
            </div>
          }
        />
      </Section>
    );
  }
  return <Frame>{children}</Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <Section pad="none">
        <div className="admin-head">
          <h1 className="admin-head__name">{copy.admin.title}</h1>
        </div>
      </Section>
      <Section pad="none">
        <div className="admin-body">{children}</div>
      </Section>
    </>
  );
}
