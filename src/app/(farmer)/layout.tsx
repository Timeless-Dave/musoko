import type { ReactNode } from 'react';
import { DashboardAside, DashboardMobileNav } from '@/features/farmer-dashboard';

export default function FarmerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <DashboardAside />
      <div className="app-frame__main role-frame__main">
        <DashboardMobileNav />
        {children}
      </div>
    </div>
  );
}