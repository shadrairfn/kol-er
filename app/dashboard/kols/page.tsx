import type { Metadata } from 'next';
import { KolWorkspace } from '@/components/app/kol-workspace';
import { listKols } from '@/lib/data/repository';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'KOL' };

export default async function KolsPage() {
  await requireUser();
  const kols = await listKols();
  return <KolWorkspace kols={kols} />;
}
