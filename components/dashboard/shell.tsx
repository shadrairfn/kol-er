'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { DashboardHeader } from './header';
import { pageMeta } from '@/lib/dashboard/config';
import type { DashboardSection } from '@/lib/dashboard/types';

function currentSection(pathname: string | null): DashboardSection {
  const segment = pathname?.split('/')[2] as DashboardSection | undefined;
  return segment && segment in pageMeta ? segment : 'instagram';
}
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setCollapsed(localStorage.getItem('kolgia-sidebar') === 'collapsed'),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  function collapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('kolgia-sidebar', next ? 'collapsed' : 'expanded');
  }
  return (
    <div className={`dashboard ${collapsed ? 'is-collapsed' : ''}`}>
      <div
        className={`drawer-backdrop ${drawer ? 'show' : ''}`}
        onClick={() => setDrawer(false)}
      />
      <Sidebar
        open={drawer}
        onNavigate={() => setDrawer(false)}
        onCollapse={collapse}
      />
      <main
        className="dash-main"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
      >
        <DashboardHeader
          meta={pageMeta[currentSection(pathname)]}
          scrolled={scrolled}
          onMenu={() => setDrawer(true)}
        />
        {children}
      </main>
    </div>
  );
}
