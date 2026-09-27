import '@/components/app/kg.css';
import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/app-header';
import { kgFonts } from '@/components/app/fonts';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = {
  title: { template: '%s — KOL GIA', default: 'KOL GIA' },
};

export default async function DashboardLayout({
  children,
}: LayoutProps<'/dashboard'>) {
  const user = await requireUser();
  return (
    <div className={`kg ${kgFonts}`}>
      <AppHeader userName={user.displayName} />
      {children}
    </div>
  );
}
