import type { ReactNode } from 'react';
import { AdminAside, AdminMobileNav } from '@/features/admin';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <AdminAside />
      <div className="app-frame__main role-frame__main">
        <AdminMobileNav />
        {children}
      </div>
    </div>
  );
}