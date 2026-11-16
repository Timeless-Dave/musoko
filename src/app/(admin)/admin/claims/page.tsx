import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, ClaimsPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.claims };

export default function Page() {
  return (
    <AdminShell>
      <ClaimsPage />
    </AdminShell>
  );
}
