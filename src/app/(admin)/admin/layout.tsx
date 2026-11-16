import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';

// A signed-in area: nothing here belongs in search results.
export const metadata: Metadata = {
  title: { default: copy.admin.title, template: `%s | ${copy.admin.title} | ${copy.brand.name}` },
  robots: { index: false, follow: false },
};

/**
 * The administrator-only frame (heading, navigation, the guard) is `AdminShell`,
 * and each page renders it around its own content. It stays out of this layout so
 * every page segment renders for the server, whoever is signed in.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
