import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { DashboardShell, EditListing } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.listingForm.editTitle };

export default function Page() {
  return (
    <DashboardShell>
      <Suspense>
        <EditListing />
      </Suspense>
    </DashboardShell>
  );
}
