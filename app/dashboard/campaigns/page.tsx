import type { Metadata } from 'next';
import { CampaignList } from '@/components/app/campaign-list';
import { listCampaigns } from '@/lib/data/repository';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Campaign' };

export default async function CampaignsPage() {
  await requireUser();
  const campaigns = await listCampaigns();
  return <CampaignList campaigns={campaigns} />;
}
