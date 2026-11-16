import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { MarketList } from '@/features/farmers-markets';

export const metadata: Metadata = { title: copy.markets.title };

export default function FarmersMarketsPage() {
  return <MarketList />;
}
