'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { Button } from '@/design-system/primitives';
import type { InquiryFolder, InquiryId } from '@/domain/types';
import { formatDate } from '@/lib/format';
import { failureWords } from './errors';
import { InquiryCard } from './InquiryCard';
import { useFileInquiry, useNow, useOwnFarm, useOwnInquiries, useSettings } from './hooks';

function useInquiryData() {
  const { data: records } = useOwnInquiries();
  const { data: farm } = useOwnFarm();
  const { data: settings } = useSettings();
  const now = useNow();
  return { records, farm, settings, now };
}

const FOLDERS: readonly InquiryFolder[] = ['inbox', 'buyers', 'done'];
/** The two moves offered from each folder. */
const MOVES: Record<InquiryFolder, readonly InquiryFolder[]> = {
  inbox: ['done', 'buyers'],
  buyers: ['done', 'inbox'],
  done: ['buyers', 'inbox'],
};

/**
 * The farmer's inquiries as a message inbox, in three folders of their own:
 * Inbox, Buyers and Done. Moving one never changes what the buyer sees, and
 * every move can be undone or reversed later.
 */
export function InquiriesPage() {
  const { records, farm, settings, now } = useInquiryData();
  const file = useFileInquiry();
  const words = copy.dashboard.inquiries;
  const f = words.folders;
  const [folder, setFolder] = useState<InquiryFolder>('inbox');
  const [openId, setOpenId] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ id: string; from: InquiryFolder; to: InquiryFolder } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (!records || !farm || !settings) return <p role="status">{copy.common.loading}</p>;
  const inFolder = (name: InquiryFolder) => records.filter((r) => r.folder === name);
  const shown = inFolder(folder);
  const selected = records.find((r) => r.inquiry.id === openId) ?? null;

  async function move(id: string, from: InquiryFolder, to: InquiryFolder) {
    setFailed(null);
    try {
      await file.mutateAsync({ inquiryId: id as InquiryId, folder: to });
      setMoved({ id, from, to });
    } catch (error) {
      setFailed(failureWords(error, f.failed));
    }
  }

  async function undo() {
    if (!moved) return;
    const last = moved;
    await move(last.id, last.to, last.from);
    setMoved(null);
  }

  return (
    <section className="dash-section" aria-labelledby="inquiries-title">
      <h2 id="inquiries-title" className="dash-title">
        {words.title}
      </h2>
      <p className="dash-lead">{words.lead}</p>
      <div className="inbox-folders" role="group" aria-label={f.label}>
        {FOLDERS.map((name) => (
          <button
            key={name}
            type="button"
            className="inbox-folder"
            aria-pressed={folder === name}
            onClick={() => {
              setFolder(name);
              setOpenId(null);
              setMoved(null);
            }}
          >
            {f.name[name]} <span className="inbox-folder__count">{inFolder(name).length}</span>
          </button>
        ))}
      </div>
      <p className="dash-note">{f.private}</p>

      <div className="inbox" data-open={selected ? 'true' : undefined}>
        <div className="inbox__list">
          {shown.length === 0 ? (
            <p className="dash-calm">{f.empty[folder]}</p>
          ) : (
            <ul aria-label={f.list}>
              {shown.map((r) => (
                <li key={r.inquiry.id}>
                  <button
                    type="button"
                    className="inbox-row"
                    aria-current={r.inquiry.id === openId ? 'true' : undefined}
                    onClick={() => {
                      setOpenId(r.inquiry.id);
                      setMoved(null);
                    }}
                  >
                    <span className="inbox-row__top">
                      <span className="inbox-row__who" data-waiting={r.inquiry.status === 'awaiting_response' || undefined}>
                        {r.buyer?.name ?? words.contactDeleted}
                      </span>
                      <time dateTime={r.inquiry.createdAt} className="inbox-row__when">
                        {formatDate(r.inquiry.createdAt)}
                      </time>
                    </span>
                    <span className="inbox-row__about">
                      {words.about} {r.productTitle ?? r.productTypeName ?? copy.inquiry.askedAnythingElse}
                      {r.inquiry.status === 'awaiting_response' ? <strong> · {f.waiting}</strong> : null}
                    </span>
                    <span className="inbox-row__snippet">{r.buyer?.message || f.noMessage}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="inbox__read">
          {selected ? (
            <>
              <div className="inbox__bar">
                <button type="button" className="inbox__back dash-link" onClick={() => setOpenId(null)}>
                  ← {f.back}
                </button>
                <div className="inbox__moves">
                  {MOVES[selected.folder].map((to) => (
                    <Button
                      key={to}
                      variant={to === 'done' ? 'primary' : 'secondary'}
                      loading={file.isPending && file.variables?.folder === to}
                      onClick={() => void move(selected.inquiry.id, selected.folder, to)}
                    >
                      {to === 'done' ? f.markDone : to === 'buyers' ? f.toBuyers : f.toInbox}
                    </Button>
                  ))}
                </div>
              </div>
              <p role="status" className="dash-status">
                {moved && moved.id === selected.inquiry.id ? (
                  <>
                    {f.moved(f.name[moved.to])}{' '}
                    <Button variant="link" onClick={() => void undo()}>
                      {f.undo}
                    </Button>
                  </>
                ) : null}
              </p>
              {failed ? (
                <p role="alert" className="dash-error">
                  {failed}
                </p>
              ) : null}
              <ul className="inquiry-list">
                <InquiryCard
                  key={selected.inquiry.id}
                  record={selected}
                  farmPhone={farm.contact.phone}
                  isDemo={farm.profile.isDemo}
                  now={now}
                  settings={settings}
                />
              </ul>
            </>
          ) : (
            <p className="inbox__choose">{f.choose}</p>
          )}
        </div>
      </div>
    </section>
  );
}
