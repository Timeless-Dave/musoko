'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { copy } from '@/content/copy';
import { Button } from '@/design-system/primitives';
import { monthName, type FarmerPlanning } from '@/domain/planning';
import { services } from '@/data';
import { useActor } from '@/features/auth';
import { GuideMessage } from '@/features/assistant';
import { useOwnFarm } from './hooks';

const w = copy.planning;
const UNIT: Record<string, string> = { fl_oz: 'fl oz' };
const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

function usePlanning() {
  const actor = useActor();
  const farmer = actor && actor.role === 'farmer' && actor.farmerProfileId ? actor : null;
  return useQuery({
    queryKey: ['own', farmer?.farmerProfileId ?? 'none', 'planning'],
    queryFn: () => services.gateway.getFarmerPlanning(farmer!),
    enabled: farmer !== null,
  });
}

/** Only figures go to the AI guide: food, counts, months and prices. No buyer's name or contact. */
function summary(p: FarmerPlanning, town: string) {
  return {
    town,
    radiusMiles: p.radiusMiles,
    windowDays: p.windowDays,
    foods: p.rows.slice(0, 8).map((r) => ({
      food: r.name,
      unit: UNIT[r.unit] ?? r.unit,
      youList: r.youList,
      searches: r.searches,
      searchesFoundNothing: r.unmet,
      plannedByMonth: r.institutionByMonth.filter((m) => m.amount > 0).map((m) => ({ month: monthName(m.month), amount: m.amount })),
      plannedBuyerKinds: r.institutionBuyers.map((b) => b.kind),
      price: r.price ? { yourCents: r.price.yours, lowCents: r.price.low, medianCents: r.price.median, highCents: r.price.high } : null,
    })),
  };
}

export function PlanningPage() {
  const { data: plan, isPending } = usePlanning();
  const { data: farm } = useOwnFarm();
  const [advice, setAdvice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function ask() {
    if (!plan) return;
    setAsking(true);
    setFailed(false);
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary(plan, farm?.town ?? '')),
      });
      if (!res.ok) throw new Error(String(res.status));
      setAdvice(await res.text());
    } catch {
      setFailed(true);
    } finally {
      setAsking(false);
    }
  }

  if (isPending || !plan) return <p role="status">{copy.common.loading}</p>;
  return (
    <section className="dash-section" aria-labelledby="planning-title">
      <h2 id="planning-title" className="dash-title">
        {w.title}
      </h2>
      <p className="dash-lead">{w.lead}</p>
      {plan.rows.length === 0 ? (
        <p className="dash-note">{w.none}</p>
      ) : (
        <ul className="plan-list">
          {plan.rows.map((r) => {
            const unit = UNIT[r.unit] ?? r.unit;
            const peak = Math.max(1, ...r.institutionByMonth.map((m) => m.amount));
            return (
              <li key={r.productTypeId} className="plan-card">
                <div className="plan-card__head">
                  <h3 className="plan-card__name">{r.name}</h3>
                  <span className={r.youList ? 'pill-note' : 'plan-card__tag'}>{r.youList ? w.youList : w.notListed}</span>
                </div>
                <p className="plan-card__meta">
                  {w.searches(r.searches, plan.windowDays)}
                  {r.unmet ? ` · ${w.unmet(r.unmet)}` : ''}
                  {r.institutionBuyers.length ? ` · ${w.buyers}: ${r.institutionBuyers.map((b) => b.label).join(', ')}` : ''}
                </p>
                {r.seasonTotal > 0 ? (
                  <figure className="plan-months">
                    <figcaption>{w.byMonth}</figcaption>
                    <table>
                      <tbody>
                        <tr>
                          {r.institutionByMonth.map((m) => (
                            <td key={m.month}>
                              <span className="plan-months__bar" style={{ blockSize: `${Math.max(2, (m.amount / peak) * 48)}px` }} aria-hidden="true" />
                              <span className="plan-months__value">{m.amount ? `${m.amount.toLocaleString('en-US')} ${unit}` : '–'}</span>
                              <span className="plan-months__label">{monthName(m.month).slice(0, 3)}</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </figure>
                ) : null}
                {r.price ? (
                  <p className="plan-card__meta">
                    <strong>{w.price}:</strong> {w.range(dollars(r.price.low), dollars(r.price.median), dollars(r.price.high), unit)} ({w.basis(r.price.basis)})
                  </p>
                ) : null}
                <ul className="plan-card__advice">
                  {r.advice.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <p className="dash-note">{w.note(plan.radiusMiles, plan.minimumSampleSize)}</p>

      {plan.rows.length ? (
        <div className="plan-ask">
          <h3 className="plan-card__name">{w.askTitle}</h3>
          <p className="dash-note">{w.askLead}</p>
          <Button variant="secondary" onClick={ask} loading={asking} loadingLabel={w.asking}>
            {w.ask}
          </Button>
          {failed ? <p className="field__error">{w.askFailed}</p> : null}
          {advice ? (
            <div className="plan-ask__answer">
              <GuideMessage text={advice} />
              <p className="dash-note">{w.askNote}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
