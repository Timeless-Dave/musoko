import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { AdminShell, FarmDetailPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.farms };

export default function Page() {
  return (
    <AdminShell>
      <Suspense>
        <FarmDetailPage />
      </Suspense>
    </AdminShell>
  );
}
