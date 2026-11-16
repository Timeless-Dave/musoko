import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';

// A signed-in area: nothing here belongs in search results.
export const metadata: Metadata = {
  title: { default: copy.dashboard.title, template: `%s | ${copy.dashboard.title} | ${copy.brand.name}` },
  robots: { index: false, follow: false },
};

/**
 * The farmer-only frame (header, navigation, the guard) is `DashboardShell`, and
 * each page renders it around its own content. It stays out of this layout so
 * every page segment renders for the server, whoever is signed in.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
