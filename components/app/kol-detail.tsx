'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  computeBaselineAction,
  markApproachedAction,
  refreshContentAction,
} from '@/app/actions/er-actions';
import { BaselineDrawer } from './baseline-drawer';
import { Icon } from './icons';
import { MetricsDrawer } from './metrics-drawer';
import { Alert, PlatformTag, STATUS_LABEL } from './ui';
import {
  basisLabel,
  baselineFormula,
  bestSnapshot,
  engagementOf,
  fmtDate,
  fmtDateTime,
  fmtNum,
  fmtPct,
  rate,
  snapshotLabel,
  weightedRate,
} from '@/lib/er';
import type { Baseline, KolDetail } from '@/types/er';

type Panel =
  | { type: 'baseline'; mode: 'manual' | 'correction' }
  | { type: 'metrics'; contentId: string; snapshotId: string; openedAt: string }
  | null;

const KIND_LABEL: Record<Baseline['kind'], string> = {
  auto: 'Apify',
  import: 'Import CSV',
  manual: 'Manual',
  correction: 'Koreksi',
};

function versionMeta(version: Baseline) {
  const by = version.kind === 'auto' ? 'otomatis' : version.createdBy || '—';
  const label =
    version.kind === 'auto' || version.kind === 'correction'
      ? KIND_LABEL[version.kind]
      : version.source || KIND_LABEL[version.kind];
  return `${label} · ${fmtDateTime(version.createdAt || version.capturedAt)} · ${by}`;
}

export function KolDetailView({
  detail,
  campaignId,
}: {
  detail: KolDetail;
  campaignId: string;
}) {
  const router = useRouter();
  const { kol, versions, campaigns } = detail;
  const baseline = kol.baseline;
  const active =
    campaigns.find((item) => item.campaign.id === campaignId) ??
    campaigns[0] ??
    null;
  const posted = active?.contents.filter((content) => content.url) ?? [];

  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<'compute' | 'approach' | 'refresh' | null>(
    null,
  );
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const [addFor, setAddFor] = useState('');
  const addContentId = posted.some((content) => content.id === addFor)
    ? addFor
    : (posted[0]?.id ?? '');

  async function compute() {
    setBusy('compute');
    const result = await computeBaselineAction(kol.id);
    setBusy(null);
    setMessage(
      result.ok
        ? {
            tone: 'info',
            text: `Baseline v${result.data.version} tersimpan: ${fmtPct(result.data.erPercent)}.`,
          }
        : { tone: 'error', text: result.error },
    );
  }

  async function approach() {
    setBusy('approach');
    const result = await markApproachedAction([kol.id]);
    setBusy(null);
    setMessage(
      result.ok
        ? {
            tone: 'info',
            text: 'KOL ditandai approached. Baseline aktif kini terkunci.',
          }
        : { tone: 'error', text: result.error },
    );
  }

  async function refreshAll() {
    setBusy('refresh');
    let failed = 0;
    for (const [index, content] of posted.entries()) {
      setProgress(`${index + 1}/${posted.length}`);
      const result = await refreshContentAction(content.id);
      if (!result.ok) failed += 1;
    }
    setBusy(null);
    setProgress('');
    setMessage(
      failed
        ? {
            tone: 'error',
            text: `${posted.length - failed} konten diperbarui, ${failed} gagal diambil.`,
          }
        : {
            tone: 'info',
            text: `Metrik terbaru ${posted.length} konten tersimpan sebagai snapshot baru.`,
          },
    );
  }

  // Setelah posting: weighted by views dari snapshot final (atau terbaru bila belum ada final).
  const picked = posted.map((content) => ({
    content,
    snapshot: bestSnapshot(content),
  }));
  const after = weightedRate(
    picked.map(({ snapshot }) => ({
      engagement: snapshot ? engagementOf(snapshot).total : null,
      denominator: snapshot?.views ?? null,
    })),
  );
  const withoutViews = picked.filter(
    ({ snapshot }) => snapshot && !snapshot.views,
  ).length;
  const withoutFinal = picked.filter(
    ({ snapshot }) => snapshot && !snapshot.isFinal,
  ).length;
  const before = baseline?.erPercent ?? null;
  const scale = Math.max(before ?? 0, after.value ?? 0) * 1.2 || 1;

  const comps = baseline
    ? [
        { label: 'Followers saat diambil', value: baseline.followers },
        { label: 'Rata-rata likes', value: baseline.avgLikes },
        { label: 'Rata-rata comments', value: baseline.avgComments },
        { label: 'Rata-rata shares', value: baseline.avgShares },
        { label: 'Rata-rata saves', value: baseline.avgSaves },
        { label: 'Engagement rata-rata', value: baseline.avgEngagement },
      ]
    : [];

  const metricsContent =
    panel?.type === 'metrics'
      ? active?.contents.find((content) => content.id === panel.contentId)
      : null;

  return (
    <main className="kg-page tight">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link href="/dashboard/kols" className="back-link">
          <Icon name="arrowLeft" size={14} />
          Semua KOL
        </Link>
        <div className="page-head">
          <div className="page-head-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <h1 className="page-title">@{kol.handle}</h1>
              <PlatformTag platform={kol.platform} />
            </div>
            <p className="page-sub">
              {[kol.name, kol.category].filter(Boolean).join(' · ')}
              {(kol.name || kol.category) && ' · '}
              <a
                href={kol.profileUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--muted)' }}
              >
                {kol.profileUrl
                  .replace(/^https?:\/\/(www\.)?/, '')
                  .replace(/\/$/, '')}
              </a>
            </p>
          </div>
          <dl className="detail-meta">
            <div className="stat">
              <dt className="kg-eyebrow">Followers</dt>
              <dd className="mono">
                {fmtNum(baseline?.followers ?? kol.followers, '—')}
              </dd>
            </div>
            <div className="stat">
              <dt className="kg-eyebrow">Campaign</dt>
              <dd>{active?.campaign.name ?? '—'}</dd>
            </div>
            <div className="stat">
              <dt className="kg-eyebrow">Status</dt>
              <dd>
                <span className={`dot ${kol.status}`} />
                {STATUS_LABEL[kol.status]}
                {kol.approachedAt && ` · ${fmtDate(kol.approachedAt)}`}
                {kol.status === 'candidate' && (
                  <button
                    type="button"
                    className="link-btn"
                    style={{ marginLeft: 8 }}
                    disabled={!!busy}
                    onClick={approach}
                  >
                    {busy === 'approach' ? 'Menyimpan…' : 'Tandai approached'}
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {message && (
        <Alert tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className="detail-cols">
        <section aria-labelledby="before-h" className="detail-col">
          <div className="col-head">
            <h2 id="before-h" className="col-title">
              <span className="square before" />
              SEBELUM APPROACH
            </h2>
            <div className="actions">
              {kol.status === 'approached' && baseline && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() =>
                    setPanel({ type: 'baseline', mode: 'correction' })
                  }
                >
                  <Icon name="lock" size={14} />
                  Buat koreksi
                </button>
              )}
              {kol.status === 'candidate' && (
                <>
                  <button
                    type="button"
                    className="btn sm quiet"
                    disabled={!!busy}
                    onClick={compute}
                  >
                    {busy === 'compute' ? 'Menghitung…' : 'Hitung ulang'}
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() =>
                      setPanel({ type: 'baseline', mode: 'manual' })
                    }
                  >
                    Edit baseline
                  </button>
                </>
              )}
              {kol.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="btn sm quiet"
                    onClick={() =>
                      setPanel({ type: 'baseline', mode: 'manual' })
                    }
                  >
                    Isi manual
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={!!busy}
                    onClick={compute}
                  >
                    {busy === 'compute' ? 'Menghitung…' : 'Hitung ER'}
                  </button>
                </>
              )}
            </div>
          </div>

          {baseline ? (
            <>
              <div className="er-hero">
                <span className="er-hero-value">
                  {fmtPct(baseline.erPercent)}
                </span>
                <span className="er-hero-meta">
                  <span>
                    {basisLabel(baseline.basis)}
                    {baseline.postsAnalyzed
                      ? ` · ${baseline.postsAnalyzed} postingan terakhir`
                      : ''}
                  </span>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    v{baseline.version} · {fmtDateTime(baseline.capturedAt)} ·{' '}
                    {baseline.source}
                  </span>
                </span>
              </div>

              <dl className="comp-grid">
                {comps.map((comp) => (
                  <div key={comp.label}>
                    <dt>{comp.label}</dt>
                    <dd className={comp.value === null ? 'na' : undefined}>
                      {fmtNum(comp.value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="formula" style={{ marginTop: -12 }}>
                {baselineFormula(
                  baseline,
                  kol.platform === 'IG' &&
                    baseline.avgShares === null &&
                    baseline.avgSaves === null
                    ? 'shares & saves tidak publik di Instagram'
                    : undefined,
                )}
              </p>
            </>
          ) : (
            <div
              className="empty"
              style={{ textAlign: 'left', borderTop: '1px solid var(--line)' }}
            >
              <strong>Belum ada baseline</strong>
              Hitung dari 12 postingan terakhir lewat Apify, atau isi angka
              manual dari insight kreator.
            </div>
          )}

          {versions.length > 0 && (
            <div>
              <h3 className="kg-eyebrow" style={{ marginBottom: 8 }}>
                Riwayat versi
              </h3>
              {versions.map((version) => {
                const replacedBy = versions.find(
                  (item) => item.supersedesId === version.id,
                );
                return (
                  <div key={version.id} className="version">
                    <span className="mono" style={{ fontWeight: 500 }}>
                      v{version.version}
                    </span>
                    <span className="cell-stack" style={{ gap: 4 }}>
                      <span>{versionMeta(version)}</span>
                      <span className="muted">
                        {version.reason
                          ? `“${version.reason}”`
                          : version.version === 1
                            ? 'Snapshot awal. Tetap disimpan untuk audit.'
                            : 'Tanpa catatan.'}
                      </span>
                    </span>
                    <span
                      className={`version-er${version.active ? '' : ' old'}`}
                    >
                      {fmtPct(version.erPercent)}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        color: version.active ? 'var(--ink)' : 'var(--muted-2)',
                      }}
                    >
                      {version.active
                        ? 'Aktif'
                        : `Digantikan v${replacedBy?.version ?? '?'}`}
                      {version.lockedAt && version.active ? ' · terkunci' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="after-h" className="detail-col">
          <div className="col-head">
            <h2 id="after-h" className="col-title">
              <span className="square after" />
              SETELAH POSTING
            </h2>
            {campaigns.length > 0 && (
              <>
                <label htmlFor="camp" className="sr-only">
                  Campaign
                </label>
                <select
                  id="camp"
                  className="select xs"
                  style={{ width: 'auto', maxWidth: 320 }}
                  value={active?.campaign.id}
                  onChange={(event) =>
                    router.replace(
                      `/dashboard/kols/${encodeURIComponent(kol.id)}?campaign=${event.target.value}`,
                      {
                        scroll: false,
                      },
                    )
                  }
                >
                  {campaigns.map((item) => (
                    <option key={item.campaign.id} value={item.campaign.id}>
                      {item.campaign.name}
                      {item.campaign.startDate
                        ? ` · ${fmtDate(item.campaign.startDate).replace(/^\d+ /, '')}`
                        : ''}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {!active ? (
            <div
              className="empty"
              style={{ textAlign: 'left', borderTop: '1px solid var(--line)' }}
            >
              <strong>Belum ada deliverable</strong>
              KOL ini belum ditambahkan ke campaign mana pun.{' '}
              <Link href="/dashboard/campaigns">Buka Campaign</Link>
            </div>
          ) : (
            <>
              <div className="bars">
                <div className="bar-row">
                  <span>Sebelum approach</span>
                  <div className="bar-track">
                    {before !== null && (
                      <div
                        className="bar-fill before"
                        style={{ width: `${(before / scale) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="bar-value">{fmtPct(before)}</span>
                </div>
                <div className="bar-row">
                  <span>Setelah posting</span>
                  <div className="bar-track">
                    {after.value !== null && (
                      <div
                        className="bar-fill after"
                        style={{ width: `${(after.value / scale) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="bar-value blue" style={{ fontWeight: 500 }}>
                    {fmtPct(after.value)}
                  </span>
                </div>
                <p className="field-hint" style={{ margin: 0 }}>
                  Sebelum:{' '}
                  {baseline ? basisLabel(baseline.basis) : 'belum ada baseline'}
                  . Setelah: weighted by views dari snapshot final
                  {withoutFinal
                    ? ` (${withoutFinal} konten memakai snapshot terbaru karena belum final)`
                    : ''}
                  {withoutViews
                    ? `; ${withoutViews} konten tanpa views tidak dihitung`
                    : ''}
                  . Basis berbeda, jadi bandingkan sebagai indikasi.
                </p>
              </div>

              <div>
                <div className="tbl-wrap">
                  <table className="tbl compact" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: 10 }}>Konten</th>
                        <th className="num" style={{ fontSize: 10 }}>
                          Views
                        </th>
                        <th className="num" style={{ fontSize: 10 }}>
                          Reach
                        </th>
                        <th className="num" style={{ fontSize: 10 }}>
                          Likes
                        </th>
                        <th className="num" style={{ fontSize: 10 }}>
                          Comm.
                        </th>
                        <th className="num" style={{ fontSize: 10 }}>
                          Shares
                        </th>
                        <th className="num" style={{ fontSize: 10 }}>
                          Saves
                        </th>
                        <th className="num" style={{ fontSize: 10 }}>
                          ER
                        </th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.contents.flatMap((content) => {
                        if (!content.url) {
                          return [
                            <tr key={content.id}>
                              <td>
                                <span className="cell-stack">
                                  <span
                                    className="cell-strong"
                                    style={{ fontSize: 13 }}
                                  >
                                    {content.title}
                                  </span>
                                  <span className="cell-sub">
                                    Belum tayang
                                    {content.scheduledAt
                                      ? ` · jadwal ${fmtDate(content.scheduledAt)}`
                                      : ''}
                                  </span>
                                </span>
                              </td>
                              <td
                                colSpan={8}
                                className="na"
                                style={{ fontSize: 12 }}
                              >
                                Tautkan URL konten di halaman campaign.
                              </td>
                            </tr>,
                          ];
                        }
                        if (!content.snapshots.length) {
                          return [
                            <tr key={content.id}>
                              <td>
                                <span className="cell-stack">
                                  <span
                                    className="cell-strong"
                                    style={{ fontSize: 13 }}
                                  >
                                    {content.title}
                                  </span>
                                  <span className="cell-sub">
                                    Belum ada snapshot
                                  </span>
                                </span>
                              </td>
                              <td
                                colSpan={7}
                                className="na"
                                style={{ fontSize: 12 }}
                              >
                                Ambil metrik terbaru atau isi manual.
                              </td>
                              <td className="end">
                                <button
                                  type="button"
                                  className="btn icon quiet"
                                  aria-label={`Tambah snapshot ${content.title}`}
                                  onClick={() =>
                                    setPanel({
                                      type: 'metrics',
                                      contentId: content.id,
                                      snapshotId: '',
                                      openedAt: new Date().toISOString(),
                                    })
                                  }
                                >
                                  <Icon name="plus" size={15} />
                                </button>
                              </td>
                            </tr>,
                          ];
                        }
                        return content.snapshots.map((snapshot) => {
                          const er = rate(
                            engagementOf(snapshot).total,
                            snapshot.views,
                          );
                          const cell = (value: number | null) => (
                            <td
                              className={`num${value === null ? ' na' : ''}`}
                              style={{ fontSize: 12 }}
                            >
                              {fmtNum(value)}
                            </td>
                          );
                          return (
                            <tr key={snapshot.id}>
                              <td>
                                <span className="cell-stack">
                                  <span
                                    className="cell-strong"
                                    style={{ fontSize: 13 }}
                                  >
                                    {content.title}
                                  </span>
                                  <span className="cell-sub">
                                    {snapshotLabel(snapshot, content.postedAt)}
                                    {snapshot.isFinal ? ' · Final' : ''}
                                  </span>
                                </span>
                              </td>
                              {cell(snapshot.views)}
                              {cell(snapshot.reach)}
                              {cell(snapshot.likes)}
                              {cell(snapshot.comments)}
                              {cell(snapshot.shares)}
                              {cell(snapshot.saves)}
                              <td
                                className={`num ${er === null ? 'na' : 'blue'}`}
                                style={{ fontWeight: 500 }}
                              >
                                {fmtPct(er)}
                              </td>
                              <td className="end">
                                <button
                                  type="button"
                                  className="btn icon quiet"
                                  style={{ border: 0 }}
                                  aria-label={`Edit snapshot ${content.title}`}
                                  onClick={() =>
                                    setPanel({
                                      type: 'metrics',
                                      contentId: content.id,
                                      snapshotId: snapshot.id,
                                      openedAt: new Date().toISOString(),
                                    })
                                  }
                                >
                                  <Icon name="edit" size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
                {active.contents.length === 0 && (
                  <div className="empty">
                    Belum ada deliverable untuk KOL ini di campaign ini.
                  </div>
                )}
                <div
                  className="actions"
                  style={{ paddingTop: 16, alignItems: 'center' }}
                >
                  <button
                    type="button"
                    className="btn sm"
                    style={{ background: 'var(--white)' }}
                    disabled={!posted.length || !!busy}
                    onClick={refreshAll}
                  >
                    {busy === 'refresh'
                      ? `Mengambil ${progress}…`
                      : 'Ambil metrik terbaru'}
                  </button>
                  {posted.length > 1 && (
                    <>
                      <label htmlFor="add-for" className="sr-only">
                        Konten untuk snapshot manual
                      </label>
                      <select
                        id="add-for"
                        className="select xs"
                        style={{ width: 'auto' }}
                        value={addContentId}
                        onChange={(event) => setAddFor(event.target.value)}
                      >
                        {posted.map((content) => (
                          <option key={content.id} value={content.id}>
                            {content.title}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn sm quiet"
                    disabled={!addContentId}
                    onClick={() =>
                      setPanel({
                        type: 'metrics',
                        contentId: addContentId,
                        snapshotId: '',
                        openedAt: new Date().toISOString(),
                      })
                    }
                  >
                    Tambah snapshot manual
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {panel?.type === 'baseline' && (
        <BaselineDrawer
          kol={kol}
          mode={panel.mode}
          onClose={() => setPanel(null)}
          onSaved={(saved) =>
            setMessage({
              tone: 'info',
              text: `Baseline disimpan sebagai v${saved.version} (${fmtPct(saved.erPercent)}).`,
            })
          }
        />
      )}
      {panel?.type === 'metrics' && metricsContent && (
        <MetricsDrawer
          content={metricsContent}
          handle={kol.handle}
          platform={kol.platform}
          initialSnapshotId={panel.snapshotId}
          openedAt={panel.openedAt}
          onClose={() => setPanel(null)}
          onSaved={() =>
            setMessage({
              tone: 'info',
              text: 'Snapshot tersimpan. Nilai lama tetap ada di riwayat.',
            })
          }
        />
      )}
    </main>
  );
}
