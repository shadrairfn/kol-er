'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/ui/brand';
import { Icon } from '@/components/ui/icon';
import { dashboardNav, sectionHref } from '@/lib/dashboard/config';

export function Sidebar({
  open,
  onNavigate,
  onCollapse,
}: {
  open: boolean;
  onNavigate: () => void;
  onCollapse: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="side-brand">
        <Brand />
        <button
          className="collapse"
          onClick={onCollapse}
          aria-label="Tutup sidebar"
        >
          Minimize
        </button>
      </div>
      <nav aria-label="Navigasi dashboard">
        {dashboardNav.map((group) => (
          <div className="nav-group" key={group.label}>
            <small>{group.label}</small>
            {group.items.map((item) => {
              const href = sectionHref(item.section);
              return (
                <Link
                  title={item.label}
                  className={pathname === href ? 'active' : ''}
                  href={href}
                  onClick={onNavigate}
                  key={item.section}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge && <em>{item.badge}</em>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-profile">
        <span className="person">NA</span>
        <p>
          <b>Nadia Ardi</b>
          <small>Workspace Admin</small>
        </p>
        <button aria-label="Menu profil">•••</button>
      </div>
    </aside>
  );
}
