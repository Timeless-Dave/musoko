'use client';

import { useMemo } from 'react';
import { copy } from '@/content/copy';
import { EmptyState, PageHeader } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';
import { useMilesFrom, usePublicMarkets, usePublicProducts, useSelectedCommunity } from '@/features/catalogue';
import { MarketRow } from './MarketRow';

export function MarketList() {
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: markets } = usePublicMarkets();
  const { data: products } = usePublicProducts();

  const sorted = useMemo(
    () =>
      [...(markets ?? [])].sort(
        (a, b) =>
          (milesFrom(a.communityId) ?? Number.MAX_SAFE_INTEGER) - (milesFrom(b.communityId) ?? Number.MAX_SAFE_INTEGER),
      ),
    [markets, milesFrom],
  );

  /** The product types the market's farms list most often, most common first. */
  const offeredAt = (farmIds: string[]): string[] => {
    const counts = new Map<string, number>();
    for (const product of products ?? []) {
      if (!farmIds.includes(product.farm.id)) continue;
      counts.set(product.productType.name, (counts.get(product.productType.name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([name]) => name);
  };

  return (
    <Section pad="tight">
      <PageHeader title={copy.markets.title} lead={copy.markets.lead} />
      {markets && sorted.length === 0 ? (
        <EmptyState sentence={copy.markets.none} />
      ) : (
        <ul className="market-list">
          {sorted.map((market, i) => (
            <li key={market.id}>
              <MarketRow market={market} index={i} offered={offeredAt(market.farms.map((f) => f.id))} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
