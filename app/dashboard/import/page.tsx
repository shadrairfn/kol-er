import type { Metadata } from 'next';
import { ImportWizard } from '@/components/app/import/import-wizard';
import { listCampaignOptions } from '@/lib/data/repository';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Import' };

export default async function ImportPage(
  props: PageProps<'/dashboard/import'>,
) {
  await requireUser();
  const { type, campaign } = await props.searchParams;
  const campaigns = await listCampaignOptions();
  return (
    <ImportWizard
      campaigns={campaigns}
      initialType={type === 'metrics' || type === 'baseline' ? type : null}
      initialCampaign={typeof campaign === 'string' ? campaign : ''}
    />
  );
}
