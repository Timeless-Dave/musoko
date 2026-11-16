import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, PrivacyPage } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.nav.privacy };

export default function Page() {
  return (
    <DashboardShell>
      <PrivacyPage />
    </DashboardShell>
  );
}
