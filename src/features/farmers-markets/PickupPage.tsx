'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, MapPin, Storefront } from '@phosphor-icons/react';
import { copy } from '@/content/copy';
import { EmptyState, PageHeader } from '@/design-system/patterns';
import { ChoiceGroup, Section } from '@/design-system/primitives';
import type { CommunityId, OpeningHours, PublicFarmSummary } from '@/domain/types';
import {
  scheduleLines,
  useMilesFrom,
  usePublicFarms,
  usePublicMarkets,
  usePublicPickupLocations,
  useSelectedCommunity,
} from '@/features/catalogue';
import { DemoMark } from '@/features/demo';

const w = copy.pickupPage;

interface Place {
  key: string;
  kind: 'market' | 'spot';
  name: string;
  town: string;
  communityId: CommunityId;
  detail: string;
  schedule: OpeningHours[];
  directions: string;
  farms: Pick<PublicFarmSummary, 'slug' | 'farmName'>[];
  isDemo: boolean;
}

const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Every place to collect food, markets and pickup spots together, nearest first. */
export function PickupPage() {
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: spots } = usePublicPickupLocations();
  const { data: markets } = usePublicMarkets();
  const { data: farms } = usePublicFarms();
  const [show, setShow] = useState<'all' | 'market' | 'spot'>('all');

  const places = useMemo(() => {
    const users = new Map<string, Place['farms']>();
    for (const farm of farms ?? []) {
      for (const o of farm.pickupOptions) {
        if (!o.pickupLocationId) continue;
        users.set(o.pickupLocationId, [...(users.get(o.pickupLocationId) ?? []), { slug: farm.slug, farmName: farm.farmName }]);
      }
    }
    const list: Place[] = [
      ...(markets ?? []).map((m) => ({
        key: m.id, kind: 'market' as const, name: m.name, town: m.town, communityId: m.communityId,
        detail: [m.venue, m.seasonNote].filter(Boolean).join(' · '), schedule: m.schedule, directions: m.directionsUrl || mapsLink(m.point.lat, m.point.lng),
        farms: m.farms, isDemo: m.isDemo,
      })),
      ...(spots ?? []).map((s) => ({
        key: s.id, kind: 'spot' as const, name: s.name, town: s.town, communityId: s.communityId, detail: s.description,
        schedule: [], directions: mapsLink(s.point.lat, s.point.lng), farms: users.get(s.id) ?? [], isDemo: s.isDemo,
      })),
    ];
    return list
      .filter((p) => show === 'all' || p.kind === show)
      .sort((a, b) => (milesFrom(a.communityId) ?? 9999) - (milesFrom(b.communityId) ?? 9999) || a.name.localeCompare(b.name));
  }, [spots, markets, farms, show, milesFrom]);

  return (
    <Section pad="tight">
      <PageHeader title={w.title} lead={w.lead} />
      <ChoiceGroup
        legend={w.show}
        name="pickup-show"
        layout="chips"
        value={show}
        onChange={(v) => setShow(v as typeof show)}
        choices={[
          { value: 'all', label: w.filterAll },
          { value: 'market', label: w.filterMarkets },
          { value: 'spot', label: w.filterSpots },
        ]}
      />
      {spots && markets && places.length === 0 ? (
        <EmptyState sentence={w.none} />
      ) : (
        <ul className="pickup-list">
          {places.map((p) => {
            const miles = milesFrom(p.communityId);
            return (
              <li key={p.key} className="pickup-row" id={p.key}>
                <span className="pickup-row__icon" aria-hidden="true">
                  {p.kind === 'market' ? <Storefront size={22} /> : <MapPin size={22} />}
                </span>
                <div className="pickup-row__main">
                  <h2 className="pickup-row__name">{p.name}</h2>
                  <p className="pickup-row__meta">
                    {[p.kind === 'market' ? w.market : w.spot, p.town, miles != null ? copy.product.away(miles) : null].filter(Boolean).join(' · ')}
                  </p>
                  {p.detail ? <p className="pickup-row__detail">{p.detail}</p> : null}
                  <p className="pickup-row__when">{p.schedule.length ? scheduleLines(p.schedule).join(', ') : w.whenAsk}</p>
                  <p className="pickup-row__farms">
                    {p.farms.length ? (
                      <>
                        {w.farms}:{' '}
                        {p.farms.map((f, i) => (
                          <span key={f.slug}>
                            {i ? ', ' : ''}
                            <Link href={`/farmers/${f.slug}`}>{f.farmName}</Link>
                          </span>
                        ))}
                      </>
                    ) : (
                      w.noFarms
                    )}
                  </p>
                </div>
                <div className="pickup-row__side">
                  <a href={p.directions} target="_blank" rel="noreferrer" className="pickup-row__directions">
                    {w.directions} <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                  {p.isDemo ? <DemoMark /> : <span className="public-mark">{w.publicMarket}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
