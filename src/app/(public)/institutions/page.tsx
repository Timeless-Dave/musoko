import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { InstitutionsHome } from '@/features/institutions';

export const metadata: Metadata = { title: copy.institutions.nav };

export default function Page() {
  return <InstitutionsHome />;
}
