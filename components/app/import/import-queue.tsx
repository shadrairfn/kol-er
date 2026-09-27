'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BaselineRowResult } from '@/app/actions/import-actions';
import { Icon } from '../icons';
import { PlatformTag } from '../ui';
import { basisLabel, fmtNum, fmtPct, rate } from '@/lib/er';
import type { QueueInput } from './import-model';

export type RowStatus = 'waiting' | 'running' | 'done' | 'failed';

export type QueueRow = {
  item: QueueInput;
  status: RowStatus;
  error?: string;
  kolId?: string;
  result?: Extract<BaselineRowResult, { ok: true }>['data'];
};

type Tab = 'all' | RowStatus;

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'waiting', label: 'Menunggu' },
  { value: 'running', label: 'Diproses' },
  { value: 'done', label: 'Selesai' },
  { value: 'failed', label: 'Gagal' },
];

const STATUS: Record<RowStatus, { label: string; color: string }> = {
  done: { label: 'Selesai', color: 'var(--ink)' },
  waiting: { label: 'Menunggu', color: 'var(--ink-2)' },
  running: { label: 'Memproses…', color: 'var(--blue)' },
  failed: { label: 'Gagal', color: 'var(--red)' },
};

const PAGE_SIZE = 12;

function subText(row: QueueRow) {
  const { item } = row;
  if (row.status === 'failed') return row.error ?? 'Gagal diproses';
  if (item.type === 'metrics') {
    if (row.status === 'done') return 'Snapshot baru tersimpan · CSV';
    return row.status === 'running' ? 'Menyimpan snapshot' : 'Snapshot baru';
  }
  if (row.status === 'done' && row.result) {
    if (row.result.version > 1) {
      return `Snapshot v${row.result.version} · v${row.result.version - 1} tetap disimpan`;
    }
    return `${basisLabel(row.result.basis)} · ${row.result.source}`;
  }
  if (row.status === 'running')
    return item.fromFile
      ? 'Menyimpan angka dari file'
      : 'Mengambil 12 postingan';
  return item.fromFile ? 'Angka dari file' : 'Diambil lewat Apify';
}

export function ImportQueue({
  rows,
  running,
  campaignId,
  onRun,
  onRunAll,
  onPause,
  onManual,
}: {
  rows: QueueRow[];
  running: boolean;
  campaignId: string;
  onRun: (index: number) => void;
  onRunAll: () => void;
  onPause: () => void;
  onManual: (index: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(0);

  const type = rows[0]?.item.type ?? 'baseline';
  const count = (status: RowStatus) =>
    rows.filter((row) => row.status === status).length;
  const done = count('done');
  const failed = count('failed');
  const waiting = count('waiting');
  const active = count('running');
  const total = rows.length;
  const indexed = rows.map((row, index) => ({ row, index }));
  const filtered =
    tab === 'all' ? indexed : indexed.filter(({ row }) => row.status === tab);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const minutes = rows
    .filter((row) => row.status === 'waiting')
    .reduce(
      (sum, row) =>
        sum + (row.item.type === 'baseline' && !row.item.fromFile ? 0.5 : 0.05),
      0,
    );
  const allDone = waiting === 0 && active === 0;

  return (
    <section aria-label="Antrian proses">
      <div className="toolbar">
        <div role="tablist" aria-label="Filter status" className="tabs">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => {
                setTab(item.value);
                setPage(0);
              }}
            >
              <span>{item.label}</span>
              <span className="count">
                {item.value === 'all' ? total : count(item.value)}
              </span>
            </button>
          ))}
        </div>
        <div className="toolbar-group tight">
          <div className="progress">
            <div className="progress-text">
              <span className="mono">
                {done} / {total} selesai
              </span>
              <span className="muted">
                {waiting
                  ? `± ${Math.max(1, Math.round(minutes))} mnt lagi`
                  : `${failed} gagal`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progres proses"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              className="progress-track"
            >
              <div
                className="progress-fill"
                style={{
                  width: `${total ? ((done + failed) / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          {running && (
            <button type="button" className="btn" onClick={onPause}>
              Jeda
            </button>
          )}
          {!running && waiting > 0 && (
            <button type="button" className="btn accent" onClick={onRunAll}>
              Proses semua ({waiting})
            </button>
          )}
          {allDone && (
            <Link
              href={
                type === 'baseline'
                  ? '/dashboard/kols'
                  : `/dashboard/campaigns/${campaignId}`
              }
              className="btn primary"
            >
              {type === 'baseline' ? 'Buka daftar KOL' : 'Buka report campaign'}
            </Link>
          )}
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl compact" style={{ minWidth: 1180 }}>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>{type === 'baseline' ? 'KOL' : 'Konten'}</th>
              <th>Platform</th>
              {type === 'baseline' ? (
                <>
                  <th className="num">Followers</th>
                  <th className="num">Postingan</th>
                  <th className="num">Engagement rata²</th>
                  <th className="num">ER sebelum</th>
                </>
              ) : (
                <>
                  <th className="num">Views</th>
                  <th className="num">Engagement</th>
                  <th className="num">ER by views</th>
                </>
              )}
              <th style={{ width: 260 }}>Status</th>
              <th className="end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row, index }) => {
              const { item } = row;
              const result = row.result;
              return (
                <tr
                  key={`${item.line}-${index}`}
                  className={row.status === 'running' ? 'running' : undefined}
                >
                  <td
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--muted-2)' }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <span className="cell-stack">
                      <span className="cell-strong">@{item.handle}</span>
                      {item.type === 'metrics' && (
                        <span className="cell-sub">{item.title}</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <PlatformTag platform={item.platform} />
                  </td>
                  {item.type === 'baseline' ? (
                    <>
                      <td className="num">
                        {fmtNum(result?.followers ?? item.followers, '—')}
                      </td>
                      <td className="num">
                        {fmtNum(result?.postsAnalyzed ?? null, '—')}
                      </td>
                      <td className="num">
                        {fmtNum(result?.avgEngagement ?? null, '—')}
                      </td>
                      <td className="num er-big">
                        {fmtPct(result?.erPercent ?? null, '—')}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="num">{fmtNum(item.views)}</td>
                      <td className="num">{fmtNum(item.engagement)}</td>
                      <td className="num er-big blue">
                        {fmtPct(rate(item.engagement, item.views))}
                      </td>
                    </>
                  )}
                  <td>
                    <span className="cell-stack">
                      <span
                        className="kg-status"
                        style={{ color: STATUS[row.status].color }}
                      >
                        <span className={`dot ${row.status}`} />
                        {STATUS[row.status].label}
                      </span>
                      <span className="cell-sub" style={{ paddingLeft: 16 }}>
                        {subText(row)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {row.status === 'waiting' && (
                        <button
                          type="button"
                          className="btn sm"
                          style={{ background: 'var(--white)' }}
                          disabled={running}
                          onClick={() => onRun(index)}
                        >
                          Proses
                        </button>
                      )}
                      {row.status === 'failed' && (
                        <>
                          {item.type === 'baseline' && row.kolId && (
                            <button
                              type="button"
                              className="btn sm quiet"
                              onClick={() => onManual(index)}
                            >
                              Isi manual
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn sm quiet"
                            disabled={running}
                            onClick={() => onRun(index)}
                          >
                            Ulangi
                          </button>
                        </>
                      )}
                      {row.status === 'done' &&
                        item.type === 'baseline' &&
                        row.kolId && (
                          <Link
                            href={`/dashboard/kols/${encodeURIComponent(row.kolId)}`}
                            className="btn sm quiet"
                          >
                            Lihat
                          </Link>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && (
        <div className="empty">Tidak ada baris dengan status ini.</div>
      )}

      <div className="table-foot">
        <span>
          Baris {filtered.length ? current * PAGE_SIZE + 1 : 0}–
          {Math.min((current + 1) * PAGE_SIZE, filtered.length)} dari{' '}
          {filtered.length}
        </span>
        <div className="pager">
          <button
            type="button"
            className="btn icon quiet"
            aria-label="Halaman sebelumnya"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className="btn icon quiet"
            aria-label="Halaman berikutnya"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
    </section>
  );
}
