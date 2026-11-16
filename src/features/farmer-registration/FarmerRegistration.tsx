'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { copy } from '@/content/copy';
import { services } from '@/data';
import { GatewayError } from '@/data/ports';
import { Button, Checkbox, CheckGroup, Field, Section, Select } from '@/design-system/primitives';
import type { RegistrationInput } from '@/domain/farmer';
import { SESSION_KEY } from '@/features/auth';
import { useCommunities } from '@/features/catalogue';
import { useMounted } from '@/lib/useMounted';

const STEPS = 2;
const words = copy.join;
const errorWords = copy.farmerErrors as Record<string, string>;

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
  showPhone: boolean;
  showEmail: boolean;
  showExactLocation: boolean;
  consentToPublish: boolean;
}

/** Everything private starts off and consent starts unticked: nothing is chosen for the farmer. */
const EMPTY: Values = {
  farmName: '', farmerName: '', communityId: '', intro: '', story: '', phone: '', email: '', streetAddress: '',
  openToWholesale: false, showPhone: false, showEmail: false, showExactLocation: false, consentToPublish: false,
};

const STEP_ONE = new Set(['farmName', 'farmerName', 'communityId', 'intro', 'story']);

function toInput(v: Values): RegistrationInput {
  return {
    ...v,
    phone: v.phone.trim() || null,
    email: v.email.trim() || null,
    streetAddress: v.streetAddress.trim() || null,
  };
}

/**
 * Farmer registration in two screens: the farm, then how buyers reach you and
 * what they may see. Consent to publish is part of registering and is recorded
 * with the date. The farmer's profile is a draft until Musoko has reviewed it.
 */
export function FarmerRegistration() {
  const mounted = useMounted();
  const { data: communities } = useCommunities();
  if (!mounted || !communities) {
    return (
      <Section pad="tight">
        <p role="status">{copy.common.loading}</p>
      </Section>
    );
  }
  return <Form communities={communities} />;
}

function Form({ communities }: { communities: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);

  const register = useMutation({
    mutationFn: (input: RegistrationInput) => services.gateway.registerFarmer(input),
    // The browser is now the new farmer: the session and everything the farmer reads must follow.
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: SESSION_KEY }), queryClient.invalidateQueries({ queryKey: ['own'] })]),
  });

  // Moving between screens moves the reader to the new heading.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const say = (code: string | undefined) => (code ? (errorWords[code] ?? words.failed) : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      // Check only the first screen's fields; the second screen's checks wait for it.
      const problems: Record<string, string> = {};
      if (!values.farmName.trim()) problems.farmName = 'farm_name_required';
      if (!values.farmerName.trim()) problems.farmerName = 'farmer_name_required';
      if (!values.communityId) problems.communityId = 'community_required';
      if (!values.intro.trim()) problems.intro = 'intro_required';
      setErrors(problems);
      if (Object.keys(problems).length === 0) setStep(2);
      return;
    }
    setFailed(null);
    try {
      await register.mutateAsync(toInput(values));
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof GatewayError && error.detail.fields) {
        const fields = error.detail.fields;
        setErrors(fields);
        // An error on the first screen's fields sends the farmer back to it.
        if (Object.keys(fields).some((f) => STEP_ONE.has(f))) setStep(1);
      }
      setFailed(words.failed);
    }
  }

  return (
    <Section pad="none" aria-labelledby="join-title">
      <form className="join-form" onSubmit={(e) => void submit(e)} noValidate>
        <h1 id="join-title" className="join-form__title">
          {words.title}
        </h1>
        <h2 className="join-form__step" ref={headingRef} tabIndex={-1}>
          <span className="join-form__count">{words.step(step, STEPS)}</span>
          {step === 1 ? words.stepFarm : words.stepReach}
        </h2>
        {step === 1 ? <p className="dash-lead">{words.lead}</p> : null}

        <div className="join-form__fields" hidden={step !== 1}>
          <Field label={words.farmName} value={values.farmName} onChange={(e) => set('farmName', e.target.value)} error={say(errors.farmName)} autoComplete="organization" />
          <Field label={words.farmerName} value={values.farmerName} onChange={(e) => set('farmerName', e.target.value)} error={say(errors.farmerName)} autoComplete="name" />
          <Select label={words.town} value={values.communityId} onChange={(e) => set('communityId', e.target.value)} error={say(errors.communityId)}>
            <option value="">{words.townChoose}</option>
            {[...communities]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Field label={words.intro} hint={words.introHint} multiline value={values.intro} onChange={(e) => set('intro', e.target.value)} error={say(errors.intro)} />
          <Field label={words.story} optionalLabel={copy.inquiry.optional} hint={words.storyHint} multiline value={values.story} onChange={(e) => set('story', e.target.value)} error={say(errors.story)} />
        </div>

        <div className="join-form__fields" hidden={step !== 2}>
          <Field label={words.phone} hint={words.phoneHint} inputMode="tel" autoComplete="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} error={say(errors.phone)} />
          <Field label={words.email} optionalLabel={copy.inquiry.optional} hint={words.emailHint} inputMode="email" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} error={say(errors.email)} />
          <Field label={words.address} optionalLabel={copy.inquiry.optional} hint={words.addressHint} autoComplete="street-address" value={values.streetAddress} onChange={(e) => set('streetAddress', e.target.value)} error={say(errors.streetAddress)} />
          <CheckGroup legend={words.privacyTitle} hint={words.privacyLead}>
            <Checkbox label={words.showPhone} checked={values.showPhone} onChange={(e) => set('showPhone', e.target.checked)} />
            <Checkbox label={words.showEmail} checked={values.showEmail} onChange={(e) => set('showEmail', e.target.checked)} />
            <Checkbox label={words.showExact} detail={words.showExactDetail} checked={values.showExactLocation} onChange={(e) => set('showExactLocation', e.target.checked)} />
          </CheckGroup>
          {errors.showPhone || errors.showEmail || errors.showExactLocation ? (
            <p className="dash-error" role="alert">
              {say(errors.showPhone ?? errors.showEmail ?? errors.showExactLocation)}
            </p>
          ) : null}
          <CheckGroup legend={copy.dashboard.profile.detailsTitle}>
            <Checkbox label={words.wholesale} detail={words.wholesaleHint} checked={values.openToWholesale} onChange={(e) => set('openToWholesale', e.target.checked)} />
          </CheckGroup>
          <CheckGroup legend={words.consentTitle} error={say(errors.consentToPublish)}>
            <Checkbox label={words.consent} checked={values.consentToPublish} onChange={(e) => set('consentToPublish', e.target.checked)} />
          </CheckGroup>
          <p className="join-form__note">{words.reviewNote}</p>
        </div>

        {failed ? (
          <p role="alert" className="dash-error">
            {failed}
          </p>
        ) : null}
        <div className="join-form__actions">
          {step === 1 ? (
            <Button type="submit">{words.next}</Button>
          ) : (
            <>
              <Button type="submit" loading={register.isPending} loadingLabel={words.submitting}>
                {words.submit}
              </Button>
              <Button variant="secondary" onClick={() => setStep(1)}>
                {words.back}
              </Button>
            </>
          )}
        </div>
        <Button variant="link" href="/dashboard">
          {words.haveAccount}
        </Button>
      </form>
    </Section>
  );
}
