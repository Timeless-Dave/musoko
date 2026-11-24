import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { About } from '@/features/welcome';

export const metadata: Metadata = { title: copy.about.title };

export default function Page() {
  return <About />;
}
