import type { Metadata } from 'next';
import { InterimHome } from '@/features/home';
import { copy } from '@/content/copy';

export const metadata: Metadata = { title: { absolute: `${copy.brand.name}: ${copy.brand.tagline}` } };

export default function HomePage() {
  return <InterimHome />;
}
