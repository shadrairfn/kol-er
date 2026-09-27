'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth-actions';
import { initials } from '@/lib/er';

const NAV = [
  { href: '/dashboard/kols', label: 'KOL' },
  { href: '/dashboard/campaigns', label: 'Campaign' },
  { href: '/dashboard/import', label: 'Import' },
];

export function AppHeader({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <header className="kg-header">
      <div className="kg-header-left">
        <Link href="/dashboard/kols" className="kg-brand">
          KOL GIA
        </Link>
        <nav aria-label="Navigasi utama" className="kg-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                pathname?.startsWith(item.href) ? 'page' : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="kg-user">
        <span className="kg-avatar" aria-hidden>
          {initials(userName)}
        </span>
        <span className="kg-user-name">{userName}</span>
        <form action={logout}>
          <button type="submit" className="kg-logout">
            Keluar
          </button>
        </form>
      </div>
    </header>
  );
}
