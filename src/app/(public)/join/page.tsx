import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { FarmerRegistration } from '@/features/farmer-registration';

export const metadata: Metadata = { title: copy.join.title };

export default function JoinPage() {
  return <FarmerRegistration />;
}
