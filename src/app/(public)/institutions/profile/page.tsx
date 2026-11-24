import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { InstitutionProfile } from '@/features/institutions';

export const metadata: Metadata = { title: copy.institutions.profile.title };

export default function Page() {
  return (
    <Suspense>
      <InstitutionProfile />
    </Suspense>
  );
}
