import type { Metadata } from 'next';
import { copy } from '@/content/copy';
import { Welcome } from '@/features/welcome';

export const metadata: Metadata = { title: copy.intro.metaTitle, description: copy.brand.tagline };

export default function WelcomePage() {
  return <Welcome />;
}
