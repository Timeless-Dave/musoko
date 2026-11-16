'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { format } from 'date-fns';
import { copy } from '@/content/copy';
import { services } from '@/data';
import { GatewayError } from '@/data/ports';
import { EmptyState, PageHeader } from '@/design-system/patterns';
import { Button, ChoiceGroup, Field, MetaLine, Section, type Choice } from '@/design-system/primitives';
import { compareRequestedToStated } from '@/domain/inquiry';
import type { PublicFarm, PublicPickupOption, PublicProduct } from '@/domain/types';
import {
  scheduleLines,
  statedAmount,
  unitPlural,
  useSelectedCommunity,
  usePublicFarms,
  usePublicProducts,
} from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import { formatListingPrice } from '@/lib/format';
import { useMounted } from '@/lib/useMounted';
import { getTabKey, useSendInquiry } from './hooks';
import {
  fieldForGatewayName,
  OTHER_LISTING,
  stepOf,
  toRequest,
  validate,
  type FormContext,
  type FormErrors,
  type FormField,
  type InquiryFormValues,
  type Step,
} from './schemas';

const STEPS = 2;

/**
 * The inquiry form. Two screens, then the status page: what you would like and
 * how to get it, then how the farmer reaches you. The transaction statement is
 * on both. Reached from a product card (`?product=`) or a farm page (`?farm=`).
 */
export function InquiryForm() {
  const mounted = useMounted();
  const params = useSearchParams();
  const { data: products } = usePublicProducts();
  const { data: farms } = usePublicFarms();

  if (!mounted || !products || !farms) {
    return (
      <Section pad="tight">
        <p role="status">{copy.common.loading}</p>
      </Section>
    );
  }

  const productId = params.get('product');
  const farmSlug = params.get('farm');
  const product = productId ? (products.find((p) => p.id === productId) ?? null) : null;
  const farm = product
    ? (farms.find((f) => f.id === product.farm.id) ?? null)
    : farmSlug
      ? (farms.find((f) => f.slug === farmSlug) ?? null)
      : null;

  if (!farm) {
    return (
      <Section pad="tight">
        <EmptyState
          sentence={copy.inquiry.noFarm}
          action={
            <Button variant="secondary" href="/food">
              {copy.inquiry.findFood}
            </Button>
          }
        />
      </Section>
    );
  }
  return (
    <InquiryFormBody
      key={`${farm.id}:${product?.id ?? ''}`}
      farm={farm}
      product={product}
      listings={products.filter((p) => p.farm.id === farm.id)}
    />
  );
}

function optionChoice(option: PublicPickupOption): Choice {
  const when = option.schedule.length ? scheduleLines(option.schedule).join(', ') : '';
  const detail = [when, option.note].filter(Boolean).join('. ');
  return {
    value: option.id,
    label: option.kind === 'own_delivery' ? copy.inquiry.pickupDelivery : copy.inquiry.pickupAt(option.name ?? '', option.town ?? ''),
    detail: detail || undefined,
  };
}

function InquiryFormBody({
  farm,
  product,
  listings,
}: {
  farm: PublicFarm;
  /** Set when the buyer came from a listing. */
  product: PublicProduct | null;
  listings: PublicProduct[];
}) {
  const router = useRouter();
  const { community } = useSelectedCommunity();
  const send = useSendInquiry();
  const [step, setStep] = useState<Step>(1);
  const [sendError, setSendError] = useState<string | null>(null);
  const [openedAt] = useState(() => services.clock.now().toISOString());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const form = useForm<InquiryFormValues>({
    defaultValues: {
      listing: product?.id ?? '',
      pickupOptionId: farm.pickupOptions.length === 1 ? farm.pickupOptions[0]!.id : '',
      quantity: '',
      replyChannel: 'text',
      name: '',
      phone: '',
      email: '',
      message: '',
      website: '',
    },
    shouldFocusError: false,
  });
  const values = useWatch({ control: form.control });
  const chosen = useMemo(
    () => listings.find((p) => p.id === values.listing) ?? null,
    [listings, values.listing],
  );
  const ctx: FormContext = {
    farmerProfileId: farm.id,
    communityId: community?.id ?? null,
    unit: chosen?.sellingUnit ?? null,
    listingRequired: product === null && listings.length > 0,
    optionRequired: farm.pickupOptions.length > 0,
  };

  // Move focus to the new step's heading, so a screen reader hears where it is.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const errorText = (field: FormField): string | undefined => {
    const code = form.formState.errors[field]?.message;
    if (!code) return undefined;
    const known = copy.inquiry.errors as Record<string, string>;
    return known[code] ?? copy.inquiry.sendErrors.generic;
  };

  const showErrors = (errors: FormErrors) => {
    form.clearErrors();
    const fields = Object.keys(errors) as FormField[];
    for (const field of fields) form.setError(field, { type: 'validate', message: errors[field] });
    if (fields[0]) form.setFocus(fields[0]);
    return fields.length > 0;
  };

  const goNext = () => {
    setSendError(null);
    if (showErrors(validate(form.getValues(), ctx, [1]))) return;
    setStep(2);
  };

  const submit = () => {
    setSendError(null);
    const current = form.getValues();
    const first = validate(current, ctx, [1]);
    if (Object.keys(first).length > 0) {
      setStep(1);
      showErrors(first);
      return;
    }
    if (showErrors(validate(current, ctx, [2]))) return;
    form.clearErrors();
    send.mutate(
      {
        request: toRequest(current, ctx),
        signals: { honeypot: current.website, openedAt, sessionKey: getTabKey() },
      },
      {
        onSuccess: ({ statusToken }) => router.push(`/inquiry/${statusToken}?sent=1`),
        onError: (error) => {
          if (!(error instanceof GatewayError)) return setSendError(copy.inquiry.sendErrors.generic);
          if (error.code === 'rate_limited') {
            const when = error.detail.retryAt ? format(new Date(error.detail.retryAt), 'h:mm a') : 'a little later';
            return setSendError(copy.inquiry.sendErrors.rateLimited(when));
          }
          if (error.code === 'spam_suspected') return setSendError(copy.inquiry.sendErrors.spam);
          if (error.code === 'not_found') return setSendError(copy.inquiry.sendErrors.notListed);
          if (error.code === 'invalid' && error.detail.fields) {
            const mapped: FormErrors = {};
            for (const [name, code] of Object.entries(error.detail.fields)) {
              const field = fieldForGatewayName(name);
              if (field) mapped[field] = code;
            }
            const fields = Object.keys(mapped) as FormField[];
            if (fields.length) {
              if (fields.some((f) => stepOf(f) === 1)) setStep(1);
              showErrors(mapped);
              return;
            }
          }
          setSendError(copy.inquiry.sendErrors.generic);
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 1) goNext();
    else submit();
  };

  // QTY-5: more than the farmer's estimate is said out loud, and never blocks sending.
  const typed = (values.quantity ?? '').trim();
  const amount = Number(typed.replace(',', '.'));
  const exceeds =
    chosen !== null &&
    typed !== '' &&
    amount > 0 &&
    compareRequestedToStated({ amount, unit: chosen.sellingUnit }, chosen.quantity, chosen) === 'exceeds';
  const stated = chosen ? statedAmount(chosen) : null;

  const listingChoices: Choice[] = [
    ...listings.map((p) => ({
      value: p.id,
      label: p.title,
      detail: `${formatListingPrice(p.priceCents, p.sellingUnit, p.unitSize)} · ${copy.availability[p.availability.status]}`,
    })),
    { value: OTHER_LISTING, label: copy.inquiry.listingOther },
  ];

  return (
    <Section pad="tight" aria-labelledby="inquiry-title">
      <PageHeader
        title={copy.inquiry.title}
        lead={copy.inquiry.leadFor(farm.farmName, farm.location.town)}
        back={{ href: `/farmers/${farm.slug}`, label: copy.inquiry.backToFarm(farm.farmName) }}
      />
      <form className="inquiry-form" onSubmit={onSubmit} noValidate>
        <h2 id="inquiry-title" className="inquiry-form__step" ref={headingRef} tabIndex={-1}>
          <span className="inquiry-form__count">{copy.inquiry.step(step, STEPS)}</span>
          {step === 1 ? copy.inquiry.stepRequest : copy.inquiry.stepYou}
        </h2>

        {product ? (
          <div className="inquiry-form__subject">
            <strong>{product.title}</strong>
            <MetaLine>
              <span>
                {product.farm.farmName}, {product.farm.town}
              </span>
              <span>{formatListingPrice(product.priceCents, product.sellingUnit, product.unitSize)}</span>
              {product.isDemo ? <DemoMark /> : null}
            </MetaLine>
          </div>
        ) : farm.isDemo ? (
          <MetaLine>
            <span>
              {farm.farmName}, {farm.location.town}
            </span>
            <DemoMark />
          </MetaLine>
        ) : null}

        <div className="inquiry-form__fields" hidden={step !== 1}>
          {product === null && listings.length > 0 ? (
            <Controller
              control={form.control}
              name="listing"
              render={({ field }) => (
                <ChoiceGroup
                  legend={copy.inquiry.listing}
                  name="listing"
                  value={field.value}
                  onChange={field.onChange}
                  choices={listingChoices}
                  error={errorText('listing')}
                />
              )}
            />
          ) : null}

          {chosen ? (
            <div className="inquiry-form__quantity">
              <Field
                label={copy.inquiry.quantityLabel(unitPlural(chosen.sellingUnit))}
                optionalLabel={copy.inquiry.quantityOptional}
                hint={copy.inquiry.quantityHint}
                inputMode="decimal"
                autoComplete="off"
                error={errorText('quantity')}
                {...form.register('quantity')}
              />
              <p className="inquiry-form__notice" role="status">
                {exceeds && stated ? copy.inquiry.exceeds(stated) : null}
              </p>
            </div>
          ) : null}

          {farm.pickupOptions.length > 0 ? (
            <Controller
              control={form.control}
              name="pickupOptionId"
              render={({ field }) => (
                <ChoiceGroup
                  legend={copy.inquiry.pickup}
                  hint={copy.inquiry.pickupNote}
                  name="pickupOptionId"
                  value={field.value}
                  onChange={field.onChange}
                  choices={farm.pickupOptions.map(optionChoice)}
                  error={errorText('pickupOptionId')}
                />
              )}
            />
          ) : null}
        </div>

        <div className="inquiry-form__fields" hidden={step !== 2}>
          <Field
            label={copy.inquiry.name}
            autoComplete="name"
            error={errorText('name')}
            {...form.register('name')}
          />
          <Controller
            control={form.control}
            name="replyChannel"
            render={({ field }) => (
              <ChoiceGroup
                legend={copy.inquiry.channel}
                name="replyChannel"
                layout="chips"
                value={field.value}
                onChange={(next) => field.onChange(next)}
                choices={[
                  { value: 'text', label: copy.inquiry.channelText },
                  { value: 'email', label: copy.inquiry.channelEmail },
                ]}
              />
            )}
          />
          {values.replyChannel === 'text' ? (
            <Field
              key="phone"
              label={copy.inquiry.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              error={errorText('phone')}
              {...form.register('phone')}
            />
          ) : (
            <Field
              key="email"
              label={copy.inquiry.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              error={errorText('email')}
              {...form.register('email')}
            />
          )}
          <Field
            multiline
            label={copy.inquiry.message}
            optionalLabel={copy.inquiry.optional}
            hint={copy.inquiry.messageHint}
            error={errorText('message')}
            {...form.register('message')}
          />
          <div className="inquiry-form__trap" aria-hidden="true">
            <label>
              {copy.inquiry.honeypot}
              <input type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
            </label>
          </div>
          <p className="inquiry-form__privacy">{copy.inquiry.privacy}</p>
        </div>

        <p className="inquiry-form__statement">{copy.transaction.statement}</p>

        {sendError ? (
          <p className="inquiry-form__error" role="alert">
            {sendError}
          </p>
        ) : null}

        <div className="inquiry-form__actions">
          {step === 1 ? (
            <Button type="submit" block>
              {copy.inquiry.next}
            </Button>
          ) : (
            <>
              <Button type="submit" block loading={send.isPending} loadingLabel={copy.inquiry.sending}>
                {copy.inquiry.send}
              </Button>
              <Button
                variant="secondary"
                block
                onClick={() => {
                  setSendError(null);
                  setStep(1);
                }}
              >
                {copy.inquiry.back}
              </Button>
            </>
          )}
        </div>
      </form>
    </Section>
  );
}
