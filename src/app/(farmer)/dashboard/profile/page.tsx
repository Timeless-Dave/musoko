import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, ProfilePage } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.dashboard.nav.profile };

export default function Page() {
  return (
    <DashboardShell>
      <ProfilePage />
    </DashboardShell>
  );
}
