import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, ListingForm } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.listingForm.newTitle };

export default function Page() {
  return (
    <DashboardShell>
      <ListingForm />
    </DashboardShell>
  );
}
