'use client';

import { useState, type FormEvent } from 'react';
import { copy } from '@/content/copy';
import { Button, Checkbox, CheckGroup, Field, Select } from '@/design-system/primitives';
import type { OwnFarm } from '@/domain/farmer';
import type { ClaimType } from '@/domain/types';
import { useCommunities, usePublicFarm } from '@/features/catalogue';
import { formatDate } from '@/lib/format';
import { fieldWords, failureWords } from './errors';
import { useOwnFarm, usePickupChoices, useSetClaims, useSetPickupOptions, useUpdateProfile } from './hooks';

const words = copy.dashboard.profile;

export function ProfilePage() {
  const { data: farm } = useOwnFarm();
  if (!farm) return <p role="status">{copy.common.loading}</p>;
  return (
    <>
      <section className="dash-section" aria-labelledby="profile-title">
        <h2 id="profile-title" className="dash-title">
          {words.title}
        </h2>
        <p className="dash-lead">{words.lead}</p>
        <PublicLink farm={farm} />
      </section>
      <DetailsForm farm={farm} />
      <ClaimsForm farm={farm} />
      <PickupForm farm={farm} />
    </>
  );
}

function PublicLink({ farm }: { farm: OwnFarm }) {
  const { data: publicFarm } = usePublicFarm(farm.profile.slug);
  if (!publicFarm) return <p className="dash-note">{words.notPublicYet}</p>;
  return (
    <div>
      <Button variant="link" href={`/farmers/${farm.profile.slug}`}>
        {words.viewPublic}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- details

function DetailsForm({ farm }: { farm: OwnFarm }) {
  const { data: communities } = useCommunities();
  const save = useUpdateProfile();
  const [values, setValues] = useState({
    farmName: farm.profile.farmName,
    farmerName: farm.profile.farmerName,
    communityId: farm.profile.communityId as string,
    intro: farm.profile.intro,
    story: farm.profile.story,
    phone: farm.contact.phone ?? '',
    email: farm.contact.email ?? '',
    streetAddress: farm.streetAddress ?? '',
    openToWholesale: farm.profile.openToWholesale,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setSaved(false);
    try {
      await save.mutateAsync({
        ...values,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        streetAddress: values.streetAddress.trim() || null,
      });
      setErrors({});
      setSaved(true);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error, words.failed));
    }
  }

  return (
    <section className="dash-section" aria-labelledby="details-title">
      <h2 id="details-title" className="dash-title">
        {words.detailsTitle}
      </h2>
      <form className="dash-form" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={copy.join.farmName} value={values.farmName} onChange={(e) => set('farmName', e.target.value)} error={errors.farmName} autoComplete="organization" />
        <Field label={copy.join.farmerName} value={values.farmerName} onChange={(e) => set('farmerName', e.target.value)} error={errors.farmerName} autoComplete="name" />
        <Select label={copy.join.town} value={values.communityId} onChange={(e) => set('communityId', e.target.value)} error={errors.communityId}>
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
        <Field label={copy.join.phone} hint={copy.join.phoneHint} inputMode="tel" autoComplete="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        <Field label={copy.join.email} hint={copy.join.emailHint} inputMode="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <Field label={copy.join.address} hint={copy.join.addressHint} autoComplete="street-address" value={values.streetAddress} onChange={(e) => set('streetAddress', e.target.value)} error={errors.streetAddress} />
        <CheckGroup legend={copy.dashboard.profile.detailsTitle}>
          <Checkbox label={copy.join.wholesale} detail={copy.join.wholesaleHint} checked={values.openToWholesale} onChange={(e) => set('openToWholesale', e.target.checked)} />
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
    </section>
  );
}

// ---------------------------------------------------------------- claims

const SNAP_LABEL = 'Accepts SNAP/EBT';
type Custom = { type: Exclude<ClaimType, 'snap_ebt'>; label: string };

function ClaimsForm({ farm }: { farm: OwnFarm }) {
  const save = useSetClaims();
  const reported = farm.claims.filter((c) => c.status === 'farmer_reported');
  const verified = farm.claims.filter((c) => c.status === 'verified');
  const presets: readonly string[] = words.presetPractices;

  const [snap, setSnap] = useState(() => reported.some((c) => c.type === 'snap_ebt'));
  const [practices, setPractices] = useState<ReadonlySet<string>>(
    () => new Set(reported.filter((c) => c.type === 'practice' && presets.includes(c.label)).map((c) => c.label)),
  );
  const [custom, setCustom] = useState<Custom[]>(() =>
    reported
      .filter((c) => c.type !== 'snap_ebt' && !(c.type === 'practice' && presets.includes(c.label)))
      .map((c) => ({ type: c.type as Custom['type'], label: c.label })),
  );
  const [kind, setKind] = useState<Custom['type']>('practice');
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(practice: string, on: boolean) {
    setPractices((current) => {
      const next = new Set(current);
      if (on) next.add(practice);
      else next.delete(practice);
      return next;
    });
  }
  function add() {
    if (label.trim() === '') {
      setErrors({ custom: copy.farmerErrors.claim_label_required });
      return;
    }
    setErrors({});
    setCustom((current) => [...current, { type: kind, label: label.trim() }]);
    setLabel('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setSaved(false);
    try {
      await save.mutateAsync([
        ...(snap ? [{ type: 'snap_ebt' as const, label: SNAP_LABEL }] : []),
        ...presets.filter((p) => practices.has(p)).map((p) => ({ type: 'practice' as const, label: p })),
        ...custom,
      ]);
      setErrors({});
      setSaved(true);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(words.failed);
    }
  }

  return (
    <section className="dash-section" aria-labelledby="claims-title">
      <h2 id="claims-title" className="dash-title">
        {words.claimsTitle}
      </h2>
      <p className="dash-lead">{words.claimsLead}</p>
      <form className="dash-form" onSubmit={(e) => void submit(e)} noValidate>
        <CheckGroup legend={copy.farms.claims}>
          <Checkbox label={words.snap} detail={words.snapHint} checked={snap} onChange={(e) => setSnap(e.target.checked)} />
        </CheckGroup>
        <CheckGroup legend={words.practices}>
          {presets.map((practice) => (
            <Checkbox key={practice} label={practice} checked={practices.has(practice)} onChange={(e) => toggle(practice, e.target.checked)} />
          ))}
        </CheckGroup>

        <fieldset className="choice-group">
          <legend className="choice-group__legend">{words.customTitle}</legend>
          {custom.length > 0 ? (
            <ul className="claim-lines">
              {custom.map((claim, index) => (
                <li key={`${claim.type}-${claim.label}-${index}`}>
                  <span>
                    <span className="claim-lines__label">{claim.label}</span>{' '}
                    <span className="claim-lines__how">
                      ({words.customKinds[claim.type]}, {copy.claims.farmer_reported})
                    </span>
                  </span>
                  <Button variant="link" aria-label={words.claimRemove(claim.label)} onClick={() => setCustom((c) => c.filter((_, i) => i !== index))}>
                    {copy.common.dismiss}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="dash-form__row dash-form__row--pair">
            <Select label={words.customType} value={kind} onChange={(e) => setKind(e.target.value as Custom['type'])}>
              {(Object.keys(words.customKinds) as Array<Custom['type']>).map((k) => (
                <option key={k} value={k}>
                  {words.customKinds[k]}
                </option>
              ))}
            </Select>
            <Field label={words.customLabel} value={label} onChange={(e) => setLabel(e.target.value)} error={errors.custom} />
          </div>
          <div>
            <Button variant="secondary" onClick={add}>
              {words.customAdd}
            </Button>
          </div>
        </fieldset>

        {verified.length > 0 ? (
          <div>
            <p className="dash-note">{words.verifiedNote}</p>
            <ul className="claim-lines">
              {verified.map((claim) => (
                <li key={claim.id}>
                  <span className="claim-lines__label">{claim.label}</span>
                  <span className="claim-lines__how">{claim.status === 'verified' ? words.claimVerified(formatDate(claim.verification.verifiedOn)) : null}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="dash-form__actions">
          <Button type="submit" loading={save.isPending} loadingLabel={words.saving}>
            {words.claimsSave}
          </Button>
        </div>
        <p role="status" className="dash-status">
          {saved ? words.claimsSaved : null}
        </p>
        {failed ? (
          <p role="alert" className="dash-error">
            {failed}
          </p>
        ) : null}
      </form>
    </section>
  );
}

// ---------------------------------------------------------------- pickup

function PickupForm({ farm }: { farm: OwnFarm }) {
  const { markets, places } = usePickupChoices();
  const save = useSetPickupOptions();
  const existing = farm.pickupOptions;
  const [marketIds, setMarketIds] = useState<ReadonlySet<string>>(() => new Set(existing.filter((o) => o.marketId).map((o) => o.marketId!)));
  const [placeIds, setPlaceIds] = useState<ReadonlySet<string>>(() => new Set(existing.filter((o) => o.pickupLocationId).map((o) => o.pickupLocationId!)));
  const delivery = existing.find((o) => o.kind === 'own_delivery');
  const [delivers, setDelivers] = useState(Boolean(delivery));
  const [deliveryNote, setDeliveryNote] = useState(delivery?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const flip = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setSaved(false);
    const noteFor = (marketId: string | null, placeId: string | null) =>
      existing.find((o) => (marketId ? o.marketId === marketId : o.pickupLocationId === placeId))?.note ?? '';
    try {
      await save.mutateAsync([
        ...[...marketIds].map((id) => ({ kind: 'farmers_market' as const, marketId: id, pickupLocationId: null, note: noteFor(id, null) })),
        ...[...placeIds].map((id) => ({ kind: 'pickup_location' as const, marketId: null, pickupLocationId: id, note: noteFor(null, id) })),
        ...(delivers ? [{ kind: 'own_delivery' as const, marketId: null, pickupLocationId: null, note: deliveryNote }] : []),
      ]);
      setErrors({});
      setSaved(true);
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(words.failed);
    }
  }

  return (
    <section className="dash-section" aria-labelledby="pickup-title">
      <h2 id="pickup-title" className="dash-title">
        {words.getTitle}
      </h2>
      <p className="dash-lead">{words.getLead}</p>
      <form className="dash-form" onSubmit={(e) => void submit(e)} noValidate>
        <CheckGroup legend={words.getMarkets}>
          {(markets.data ?? []).length === 0 ? <p className="dash-note">{words.getNone}</p> : null}
          {(markets.data ?? []).map((m) => (
            <Checkbox key={m.id} label={m.name} detail={m.town} checked={marketIds.has(m.id)} onChange={(e) => setMarketIds((s) => flip(s, m.id, e.target.checked))} />
          ))}
        </CheckGroup>
        <CheckGroup legend={words.getPickups}>
          {(places.data ?? []).length === 0 ? <p className="dash-note">{words.getNone}</p> : null}
          {(places.data ?? []).map((p) => (
            <Checkbox key={p.id} label={p.name} detail={p.town} checked={placeIds.has(p.id)} onChange={(e) => setPlaceIds((s) => flip(s, p.id, e.target.checked))} />
          ))}
        </CheckGroup>
        <CheckGroup legend={copy.inquiry.pickupDelivery}>
          <Checkbox label={words.getDelivery} checked={delivers} onChange={(e) => setDelivers(e.target.checked)} />
        </CheckGroup>
        {delivers ? <Field label={words.getDeliveryNote} hint={words.getDeliveryHint} value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} error={Object.values(errors)[0]} /> : null}
        <div className="dash-form__actions">
          <Button type="submit" loading={save.isPending} loadingLabel={words.saving}>
            {words.getSave}
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
    </section>
  );
}
