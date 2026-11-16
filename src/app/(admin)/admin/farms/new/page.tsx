import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { AdminShell, NewFarm } from '@/features/admin';

export const metadata: Metadata = { title: copy.admin.editor.newTitle };

export default function Page() {
  return (
    <AdminShell>
      <NewFarm />
    </AdminShell>
  );
}
