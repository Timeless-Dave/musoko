import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { FarmProfile } from '@/features/farmers';

export const metadata: Metadata = { title: copy.farms.title };

export default function FarmPage() {
  // The profile reads the slug in the browser, where the demo data lives.
  // A draft or unpublished farm is never returned by the public gateway, so it renders "not listed".
  return (
    <Suspense>
      <FarmProfile />
    </Suspense>
  );
}
