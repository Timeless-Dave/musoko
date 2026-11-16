import type { Metadata } from 'next';
import { Suspense } from 'react';
import { copy } from '@/content/copy';
import { MapExplorer } from '@/features/map';

export const metadata: Metadata = { title: copy.map.title };

export default function MapPage() {
  // The view and filters live in the URL, so the explorer renders inside Suspense.
  // The map library is not part of this page: it loads when the map tab opens.
  return (
    <Suspense>
      <MapExplorer />
    </Suspense>
  );
}
