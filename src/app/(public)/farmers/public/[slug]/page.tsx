import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { DirectoryProfile } from '@/features/farmers';

export const metadata: Metadata = { title: copy.farms.title };

export default function Page() {
  return (
    <Suspense>
      <DirectoryProfile />
    </Suspense>
  );
}
