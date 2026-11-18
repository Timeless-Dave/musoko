import type { ReactNode } from 'react';
import { AppSidebar } from '@/features/shell';

/** Browse pages: the sidebar beside the content from 1024px, like a marketplace app. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <AppSidebar />
      <div className="app-frame__main">{children}</div>
    </div>
  );
}
