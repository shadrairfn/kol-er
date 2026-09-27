export default function DashboardLoading() {
  return (
    <main className="kg-page" aria-busy="true">
      <div className="page-head-text">
        <span className="kg-eyebrow">MEMUAT DATA</span>
        <p className="page-sub">Mengambil data dari Google Sheets…</p>
      </div>
      <div className="progress-track" style={{ width: 240 }}>
        <div className="progress-fill" style={{ width: '35%' }} />
      </div>
    </main>
  );
}
