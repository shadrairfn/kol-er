import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KOL GIA — Kolaborasi kreator, tanpa kerumitan',
  description: 'Platform kolaborasi KOL untuk tim brand Indonesia.',
};
const themeScript = `(function(){try{var t=localStorage.getItem('kolgia-theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){}})()`;
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
