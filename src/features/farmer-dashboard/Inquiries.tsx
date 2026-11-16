'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, ChoiceGroup } from '@/design-system/primitives';
import { outcomePromptDue, type InquiryRecord } from '@/domain/inquiry';
import { InquiryCard } from './InquiryCard';
import { useNow, useOwnFarm, useOwnInquiries, useSettings } from './hooks';

type Filter = 'waiting' | 'answered' | 'closed' | 'all';

const matches: Record<Filter, (r: InquiryRecord) => boolean> = {
  waiting: (r) => r.inquiry.status === 'awaiting_response',
  answered: (r) => r.inquiry.status === 'responded',
  closed: (r) => r.inquiry.status === 'closed',
  all: () => true,
};

function useInquiryData() {
  const { data: records } = useOwnInquiries();
  const { data: farm } = useOwnFarm();
  const { data: settings } = useSettings();
  const now = useNow();
  return { records, farm, settings, now };
}

/** The inquiries to act on first: unanswered, and answered ones whose outcome question is due. */
export function NeedsYou() {
  const { records, farm, settings, now } = useInquiryData();
  // A card stays in its own list once acted on, so its "saved" line is not taken away with it.
  const [kept, setKept] = useState<ReadonlyMap<string, 'waiting' | 'follow'>>(new Map());
  const keep = (id: string, list: 'waiting' | 'follow') => setKept((current) => new Map(current).set(id, list));
  if (!records || !farm || !settings) return <p role="status">{copy.common.loading}</p>;

  const waiting = records.filter((r) => matches.waiting(r) || kept.get(r.inquiry.id) === 'waiting');
  const followUp = records.filter(
    (r) => kept.get(r.inquiry.id) === 'follow' || (!waiting.includes(r) && outcomePromptDue(r.inquiry, r.outcome, now, settings)),
  );
  const shownWaiting = waiting.filter((r, i) => i < 3 || kept.get(r.inquiry.id) === 'waiting');
  const card = (r: InquiryRecord, list: 'waiting' | 'follow') => (
    <InquiryCard
      key={r.inquiry.id}
      record={r}
      farmPhone={farm.contact.phone}
      isDemo={farm.profile.isDemo}
      now={now}
      settings={settings}
      onActed={() => keep(r.inquiry.id, list)}
    />
  );
  return (
    <>
      <section className="dash-section" aria-labelledby="today-waiting">
        <div className="dash-section__head">
          <h2 id="today-waiting" className="dash-title">
            {copy.dashboard.today.waiting}
          </h2>
          <Button variant="link" href="/dashboard/inquiries">
            {copy.dashboard.today.seeAll}
          </Button>
        </div>
        {shownWaiting.length === 0 ? (
          <p className="dash-lead">{copy.dashboard.today.waitingNone}</p>
        ) : (
          <ul className="inquiry-list">{shownWaiting.map((r) => card(r, 'waiting'))}</ul>
        )}
      </section>
      {followUp.length > 0 ? (
        <section className="dash-section" aria-labelledby="today-follow">
          <h2 id="today-follow" className="dash-title">
            {copy.dashboard.today.followUp}
          </h2>
          <ul className="inquiry-list">{followUp.map((r) => card(r, 'follow'))}</ul>
        </section>
      ) : null}
    </>
  );
}

export function InquiriesPage() {
  const { records, farm, settings, now } = useInquiryData();
  const [chosen, setChosen] = useState<Filter | null>(null);
  // A card stays in view once acted on, so its "saved" line is not taken away with it.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());

  if (!records || !farm || !settings) return <p role="status">{copy.common.loading}</p>;
  const count = (f: Filter) => records.filter(matches[f]).length;
  const filter: Filter = chosen ?? (count('waiting') > 0 ? 'waiting' : 'all');
  const shown = records.filter((r) => matches[filter](r) || kept.has(r.inquiry.id));
  const words = copy.dashboard.inquiries;

  return (
    <section className="dash-section" aria-labelledby="inquiries-title">
      <h2 id="inquiries-title" className="dash-title">
        {words.title}
      </h2>
      <p className="dash-lead">{words.lead}</p>
      <ChoiceGroup
        legend={words.filterLabel}
        name="inquiry-filter"
        layout="chips"
        value={filter}
        onChange={(v) => setChosen(v as Filter)}
        choices={[
          { value: 'waiting', label: `${words.filterWaiting} (${count('waiting')})` },
          { value: 'answered', label: `${words.filterAnswered} (${count('answered')})` },
          { value: 'closed', label: `${words.filterClosed} (${count('closed')})` },
          { value: 'all', label: `${words.filterAll} (${count('all')})` },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState sentence={words.none} />
      ) : (
        <ul className="inquiry-list">
          {shown.map((r) => (
            <InquiryCard
              key={r.inquiry.id}
              record={r}
              farmPhone={farm.contact.phone}
              isDemo={farm.profile.isDemo}
              now={now}
              settings={settings}
              onActed={() => setKept((current) => new Set(current).add(r.inquiry.id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
