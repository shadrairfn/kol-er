'use client';
import { Icon } from '@/components/ui/icon';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { PageMeta } from '@/lib/dashboard/types';
export function DashboardHeader({
  meta,
  scrolled,
  onMenu,
}: {
  meta: PageMeta;
  scrolled: boolean;
  onMenu: () => void;
}) {
  return (
    <header className={`dash-header ${scrolled ? 'scrolled' : ''}`}>
      <div>
        <button className="mobile-menu" onClick={onMenu} aria-label="Buka menu">
          <Icon name="menu" />
        </button>
        <span className="context">
          WORKSPACE / <b>{meta.title.toUpperCase()}</b>
        </span>
      </div>
      <div className="dash-actions">
        <button className="global-search">
          <Icon name="search" size={18} />
          <span>Cari apa saja...</span>
          <kbd>⌘ K</kbd>
        </button>
        <ThemeToggle className="dash-icon" />
        <button className="dash-icon" aria-label="Notifikasi">
          <Icon name="bell" />
          <i />
        </button>
        <span className="header-avatar">NA</span>
      </div>
    </header>
  );
}
