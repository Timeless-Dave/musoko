'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { copy } from '@/content/copy';
import { EmptyState } from '@/design-system/patterns';
import { Button, Checkbox, ChoiceGroup, Dialog, Field, Select, type Choice } from '@/design-system/primitives';
import { comingSoonMonths } from '@/domain/availability';
import {
  categoryAsksLicence,
  KEEP_UNIT,
  presetIdFor,
  SELLING_UNITS,
  type ListingCreateInput,
  type ListingUpdateInput,
  type OwnListing,
} from '@/domain/farmer';
import { matchUnitPreset, normalizedUnitPrice, unitPresetsFor } from '@/domain/units';
import type { ProductCategory, ProductId, ProductType, SellingUnit } from '@/domain/types';
import { CATEGORY_ORDER, useProductTypes } from '@/features/catalogue';
import { centsToDollarsText, formatListingPrice, formatUnitPrice, parseDollars } from '@/lib/format';
import { useMounted } from '@/lib/useMounted';
import { fieldWords, failureWords } from './errors';
import { ListingOverview } from './ListingOverview';
import { monthName, presetLabel, unitCount, unitName } from './format';
import { useCreateListing, useNow, useOwnListings, useRemoveListing, useSettings, useUpdateListing } from './hooks';

const words = copy.dashboard.listingForm;

/** `productId` set: edit that listing. Absent: a new one. */
export function ListingForm({ productId }: { productId?: ProductId }) {
  const mounted = useMounted();
  const { data: listings } = useOwnListings();
  const { data: types } = useProductTypes();
  const { data: settings } = useSettings();

  if (!mounted || !listings || !types || !settings) return <p role="status">{copy.common.loading}</p>;
  const existing = productId ? (listings.find((l) => l.product.id === productId) ?? null) : null;
  if (productId && !existing) {
    return (
      <EmptyState
        sentence={words.notFound}
        action={
          <Button variant="secondary" href="/dashboard/listings">
            {words.back}
          </Button>
        }
      />
    );
  }
  return <Body existing={existing} types={types} settings={settings} />;
}

const CATEGORY_LABEL = copy.categories as Record<ProductCategory, string>;

function Body({
  existing,
  types,
  settings,
}: {
  existing: OwnListing | null;
  types: ProductType[];
  settings: Parameters<typeof comingSoonMonths>[1];
}) {
  const router = useRouter();
  const now = useNow();
  const create = useCreateListing();
  const update = useUpdateListing();
  const remove = useRemoveListing();
  const cancelRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  const [typeId, setTypeId] = useState(existing?.product.productTypeId ?? '');
  const [title, setTitle] = useState(existing?.product.title ?? '');
  const [description, setDescription] = useState(existing?.product.description ?? '');
  const [presetId, setPresetId] = useState(existing ? presetIdFor(existing.productType, existing.product) : '');
  const [price, setPrice] = useState(existing ? centsToDollarsText(existing.product.priceCents) : '');
  const [licence, setLicence] = useState(existing?.product.licenceSelfConfirmed === true);
  const [status, setStatus] = useState<'available_now' | 'coming_soon'>('available_now');
  const months = comingSoonMonths(now, settings);
  const [month, setMonth] = useState(months[0] ?? '');
  const [amount, setAmount] = useState('');
  const [amountUnit, setAmountUnit] = useState<SellingUnit | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);

  const type = types.find((t) => t.id === typeId) ?? null;
  const presets = useMemo(() => (type ? unitPresetsFor(type) : []), [type]);
  const kept = existing && type?.id === existing.productType.id && matchUnitPreset(presets, existing.product) === null;
  const preset = presets.find((p) => p.id === presetId) ?? null;
  const asksLicence = type ? categoryAsksLicence(type.category) : false;

  const sizeNow = preset ? preset.unitSize : kept && presetId === KEEP_UNIT ? existing!.product.unitSize : null;
  const unitNow = preset ? preset.sellingUnit : kept && presetId === KEEP_UNIT ? existing!.product.sellingUnit : null;
  const cents = parseDollars(price);
  const preview =
    type && unitNow && cents !== null && cents > 0
      ? {
          line: formatListingPrice(cents, unitNow, sizeNow),
          unitPrice: normalizedUnitPrice({ priceCents: cents, unitSize: sizeNow }, type),
        }
      : null;

  const typeGroups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({ category, items: types.filter((t) => t.category === category) })).filter((g) => g.items.length > 0),
    [types],
  );

  function chooseType(next: string) {
    const was = types.find((t) => t.id === typeId);
    const becoming = types.find((t) => t.id === next);
    setTypeId(next);
    setPresetId('');
    // A name nobody typed follows the product.
    if (becoming && (title === '' || title === was?.name)) setTitle(becoming.name);
  }

  const presetChoices: Choice[] = [
    ...presets.map((p) => ({ value: p.id, label: presetLabel(p) })),
    ...(kept && existing
      ? [
          {
            value: KEEP_UNIT,
            label: words.sellKeep(formatListingPrice(existing.product.priceCents, existing.product.sellingUnit, existing.product.unitSize)),
          },
        ]
      : []),
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    setSaved(false);
    const problems: Record<string, string> = {};
    if (cents === null || cents <= 0) problems.priceCents = copy.farmerErrors.price_invalid;
    const amountNumber = amount.trim() === '' ? null : Number(amount);
    if (amountNumber !== null && (!Number.isFinite(amountNumber) || amountNumber <= 0)) problems.amount = copy.farmerErrors.quantity_invalid;
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    const base: ListingUpdateInput = {
      productTypeId: typeId,
      title,
      description,
      priceCents: cents!,
      presetId,
      licenceSelfConfirmed: licence,
    };
    try {
      if (existing) {
        await update.mutateAsync({ productId: existing.product.id, values: base });
        setErrors({});
        setSaved(true);
      } else {
        const input: ListingCreateInput = {
          ...base,
          status,
          expectedMonth: status === 'coming_soon' ? month : null,
          quantity:
            status === 'available_now' && amountNumber !== null
              ? { amount: amountNumber, unit: amountUnit || unitNow || 'each', approximate: true }
              : null,
        };
        await create.mutateAsync(input);
        router.push('/dashboard/listings');
      }
    } catch (error) {
      setErrors(fieldWords(error));
      setFailed(failureWords(error, words.failed));
    }
  }

  async function confirmRemove() {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.product.id);
      router.push('/dashboard/listings');
    } catch (error) {
      setRemoving(false);
      setFailed(failureWords(error, words.failed));
    }
  }

  const busy = create.isPending || update.isPending;
  const amountUnits: SellingUnit[] = unitNow
    ? [unitNow, ...(type && (SELLING_UNITS as readonly string[]).includes(type.comparisonUnit) && type.comparisonUnit !== unitNow ? [type.comparisonUnit as SellingUnit] : [])]
    : [];

  return (
    <section className="dash-section" aria-labelledby="listing-form-title">
      <div>
        <Button variant="link" href="/dashboard/listings">
          {words.back}
        </Button>
      </div>
      {existing ? <ListingOverview listing={existing} /> : null}
      <h2 id="listing-form-title" className={existing ? 'dash-subtitle' : 'dash-title'}>
        {existing ? words.editTitle : words.newTitle}
      </h2>
      <form className="dash-form" onSubmit={(e) => void submit(e)} noValidate>
        <Select label={words.type} value={typeId} onChange={(e) => chooseType(e.target.value)} error={errors.productTypeId}>
          <option value="">{words.typeChoose}</option>
          {typeGroups.map((group) => (
            <optgroup key={group.category} label={CATEGORY_LABEL[group.category]}>
              {group.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>

        <Field label={words.name} hint={words.nameHint} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <Field label={words.description} optionalLabel={words.amountOptional} multiline value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />

        {type ? (
          <ChoiceGroup
            legend={words.sell}
            hint={words.sellHint}
            name="preset"
            value={presetId}
            onChange={setPresetId}
            choices={presetChoices}
            error={errors.presetId}
          />
        ) : null}

        <Field
          label={words.price}
          hint={unitNow ? words.priceHint(unitName(unitNow)) : undefined}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.priceCents}
        />

        {preview ? (
          <div className="dash-form__preview" aria-live="polite">
            <span>{words.preview}</span>
            <strong>{preview.unitPrice ? `${preview.line} · ${formatUnitPrice(preview.unitPrice)}` : preview.line}</strong>
            {preview.unitPrice ? null : <span className="dash-note">{words.previewNoUnit}</span>}
          </div>
        ) : null}

        {asksLicence ? (
          <Checkbox
            label={words.licence}
            detail={words.licenceHint}
            checked={licence}
            onChange={(e) => setLicence(e.target.checked)}
            aria-invalid={errors.licenceSelfConfirmed ? true : undefined}
          />
        ) : null}
        {errors.licenceSelfConfirmed ? (
          <p className="dash-error" role="alert">
            {errors.licenceSelfConfirmed}
          </p>
        ) : null}

        {!existing ? (
          <>
            <ChoiceGroup
              legend={words.status}
              name="status"
              layout="chips"
              value={status}
              onChange={(v) => setStatus(v as 'available_now' | 'coming_soon')}
              choices={[
                { value: 'available_now', label: words.statusNow },
                { value: 'coming_soon', label: words.statusSoon },
              ]}
            />
            {status === 'coming_soon' ? (
              <Select label={words.month} value={month} onChange={(e) => setMonth(e.target.value)} error={errors.expectedMonth}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="dash-form__row dash-form__row--pair">
                <Field
                  label={words.amount}
                  optionalLabel={words.amountOptional}
                  hint={words.amountHint}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={errors.amount ?? errors['quantity.amount']}
                />
                {amountUnits.length > 0 ? (
                  <Select label={copy.dashboard.listing.amountUnit} value={amountUnit || amountUnits[0]} onChange={(e) => setAmountUnit(e.target.value as SellingUnit)}>
                    {amountUnits.map((u) => (
                      <option key={u} value={u}>
                        {unitCount(u) || unitName(u)}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        <div className="dash-form__actions">
          <Button type="submit" loading={busy} loadingLabel={words.saving}>
            {words.save}
          </Button>
          <Button variant="link" href="/dashboard/listings">
            {copy.dashboard.listing.cancel}
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

      {existing ? (
        <div className="dash-form__actions">
          <Button variant="secondary" onClick={() => setRemoving(true)}>
            {words.remove}
          </Button>
        </div>
      ) : null}
      <Dialog
        open={removing}
        onOpenChange={setRemoving}
        title={words.removeTitle}
        description={words.removeBody}
        closeLabel={copy.common.close}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button loading={remove.isPending} onClick={() => void confirmRemove()}>
              {words.removeConfirm}
            </Button>
            <Button variant="secondary" ref={cancelRef} onClick={() => setRemoving(false)}>
              {copy.common.cancel}
            </Button>
          </>
        }
      />
    </section>
  );
}

/** The edit page: the listing's id comes from the address. */
export function EditListing() {
  const { productId } = useParams<{ productId: string }>();
  return <ListingForm productId={productId as ProductId} />;
}
