import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, FarmsPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.farms };

export default function Page() {
  return (
    <AdminShell>
      <FarmsPage />
    </AdminShell>
  );
}
