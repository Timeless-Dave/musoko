'use client';

import { copy } from '@/content/copy';
import { StatFigure, StatGrid } from '@/design-system/patterns';
import { MetaLine } from '@/design-system/primitives';
import type { PilotMetrics, ScopeMetrics, Suppressed } from '@/domain/analytics';
import { formatDate } from '@/lib/format';
import { useNoResultSearches, usePilotMetrics } from './hooks';

const words = copy.admin.metrics;

/** Typical time to answer, in plain words. Reuses the farmer's wording. */
const typical = (hours: number | null) => (hours === null ? words.notEnough : copy.dashboard.numbers.typicalHours(hours));

/** A figure, or the sentence "Not enough data" in its place (DPRIV-3). */
function figure(value: Suppressed<number | string>, label: string, note?: string) {
  return value.shown ? <StatFigure figure={value.value} label={label} note={note} /> : <StatFigure insufficient={words.notEnough} label={label} note={note} />;
}

/**
 * METRIC-1 to METRIC-6. Every figure on this page has been through small-sample
 * suppression in the domain: a figure that rests on too little data arrives as
 * "not enough data" and carries no number to print.
 */
export function MetricsPage() {
  const { data: metrics, isPending } = usePilotMetrics();
  if (isPending || !metrics) return <p role="status">{copy.admin.loading}</p>;
  return (
    <>
      <section className="admin-section" aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="admin-title">
          {words.title}
        </h2>
        <p className="admin-lead">{words.lead}</p>
        <div className="admin-callout" role="note" aria-labelledby="metrics-note-title">
          <h3 id="metrics-note-title" className="admin-callout__title">
            {words.noteTitle}
          </h3>
          <p>{words.note(metrics.minimumSampleSize)}</p>
        </div>
      </section>
      <Pilot metrics={metrics} />
      <Communities metrics={metrics} />
      <NoResults />
    </>
  );
}

function Pilot({ metrics }: { metrics: PilotMetrics }) {
  const m = metrics.overall;
  return (
    <section className="admin-section" aria-labelledby="pilot-title">
      <h2 id="pilot-title" className="admin-title">
        {words.pilotTitle}
      </h2>
      <StatGrid>
        {figure(m.inquiriesSent, words.inquiriesSent)}
        {figure(m.inquiriesAnswered, words.inquiriesAnswered)}
        {m.medianReplyHours.shown ? (
          <StatFigure figure={typical(m.medianReplyHours.value)} label={words.typical} />
        ) : (
          <StatFigure insufficient={words.notEnough} label={words.typical} />
        )}
        {figure(m.closedWithoutResponse, words.closedNoReply)}
        {figure(m.listingsConfirmed, words.listingsConfirmed(metrics.availabilityWindowDays), words.windowNote(metrics.availabilityWindowDays))}
        {figure(m.activeFarmers, words.activeFarmers, words.activeFarmersNote)}
        {figure(m.farmsListed, words.farmsListed)}
        {figure(m.snapEbtFarms, words.snap, words.selfReported)}
        {figure(m.searches, words.searches)}
        {figure(m.searchesWithNoResults, words.noResults)}
      </StatGrid>
      <Outcomes scope={m} />
      <Rankings scope={m} headingId="pilot-top" />
    </section>
  );
}

/** METRIC-2: the farmers' own answers, labelled as such. */
function Outcomes({ scope }: { scope: ScopeMetrics }) {
  const outcomes = scope.outcomes;
  return (
    <div className="admin-group">
      <h3 className="admin-subtitle">{words.outcomesTitle}</h3>
      <p className="admin-note">{words.outcomesNote}</p>
      {outcomes.shown ? (
        <StatGrid>
          <StatFigure figure={outcomes.value.recorded} label={words.outcomesRecorded} />
          <StatFigure figure={outcomes.value.sale} label={words.outcome.sale} note={words.selfReported} />
          <StatFigure figure={outcomes.value.new_potential_customer} label={words.outcome.new_potential_customer} note={words.selfReported} />
          <StatFigure figure={outcomes.value.no} label={words.outcome.no} note={words.selfReported} />
          <StatFigure figure={outcomes.value.still_discussing} label={words.outcome.still_discussing} note={words.selfReported} />
        </StatGrid>
      ) : (
        <p className="admin-insufficient">{words.notEnough}</p>
      )}
    </div>
  );
}

function Rankings({ scope, headingId }: { scope: ScopeMetrics; headingId: string }) {
  return (
    <div className="admin-group" role="group" aria-labelledby={headingId}>
      <h3 id={headingId} className="admin-subtitle">
        {words.topTitle}
      </h3>
      <Ranked title={words.topProducts} list={scope.mostInquiredProducts} name={(p) => p.name} count={(p) => p.count} />
      <Ranked title={words.topChosen} list={scope.mostChosenPlaces} name={(p) => p.name} count={(p) => p.count} />
      <Ranked title={words.topOpened} list={scope.mostOpenedPlaces} name={(p) => p.name} count={(p) => p.count} />
    </div>
  );
}

function Ranked<T>({ title, list, name, count }: { title: string; list: Suppressed<T[]>; name: (item: T) => string; count: (item: T) => number }) {
  return (
    <div className="admin-ranked">
      <h4 className="admin-ranked__title">{title}</h4>
      {!list.shown ? (
        <p className="admin-insufficient">{words.notEnough}</p>
      ) : list.value.length === 0 ? (
        <p className="admin-note">{words.topNone}</p>
      ) : (
        <ol className="admin-lines">
          {list.value.map((item, i) => (
            <li key={`${name(item)}-${i}`}>
              <span className="admin-lines__label">{name(item)}</span>
              <span className="admin-lines__how">{count(item)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Each community on its own, as a ledger. A thin community shows "Not enough data" in every row it cannot support. */
function Communities({ metrics }: { metrics: PilotMetrics }) {
  return (
    <section className="admin-section" aria-labelledby="communities-title">
      <h2 id="communities-title" className="admin-title">
        {words.communitiesTitle}
      </h2>
      <p className="admin-lead">{words.communitiesLead}</p>
      <ul className="admin-list">
        {metrics.communities.map((c) => (
          <li key={c.communityId} className="admin-row admin-row--block">
            <h3 className="admin-row__title">{c.name}</h3>
            <MetaLine>
              <span>{c.inquiriesSent.shown ? words.acrossLabel(c.inquiriesSent.value) : words.notEnough}</span>
            </MetaLine>
            <Ledger scope={c} windowDays={metrics.availabilityWindowDays} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every farmer-reported figure says so in its label. */
const self = (label: string) => `${label}, self-reported`;

function Ledger({ scope: c, windowDays }: { scope: ScopeMetrics; windowDays: number }) {
  const num = (value: Suppressed<number>) => (value.shown ? String(value.value) : words.notEnough);
  const outcomes = c.outcomes;
  const top = (list: Suppressed<Array<{ name: string; count: number }>>) =>
    !list.shown ? words.notEnough : list.value.length === 0 ? words.topNone : list.value.map((p) => `${p.name} (${p.count})`).join(', ');
  const rows: Array<[string, string]> = [
    [words.farmsListed, num(c.farmsListed)],
    [words.activeFarmers, num(c.activeFarmers)],
    [words.listingsConfirmed(windowDays), num(c.listingsConfirmed)],
    [self(words.snap), num(c.snapEbtFarms)],
    [words.searches, num(c.searches)],
    [words.noResults, num(c.searchesWithNoResults)],
    [words.inquiriesSent, num(c.inquiriesSent)],
    [words.inquiriesAnswered, num(c.inquiriesAnswered)],
    [words.typical, c.medianReplyHours.shown ? typical(c.medianReplyHours.value) : words.notEnough],
    [words.closedNoReply, num(c.closedWithoutResponse)],
    [self(words.outcome.sale), outcomes.shown ? String(outcomes.value.sale) : words.notEnough],
    [self(words.outcome.new_potential_customer), outcomes.shown ? String(outcomes.value.new_potential_customer) : words.notEnough],
    [words.topProducts, top(c.mostInquiredProducts)],
    [words.topChosen, top(c.mostChosenPlaces)],
    [words.topOpened, top(c.mostOpenedPlaces)],
  ];
  return (
    <dl className="admin-ledger">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** DATA-2. The raw terms of searches that found nothing. Administrators only (DPRIV-4). */
function NoResults() {
  const { data: terms, isPending } = useNoResultSearches();
  return (
    <section className="admin-section" aria-labelledby="zero-title">
      <h2 id="zero-title" className="admin-title">
        {words.zeroTitle}
      </h2>
      <p className="admin-lead">{words.zeroLead}</p>
      {isPending || !terms ? (
        <p role="status">{copy.admin.loading}</p>
      ) : terms.length === 0 ? (
        <p className="admin-note">{words.zeroNone}</p>
      ) : (
        <ul className="admin-lines">
          {terms.map((t) => (
            <li key={`${t.communityId ?? 'any'}-${t.terms}`}>
              <span>
                <span className="admin-lines__label">{t.terms}</span>{' '}
                <span className="admin-lines__how">{t.communityName ?? words.zeroAnywhere}</span>
              </span>
              <span className="admin-lines__how">{words.zeroLine(t.count, formatDate(t.lastDay))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
