'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, ChoiceGroup, MetaLine } from '@/design-system/primitives';
import { awaitingResponseRows } from '@/domain/admin';
import type { InquiryRecord } from '@/domain/inquiry';
import { DemoMark } from '@/features/demo';
import { formatDate } from '@/lib/format';
import { useAdminInquiries, useNow, useSettings } from './hooks';

const words = copy.admin.inquiries;
type Filter = 'awaiting' | 'responded' | 'closed' | 'all';

const statusOf: Record<Exclude<Filter, 'all'>, InquiryRecord['inquiry']['status']> = {
  awaiting: 'awaiting_response',
  responded: 'responded',
  closed: 'closed',
};

/**
 * STAT-1 for administrators. Opens on what is still waiting for a farmer, longest
 * first. The buyer's contact is shown because administrators may see it (INQ-5);
 * a closed inquiry whose retention has passed shows that the details were deleted.
 */
export function InquiriesPage() {
  const { data: records, isPending } = useAdminInquiries();
  const { data: settings } = useSettings();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('awaiting');
  if (isPending || !records || !settings) return <p role="status">{copy.admin.loading}</p>;

  const count = (f: Filter) => (f === 'all' ? records.length : records.filter((r) => r.inquiry.status === statusOf[f]).length);
  const rows =
    filter === 'awaiting'
      ? awaitingResponseRows(records, now, settings).map((r) => ({ record: r.record, waitingHours: r.waitingHours as number | null, closesAt: r.closesAt as string | null }))
      : records
          .filter((r) => filter === 'all' || r.inquiry.status === statusOf[filter])
          .map((record) => ({ record, waitingHours: null as number | null, closesAt: null as string | null }));

  return (
    <section className="admin-section" aria-labelledby="inquiries-title">
      <h2 id="inquiries-title" className="admin-title">
        {words.title}
      </h2>
      <p className="admin-lead">{words.lead}</p>
      <ChoiceGroup
        legend={words.filterLabel}
        name="admin-inquiry-filter"
        layout="chips"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        choices={[
          { value: 'awaiting', label: `${words.filterAwaiting} (${count('awaiting')})` },
          { value: 'responded', label: `${words.filterResponded} (${count('responded')})` },
          { value: 'closed', label: `${words.filterClosed} (${count('closed')})` },
          { value: 'all', label: `${words.filterAll} (${count('all')})` },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState sentence={filter === 'awaiting' ? words.noneWaiting : words.none} />
      ) : (
        <ul className="admin-list">
          {rows.map(({ record, waitingHours, closesAt }) => (
            <InquiryRow key={record.inquiry.id} record={record} waitingHours={waitingHours} closesAt={closesAt} reminderHours={settings.inquiryReminderHours} />
          ))}
        </ul>
      )}
      <p className="admin-note">{copy.response.noPromise}</p>
      <p className="admin-note">{words.statement}</p>
      <p className="admin-note">{copy.transaction.statement}</p>
    </section>
  );
}

function InquiryRow({
  record,
  waitingHours,
  closesAt,
  reminderHours,
}: {
  record: InquiryRecord;
  waitingHours: number | null;
  closesAt: string | null;
  reminderHours: number;
}) {
  const { inquiry, buyer, reply, outcome } = record;
  const about = record.productTitle ?? record.productTypeName ?? copy.inquiry.askedAnythingElse;
  const channel =
    buyer === null ? null : inquiry.replyChannel === 'text' ? words.wantsText(buyer.phone ?? '') : words.wantsEmail(buyer.email ?? '');
  return (
    <li className="admin-row">
      <div className="admin-row__main">
        <h3 className="admin-row__title">{buyer?.name ?? words.contactDeleted}</h3>
        <MetaLine>
          <span>{words.status[inquiry.status]}</span>
          <span>
            {words.about} {about}
          </span>
          <span>
            {words.to} {record.farmName}
          </span>
          {record.pickupName ? <span>{record.pickupName}</span> : null}
          <span>
            {words.sent} {formatDate(inquiry.createdAt)}
          </span>
          {waitingHours !== null ? <span>{words.waiting(words.hours(waitingHours))}</span> : null}
          <DemoMark />
        </MetaLine>
        {channel ? <p>{channel}</p> : <p className="admin-note">{words.contactDeletedNote}</p>}
        {buyer?.message ? <p className="admin-quote">“{buyer.message}”</p> : null}
        {inquiry.status === 'awaiting_response' ? (
          <p className="admin-note">
            {inquiry.reminderSentAt ? words.reminderSent(formatDate(inquiry.reminderSentAt)) : words.reminderLater(reminderHours)}
            {closesAt ? ` ${words.closesBy(formatDate(closesAt))}` : ''}
          </p>
        ) : null}
        {reply ? <p className="admin-note">{words.replied(words.repliedKinds[reply.kind], formatDate(reply.createdAt))}</p> : null}
        {outcome ? (
          <p className="admin-note">
            {words.outcomeLine(copy.dashboard.inquiries.outcome[outcome.outcome])} {copy.dashboard.inquiries.selfReported}
          </p>
        ) : null}
        {inquiry.status === 'closed' && inquiry.closedReason === 'unanswered' ? <p className="admin-note">{words.closedUnanswered}</p> : null}
      </div>
      <div className="admin-row__actions">
        <Button variant="link" href={`/admin/farms/${inquiry.farmerProfileId}`}>
          {words.openFarm}
        </Button>
      </div>
    </li>
  );
}
