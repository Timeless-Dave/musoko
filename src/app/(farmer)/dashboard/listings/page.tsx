import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, ListingsPage } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.nav.listings };

export default function Page() {
  return (
    <DashboardShell>
      <ListingsPage />
    </DashboardShell>
  );
}
