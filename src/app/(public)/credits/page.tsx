import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { Credits } from '@/features/credits';

export const metadata: Metadata = { title: copy.credits.title };

export default function CreditsPage() {
  return <Credits />;
}
