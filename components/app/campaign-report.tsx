'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { refreshContentAction } from '@/app/actions/er-actions';
import { DeliverableDrawer } from './content-drawers';
import { Icon } from './icons';
import { MetricsDrawer } from './metrics-drawer';
import { Alert, PlatformTag, Segmented } from './ui';
import {
  engagementOf,
  finalSnapshot,
  fmtDateTime,
  fmtNum,
  fmtPct,
  fmtRange,
  fmtShortDate,
  latestSnapshot,
  rate,
  snapshotDenominator,
  snapshotLabel,
  toDateInput,
  weightedRate,
} from '@/lib/er';
import { downloadText, slugify, toCsv } from '@/lib/csv';
import { PLATFORM_LABEL } from '@/lib/platform';
import type {
  CampaignReport as Report,
  Content,
  ContentBasis,
  Kol,
  Metric,
  Platform,
  Snapshot,
} from '@/types/er';

type PlatformFilter = 'all' | Platform;
type SnapMode = 'latest' | 'final';
type Panel =
  | { type: 'metrics'; contentId: string; snapshotId: string; openedAt: string }
  | { type: 'deliverable'; contentId: string; openedAt: string }
  | null;

const BASIS_SHORT: Record<ContentBasis, string> = {
  views: 'BY VIEWS',
  reach: 'BY REACH',
  followers: 'BY FOLL.',
};

const METRIC_KEYS = [
  'views',
  'reach',
  'likes',
  'comments',
  'shares',
  'saves',
] as const;

type Row = {
  content: Content;
  kol: Kol | undefined;
  snapshot: Snapshot | null;
  engagement: Metric;
  missing: number;
  er: Metric;
};

export function CampaignReport({ report }: { report: Report }) {
  const { campaign, contents, kols } = report;
  const [basis, setBasis] = useState<ContentBasis>('views');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [snapMode, setSnapMode] = useState<SnapMode>('latest');
  const [panel, setPanel] = useState<Panel>(null);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [message, setMessage] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);

  const kolById = useMemo(
    () => new Map(kols.map((kol) => [kol.id, kol])),
    [kols],
  );

  const rows: Row[] = useMemo(
    () =>
      contents
        .map((content) => ({ content, kol: kolById.get(content.kolId) }))
        .filter(({ kol }) => platform === 'all' || kol?.platform === platform)
        .map(({ content, kol }) => {
          const snapshot =
            snapMode === 'final'
              ? finalSnapshot(content)
              : latestSnapshot(content);
          const engagement = snapshot ? engagementOf(snapshot) : null;
          const followers = kol?.baseline?.followers ?? kol?.followers ?? null;
          const denominator = snapshot
            ? snapshotDenominator(snapshot, basis, followers)
            : null;
          return {
            content,
            kol,
            snapshot,
            engagement: engagement?.total ?? null,
            missing: engagement?.missing.length ?? 0,
            er: rate(engagement?.total ?? null, denominator),
          };
        })
        .sort(
          (a, b) =>
            (a.kol?.handle ?? '').localeCompare(b.kol?.handle ?? '') ||
            (a.content.postedAt || '9').localeCompare(
              b.content.postedAt || '9',
            ),
        ),
    [contents, kolById, platform, snapMode, basis],
  );

  const posted = rows.filter((row) => row.content.url);
  const measured = posted.filter((row) => row.snapshot);
  const after = weightedRate(
    measured.map((row) => ({
      engagement: row.engagement,
      denominator: snapshotDenominator(
        row.snapshot!,
        basis,
        row.kol?.baseline?.followers ?? row.kol?.followers ?? null,
      ),
    })),
  );

  const accounts = [
    ...new Map(rows.map((row) => [row.kol?.id, row.kol])).values(),
  ].filter((kol): kol is Kol => !!kol);
  const withBaseline = accounts.filter(
    (kol) => kol.baseline?.avgEngagement != null && kol.baseline.followers,
  );
  const before = weightedRate(
    withBaseline.map((kol) => ({
      engagement: kol.baseline!.avgEngagement,
      denominator: kol.baseline!.followers,
    })),
  );

  const totals = METRIC_KEYS.map((key) => {
    const values = measured
      .map((row) => row.snapshot![key])
      .filter((value): value is number => value !== null);
    return {
      label: key === 'comments' ? 'COMMENTS' : key.toUpperCase(),
      value: values.length
        ? fmtNum(values.reduce((sum, value) => sum + value, 0))
        : 'N/A',
      cov: `${values.length}/${posted.length} konten`,
    };
  });
  const complete = measured.filter((row) =>
    (['views', 'likes', 'comments', 'shares', 'saves'] as const).every(
      (key) => row.snapshot![key] !== null,
    ),
  ).length;

  const lastUpdated = contents
    .flatMap((content) =>
      content.snapshots.map((snapshot) => snapshot.capturedAt),
    )
    .sort()
    .at(-1);
  const platforms = [
    ...new Set(contents.map((content) => kolById.get(content.kolId)?.platform)),
  ]
    .filter((item): item is Platform => !!item)
    .map((item) => PLATFORM_LABEL[item]);

  async function refresh(contentId: string) {
    setRefreshing((current) => new Set(current).add(contentId));
    const result = await refreshContentAction(contentId);
    setRefreshing((current) => {
      const next = new Set(current);
      next.delete(contentId);
      return next;
    });
    return result;
  }

  async function refreshOne(row: Row) {
    const result = await refresh(row.content.id);
    setMessage(
      result.ok
        ? {
            tone: 'info',
            text: `Metrik ${row.content.title} @${row.kol?.handle ?? ''} diperbarui.`,
          }
        : {
            tone: 'error',
            text: `@${row.kol?.handle ?? ''} ${row.content.title}: ${result.error}`,
          },
    );
  }

  async function refreshAll() {
    const targets = posted.map((row) => row.content.id);
    let failed = 0;
    setBatch({ done: 0, total: targets.length });
    for (const [index, id] of targets.entries()) {
      const result = await refresh(id);
      if (!result.ok) failed += 1;
      setBatch({ done: index + 1, total: targets.length });
    }
    setBatch(null);
    setMessage(
      failed
        ? {
            tone: 'error',
            text: `${targets.length - failed} konten diperbarui, ${failed} gagal diambil.`,
          }
        : {
            tone: 'info',
            text: `Metrik ${targets.length} konten tersimpan sebagai snapshot baru.`,
          },
    );
  }

  function exportCsv() {
    const header = [
      'KOL',
      'Platform',
      'Konten',
      'URL',
      'Diposting',
      'Views',
      'Reach',
      'Likes',
      'Comments',
      'Shares',
      'Saves',
      'Total engagement',
      `ER ${basis} (%)`,
      'ER sebelum approach (%)',
      'Basis ER sebelum',
      'Snapshot',
      'Waktu pengambilan',
      'Sumber',
      'Final',
    ];
    const pct = (value: Metric) => (value === null ? 'N/A' : value.toFixed(2));
    const raw = (value: Metric) => (value === null ? 'N/A' : value);
    const body = rows.map(({ content, kol, snapshot, engagement, er }) => [
      kol ? `@${kol.handle}` : '',
      kol ? PLATFORM_LABEL[kol.platform] : '',
      content.title,
      content.url,
      content.postedAt ? toDateInput(content.postedAt) : 'Belum tayang',
      ...METRIC_KEYS.map((key) => (snapshot ? raw(snapshot[key]) : '')),
      snapshot ? raw(engagement) : '',
      snapshot ? pct(er) : '',
      pct(kol?.baseline?.erPercent ?? null),
      kol?.baseline?.basis ?? '',
      snapshot ? snapshotLabel(snapshot, content.postedAt) : '',
      snapshot?.capturedAt ?? '',
      snapshot?.source ?? '',
      snapshot?.isFinal ? 'Ya' : '',
    ]);
    downloadText(
      `report-${slugify(campaign.name)}.csv`,
      toCsv([header, ...body]),
    );
  }

  const metricsContent =
    panel?.type === 'metrics'
      ? contents.find((content) => content.id === panel.contentId)
      : undefined;
  const metricsKol = metricsContent
    ? kolById.get(metricsContent.kolId)
    : undefined;
  const linkContent =
    panel?.type === 'deliverable' && panel.contentId
      ? contents.find((content) => content.id === panel.contentId)
      : undefined;

  return (
    <main className="kg-page tight">
      <div className="page-head">
        <div className="page-head-text" style={{ gap: 10 }}>
          <Link href="/dashboard/campaigns" className="back-link">
            <Icon name="arrowLeft" size={14} />
            Semua campaign
          </Link>
          <span
            className="kg-eyebrow"
            style={{ fontSize: 12, color: 'var(--muted)' }}
          >
            CAMPAIGN · REPORT
          </span>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-sub">
            {fmtRange(campaign.startDate, campaign.endDate)} ·{' '}
            {new Set(contents.map((content) => content.kolId)).size} KOL ·{' '}
            {contents.length} deliverable
            {platforms.length ? ` · ${platforms.join(', ')}` : ''}
          </p>
        </div>
        <div className="actions">
          <Link
            href={`/dashboard/import?type=metrics&campaign=${campaign.id}`}
            className="btn"
          >
            <Icon name="upload" />
            Import metrik
          </Link>
          <button
            type="button"
            className="btn"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            <Icon name="download" />
            Export CSV
          </button>
          <button
            type="button"
            className="btn accent"
            onClick={refreshAll}
            disabled={!!batch || !posted.length}
          >
            <Icon name="refresh" />
            {batch
              ? `Mengambil ${Math.min(batch.done + 1, batch.total)}/${batch.total}…`
              : 'Ambil metrik semua'}
          </button>
        </div>
      </div>

      {message && (
        <Alert tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <section aria-label="Ringkasan" className="summary">
        <div className="summary-block">
          <span className="summary-label">
            <span className="square before" />
            TOTAL ER SEBELUM APPROACH
          </span>
          <span className="summary-value">{fmtPct(before.value)}</span>
          <span className="summary-note">
            weighted by followers · {before.count} akun · baseline aktif
          </span>
        </div>
        <div className="summary-block">
          <span className="summary-label blue">
            <span className="square after" />
            ER SETELAH POSTING
          </span>
          <span className="summary-value blue">{fmtPct(after.value)}</span>
          <span className="summary-note">
            weighted by {basis} · {after.count} dari {posted.length} konten
          </span>
        </div>
        <dl className="totals">
          {totals.map((total) => (
            <div key={total.label}>
              <dt>{total.label}</dt>
              <dd>{total.value}</dd>
              <dd className="cov">{total.cov}</dd>
            </div>
          ))}
          <div>
            <dt>COVERAGE</dt>
            <dd>
              {complete}/{rows.length}
            </dd>
            <dd className="cov">deliverable lengkap</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Konten campaign">
        <div className="toolbar">
          <div className="toolbar-group">
            <div className="labelled">
              <span>Basis ER</span>
              <Segmented
                label="Basis ER"
                value={basis}
                onChange={setBasis}
                options={[
                  { value: 'views', label: 'Views' },
                  { value: 'reach', label: 'Reach' },
                  { value: 'followers', label: 'Followers' },
                ]}
              />
            </div>
            <div className="labelled">
              <span>Platform</span>
              <Segmented
                label="Platform"
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: 'all', label: 'Semua' },
                  { value: 'IG', label: 'Instagram' },
                  { value: 'TT', label: 'TikTok' },
                ]}
              />
            </div>
            <div className="labelled">
              <label htmlFor="snap">Snapshot</label>
              <select
                id="snap"
                className="select sm"
                style={{ width: 'auto' }}
                value={snapMode}
                onChange={(event) =>
                  setSnapMode(event.target.value as SnapMode)
                }
              >
                <option value="latest">Terbaru per konten</option>
                <option value="final">Final saja</option>
              </select>
            </div>
          </div>
          <div className="toolbar-group tight">
            <span className="toolbar-note" style={{ fontSize: 13 }}>
              {lastUpdated
                ? `Diperbarui ${fmtDateTime(lastUpdated)}`
                : 'Belum ada snapshot'}
            </span>
            <button
              type="button"
              className="btn md"
              onClick={() =>
                setPanel({
                  type: 'deliverable',
                  contentId: '',
                  openedAt: new Date().toISOString(),
                })
              }
            >
              <Icon name="plus" />
              Tambah deliverable
            </button>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl dense" style={{ minWidth: 1360 }}>
            <thead>
              <tr>
                <th>KOL</th>
                <th>Plat.</th>
                <th>Konten</th>
                <th>Diposting</th>
                <th className="num">Views</th>
                <th className="num">Reach</th>
                <th className="num">Likes</th>
                <th className="num">Comm.</th>
                <th className="num">Shares</th>
                <th className="num">Saves</th>
                <th className="num">Engage.</th>
                <th className="num blue">
                  <span className="cell-stack end">
                    <span>ER</span>
                    <span style={{ fontSize: 10 }}>{BASIS_SHORT[basis]}</span>
                  </span>
                </th>
                <th className="num">
                  <span className="cell-stack end">
                    <span>ER</span>
                    <span style={{ fontSize: 10 }}>SEBELUM</span>
                  </span>
                </th>
                <th>Snapshot</th>
                <th className="end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { content, kol, snapshot } = row;
                const isPosted = !!content.url;
                const isRefreshing = refreshing.has(content.id);
                const metric = (value: Metric | undefined) =>
                  !isPosted || !snapshot ? (
                    <td className="num na">—</td>
                  ) : (
                    <td className={`num${value === null ? ' na' : ''}`}>
                      {fmtNum(value ?? null)}
                    </td>
                  );
                return (
                  <tr
                    key={content.id}
                    className={isRefreshing ? 'running' : undefined}
                  >
                    <td>
                      {kol ? (
                        <Link
                          href={`/dashboard/kols/${encodeURIComponent(kol.id)}?campaign=${campaign.id}`}
                          className="cell-strong"
                          style={{ textDecoration: 'none', fontSize: 14 }}
                        >
                          @{kol.handle}
                        </Link>
                      ) : (
                        <span className="na">KOL dihapus</span>
                      )}
                    </td>
                    <td>{kol && <PlatformTag platform={kol.platform} />}</td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>
                      {isPosted ? (
                        <a href={content.url} target="_blank" rel="noreferrer">
                          {content.title} ↗
                        </a>
                      ) : (
                        content.title
                      )}
                    </td>
                    <td
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isPosted ? fmtShortDate(content.postedAt) : '—'}
                    </td>
                    {metric(snapshot?.views)}
                    {metric(snapshot?.reach)}
                    {metric(snapshot?.likes)}
                    {metric(snapshot?.comments)}
                    {metric(snapshot?.shares)}
                    {metric(snapshot?.saves)}
                    <td className="num">
                      {isPosted && snapshot ? (
                        <span className="cell-stack end">
                          <span>{fmtNum(row.engagement)}</span>
                          {row.missing > 0 && (
                            <span
                              style={{
                                fontSize: 10.5,
                                color: 'var(--muted-2)',
                              }}
                            >
                              {4 - row.missing}/4 komponen
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="na">—</span>
                      )}
                    </td>
                    <td
                      className={`num ${row.er === null || !snapshot ? 'na' : 'blue'}`}
                      style={{ fontSize: 14, fontWeight: 500 }}
                    >
                      {isPosted && snapshot ? fmtPct(row.er) : '—'}
                    </td>
                    <td className="num" style={{ color: 'var(--ink-2)' }}>
                      {fmtPct(kol?.baseline?.erPercent ?? null, '—')}
                    </td>
                    <td>
                      <span className="cell-stack">
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight:
                              snapshot?.isFinal || !isPosted ? 500 : 400,
                          }}
                        >
                          {!isPosted
                            ? 'Belum tayang'
                            : snapshot
                              ? `${snapshotLabel(snapshot, content.postedAt).split(' · ')[0]}${snapshot.isFinal ? ' · Final' : ' · terbaru'}`
                              : snapMode === 'final' && content.snapshots.length
                                ? 'Belum final'
                                : 'Belum ada'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {!isPosted
                            ? content.scheduledAt
                              ? `Jadwal ${fmtShortDate(content.scheduledAt)}`
                              : 'Tanpa jadwal'
                            : snapshot
                              ? `${snapshot.source} · ${fmtShortDate(snapshot.capturedAt)}`
                              : '—'}
                        </span>
                      </span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ gap: 4 }}>
                        {isPosted ? (
                          <>
                            <button
                              type="button"
                              className="btn icon quiet"
                              aria-label={`Ambil ulang metrik ${content.title} @${kol?.handle ?? ''}`}
                              disabled={isRefreshing || !!batch}
                              onClick={() => refreshOne(row)}
                            >
                              <Icon name="refresh" size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn icon quiet"
                              aria-label={`Edit metrik ${content.title} @${kol?.handle ?? ''}`}
                              onClick={() =>
                                setPanel({
                                  type: 'metrics',
                                  contentId: content.id,
                                  snapshotId:
                                    snapshot?.id ??
                                    latestSnapshot(content)?.id ??
                                    '',
                                  openedAt: new Date().toISOString(),
                                })
                              }
                            >
                              <Icon name="edit" size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn sm"
                            style={{ padding: '0 10px' }}
                            onClick={() =>
                              setPanel({
                                type: 'deliverable',
                                contentId: content.id,
                                openedAt: new Date().toISOString(),
                              })
                            }
                          >
                            Tautkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="empty">
            {contents.length ? (
              <>
                <strong>Tidak ada konten untuk filter ini</strong>
                Ubah filter platform.
              </>
            ) : (
              <>
                <strong>Belum ada deliverable</strong>
                Tambahkan deliverable tiap KOL (mis. Reel 1, Video 2), lalu
                tautkan URL setelah konten tayang.
              </>
            )}
          </div>
        )}

        <p className="footnote">
          N/A = tidak disediakan platform atau belum diinput; tidak dihitung
          sebagai 0. Engagement = likes + comments + shares + saves yang
          tersedia. ER total = Σ engagement ÷ Σ basis × 100 (weighted), hanya
          dari konten yang punya nilai basis. Baseline sebelum approach disimpan
          terpisah dan tidak berubah oleh data setelah posting.
        </p>
      </section>

      {panel?.type === 'metrics' && metricsContent && (
        <MetricsDrawer
          content={metricsContent}
          handle={metricsKol?.handle ?? ''}
          platform={metricsKol?.platform ?? 'IG'}
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
      {panel?.type === 'deliverable' && (
        <DeliverableDrawer
          campaign={campaign}
          kols={kols}
          content={linkContent}
          today={toDateInput(panel.openedAt)}
          onClose={() => setPanel(null)}
        />
      )}
    </main>
  );
}
