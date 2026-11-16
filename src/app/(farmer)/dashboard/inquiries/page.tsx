import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, InquiriesPage } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.nav.inquiries };

export default function Page() {
  return (
    <DashboardShell>
      <InquiriesPage />
    </DashboardShell>
  );
}
