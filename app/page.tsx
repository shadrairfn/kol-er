import { LandingHeader } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
export default function Home() {
  return (
    <main className="landing">
      <LandingHeader />
      <Hero />
    </main>
  );
}
