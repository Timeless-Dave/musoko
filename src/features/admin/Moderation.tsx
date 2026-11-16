'use client';

import Link from 'next/link';
import { useState } from 'react';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, Field, MetaLine } from '@/design-system/primitives';
import type { ModerationItem } from '@/domain/admin';
import { DemoMark } from '@/features/demo';
import { failureWords } from './errors';
import { useModerationItems, useSetModeration } from './hooks';

const words = copy.admin.moderation;

/** Hide a listing, farmers market or pickup point from buyers, or show it again. Nothing is deleted. */
export function ModerationPage() {
  const { data: items, isPending } = useModerationItems();
  const set = useSetModeration();
  const [find, setFind] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (isPending || !items) return <p role="status">{copy.admin.loading}</p>;

  const term = find.trim().toLowerCase();
  const shown = term
    ? items.filter((i) => [i.title, i.farmName ?? '', i.town, words.kinds[i.kind]].some((text) => text.toLowerCase().includes(term)))
    : items;

  async function flip(item: ModerationItem) {
    setFailed(null);
    setMessage(null);
    const status = item.status === 'visible' ? 'hidden' : 'visible';
    try {
      await set.mutateAsync({ kind: item.kind, id: item.id, status });
      setMessage(status === 'hidden' ? words.hidden(item.title) : words.shown(item.title));
    } catch (error) {
      setFailed(failureWords(error));
    }
  }

  return (
    <section className="admin-section" aria-labelledby="moderation-title">
      <h2 id="moderation-title" className="admin-title">
        {words.title}
      </h2>
      <p className="admin-lead">{words.lead}</p>
      <Field label={words.findLabel} hint={words.findHint} type="search" value={find} onChange={(e) => setFind(e.target.value)} />
      <p role="status" className="admin-status">
        {message}
      </p>
      {failed ? (
        <p role="alert" className="admin-error">
          {failed}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState sentence={words.none} />
      ) : (
        <ul className="admin-list">
          {shown.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="admin-row">
              <div className="admin-row__main">
                <h3 className="admin-row__title">{item.title}</h3>
                <MetaLine>
                  <span>{words.kinds[item.kind]}</span>
                  {item.farmName ? <span>{item.farmName}</span> : null}
                  <span>{item.town}</span>
                  <span>{item.status === 'visible' ? words.visibleWord : words.hiddenWord}</span>
                  {item.isDemo ? <DemoMark /> : null}
                </MetaLine>
              </div>
              <div className="admin-row__actions">
                <Button
                  variant="secondary"
                  aria-label={item.status === 'visible' ? words.hideLabel(item.title) : words.showLabel(item.title)}
                  loading={set.isPending && set.variables?.id === item.id}
                  onClick={() => void flip(item)}
                >
                  {item.status === 'visible' ? words.hide : words.show}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-links">
        <Link href="/admin/farms">{copy.admin.nav.farms}</Link>
      </div>
    </section>
  );
}
