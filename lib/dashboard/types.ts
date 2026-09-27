import type { IconName } from '@/components/ui/icon';
export type DashboardSection = 'instagram' | 'kols' | 'reports';
export type PageMeta = { title: string; description: string; action: string };
export type NavItem = {
  section: DashboardSection;
  label: string;
  icon: IconName;
  badge?: string;
};
