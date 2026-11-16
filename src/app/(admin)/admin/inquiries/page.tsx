import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, InquiriesPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.inquiries };

export default function Page() {
  return (
    <AdminShell>
      <InquiriesPage />
    </AdminShell>
  );
}
