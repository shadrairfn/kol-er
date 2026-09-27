'use client';

import { Icon } from '@/components/app/icons';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="kg-page">
      <div className="page-head-text">
        <h1 className="page-title">Data tidak bisa dimuat</h1>
        <p className="page-sub">
          Koneksi ke Google Sheets atau layanan data gagal. Periksa konfigurasi
          environment (GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
          lalu coba lagi.
        </p>
      </div>
      <div className="alert error" role="alert">
        <Icon name="alert" size={16} />
        <span>{error.message || 'Terjadi kesalahan tak terduga.'}</span>
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={reset}>
          <Icon name="refresh" />
          Coba lagi
        </button>
      </div>
    </main>
  );
}
