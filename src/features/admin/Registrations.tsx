'use client';

import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button } from '@/design-system/primitives';
import { registrationQueue } from '@/domain/admin';
import { FarmRow } from './FarmRow';
import { useAdminFarms } from './hooks';

const words = copy.admin.registrations;

/**
 * The queue: every profile waiting on Musoko, in two groups. Drafts with no consent
 * come first because nothing can move until the farmer has agreed.
 */
export function RegistrationsPage() {
  const { data: farms, isPending } = useAdminFarms();
  if (isPending || !farms) return <p role="status">{copy.admin.loading}</p>;
  const queue = registrationQueue(farms);
  const needConsent = queue.filter((r) => r.state === 'needs_consent');
  const ready = queue.filter((r) => r.state !== 'needs_consent');

  return (
    <section className="admin-section" aria-labelledby="registrations-title">
      <div className="admin-section__head">
        <h2 id="registrations-title" className="admin-title">
          {words.title}
        </h2>
        <Button href="/admin/farms/new" variant="secondary">
          {words.start}
        </Button>
      </div>
      <p className="admin-lead">{words.lead}</p>
      {queue.length === 0 ? (
        <EmptyState sentence={words.none} />
      ) : (
        <>
          <Group title={words.needConsent} rows={needConsent} id="reg-consent" />
          <Group title={words.readyTitle} rows={ready} id="reg-ready" />
        </>
      )}
    </section>
  );
}

function Group({ title, rows, id }: { title: string; rows: ReturnType<typeof registrationQueue>; id: string }) {
  return (
    <section className="admin-group" aria-labelledby={id}>
      <h3 id={id} className="admin-subtitle">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="admin-note">{words.noneIn}</p>
      ) : (
        <ul className="admin-list">
          {rows.map((row) => (
            <FarmRow key={row.id} row={row} showConsent />
          ))}
        </ul>
      )}
    </section>
  );
}
