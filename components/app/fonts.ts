import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google';

const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--kg-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--kg-mono',
  display: 'swap',
});

export const kgFonts = `${sans.variable} ${mono.variable}`;
