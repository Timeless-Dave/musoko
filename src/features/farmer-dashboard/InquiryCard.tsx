'use client';

import { useId, useRef, useState } from 'react';
import { copy } from '@/content/copy';
import { Button, Dialog, Field, MetaLine } from '@/design-system/primitives';
import { canReply, outcomePromptDue, OUTCOME_KINDS, type InquiryRecord } from '@/domain/inquiry';
import type { OutcomeKind, ReplyKind, Settings } from '@/domain/types';
import { DemoMark } from '@/features/demo';
import { formatDate } from '@/lib/format';
import { fieldWords, failureWords } from './errors';
import { unitCount } from './format';
import { useRecordOutcome, useReply } from './hooks';

const words = copy.dashboard.inquiries;

/**
 * One inquiry as the farmer it was sent to sees it: who asked, what for, and
 * the buyer's contact, which only this farmer and administrators can see. A
 * reply is one tap. "Contact me" asks first, because it shares the farmer's phone.
 */
export function InquiryCard({
  record,
  farmPhone,
  isDemo,
  now,
  settings,
  onActed,
}: {
  record: InquiryRecord;
  /** The farmer's own phone, or null when none is on file. */
  farmPhone: string | null;
  isDemo: boolean;
  now: Date;
  settings: Pick<Settings, 'outcomePromptDays'>;
  /** Called once a reply or an answer is saved, so a list can keep this card in view. */
  onActed?: () => void;
}) {
  const { inquiry, buyer, reply, outcome } = record;
  const sendReply = useReply();
  const sendOutcome = useRecordOutcome();
  const noteId = useId();
  const cancelRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [again, setAgain] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | undefined>();

  const quantity = inquiry.requestedQuantity ? `${inquiry.requestedQuantity.amount} ${unitCount(inquiry.requestedQuantity.unit)}`.trim() : null;
  const about = record.productTitle ?? record.productTypeName ?? copy.inquiry.askedAnythingElse;
  const open = canReply(inquiry);
  const showReplyButtons = open && (reply === null || again);
  const promptDue = !skipped && outcomePromptDue(inquiry, outcome, now, settings);
  const channelLine =
    buyer === null
      ? words.contactDeleted
      : inquiry.replyChannel === 'text'
        ? words.wantsText(buyer.phone ?? '')
        : words.wantsEmail(buyer.email ?? '');

  async function send(kind: ReplyKind, confirmSharePhone: boolean) {
    setError(null);
    setNoteError(undefined);
    setMessage(null);
    // Keep this card where it is before the list refreshes underneath it.
    onActed?.();
    try {
      await sendReply.mutateAsync({ inquiryId: inquiry.id, reply: { kind, message: note, confirmSharePhone } });
      setMessage(words.replySent);
      setNote('');
      setNoteOpen(false);
      setAgain(false);
      setSharing(false);
    } catch (e) {
      setSharing(false);
      const fields = fieldWords(e);
      if (fields.message) {
        setNoteOpen(true);
        setNoteError(fields.message);
      }
      // A note problem is said beside the note. Anything else is said once, here.
      setError(fields.message ? null : (Object.values(fields)[0] ?? failureWords(e, words.failed)));
    }
  }

  async function saveOutcome(kind: OutcomeKind) {
    setError(null);
    setMessage(null);
    onActed?.();
    try {
      await sendOutcome.mutateAsync({ inquiryId: inquiry.id, outcome: kind });
      setMessage(words.outcomeSaved);
      setChanging(false);
    } catch (e) {
      setError(failureWords(e, words.failed));
    }
  }

  return (
    <li className="inquiry-card">
      <div className="inquiry-card__head">
        <h3 className="inquiry-card__who">{buyer?.name ?? words.contactDeleted}</h3>
        <p className="inquiry-card__state">{words.status[inquiry.status]}</p>
      </div>
      <MetaLine>
        <span>
          {words.about} {about}
        </span>
        {quantity ? (
          <span>
            {words.howMany} {quantity}
          </span>
        ) : null}
        {record.pickupName ? <span>{record.pickupName}</span> : inquiry.chosenOptionKind === 'own_delivery' ? <span>{copy.inquiry.pickupDelivery}</span> : null}
        <span>
          {words.sent} {formatDate(inquiry.createdAt)}
        </span>
        {isDemo ? <DemoMark /> : null}
      </MetaLine>
      {buyer ? <p>{channelLine}</p> : <p className="dash-note">{channelLine}</p>}
      {buyer?.message ? <p className="inquiry-card__quote">“{buyer.message}”</p> : null}

      {reply ? (
        <div>
          <p>
            <strong>{words.replied(words.repliedKinds[reply.kind], formatDate(reply.createdAt))}</strong>
          </p>
          {reply.message ? (
            <p>
              {words.yourNote}: {reply.message}
            </p>
          ) : null}
          {reply.phoneShared ? <p className="dash-note">{words.phoneShared}</p> : null}
        </div>
      ) : null}

      {showReplyButtons ? (
        <div className="inquiry-card__note">
          {noteOpen ? (
            <Field
              id={noteId}
              label={words.note}
              hint={words.noteHint}
              multiline
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={noteError}
            />
          ) : (
            <div>
              <Button variant="link" onClick={() => setNoteOpen(true)}>
                {words.addNote}
              </Button>
            </div>
          )}
          <div className="inquiry-card__reply-actions" role="group" aria-label={words.replyHint}>
            <Button loading={sendReply.isPending && !sharing} onClick={() => void send('available', false)}>
              {words.replyAvailable}
            </Button>
            <Button variant="secondary" loading={sendReply.isPending && !sharing} onClick={() => void send('sold_out', false)}>
              {words.replySoldOut}
            </Button>
            <Button variant="secondary" onClick={() => setSharing(true)}>
              {words.replyContact}
            </Button>
          </div>
        </div>
      ) : null}
      {open && reply !== null && !again ? (
        <div>
          <Button variant="link" onClick={() => setAgain(true)}>
            {words.replyAgain}
          </Button>
        </div>
      ) : null}
      {!open && reply === null ? (
        <p className="dash-note">{inquiry.closedReason === 'unanswered' ? words.closedUnanswered : words.closedNote}</p>
      ) : null}
      {!open && reply !== null && outcome === null && !promptDue ? <p className="dash-note">{words.closedNote}</p> : null}

      {outcome ? (
        <p>
          {words.outcomeRecorded(words.outcome[outcome.outcome])} <span className="dash-note">{words.selfReported}</span>{' '}
          {outcome.outcome === 'still_discussing' && !changing ? (
            <Button variant="link" onClick={() => setChanging(true)}>
              {words.outcomeChange}
            </Button>
          ) : null}
        </p>
      ) : null}
      {promptDue || (changing && outcome) ? (
        <div className="inquiry-card__outcome" role="group" aria-labelledby={`${noteId}-outcome`}>
          <h4 id={`${noteId}-outcome`}>{words.outcomeTitle}</h4>
          <p className="dash-note">{words.outcomeHint}</p>
          <div className="inquiry-card__outcome-actions">
            {OUTCOME_KINDS.map((kind) => (
              <Button key={kind} variant="secondary" loading={sendOutcome.isPending && sendOutcome.variables?.outcome === kind} onClick={() => void saveOutcome(kind)}>
                {words.outcome[kind]}
              </Button>
            ))}
          </div>
          <div>
            <Button variant="link" onClick={() => (changing ? setChanging(false) : setSkipped(true))}>
              {words.outcomeSkip}
            </Button>
          </div>
        </div>
      ) : null}

      <p role="status" className="dash-status">
        {message}
      </p>
      {error ? (
        <p role="alert" className="dash-error">
          {error}
        </p>
      ) : null}
      <p className="dash-note">{words.statement}</p>

      <Dialog
        open={sharing}
        onOpenChange={setSharing}
        title={words.shareTitle}
        description={
          farmPhone ? (buyer ? words.shareBody(buyer.name, farmPhone) : words.shareBodyNoName(farmPhone)) : words.shareNoPhone
        }
        closeLabel={copy.common.close}
        initialFocusRef={cancelRef}
        actions={
          farmPhone ? (
            <>
              <Button loading={sendReply.isPending} onClick={() => void send('contact_me', true)}>
                {words.shareConfirm}
              </Button>
              <Button variant="secondary" ref={cancelRef} onClick={() => setSharing(false)}>
                {copy.common.cancel}
              </Button>
            </>
          ) : (
            <>
              <Button href="/dashboard/profile">{words.shareAddPhone}</Button>
              <Button variant="secondary" ref={cancelRef} onClick={() => setSharing(false)}>
                {copy.common.cancel}
              </Button>
            </>
          )
        }
      />
    </li>
  );
}
