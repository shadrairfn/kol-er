import type { DashboardSection, NavItem, PageMeta } from './types';
export const dashboardNav: { label: string; items: NavItem[] }[] = [
  {
    label: 'WORKSPACE',
    items: [
      { section: 'kols', label: 'KOL', icon: 'users' },
      { section: 'instagram', label: 'Instagram Stats', icon: 'chart' },
      { section: 'reports', label: 'Report', icon: 'content' },
    ],
  },
];
export const pageMeta: Record<DashboardSection, PageMeta> = {
  instagram: {
    title: 'Instagram Stats',
    description:
      'Ambil statistik views, likes, dan comments dari post atau reel Instagram.',
    action: 'Ambil statistik',
  },
  kols: {
    title: 'KOL',
    description: 'Tambahkan profil Instagram KOL ke database Google Sheets.',
    action: 'Tambah KOL',
  },
  reports: {
    title: 'Report',
    description: 'Laporan KOL dan performa Instagram.',
    action: 'Buat report',
  },
};
export function sectionHref(section: DashboardSection) {
  return section === 'instagram' ? '/dashboard' : `/dashboard/${section}`;
}
