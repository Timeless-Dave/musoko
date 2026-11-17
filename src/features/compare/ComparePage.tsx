'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { blurFor } from '@/content/image-credits';
import { EmptyState, PhotoFrame } from '@/design-system/patterns';
import { Button, Section, StatusMark } from '@/design-system/primitives';
import {
  pickupSummary,
  statusDetail,
  STATUS_FILL,
  useMilesFrom,
  usePublicProducts,
  useSelectedCommunity,
} from '@/features/catalogue';
import { services } from '@/data';
import type { PublicProduct } from '@/domain/types';
import { formatListingPrice, formatUnitPrice } from '@/lib/format';
import { useMounted } from '@/lib/useMounted';
import { useCompareStore } from './store';

export function ComparePage() {
  const ids = useCompareStore((s) => s.ids);
  const clear = useCompareStore((s) => s.clear);
  const remove = useCompareStore((s) => s.remove);
  const { data: products } = usePublicProducts();
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const mounted = useMounted();
  const now = useMemo(() => (mounted ? services.clock.now() : null), [mounted]);

  const selected = useMemo(() => {
    if (!products) return [];
    return ids.map((id) => products.find((p) => p.id === id)).filter((p) => p != null);
  }, [ids, products]);

  if (!products) {
    return (
      <Section>
        <p>{copy.common.loading}</p>
      </Section>
    );
  }

  if (!selected.length) {
    return (
      <Section>
        <h1 className="display-m">{copy.compare.title}</h1>
        <p className="compare-intro">{copy.compare.intro}</p>
        <EmptyState
          sentence={copy.compare.empty}
          action={
            <Button variant="primary" href="/food">
              {copy.compare.emptyAction}
            </Button>
          }
        />
      </Section>
    );
  }

  const rows: { label: string; cell: (p: PublicProduct) => ReactNode }[] = [
    {
      label: copy.compare.row.photo,
      cell: (p) =>
        p.photo ? (
          <PhotoFrame ratio="4:3" src={p.photo.src} alt="" sizes="10rem" blurDataURL={blurFor(p.photo.src)} />
        ) : (
          <div className="compare-no-photo" />
        ),
    },
    {
      label: copy.compare.row.listing,
      cell: (p) => (
        <Link href={`/farmers/${p.farm.slug}#${p.id}`} className="compare-link">
          {p.title}
        </Link>
      ),
    },
    { label: copy.compare.row.farm, cell: (p) => `${p.farm.farmName} · ${p.farm.town}` },
    {
      label: copy.compare.row.price,
      cell: (p) => formatListingPrice(p.priceCents, p.sellingUnit, p.unitSize),
    },
    {
      label: copy.compare.row.unit,
      cell: (p) => (p.normalizedUnitPrice ? formatUnitPrice(p.normalizedUnitPrice) : '—'),
    },
    {
      label: copy.compare.row.status,
      cell: (p) => (
        <span className="compare-status">
          <StatusMark fill={STATUS_FILL[p.availability.status]} />
          {copy.availability[p.availability.status]}
          {now && statusDetail(p, now) ? ` · ${statusDetail(p, now)}` : ''}
        </span>
      ),
    },
    { label: copy.compare.row.pickup, cell: (p) => pickupSummary(p.pickupOptions) ?? '—' },
    {
      label: copy.compare.row.away,
      cell: (p) => {
        const miles = milesFrom(p.farm.communityId);
        return miles != null ? copy.product.away(miles) : '—';
      },
    },
  ];

  return (
    <Section>
      <p className="compare-intro">{copy.compare.intro}</p>
      <div className="compare-head">
        <h1 className="display-m">{copy.compare.title}</h1>
        <Button variant="link" onClick={clear}>
          {copy.compare.clear}
        </Button>
      </div>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" className="compare-table__label" />
              {selected.map((p) => (
                <th key={p.id} scope="col" className="compare-table__col">
                  <Button variant="link" onClick={() => remove(p.id)} className="compare-table__remove">
                    {copy.compare.remove}
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="compare-table__label">
                  {row.label}
                </th>
                {selected.map((p) => (
                  <td key={p.id}>{row.cell(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}