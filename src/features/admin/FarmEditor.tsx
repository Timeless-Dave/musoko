'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { copy } from '@/content/copy';
import { Button, Checkbox, CheckGroup, Field, Select } from '@/design-system/primitives';
import type { AdminFarm } from '@/domain/admin';
import { useCommunities } from '@/features/catalogue';
import { failureWords, fieldWords } from './errors';
import { useCreateFarm, useUpdateFarm } from './hooks';

const words = copy.admin.editor;

interface Values {
  farmName: string;
  farmerName: string;
  communityId: string;
  intro: string;
  story: string;
  phone: string;
  email: string;
  streetAddress: string;
  openToWholesale: boolean;
}

const EMPTY: Values = { farmName: '', farmerName: '', communityId: '', intro: '', story: '', phone: '', email: '', streetAddress: '', openToWholesale: false };

const toInput = (v: Values) => ({
  ...v,
  phone: v.phone.trim() || null,
  email: v.email.trim() || null,
  streetAddress: v.streetAddress.trim() || null,
});

/** The profile fields an administrator fills in for a farmer. Same words as the farmer's own form. */
function Fields({
  values,
  set,
  errors,
}: {
  values: Values;
  set: <K extends keyof Values>(key: K, value: Values[K]) => void;
  errors: Record<string, string>;
}) {
  const { data: communities } = useCommunities();
  return (
    <>
      <Field label={copy.join.farmName} value={values.farmName} onChange={(e) => set('farmName', e.target.value)} error={errors.farmName} />
      <Field label={copy.join.farmerName} value={values.farmerName} onChange={(e) => set('farmerName', e.target.value)} error={errors.farmerName} />
      <Select label={copy.join.town} value={values.communityId} onChange={(e) => set('communityId', e.target.value)} error={errors.communityId}>
        <option value="">{copy.join.townChoose}</option>
        {[...(communities ?? [])]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <Field label={copy.join.intro} hint={copy.join.introHint} multiline value={values.intro} onChange={(e) => set('intro', e.target.value)} error={errors.intro} />
      <Field label={copy.join.story} hint={copy.join.storyHint} multiline value={values.story} onChange={(e) => set('story', e.target.value)} error={errors.story} />
      <Field label={copy.join.phone} inputMode="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
      <Field label={copy.join.email} inputMode="email" value={values.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
      <Field label={copy.join.address} hint={copy.join.addressHint} value={values.streetAddress} onChange={(e) => set('streetAddress', e.target.value)} error={errors.streetAddress} />
      <CheckGroup legend={copy.admin.farms.title}>
        <Checkbox label={copy.join.wholesale} detail={copy.join.wholesaleHint} checked={values.openToWholesale} onChange={(e) => set('openToWholesale', e.target.checked)} />
      </CheckGroup>
    </>
  );
}

/** CONS-1: starting a profile for a farmer. It is saved as a draft with no consent. */
export function NewFarm() {
  const router = useRouter();
  const create = useCreateFarm();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    try {
      const farm = await create.mutateAsync(toInput(values));
      router.push(`/admin/farms/${farm.profile.id}`);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error));
    }
  }

  return (
    <section className="admin-section" aria-labelledby="new-title">
      <h2 id="new-title" className="admin-title">
        {words.newTitle}
      </h2>
      <p className="admin-lead">{words.newLead}</p>
      <form className="admin-form" onSubmit={(e) => void submit(e)} noValidate>
        <Fields values={values} set={set} errors={errors} />
        <div className="admin-form__actions">
          <Button type="submit" loading={create.isPending} loadingLabel={words.creating}>
            {words.create}
          </Button>
          <Button variant="link" href="/admin/farms">
            {words.createBack}
          </Button>
        </div>
        {failed ? (
          <p role="alert" className="admin-error">
            {failed}
          </p>
        ) : null}
      </form>
    </section>
  );
}

/** CONS-3: changes on the farmer's behalf. The save says whether the profile now waits for the farmer's review. */
export function EditFarmDetails({ farm }: { farm: AdminFarm }) {
  const save = useUpdateFarm();
  const { profile } = farm;
  const [values, setValues] = useState<Values>({
    farmName: profile.farmName,
    farmerName: profile.farmerName,
    communityId: profile.communityId,
    intro: profile.intro,
    story: profile.story,
    phone: farm.contact.phone ?? '',
    email: farm.contact.email ?? '',
    streetAddress: farm.streetAddress ?? '',
    openToWholesale: profile.openToWholesale,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const hasConsent = profile.consentMethod !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setMessage(null);
    try {
      const after = await save.mutateAsync({ farmId: profile.id, values: toInput(values) });
      setErrors({});
      setMessage(after.awaitingFarmerReview ? words.savedAwaiting : words.saved);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error));
    }
  }

  return (
    <section className="admin-section" aria-labelledby="edit-title">
      <h2 id="edit-title" className="admin-title">
        {words.editTitle}
      </h2>
      <p className="admin-lead">{hasConsent ? words.editLeadListed : words.editLeadDraft}</p>
      <form className="admin-form" onSubmit={(e) => void submit(e)} noValidate>
        <Fields values={values} set={set} errors={errors} />
        <div className="admin-form__actions">
          <Button type="submit" loading={save.isPending} loadingLabel={words.saving}>
            {words.save}
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
      </form>
    </section>
  );
}
