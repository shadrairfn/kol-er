import '@/components/app/kg.css';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { kgFonts } from '@/components/app/fonts';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Masuk — KOL GIA',
};

export default async function LoginPage(props: PageProps<'/login'>) {
  if (await getSession()) redirect('/dashboard/kols');
  const { next } = await props.searchParams;

  return (
    <div className={`kg ${kgFonts}`}>
      <main className="login">
        <section className="login-hero" aria-label="Tentang KOL GIA">
          <div className="login-hero-top">
            <span className="kg-brand">KOL GIA</span>
            <span
              className="mono"
              style={{
                fontSize: 12,
                color: '#a9a9a4',
                letterSpacing: '0.04em',
              }}
            >
              INSTAGRAM · TIKTOK
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <h1>
              Engagement rate, sebelum dan <span>sesudah</span>.
            </h1>
            <p className="login-formula">
              ER = (likes + comments + shares + saves) ÷ basis × 100
            </p>
          </div>

          <div className="login-pillars">
            <div>
              <div className="login-pillar-title">
                <span className="square before" />
                SEBELUM APPROACH
              </div>
              <p>
                Baseline dari data awal akun KOL. Disimpan sebagai snapshot dan
                tidak pernah ditimpa.
              </p>
            </div>
            <div>
              <div className="login-pillar-title">
                <span className="square after" />
                SETELAH POSTING
              </div>
              <p>
                Performa aktual konten campaign: views, reach, likes, comments,
                shares, saves.
              </p>
            </div>
          </div>
        </section>

        <section className="login-panel">
          <LoginForm next={typeof next === 'string' ? next : ''} />
        </section>
      </main>
    </div>
  );
}
