'use client';

import { useState, type FormEvent } from 'react';
import { copy } from '@/content/copy';
import { StatFigure, StatGrid } from '@/design-system/patterns';
import { Button, Field } from '@/design-system/primitives';
import { formatDate } from '@/lib/format';
import { failureWords, fieldWords } from './errors';
import { useRetentionView, useRunRetention, useUpdateRetention } from './hooks';

const words = copy.admin.data;

/**
 * DPRIV-2. What is held, what is past its time, a button that runs the same rules
 * the schedule runs, and the three settings the project owner still has to decide.
 * Counts only: nothing here shows a search term or a buyer's detail.
 */
export function RetentionPage() {
  const { data: view, isPending } = useRetentionView();
  if (isPending || !view) return <p role="status">{copy.admin.loading}</p>;
  const { status } = view;
  return (
    <>
      <section className="admin-section" aria-labelledby="data-title">
        <h2 id="data-title" className="admin-title">
          {words.title}
        </h2>
        <p className="admin-lead">{words.lead}</p>
        <StatGrid>
          <StatFigure
            figure={status.searchEvents.held}
            label={words.searchesHeld}
            note={status.searchEvents.oldestDay ? words.searchesOldest(formatDate(status.searchEvents.oldestDay)) : undefined}
          />
          <StatFigure figure={status.searchEvents.due} label={words.searchesDue} />
          <StatFigure figure={status.buyerContacts.held} label={words.contactsHeld} />
          <StatFigure figure={status.buyerContacts.due} label={words.contactsDue} />
          <StatFigure figure={status.aggregates} label={words.aggregates} note={words.aggregatesNote} />
        </StatGrid>
      </section>
      <RunSection />
      <SettingsSection />
    </>
  );
}

function RunSection() {
  const run = useRunRetention();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function go() {
    setFailed(null);
    setMessage(null);
    try {
      const result = await run.mutateAsync();
      const none = result.searchEventsRolledUp + result.buyerContactsDeleted + result.inquiriesClosed + result.remindersSent === 0;
      setMessage(none ? words.ranNothing : words.ranSummary(result.searchEventsRolledUp, result.buyerContactsDeleted, result.inquiriesClosed, result.remindersSent));
    } catch (error) {
      setFailed(failureWords(error));
    }
  }

  return (
    <section className="admin-section" aria-labelledby="run-title">
      <h2 id="run-title" className="admin-title">
        {words.runTitle}
      </h2>
      <p className="admin-lead">{words.runLead}</p>
      <div className="admin-form__actions">
        <Button variant="secondary" loading={run.isPending} loadingLabel={words.running} onClick={() => void go()}>
          {words.run}
        </Button>
      </div>
      <p role="status" className="admin-status">
        {message}
      </p>
      {failed ? (
        <p role="alert" className="admin-error">
          {failed}
        </p>
      ) : null}
    </section>
  );
}

function SettingsSection() {
  const { data: view } = useRetentionView();
  const save = useUpdateRetention();
  const [values, setValues] = useState({
    searchEventRetentionDays: String(view?.settings.searchEventRetentionDays ?? ''),
    buyerContactRetentionDays: String(view?.settings.buyerContactRetentionDays ?? ''),
    minimumSampleSize: String(view?.settings.minimumSampleSize ?? ''),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setSaved(false);
    // An empty or non-numeric box is NaN, which the schema refuses with the same words as any other bad number.
    const n = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));
    try {
      await save.mutateAsync({
        searchEventRetentionDays: n(values.searchEventRetentionDays),
        buyerContactRetentionDays: n(values.buyerContactRetentionDays),
        minimumSampleSize: n(values.minimumSampleSize),
      });
      setErrors({});
      setSaved(true);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error));
    }
  }

  return (
    <section className="admin-section" aria-labelledby="settings-title">
      <h2 id="settings-title" className="admin-title">
        {words.settingsTitle}
      </h2>
      <p className="admin-lead">{words.settingsLead}</p>
      <form className="admin-form" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={words.searchDays} inputMode="numeric" value={values.searchEventRetentionDays} onChange={(e) => set('searchEventRetentionDays', e.target.value)} error={errors.searchEventRetentionDays} />
        <Field label={words.contactDays} inputMode="numeric" value={values.buyerContactRetentionDays} onChange={(e) => set('buyerContactRetentionDays', e.target.value)} error={errors.buyerContactRetentionDays} />
        <Field label={words.minimum} inputMode="numeric" value={values.minimumSampleSize} onChange={(e) => set('minimumSampleSize', e.target.value)} error={errors.minimumSampleSize} />
        <div className="admin-form__actions">
          <Button type="submit" loading={save.isPending} loadingLabel={words.savingSettings}>
            {words.saveSettings}
          </Button>
        </div>
        <p role="status" className="admin-status">
          {saved ? words.saved : null}
        </p>
        {failed ? (
          <p role="alert" className="admin-error">
            {failed}
          </p>
        ) : null}
      </form>
    </section>
  );
}
