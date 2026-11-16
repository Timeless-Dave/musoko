'use client';

import { copy } from '@/content/copy';
import { StatFigure, StatGrid } from '@/design-system/patterns';
import { useFarmerNumbers } from './hooks';

const words = copy.dashboard.numbers;

/**
 * The farmer's own figures. Plain numbers on a ledger grid. The note says what
 * they cover, and that the outcomes are the farmer's own answers.
 */
export function NumbersPage() {
  const { data: n, isPending } = useFarmerNumbers();
  if (isPending || !n) return <p role="status">{copy.common.loading}</p>;
  return (
    <section className="dash-section" aria-labelledby="numbers-title">
      <h2 id="numbers-title" className="dash-title">
        {words.title}
      </h2>
      <p className="dash-lead">{words.lead}</p>
      <StatGrid>
        <StatFigure figure={n.inquiries.recent} label={words.recent} note={words.window(n.windowDays)} />
        <StatFigure figure={n.inquiries.awaiting} label={words.waiting} />
        <StatFigure figure={n.replies.answered} label={words.answered} />
        <StatFigure
          figure={n.replies.medianHours === null ? undefined : words.typicalHours(n.replies.medianHours)}
          insufficient={n.replies.medianHours === null ? words.typicalNone : undefined}
          label={words.typical}
        />
        <StatFigure figure={n.inquiries.closedUnanswered} label={words.unanswered} />
        <StatFigure figure={n.listings.availableNow} label={words.listingsNow} note={words.listingsOf(n.listings.availableNow, n.listings.total)} />
        <StatFigure figure={n.outcomes.sale} label={words.outcomesSale} note={copy.dashboard.inquiries.selfReported} />
        <StatFigure figure={n.outcomes.new_potential_customer} label={words.outcomesNew} note={copy.dashboard.inquiries.selfReported} />
      </StatGrid>
      <p className="dash-note">{words.outcomesNote}</p>
      <p className="dash-note">{words.note}</p>
    </section>
  );
}
