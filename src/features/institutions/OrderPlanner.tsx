'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { copy } from '@/content/copy';
import { PageHeader } from '@/design-system/patterns';
import { Button, Checkbox, ChoiceGroup, Field, Section, Select } from '@/design-system/primitives';
import { planSourcing, type SourcingLine } from '@/domain/institutions';
import type { PublicProduct } from '@/domain/types';
import { services } from '@/data';
import { GatewayError } from '@/data/ports';
import { pickupSummary, unitPlural, useCommunities, useProductTypes, usePublicProducts, useSelectedCommunity } from '@/features/catalogue';
import { formatMoney } from '@/lib/format';
import { useMounted } from '@/lib/useMounted';
import { useInstitutionToken, useOwnInstitution, useSavedOrders, useSendOrder } from './hooks';

const w = copy.institutions.order;
const errs = copy.institutions.profile.errors;
const UNIT: Record<string, string> = { fl_oz: 'fl oz' };
const RADII = ['30', '60', '100', 'any'] as const;
type DetailKey = 'organisation' | 'contactName' | 'replyChannel' | 'phone' | 'email' | 'neededBy' | 'cadence' | 'message' | 'website';

function defaultOption(product: PublicProduct | undefined): string {
  if (!product?.pickupOptions.length) return '';
  return (product.pickupOptions.find((o) => o.kind === 'own_delivery') ?? product.pickupOptions[0]).id;
}

/** One order, split across farms, sent to each as an ordinary inquiry. */
export function OrderPlanner() {
  const mounted = useMounted();
  const { community, communities } = useSelectedCommunity();
  const { data: allCommunities } = useCommunities();
  const { data: types } = useProductTypes();
  const { data: products } = usePublicProducts();
  const [token] = useInstitutionToken();
  const { data: own } = useOwnInstitution(token);
  const [, saveOrder] = useSavedOrders();
  const send = useSendOrder();

  const [typeId, setTypeId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [townId, setTownId] = useState('');
  const [radius, setRadius] = useState<(typeof RADII)[number]>('60');
  const [comingSoon, setComingSoon] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<Record<string, string>>({});
  // What the buyer typed, over the details from their organisation profile on this device.
  const [edits, setDetails] = useState<Partial<Record<DetailKey, string>>>({});
  const fromProfile: Record<DetailKey, string> = {
    organisation: own?.institution.name ?? '', contactName: own?.contact.contactName ?? '',
    replyChannel: own && !own.contact.email ? 'text' : 'email', phone: own?.contact.phone ?? '', email: own?.contact.email ?? '',
    neededBy: '', cadence: 'one_time', message: '', website: '',
  };
  const details = { ...fromProfile, ...edits } as Record<DetailKey, string>;
  const [openedAt] = useState(() => services.clock.now().toISOString());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ tokens: string[]; farms: string[] } | null>(null);

  const town = (allCommunities ?? communities).find((c) => c.id === (townId || own?.institution.communityId || community?.id)) ?? community;
  const type = types?.find((t) => t.id === typeId) ?? null;
  const amount = Number(amountText);
  const unit = type ? (UNIT[type.comparisonUnit] ?? type.comparisonUnit) : '';

  const plan =
    type && amount > 0 && products
      ? planSourcing({
          productType: type, amount, products, from: town ?? null, communities: allCommunities ?? [],
          maxMiles: radius === 'any' ? undefined : Number(radius), includeComingSoon: comingSoon,
        })
      : null;

  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const lines: (SourcingLine & { units: number })[] = (plan?.lines ?? [])
    .filter((l) => !removed.has(l.productId))
    .map((l) => {
      const o = Number(overrides[l.productId]);
      return { ...l, units: o > 0 ? o : l.sellingUnits };
    });
  const estimate = lines.reduce((sum, l) => sum + l.units * (productById.get(l.productId)?.priceCents ?? 0), 0);

  const set = (key: DetailKey) => (e: { target: { value: string } }) => setDetails((d) => ({ ...d, [key]: e.target.value }));
  const err = (key: string) => (errors[key] ? (errs[errors[key]] ?? errs.generic) : undefined);

  function submit() {
    setSendError(null);
    setErrors({});
    send.mutate(
      {
        openedAt,
        honeypot: details.website,
        input: {
          organisation: details.organisation,
          institutionId: own?.institution.id ?? null,
          communityId: town?.id ?? null,
          contactName: details.contactName,
          replyChannel: details.replyChannel as 'text' | 'email',
          phone: details.phone || null,
          email: details.email || null,
          neededBy: details.neededBy || null,
          cadence: details.cadence as 'weekly' | 'monthly' | 'one_time',
          message: details.message,
          lines: lines.map((l) => ({
            farmerProfileId: l.farmerProfileId,
            productId: l.productId,
            pickupOptionId: (options[l.productId] ?? defaultOption(productById.get(l.productId))) || null,
            amount: l.units,
            unit: l.sellingUnit,
          })),
        },
      },
      {
        onSuccess: (receipt) => {
          saveOrder({ group: receipt.requestGroup, food: type?.name ?? '', sentAt: new Date().toISOString(), tokens: receipt.statusTokens });
          setSent({ tokens: receipt.statusTokens, farms: lines.map((l) => `${l.farmName}: ${l.title}`) });
          window.scrollTo({ top: 0 });
        },
        onError: (error) => {
          if (!(error instanceof GatewayError)) return setSendError(w.errors.generic);
          if (error.code === 'rate_limited') return setSendError(w.errors.rate_limited);
          if (error.code === 'spam_suspected') return setSendError(w.errors.spam_suspected);
          if (error.code === 'not_found') return setSendError(w.errors.not_found);
          const fields = (error.detail.fields ?? {}) as Record<string, string>;
          setErrors(fields);
          setSendError(Object.values(fields).includes('option_required') ? w.errors.option_required : w.errors.generic);
        },
      },
    );
  }

  if (sent) {
    return (
      <Section pad="tight">
        <PageHeader title={w.sentTitle} lead={w.sentBody} back={{ href: '/institutions', label: copy.institutions.nav }} />
        <ul className="order-sent">
          {sent.tokens.map((t, i) => (
            <li key={t}>
              <span>{sent.farms[i]}</span>
              <Link href={`/inquiry/${t}`}>{w.status}</Link>
            </li>
          ))}
        </ul>
        <p className="inst-note">{copy.institutions.noPayment}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setSent(null);
            setOverrides({});
            setRemoved(new Set());
            setAmountText('');
          }}
        >
          {w.another}
        </Button>
      </Section>
    );
  }

  return (
    <Section pad="tight">
      <PageHeader title={w.title} lead={w.lead} back={{ href: '/institutions', label: copy.institutions.nav }} />
      <div className="order-grid">
        <div className="order-form">
          <Select label={w.food} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{w.chooseFood}</option>
            {(types ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Field
            label={w.amount(type ? unitPlural(unit) : '…')}
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))}
          />
          {mounted ? (
            <Select label={w.town} value={town?.id ?? ''} onChange={(e) => setTownId(e.target.value)}>
              {(allCommunities ?? communities).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : null}
          <ChoiceGroup
            legend={w.radius}
            name="radius"
            layout="chips"
            value={radius}
            onChange={(v) => setRadius(v as (typeof RADII)[number])}
            choices={RADII.map((r) => ({ value: r, label: r === 'any' ? w.anyDistance : w.miles(Number(r)) }))}
          />
          <Checkbox label={w.comingSoon} checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} />
        </div>

        <div className="order-plan" aria-live="polite">
          {plan ? (
            <>
              <h2 className="display-s">{w.planTitle}</h2>
              {plan.lines.length === 0 ? (
                <p className="inst-lead">{w.noFarms}</p>
              ) : (
                <>
                  <p className="inst-lead">
                    {w.covered(`${plan.covered} ${unit}`, `${plan.requested} ${unit}`)}{' '}
                    {plan.lines.some((l) => !l.quantityKnown) && plan.covered < plan.requested
                      ? w.askRest(`${Math.round((plan.requested - plan.covered) * 10) / 10} ${unit}`)
                      : null}
                  </p>
                  <ul className="order-lines">
                    {lines.map((l) => {
                      const product = productById.get(l.productId);
                      return (
                        <li key={l.productId} className="order-line">
                          <div className="order-line__head">
                            <Link href={`/farmers/${product?.farm.slug ?? ''}`} className="order-line__farm">
                              {l.farmName}
                            </Link>
                            <span className="order-line__meta">
                              {[l.town, l.miles != null ? copy.product.away(l.miles) : null, l.quantityKnown ? w.stated : w.ask].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          <p className="order-line__title">
                            {l.title}
                            {product ? ` · ${formatMoney(product.priceCents)} per ${product.sellingUnit.replace('_', ' ')}` : ''}
                          </p>
                          <div className="order-line__controls">
                            <Field
                              label={`${w.lineAmount} (${unitPlural(l.sellingUnit.replace('_', ' '))})`}
                              inputMode="numeric"
                              value={overrides[l.productId] ?? String(l.sellingUnits)}
                              onChange={(e) => setOverrides((o) => ({ ...o, [l.productId]: e.target.value.replace(/\D/g, '') }))}
                            />
                            {product && product.pickupOptions.length > 1 ? (
                              <Select
                                label={w.getIt}
                                value={options[l.productId] ?? defaultOption(product)}
                                onChange={(e) => setOptions((o) => ({ ...o, [l.productId]: e.target.value }))}
                              >
                                {product.pickupOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {pickupSummary([o]) ?? o.kind}
                                  </option>
                                ))}
                              </Select>
                            ) : product?.pickupOptions.length === 1 ? (
                              <p className="order-line__meta">{pickupSummary(product.pickupOptions)}</p>
                            ) : null}
                            <Button variant="link" onClick={() => setRemoved((r) => new Set(r).add(l.productId))}>
                              {w.remove}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {plan.shortfall > 0 && !plan.lines.some((l) => !l.quantityKnown) ? (
                    <p className="inst-lead">{w.shortfall(`${plan.shortfall} ${unit}`)}</p>
                  ) : null}
                  <p className="inst-note">{w.estimate(formatMoney(estimate))}</p>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      {lines.length ? (
        <form
          className="order-details"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 className="display-s">{w.detailsTitle}</h2>
          <div className="order-details__grid">
            <Field label={w.organisation} value={details.organisation} onChange={set('organisation')} error={err('organisation')} />
            <Field label={w.contactName} value={details.contactName} onChange={set('contactName')} error={err('contactName')} />
          </div>
          <ChoiceGroup
            legend={w.replyBy}
            name="reply"
            layout="chips"
            value={details.replyChannel}
            onChange={(v) => setDetails((d) => ({ ...d, replyChannel: v }))}
            choices={[
              { value: 'email', label: w.email },
              { value: 'text', label: w.text },
            ]}
          />
          <div className="order-details__grid">
            <Field label={w.emailAddress} type="email" value={details.email} onChange={set('email')} error={err('email')} />
            <Field label={w.phone} type="tel" value={details.phone} onChange={set('phone')} error={err('phone')} />
            <Field label={w.neededBy} type="date" value={details.neededBy} onChange={set('neededBy')} />
            <Select label={w.cadence} value={details.cadence} onChange={set('cadence')}>
              {(['one_time', 'weekly', 'monthly'] as const).map((c) => (
                <option key={c} value={c}>
                  {copy.institutions.cadenceLabel[c]}
                </option>
              ))}
            </Select>
          </div>
          <Field multiline label={w.message} hint={w.messageHint} value={details.message} onChange={set('message')} error={err('message')} />
          <div className="inquiry-form__trap" aria-hidden="true">
            <label>
              {copy.inquiry.honeypot}
              <input type="text" tabIndex={-1} autoComplete="off" value={details.website} onChange={set('website')} />
            </label>
          </div>
          <p className="inst-note">{copy.institutions.noPayment}</p>
          {sendError ? (
            <p className="field__error" role="alert">
              {sendError}
            </p>
          ) : null}
          <Button type="submit" loading={send.isPending} loadingLabel={w.sending}>
            {w.send(new Set(lines.map((l) => l.farmerProfileId)).size)}
          </Button>
        </form>
      ) : null}
    </Section>
  );
}
