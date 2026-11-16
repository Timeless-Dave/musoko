'use client';

import { useId, useState } from 'react';
import { format, formatDistanceStrict } from 'date-fns';
import { copy } from '@/content/copy';
import { Button, Field, MetaLine, Select, StatusMark } from '@/design-system/primitives';
import { comingSoonMonths } from '@/domain/availability';
import { SELLING_UNITS, type OwnListing } from '@/domain/farmer';
import type { Settings, SellingUnit } from '@/domain/types';
import { STATUS_FILL } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import { formatListingPrice, formatUnitPrice } from '@/lib/format';
import { normalizedUnitPrice } from '@/domain/units';
import { fieldWords, failureWords } from './errors';
import { monthName, monthShort, unitCount, unitName } from './format';
import { useSetAvailability } from './hooks';

const words = copy.dashboard.listing;

/** The units a farmer can count this listing in: how it is sold, and the unit its price is compared in. */
function amountUnits(listing: OwnListing): SellingUnit[] {
  const units: SellingUnit[] = [listing.product.sellingUnit];
  const comparison = listing.productType.comparisonUnit;
  if ((SELLING_UNITS as readonly string[]).includes(comparison) && !units.includes(comparison as SellingUnit)) {
    units.push(comparison as SellingUnit);
  }
  return units;
}

function statusLine(listing: OwnListing, now: Date): string {
  const { availability } = listing;
  if (listing.status === 'available_now') {
    return words.statusLine.available_now(
      availability.lastConfirmedAt ? formatDistanceStrict(new Date(availability.lastConfirmedAt), now, { addSuffix: true }) : '',
    );
  }
  if (listing.status === 'coming_soon') {
    return words.statusLine.coming_soon(availability.expectedMonth ? monthShort(availability.expectedMonth) : '');
  }
  return words.statusLine.unconfirmed;
}

/**
 * One listing and its quick changes. "Still available" is one tap. Beside it:
 * the amount in the same step, a month for "Coming soon", and "None right now".
 * A line under the buttons says what was saved, and only after the save returned.
 */
export function ListingRow({ listing, now, settings }: { listing: OwnListing; now: Date; settings: Settings }) {
  const set = useSetAvailability();
  const id = useId();
  const [panel, setPanel] = useState<'amount' | 'soon' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const { product, productType, quantity } = listing;
  const units = amountUnits(listing);
  const [amount, setAmount] = useState(() => (quantity ? String(quantity.amount) : ''));
  const [unit, setUnit] = useState<SellingUnit>(() => quantity?.unit ?? product.sellingUnit);
  const months = comingSoonMonths(now, settings);
  const [month, setMonth] = useState(() => listing.availability.expectedMonth ?? months[0] ?? '');
  const unitPrice = normalizedUnitPrice(product, productType);

  async function apply(change: Parameters<typeof set.mutateAsync>[0]['change'], done: string) {
    setError(null);
    setMessage(null);
    setFieldError({});
    try {
      await set.mutateAsync({ productId: product.id, change });
      setMessage(done);
      setPanel(null);
    } catch (e) {
      setFieldError(fieldWords(e));
      setError(failureWords(e, words.saveFailed));
    }
  }

  function confirmWithAmount(clear: boolean) {
    if (clear) return void apply({ kind: 'still_available', quantity: null }, words.confirmedNow);
    const parsed = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(parsed) || parsed <= 0) {
      setFieldError({ amount: copy.farmerErrors.quantity_invalid });
      return;
    }
    void apply({ kind: 'still_available', quantity: { amount: parsed, unit, approximate: true } }, words.confirmedNow);
  }

  return (
    <li className="listing-row">
      <div className="listing-row__main">
        <h3 className="listing-row__title">{product.title}</h3>
        <MetaLine>
          <span>{productType.name}</span>
          <span>{formatListingPrice(product.priceCents, product.sellingUnit, product.unitSize)}</span>
          {unitPrice ? <span>{formatUnitPrice(unitPrice)}</span> : null}
          {product.isDemo ? <DemoMark /> : null}
        </MetaLine>
        <p className="listing-row__status">
          <StatusMark fill={STATUS_FILL[listing.status]} size="body" />
          <span>{statusLine(listing, now)}</span>
        </p>
        <p className="dash-note">
          {quantity
            ? words.amountLine(
                `${quantity.amount} ${unitCount(quantity.unit)}`.trim(),
                format(new Date(quantity.lastConfirmedAt), 'd MMM'),
                quantity.approximate,
              )
            : words.noAmount}
        </p>
        {product.moderationStatus !== 'visible' ? <p className="dash-note">{words.moderated}</p> : null}
      </div>

      <div className="listing-row__actions">
        <Button loading={set.isPending && set.variables?.change.kind === 'still_available' && panel === null} onClick={() => void apply({ kind: 'still_available' }, words.confirmedNow)}>
          {words.stillAvailable}
        </Button>
        <Button variant="link" aria-expanded={panel === 'amount'} aria-controls={`${id}-amount`} onClick={() => setPanel(panel === 'amount' ? null : 'amount')}>
          {words.amount}
        </Button>
        <Button variant="link" aria-expanded={panel === 'soon'} aria-controls={`${id}-soon`} onClick={() => setPanel(panel === 'soon' ? null : 'soon')}>
          {words.comingSoon}
        </Button>
        <Button variant="link" onClick={() => void apply({ kind: 'not_available' }, words.noneNowDone)}>
          {words.noneNow}
        </Button>
        <Button variant="link" href={`/dashboard/listings/${product.id}`}>
          {words.edit}
        </Button>
      </div>

      {panel === 'amount' ? (
        <div className="listing-row__panel" id={`${id}-amount`} role="group" aria-labelledby={`${id}-amount-title`}>
          <h4 id={`${id}-amount-title`}>{words.amountTitle}</h4>
          <p className="dash-note">{words.amountHint}</p>
          <div className="dash-form__row dash-form__row--pair">
            <Field
              label={words.amountLabel}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={fieldError.amount ?? fieldError['quantity.amount']}
            />
            <Select label={words.amountUnit} value={unit} onChange={(e) => setUnit(e.target.value as SellingUnit)}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {unitCount(u) || unitName(u)}
                </option>
              ))}
            </Select>
          </div>
          <div className="listing-row__panel-actions">
            <Button loading={set.isPending} onClick={() => confirmWithAmount(false)}>
              {words.amountConfirm}
            </Button>
            <Button variant="link" onClick={() => confirmWithAmount(true)}>
              {words.amountNone}
            </Button>
          </div>
        </div>
      ) : null}

      {panel === 'soon' ? (
        <div className="listing-row__panel" id={`${id}-soon`} role="group" aria-labelledby={`${id}-soon-title`}>
          <h4 id={`${id}-soon-title`}>{words.comingSoonTitle}</h4>
          <Select label={words.comingSoonMonth} value={month} onChange={(e) => setMonth(e.target.value)} error={fieldError.expectedMonth}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </Select>
          <div className="listing-row__panel-actions">
            <Button loading={set.isPending} onClick={() => void apply({ kind: 'coming_soon', expectedMonth: month }, words.comingSoonDone(monthName(month)))}>
              {words.comingSoonConfirm}
            </Button>
            <Button variant="link" onClick={() => setPanel(null)}>
              {words.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      <p role="status" className="dash-status">
        {message}
      </p>
      {error ? (
        <p role="alert" className="dash-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}
