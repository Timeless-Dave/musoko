import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, NumbersPage } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.nav.numbers };

export default function Page() {
  return (
    <DashboardShell>
      <NumbersPage />
    </DashboardShell>
  );
}
