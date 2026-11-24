import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { OrderPlanner } from '@/features/institutions';

export const metadata: Metadata = { title: copy.institutions.order.title };

export default function Page() {
  return (
    <Suspense>
      <OrderPlanner />
    </Suspense>
  );
}
