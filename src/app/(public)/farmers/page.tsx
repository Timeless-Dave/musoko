import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { FarmDirectory } from '@/features/farmers';

export const metadata: Metadata = { title: copy.farms.title };

export default function FarmersPage() {
  return <FarmDirectory />;
}
