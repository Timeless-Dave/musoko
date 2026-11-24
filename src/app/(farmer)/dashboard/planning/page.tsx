import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { DashboardShell, PlanningPage } from '@/features/farmer-dashboard';

export const metadata: Metadata = { title: copy.planning.title };

export default function Page() {
  return (
    <DashboardShell>
      <PlanningPage />
    </DashboardShell>
  );
}
