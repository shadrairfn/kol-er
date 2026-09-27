import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CampaignReport } from '@/components/app/campaign-report';
import { getCampaignReport } from '@/lib/data/repository';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Report campaign' };

export default async function CampaignReportPage(
  props: PageProps<'/dashboard/campaigns/[id]'>,
) {
  await requireUser();
  const { id } = await props.params;
  const report = await getCampaignReport(id);
  if (!report) notFound();
  return <CampaignReport report={report} />;
}
