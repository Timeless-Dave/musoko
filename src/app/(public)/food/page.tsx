import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { Marketplace } from '@/features/marketplace';

export const metadata: Metadata = { title: copy.food.title };

export default function FoodPage() {
  // The marketplace reads its filters from the URL, so it renders inside Suspense.
  return (
    <Suspense>
      <Marketplace />
    </Suspense>
  );
}
