import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KolDetailView } from '@/components/app/kol-detail';
import { getKolDetail } from '@/lib/data/repository';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Detail KOL' };

export default async function KolDetailPage(
  props: PageProps<'/dashboard/kols/[id]'>,
) {
  await requireUser();
  const { id } = await props.params;
  const { campaign } = await props.searchParams;
  const detail = await getKolDetail(id);
  if (!detail) notFound();
  return (
    <KolDetailView
      detail={detail}
      campaignId={typeof campaign === 'string' ? campaign : ''}
    />
  );
}
