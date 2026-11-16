'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { copy } from '@/content/copy';
import { Button, ChoiceGroup, Dialog, Field, MetaLine } from '@/design-system/primitives';
import { ADMIN_CONSENT_METHODS } from '@/domain/consent';
import type { AdminFarm } from '@/domain/admin';
import type { ConsentMethod, FarmerProfileId } from '@/domain/types';
import { useSession } from '@/features/auth';
import { DemoMark } from '@/features/demo';
import { formatDate } from '@/lib/format';
import { EditFarmDetails } from './FarmEditor';
import { failureWords, fieldWords } from './errors';
import { useAdminFarm, useApproveFarm, useDeclineFarm, useNow, useRecordConsent, useRecordReview } from './hooks';

const words = copy.admin.detail;

/** One profile: where it stands and the next action, the record, the edit form, the farmer's choices, the private details. */
export function FarmDetailPage() {
  const params = useParams<{ farmId: string }>();
  const { data: farm, isPending, isError } = useAdminFarm((params.farmId as FarmerProfileId | undefined) ?? null);

  if (isPending) return <p role="status">{copy.admin.loading}</p>;
  if (isError || !farm) {
    return (
      <section className="admin-section">
        <p role="alert">{copy.admin.editor.notFound}</p>
        <div>
          <Button variant="link" href="/admin/farms">
            {words.back}
          </Button>
        </div>
      </section>
    );
  }
  return (
    <>
      <section className="admin-section" aria-labelledby="farm-title">
        <Button variant="link" href="/admin/farms">
          {words.back}
        </Button>
        <h2 id="farm-title" className="admin-title">
          {farm.profile.farmName}
        </h2>
        <MetaLine>
          <span>{farm.town}</span>
          <span>{copy.admin.state[farm.state]}</span>
          <span>{copy.admin.farms.listings(farm.listingCount)}</span>
          {farm.profile.isDemo ? <DemoMark /> : null}
        </MetaLine>
        <StandsPanel farm={farm} />
      </section>
      <RecordSection farm={farm} />
      <EditFarmDetails farm={farm} />
      <ChoicesSection farm={farm} />
      <ClaimsSection farm={farm} />
    </>
  );
}

// ---------------------------------------------------------------- where it stands

function StandsPanel({ farm }: { farm: AdminFarm }) {
  const approve = useApproveFarm();
  const decline = useDeclineFarm();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const id = farm.profile.id;
  const hasConsent = farm.profile.consentMethod !== null;

  async function run(action: () => Promise<unknown>, done: string) {
    setFailed(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      setConfirming(false);
    } catch (error) {
      setConfirming(false);
      setFailed(failureWords(error));
    }
  }

  const state = farm.state;
  const text = state === 'listed' ? words.listed : state === 'listed_awaiting_review' ? words.listed_awaiting_review : state === 'pending_review' ? words.pending_review : state === 'needs_consent' ? words.needs_consent : state === 'unpublished' ? words.unpublished : words.rejected;
  const listed = state === 'listed' || state === 'listed_awaiting_review';

  return (
    <div className="admin-notice" aria-labelledby="stands-title">
      <h3 id="stands-title" className="admin-notice__title">
        {text.title}
      </h3>
      <p>{text.body}</p>

      {state === 'needs_consent' || (state === 'rejected' && !hasConsent) ? <ConsentForm mode="consent" farmId={id} onRecorded={setMessage} /> : null}
      {state === 'listed_awaiting_review' ? <ConsentForm mode="review" farmId={id} onRecorded={setMessage} /> : null}

      <div className="admin-notice__actions">
        {state === 'pending_review' ? (
          <>
            <Button loading={approve.isPending} onClick={() => void run(() => approve.mutateAsync(id), words.pending_review.approved)}>
              {words.pending_review.approve}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              {words.pending_review.decline}
            </Button>
          </>
        ) : null}
        {state === 'rejected' && hasConsent ? (
          <Button loading={approve.isPending} onClick={() => void run(() => approve.mutateAsync(id), words.rejected.relisted)}>
            {words.rejected.relist}
          </Button>
        ) : null}
        {listed ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              {words.listed.takeOff}
            </Button>
            <Button variant="link" href={`/farmers/${farm.profile.slug}`}>
              {words.publicLink}
            </Button>
          </>
        ) : null}
      </div>

      <p role="status" className="admin-status">
        {message}
      </p>
      {failed ? (
        <p role="alert" className="admin-error">
          {failed}
        </p>
      ) : null}

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={listed ? words.takeOffTitle : words.declineTitle}
        description={listed ? words.takeOffBody : words.declineBody}
        closeLabel={copy.common.close}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button
              loading={decline.isPending}
              onClick={() => void run(() => decline.mutateAsync(id), listed ? words.listed.tookOff : words.pending_review.declined)}
            >
              {listed ? words.listed.takeOff : words.pending_review.decline}
            </Button>
            <Button variant="secondary" ref={cancelRef} onClick={() => setConfirming(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      />
    </div>
  );
}

/**
 * CONS-2 and CONS-3. How the farmer agreed (in person, by phone, signed form), the
 * day, and who wrote it down. The same form logs consent and the farmer's review.
 */
function ConsentForm({ mode, farmId, onRecorded }: { mode: 'consent' | 'review'; farmId: FarmerProfileId; onRecorded: (message: string) => void }) {
  const consent = useRecordConsent();
  const review = useRecordReview();
  const { data: session } = useSession();
  const now = useNow();
  const today = format(now, 'yyyy-MM-dd');
  const [method, setMethod] = useState<string>('');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const write = mode === 'consent' ? consent : review;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    try {
      await write.mutateAsync({ farmId, record: { method: method as 'in_person', date } });
      setErrors({});
      // The form goes once the record is saved, so the saved line lives in the panel around it.
      onRecorded(words.recorded);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error));
    }
  }

  return (
    <form className="admin-form" onSubmit={(e) => void submit(e)} noValidate aria-label={mode === 'consent' ? words.recordTitle : words.recordReviewTitle}>
      <h4 className="admin-subtitle">{mode === 'consent' ? words.recordTitle : words.recordReviewTitle}</h4>
      <ChoiceGroup
        legend={words.method}
        name={`${mode}-method`}
        value={method}
        onChange={setMethod}
        error={errors.method}
        choices={ADMIN_CONSENT_METHODS.map((m) => ({ value: m, label: copy.admin.methods[m] }))}
      />
      <Field label={words.date} hint={words.dateHint} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
      <p className="admin-note">{words.recordedBy(session?.user.displayName ?? '')}</p>
      <div className="admin-form__actions">
        <Button type="submit" loading={write.isPending}>
          {mode === 'consent' ? words.recordConsent : words.recordReview}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="admin-error">
          {failed}
        </p>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------- the record

function RecordSection({ farm }: { farm: AdminFarm }) {
  const { profile } = farm;
  const line = (method: ConsentMethod | null, date: string | null, by: string | null) =>
    method && date ? words.recordLine(copy.admin.methods[method], formatDate(date), by) : words.none;
  return (
    <section className="admin-section" aria-labelledby="record-title">
      <h2 id="record-title" className="admin-title">
        {words.recordTitleDone}
      </h2>
      <dl className="admin-ledger">
        <div>
          <dt>{words.createdLabel}</dt>
          <dd>
            {copy.admin.startedBy[profile.createdByRole]}
            {farm.createdByName ? `: ${farm.createdByName}` : ''}
          </dd>
        </div>
        <div>
          <dt>{words.consentLabel}</dt>
          <dd>{line(profile.consentMethod, profile.consentDate, farm.consentRecordedByName)}</dd>
        </div>
        <div>
          <dt>{words.reviewLabel}</dt>
          <dd>{line(profile.reviewMethod, profile.reviewDate, farm.reviewRecordedByName)}</dd>
        </div>
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- the farmer's choices and private details

function ChoicesSection({ farm }: { farm: AdminFarm }) {
  const { profile } = farm;
  const on = (value: boolean) => (value ? words.privacyOn : words.privacyOff);
  return (
    <>
      <section className="admin-section" aria-labelledby="choices-title">
        <h2 id="choices-title" className="admin-title">
          {words.privacyTitle}
        </h2>
        <p className="admin-lead">{words.privacyLead}</p>
        <dl className="admin-ledger">
          <div>
            <dt>{words.privacyPhone}</dt>
            <dd>{on(profile.showPhone)}</dd>
          </div>
          <div>
            <dt>{words.privacyEmail}</dt>
            <dd>{on(profile.showEmail)}</dd>
          </div>
          <div>
            <dt>{words.privacyExact}</dt>
            <dd>{on(profile.showExactLocation)}</dd>
          </div>
        </dl>
      </section>
      <section className="admin-section" aria-labelledby="private-title">
        <h2 id="private-title" className="admin-title">
          {words.privateTitle}
        </h2>
        <p className="admin-lead">{words.privateLead}</p>
        <dl className="admin-ledger">
          <div>
            <dt>{words.privatePhone}</dt>
            <dd>{farm.contact.phone ?? words.privateNone}</dd>
          </div>
          <div>
            <dt>{words.privateEmail}</dt>
            <dd>{farm.contact.email ?? words.privateNone}</dd>
          </div>
          <div>
            <dt>{words.privateAddress}</dt>
            <dd>{farm.streetAddress ?? words.privateNone}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function ClaimsSection({ farm }: { farm: AdminFarm }) {
  return (
    <section className="admin-section" aria-labelledby="farm-claims-title">
      <h2 id="farm-claims-title" className="admin-title">
        {words.claimsTitle}
      </h2>
      {farm.claims.length === 0 ? (
        <p className="admin-note">{words.claimsNone}</p>
      ) : (
        <ul className="admin-lines">
          {farm.claims.map((claim) => (
            <li key={claim.id}>
              <span className="admin-lines__label">{claim.label}</span>
              <span className="admin-lines__how">
                {claim.status === 'verified' ? copy.admin.claims.verifiedOn(formatDate(claim.verification.verifiedOn)) : copy.admin.claims.reported}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-links">
        <Link href="/admin/claims">{words.claimsLink}</Link>
        <Link href="/admin/moderation">{words.moderationLink}</Link>
      </div>
    </section>
  );
}
