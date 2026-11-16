import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, RetentionPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.data };

export default function Page() {
  return (
    <AdminShell>
      <RetentionPage />
    </AdminShell>
  );
}
