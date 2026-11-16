import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, MetricsPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.metrics };

export default function Page() {
  return (
    <AdminShell>
      <MetricsPage />
    </AdminShell>
  );
}
