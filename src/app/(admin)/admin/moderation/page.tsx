import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, ModerationPage } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.nav.moderation };

export default function Page() {
  return (
    <AdminShell>
      <ModerationPage />
    </AdminShell>
  );
}
