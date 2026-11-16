'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useRef, useState } from 'react';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, ChoiceGroup, Dialog, Field, MetaLine } from '@/design-system/primitives';
import type { AdminClaimRow } from '@/domain/admin';
import { CLAIM_EVIDENCE_LIMITS } from '@/domain/claims';
import { formatDate } from '@/lib/format';
import { failureWords, fieldWords } from './errors';
import { useAdminClaims, useNow, useRemoveVerification, useVerifyClaim } from './hooks';

const words = copy.admin.claims;
type Filter = 'check' | 'verified' | 'all';

const matches: Record<Filter, (r: AdminClaimRow) => boolean> = {
  check: (r) => r.claim.status === 'farmer_reported',
  verified: (r) => r.claim.status === 'verified',
  all: () => true,
};

/**
 * TRUST-2. Every claim, the unchecked ones first. "Verified" attaches to the one
 * claim, with the evidence checked and the day: never to a farmer or a farm.
 */
export function ClaimsPage() {
  const { data: rows, isPending } = useAdminClaims();
  const [filter, setFilter] = useState<Filter>('check');
  const [message, setMessage] = useState<string | null>(null);
  if (isPending || !rows) return <p role="status">{copy.admin.loading}</p>;
  const count = (f: Filter) => rows.filter(matches[f]).length;
  const shown = rows.filter(matches[filter]);

  return (
    <section className="admin-section" aria-labelledby="claims-title">
      <h2 id="claims-title" className="admin-title">
        {words.title}
      </h2>
      <p className="admin-lead">{words.lead}</p>
      <p className="admin-note">{words.snapNote}</p>
      <ChoiceGroup
        legend={words.filterLabel}
        name="claim-filter"
        layout="chips"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        choices={[
          { value: 'check', label: `${words.filterCheck} (${count('check')})` },
          { value: 'verified', label: `${words.filterVerified} (${count('verified')})` },
          { value: 'all', label: `${words.filterAll} (${count('all')})` },
        ]}
      />
      <p role="status" className="admin-status">
        {message}
      </p>
      {shown.length === 0 ? (
        <EmptyState sentence={words.none} />
      ) : (
        <ul className="admin-list">
          {shown.map((row) => (
            <ClaimRow key={row.claim.id} row={row} onDone={setMessage} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ClaimRow({ row, onDone }: { row: AdminClaimRow; onDone: (message: string) => void }) {
  const { claim } = row;
  const verify = useVerifyClaim();
  const remove = useRemoveVerification();
  const now = useNow();
  const today = format(now, 'yyyy-MM-dd');
  const cancelRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [evidence, setEvidence] = useState(claim.status === 'verified' ? claim.verification.evidenceChecked : '');
  const [date, setDate] = useState(claim.status === 'verified' ? claim.verification.verifiedOn : today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);

  async function save() {
    setFailed(null);
    try {
      await verify.mutateAsync({ claimId: claim.id, values: { evidenceChecked: evidence, verifiedOn: date } });
      setErrors({});
      setOpen(false);
      onDone(words.verifySaved(claim.label));
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error));
    }
  }
  async function take() {
    setFailed(null);
    try {
      await remove.mutateAsync(claim.id);
      setRemoving(false);
      onDone(words.removed(claim.label));
    } catch (error) {
      setRemoving(false);
      setFailed(failureWords(error));
    }
  }

  return (
    <li className="admin-row">
      <div className="admin-row__main">
        <h3 className="admin-row__title">{claim.label}</h3>
        <MetaLine>
          <Link href={`/admin/farms/${claim.farmerProfileId}`}>{row.farmName}</Link>
          <span>{row.town}</span>
          <span>{words.types[claim.type]}</span>
          <span>{claim.status === 'verified' ? words.verifiedOn(formatDate(claim.verification.verifiedOn)) : words.reported}</span>
          {row.farmListed ? null : <span>{words.notListed}</span>}
        </MetaLine>
        {claim.status === 'verified' ? (
          <p className="admin-note">
            {words.evidence}: {claim.verification.evidenceChecked}
            {row.verifiedByName ? ` ${words.by(row.verifiedByName)}.` : ''}
          </p>
        ) : null}
        {failed ? (
          <p role="alert" className="admin-error">
            {failed}
          </p>
        ) : null}
      </div>
      <div className="admin-row__actions">
        <Button variant="secondary" aria-label={`${claim.status === 'verified' ? words.verifyAgain : words.verify}: ${claim.label}, ${row.farmName}`} onClick={() => setOpen(true)}>
          {claim.status === 'verified' ? words.verifyAgain : words.verify}
        </Button>
        {claim.status === 'verified' ? (
          <Button variant="link" aria-label={`${words.remove}: ${claim.label}, ${row.farmName}`} onClick={() => setRemoving(true)}>
            {words.remove}
          </Button>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={words.verifyTitle(claim.label)}
        description={words.verifyLead}
        closeLabel={copy.common.close}
        actions={
          <>
            <Button loading={verify.isPending} onClick={() => void save()}>
              {words.verifySave}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      >
        <div className="admin-form">
          <Field
            label={words.evidenceLabel}
            hint={words.evidenceHint}
            multiline
            maxLength={CLAIM_EVIDENCE_LIMITS.max + 50}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            error={errors.evidenceChecked}
          />
          <Field label={words.dateLabel} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} error={errors.verifiedOn} />
          {failed ? (
            <p role="alert" className="admin-error">
              {failed}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={removing}
        onOpenChange={setRemoving}
        title={words.removeTitle}
        description={words.removeBody}
        closeLabel={copy.common.close}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button loading={remove.isPending} onClick={() => void take()}>
              {words.removeConfirm}
            </Button>
            <Button variant="secondary" ref={cancelRef} onClick={() => setRemoving(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      />
    </li>
  );
}
