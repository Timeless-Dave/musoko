import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Styleguide } from '@/features/styleguide';

export const metadata: Metadata = { title: 'Styleguide', robots: { index: false, follow: false } };

export default function StyleguidePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <Styleguide />;
}
