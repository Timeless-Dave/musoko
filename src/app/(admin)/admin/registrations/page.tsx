import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, RegistrationsPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.registrations };

export default function Page() {
  return (
    <AdminShell>
      <RegistrationsPage />
    </AdminShell>
  );
}
