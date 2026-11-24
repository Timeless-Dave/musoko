'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { PageHeader } from '@/design-system/patterns';
import { Button, Checkbox, Field, Section, Select } from '@/design-system/primitives';
import { INSTITUTION_KINDS, type InstitutionInput } from '@/domain/institutions';
import { monthName } from '@/domain/planning';
import type { InstitutionNeedId, YearMonth } from '@/domain/types';
import { GatewayError } from '@/data/ports';
import { services } from '@/data';
import { unitPlural, useCommunities, useProductTypes, useSelectedCommunity } from '@/features/catalogue';
import { useMounted } from '@/lib/useMounted';
import { useBuyerInquiry, useInstitutionMutations, useInstitutionToken, useOwnInstitution, useSavedOrders } from './hooks';

const w = copy.institutions.profile;
const UNIT: Record<string, string> = { fl_oz: 'fl oz' };

function fieldsOf(error: unknown): Record<string, string> {
  if (error instanceof GatewayError && error.code === 'invalid') return (error.detail.fields ?? {}) as Record<string, string>;
  return { form: 'generic' };
}

function nextMonths(n: number): YearMonth[] {
  const now = services.clock.now();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function OrderStatus({ token }: { token: string }) {
  const { data } = useBuyerInquiry(token);
  if (!data) return null;
  return (
    <li>
      <span>{data.farm.name}</span>
      <span className="order-status">{copy.inquiry.status[data.status]}</span>
      <Link href={`/inquiry/${token}`}>{copy.institutions.order.status}</Link>
    </li>
  );
}

/** Make or edit the organisation profile, list planned needs, and follow orders sent from this device. */
export function InstitutionProfile() {
  const mounted = useMounted();
  const [token, setToken] = useInstitutionToken();
  const { data: own, isFetched } = useOwnInstitution(token);
  const { community } = useSelectedCommunity();
  const { data: communities } = useCommunities();
  const { data: types } = useProductTypes();
  const [orders] = useSavedOrders();
  const m = useInstitutionMutations(token);

  const blank: InstitutionInput = { name: '', kind: 'school', communityId: '', about: '', receivingNote: '', showName: true, contactName: '', phone: null, email: null };
  // What the buyer changed, over the saved profile (or a blank one).
  const [edits, setEdits] = useState<Partial<InstitutionInput>>({});
  const base: InstitutionInput = own
    ? {
        name: own.institution.name, kind: own.institution.kind, communityId: own.institution.communityId, about: own.institution.about,
        receivingNote: own.institution.receivingNote, showName: own.institution.showName, contactName: own.contact.contactName,
        phone: own.contact.phone, email: own.contact.email,
      }
    : blank;
  const form: InstitutionInput = { ...base, ...edits };
  const setForm = (change: (f: InstitutionInput) => InstitutionInput) => setEdits((e) => ({ ...e, ...change({ ...base, ...e }) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const months = mounted ? nextMonths(12) : [];
  const [need, setNeed] = useState({ productTypeId: '', amount: '', cadence: 'monthly', startMonth: '', endMonth: '', note: '' });
  const [needErrors, setNeedErrors] = useState<Record<string, string>>({});

  // A token for a profile this demo no longer has (the demo was reset) is dropped.
  useEffect(() => {
    if (token && isFetched && own === null) setToken('');
  }, [token, isFetched, own, setToken]);

  const err = (fields: Record<string, string>, key: string) => (fields[key] ? (w.errors[fields[key]] ?? w.errors.generic) : undefined);
  const input = { ...form, communityId: form.communityId || community?.id || '' };
  const text = (key: keyof InstitutionInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value || (key === 'phone' || key === 'email' ? null : '') }));

  function save() {
    setErrors({});
    setSaved(false);
    const done = { onSuccess: () => setSaved(true), onError: (e: unknown) => setErrors(fieldsOf(e)) };
    if (own) m.update.mutate(input, done);
    else m.register.mutate(input, { ...done, onSuccess: (r) => { setToken(r.editToken); setSaved(true); } });
  }

  function addNeed() {
    setNeedErrors({});
    const start = need.startMonth || months[0];
    m.addNeed.mutate(
      { productTypeId: need.productTypeId, amount: Number(need.amount), cadence: need.cadence as 'monthly', startMonth: start, endMonth: need.endMonth || start, note: need.note },
      { onSuccess: () => setNeed((n) => ({ ...n, amount: '', note: '' })), onError: (e) => setNeedErrors(fieldsOf(e)) },
    );
  }

  const needType = types?.find((t) => t.id === need.productTypeId);

  return (
    <Section pad="tight">
      <PageHeader title={own ? w.title : w.createTitle} lead={w.lead} back={{ href: '/institutions', label: copy.institutions.nav }} />
      <div className="inst-profile">
        <form
          className="inst-card"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label={w.name} value={form.name} onChange={text('name')} error={err(errors, 'name')} />
          <Select label={w.kind} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as InstitutionInput['kind'] }))}>
            {INSTITUTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {copy.institutions.kinds[k]}
              </option>
            ))}
          </Select>
          {mounted ? (
            <Select label={w.town} value={input.communityId} onChange={text('communityId')} error={err(errors, 'communityId')}>
              {(communities ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Checkbox label={w.showName} detail={w.showNameHint} checked={form.showName} onChange={(e) => setForm((f) => ({ ...f, showName: e.target.checked }))} />
          <Field multiline label={w.about} hint={w.aboutHint} value={form.about} onChange={text('about')} error={err(errors, 'about')} />
          <Field label={w.receiving} value={form.receivingNote} onChange={text('receivingNote')} error={err(errors, 'receivingNote')} />
          <Field label={w.contactName} hint={w.contactHint} value={form.contactName} onChange={text('contactName')} error={err(errors, 'contactName')} />
          <Field label={w.email} type="email" value={form.email ?? ''} onChange={text('email')} error={err(errors, 'email')} />
          <Field label={w.phone} type="tel" value={form.phone ?? ''} onChange={text('phone')} error={err(errors, 'phone')} />
          {errors.form ? <p className="field__error">{w.errors[errors.form] ?? w.errors.generic}</p> : null}
          <div className="inst-card__actions">
            <Button type="submit" loading={m.register.isPending || m.update.isPending}>
              {own ? w.save : w.create}
            </Button>
            {saved ? <span role="status">{w.saved}</span> : null}
          </div>
          <p className="inst-note">{w.deviceNote}</p>
        </form>

        <div className="inst-side">
          {own ? (
            <section className="inst-card" aria-labelledby="needs-title">
              <h2 id="needs-title" className="display-s">
                {w.needsTitle}
              </h2>
              {own.needs.length ? (
                <ul className="need-list">
                  {own.needs.map((n) => {
                    const t = types?.find((x) => x.id === n.productTypeId);
                    return (
                      <li key={n.id}>
                        <span>
                          <strong>{t?.name}</strong>{' '}
                          {copy.institutions.amountPer(n.amount, UNIT[t?.comparisonUnit ?? ''] ?? t?.comparisonUnit ?? '', copy.institutions.cadence[n.cadence])},{' '}
                          {copy.institutions.months(monthName(n.startMonth), monthName(n.endMonth))}
                        </span>
                        <Button variant="link" onClick={() => m.removeNeed.mutate(n.id as InstitutionNeedId)}>
                          {w.remove}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="inst-lead">{w.needsNone}</p>
              )}
              <h3 className="inst-card__sub">{w.addNeed}</h3>
              <Select label={w.food} value={need.productTypeId} onChange={(e) => setNeed((n) => ({ ...n, productTypeId: e.target.value }))} error={err(needErrors, 'productTypeId')}>
                <option value="">{copy.institutions.order.chooseFood}</option>
                {(types ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <div className="order-details__grid">
                <Field
                  label={w.amount(needType ? unitPlural(UNIT[needType.comparisonUnit] ?? needType.comparisonUnit) : '…')}
                  inputMode="decimal"
                  value={need.amount}
                  onChange={(e) => setNeed((n) => ({ ...n, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                  error={err(needErrors, 'amount')}
                />
                <Select label={w.cadence} value={need.cadence} onChange={(e) => setNeed((n) => ({ ...n, cadence: e.target.value }))}>
                  {(['weekly', 'monthly', 'one_time'] as const).map((c) => (
                    <option key={c} value={c}>
                      {copy.institutions.cadenceLabel[c]}
                    </option>
                  ))}
                </Select>
                <Select label={w.from} value={need.startMonth || months[0] || ''} onChange={(e) => setNeed((n) => ({ ...n, startMonth: e.target.value }))}>
                  {months.map((mo) => (
                    <option key={mo} value={mo}>
                      {`${monthName(mo)} ${mo.slice(0, 4)}`}
                    </option>
                  ))}
                </Select>
                <Select label={w.to} value={need.endMonth || need.startMonth || months[0] || ''} onChange={(e) => setNeed((n) => ({ ...n, endMonth: e.target.value }))} error={err(needErrors, 'endMonth')}>
                  {months.map((mo) => (
                    <option key={mo} value={mo}>
                      {`${monthName(mo)} ${mo.slice(0, 4)}`}
                    </option>
                  ))}
                </Select>
              </div>
              <Field label={w.note} value={need.note} onChange={(e) => setNeed((n) => ({ ...n, note: e.target.value }))} />
              <Button variant="secondary" onClick={addNeed} loading={m.addNeed.isPending}>
                {w.add}
              </Button>
            </section>
          ) : null}

          <section className="inst-card" aria-labelledby="orders-title">
            <h2 id="orders-title" className="display-s">
              {w.ordersTitle}
            </h2>
            {mounted && orders.length ? (
              orders.map((o) => (
                <div key={o.group} className="order-group">
                  <h3 className="inst-card__sub">
                    {o.food} · {new Date(o.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </h3>
                  <ul className="order-sent">
                    {o.tokens.map((t) => (
                      <OrderStatus key={t} token={t} />
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="inst-lead">{w.ordersNone}</p>
            )}
          </section>
        </div>
      </div>
    </Section>
  );
}
