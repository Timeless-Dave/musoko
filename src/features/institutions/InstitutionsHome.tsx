'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Buildings, ClipboardText } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { EmptyState, PageHeader } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';
import { monthName } from '@/domain/planning';
import { FarmCard, useMilesFrom, usePublicFarms, usePublicProducts, useSelectedCommunity } from '@/features/catalogue';
import { DemoMark } from '@/features/demo';
import { usePublicInstitutions } from './hooks';

const w = copy.institutions;
const UNIT: Record<string, string> = { fl_oz: 'fl oz' };

/** The page for schools, hospitals, restaurants, colleges and pantries. */
export function InstitutionsHome() {
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: institutions } = usePublicInstitutions();
  const { data: farms } = usePublicFarms();
  const { data: products } = usePublicProducts();

  const needs = useMemo(
    () =>
      (institutions ?? [])
        .flatMap((i) => i.needs)
        .sort((a, b) => (milesFrom(a.communityId) ?? 9999) - (milesFrom(b.communityId) ?? 9999) || a.startMonth.localeCompare(b.startMonth)),
    [institutions, milesFrom],
  );
  const wholesale = useMemo(
    () => (farms ?? []).filter((f) => f.openToWholesale).sort((a, b) => (milesFrom(a.location.communityId) ?? 9999) - (milesFrom(b.location.communityId) ?? 9999)),
    [farms, milesFrom],
  );

  return (
    <>
      <Section pad="tight">
        <PageHeader title={w.title} lead={w.lead} />
        <ul className="inst-actions">
          <li>
            <Link href="/institutions/order" className="inst-action">
              <ClipboardText size={28} aria-hidden="true" />
              <span className="inst-action__title">
                {w.actions.order.title} <ArrowRight size={16} aria-hidden="true" />
              </span>
              <span className="inst-action__body">{w.actions.order.body}</span>
            </Link>
          </li>
          <li>
            <Link href="/institutions/profile" className="inst-action">
              <Buildings size={28} aria-hidden="true" />
              <span className="inst-action__title">
                {w.actions.profile.title} <ArrowRight size={16} aria-hidden="true" />
              </span>
              <span className="inst-action__body">{w.actions.profile.body}</span>
            </Link>
          </li>
        </ul>
        <p className="inst-note">{w.noPayment}</p>
      </Section>

      <Section pad="tight" aria-labelledby="inst-board">
        <h2 id="inst-board" className="display-s">
          {w.boardTitle}
        </h2>
        <p className="inst-lead">{w.boardLead}</p>
        {institutions && needs.length === 0 ? (
          <EmptyState sentence={w.boardNone} />
        ) : (
          <ul className="need-board">
            {needs.map((n) => {
              const miles = milesFrom(n.communityId);
              return (
                <li key={n.id} className="need-row">
                  <div className="need-row__food">
                    <span className="need-row__name">{n.productType.name}</span>
                    <span className="need-row__amount">
                      {w.amountPer(n.amount, UNIT[n.productType.comparisonUnit] ?? n.productType.comparisonUnit, w.cadence[n.cadence])}
                    </span>
                  </div>
                  <div className="need-row__who">
                    <span>{n.buyerLabel}</span>
                    <span className="need-row__meta">
                      {w.kinds[n.kind]} · {n.town}
                      {miles != null ? ` · ${copy.product.away(miles)}` : ''}
                    </span>
                  </div>
                  <div className="need-row__when">
                    {w.months(monthName(n.startMonth), monthName(n.endMonth))}
                    {n.note ? <span className="need-row__note">{n.note}</span> : null}
                  </div>
                  {n.isDemo ? <DemoMark /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {wholesale.length ? (
        <Section pad="tight" aria-labelledby="inst-wholesale">
          <h2 id="inst-wholesale" className="display-s">
            {w.wholesaleTitle}
          </h2>
          <p className="inst-lead">{w.wholesaleLead}</p>
          <ul className="farm-grid">
            {wholesale.map((farm) => (
              <li key={farm.id}>
                <FarmCard
                  farm={farm}
                  listings={(products ?? []).filter((p) => p.farm.id === farm.id).length}
                  miles={milesFrom(farm.location.communityId)}
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
