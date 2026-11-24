import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { PickupPage } from '@/features/farmers-markets';

export const metadata: Metadata = { title: copy.pickupPage.title };

export default function Page() {
  return <PickupPage />;
}
