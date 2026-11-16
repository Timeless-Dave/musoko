'use client';

import { useRef, useState, type FormEvent } from 'react';
import { copy } from '@/content/copy';
import { Button, Checkbox, CheckGroup, Dialog } from '@/design-system/primitives';
import type { OwnFarm } from '@/domain/farmer';
import { fieldWords, failureWords } from './errors';
import { useOwnFarm, useSetPublication, useUpdatePrivacy } from './hooks';

const words = copy.dashboard.privacy;

export function PrivacyPage() {
  const { data: farm } = useOwnFarm();
  if (!farm) return <p role="status">{copy.common.loading}</p>;
  return (
    <>
      <section className="dash-section" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="dash-title">
          {words.title}
        </h2>
        <p className="dash-lead">{words.lead}</p>
        <SettingsForm farm={farm} />
      </section>
      <Publication farm={farm} />
      <section className="dash-section" aria-labelledby="who-title">
        <h2 id="who-title" className="dash-title">
          {words.whoTitle}
        </h2>
        <ul className="dash-who">
          {words.who.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function SettingsForm({ farm }: { farm: OwnFarm }) {
  const save = useUpdatePrivacy();
  const [values, setValues] = useState({
    showPhone: farm.profile.showPhone,
    showEmail: farm.profile.showEmail,
    showExactLocation: farm.profile.showExactLocation,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { phone, email } = farm.contact;
  const hasAddress = farm.streetAddress !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setSaved(false);
    try {
      await save.mutateAsync(values);
      setErrors({});
      setSaved(true);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error, words.failed));
    }
  }

  return (
    <form className="dash-form" onSubmit={(e) => void submit(e)} noValidate>
      <CheckGroup legend={words.showTitle} error={errors.showPhone ?? errors.showEmail ?? errors.showExactLocation}>
        <Checkbox
          label={words.showPhone}
          detail={phone ? words.showPhoneDetail(phone) : words.noPhone}
          checked={values.showPhone && phone !== null}
          disabled={phone === null}
          onChange={(e) => setValues((v) => ({ ...v, showPhone: e.target.checked }))}
        />
        <Checkbox
          label={words.showEmail}
          detail={email ? words.showEmailDetail(email) : words.noEmail}
          checked={values.showEmail && email !== null}
          disabled={email === null}
          onChange={(e) => setValues((v) => ({ ...v, showEmail: e.target.checked }))}
        />
        <Checkbox
          label={words.showExact}
          detail={hasAddress ? words.showExactDetail(farm.town) : words.noAddress}
          checked={values.showExactLocation && hasAddress}
          disabled={!hasAddress}
          onChange={(e) => setValues((v) => ({ ...v, showExactLocation: e.target.checked }))}
        />
      </CheckGroup>
      <div className="dash-form__actions">
        <Button type="submit" loading={save.isPending} loadingLabel={words.saving}>
          {words.save}
        </Button>
      </div>
      <p role="status" className="dash-status">
        {saved ? words.saved : null}
      </p>
      {failed ? (
        <p role="alert" className="dash-error">
          {failed}
        </p>
      ) : null}
    </form>
  );
}

/** CONS-4: take the profile down, or show it again. The farmer's own switch, at any time. */
function Publication({ farm }: { farm: OwnFarm }) {
  const publish = useSetPublication();
  const cancelRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function run(published: boolean) {
    setFailed(null);
    setMessage(null);
    try {
      await publish.mutateAsync(published);
      setMessage(published ? words.publishedDone : words.unpublishedDone);
      setAsking(false);
    } catch (error) {
      setAsking(false);
      setFailed(failureWords(error, words.failed));
    }
  }

  const state = farm.state;
  return (
    <section className="dash-section" aria-labelledby="publication-title">
      <h2 id="publication-title" className="dash-title">
        {words.publicationTitle}
      </h2>
      {state === 'listed' || state === 'listed_awaiting_review' ? (
        <>
          <p className="dash-lead">{words.publishedNow}</p>
          <div>
            <Button variant="secondary" onClick={() => setAsking(true)}>
              {words.unpublish}
            </Button>
          </div>
        </>
      ) : state === 'unpublished' ? (
        <>
          <p className="dash-lead">{words.unpublishedNow}</p>
          <div>
            <Button loading={publish.isPending} onClick={() => void run(true)}>
              {words.publish}
            </Button>
          </div>
        </>
      ) : (
        <p className="dash-lead">{words.notYetPublic}</p>
      )}
      <p role="status" className="dash-status">
        {message}
      </p>
      {failed ? (
        <p role="alert" className="dash-error">
          {failed}
        </p>
      ) : null}
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        title={words.unpublishTitle}
        description={words.unpublishBody}
        closeLabel={copy.common.close}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button loading={publish.isPending} onClick={() => void run(false)}>
              {words.unpublishConfirm}
            </Button>
            <Button variant="secondary" ref={cancelRef} onClick={() => setAsking(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      />
    </section>
  );
}
