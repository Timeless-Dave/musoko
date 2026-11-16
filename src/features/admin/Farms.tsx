'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, ChoiceGroup } from '@/design-system/primitives';
import type { AdminFarmRow } from '@/domain/admin';
import { FarmRow } from './FarmRow';
import { useAdminFarms } from './hooks';

const words = copy.admin.farms;
type Filter = 'all' | 'listed' | 'awaiting' | 'not_public';

const matches: Record<Filter, (r: AdminFarmRow) => boolean> = {
  all: () => true,
  listed: (r) => r.state === 'listed' || r.state === 'listed_awaiting_review',
  awaiting: (r) => r.awaitingFarmerReview && r.registrationStatus === 'approved',
  not_public: (r) => r.state !== 'listed' && r.state !== 'listed_awaiting_review',
};

/** Every profile in every state, filtered by where it stands. */
export function FarmsPage() {
  const { data: farms, isPending } = useAdminFarms();
  const [filter, setFilter] = useState<Filter>('all');
  if (isPending || !farms) return <p role="status">{copy.admin.loading}</p>;
  const count = (f: Filter) => farms.filter(matches[f]).length;
  const shown = farms.filter(matches[filter]);

  return (
    <section className="admin-section" aria-labelledby="farms-title">
      <div className="admin-section__head">
        <h2 id="farms-title" className="admin-title">
          {words.title}
        </h2>
        <Button href="/admin/farms/new" variant="secondary">
          {words.start}
        </Button>
      </div>
      <p className="admin-lead">{words.lead}</p>
      <ChoiceGroup
        legend={words.filterLabel}
        name="farm-filter"
        layout="chips"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        choices={[
          { value: 'all', label: `${words.filterAll} (${count('all')})` },
          { value: 'listed', label: `${words.filterListed} (${count('listed')})` },
          { value: 'awaiting', label: `${words.filterAwaiting} (${count('awaiting')})` },
          { value: 'not_public', label: `${words.filterNotPublic} (${count('not_public')})` },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState sentence={words.none} />
      ) : (
        <ul className="admin-list">
          {shown.map((row) => (
            <FarmRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
