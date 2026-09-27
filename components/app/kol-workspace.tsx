'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  computeBaselineAction,
  markApproachedAction,
} from '@/app/actions/er-actions';
import { BaselineDrawer } from './baseline-drawer';
import { Icon } from './icons';
import { KolDrawer } from './kol-drawer';
import { Alert, PlatformTag, STATUS_LABEL, Segmented } from './ui';
import { basisLabel, fmtDateTime, fmtNum, fmtPct } from '@/lib/er';
import type { Kol, KolStatus, Platform } from '@/types/er';

type PlatformFilter = 'all' | Platform;
type StatusFilter = 'all' | KolStatus;
type Panel =
  | { type: 'add' }
  | { type: 'baseline'; kolId: string; mode: 'manual' | 'correction' }
  | null;

function sourceLabel(kol: Kol) {
  const baseline = kol.baseline;
  if (!baseline) return '—';
  return baseline.kind === 'correction'
    ? `${baseline.source} · koreksi`
    : baseline.source;
}

export function KolWorkspace({ kols }: { kols: Kol[] }) {
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [confirmApproach, setConfirmApproach] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [message, setMessage] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const stopRef = useRef(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    return kols.filter(
      (kol) =>
        (platform === 'all' || kol.platform === platform) &&
        (status === 'all' || kol.status === status) &&
        (!q || kol.handle.includes(q) || kol.name.toLowerCase().includes(q)),
    );
  }, [kols, platform, status, query]);

  const pending = kols.filter((kol) => kol.status === 'pending');
  const withBaseline = kols.filter((kol) => kol.baseline).length;
  const selectedKols = kols.filter((kol) => selected.has(kol.id));
  const approachable = selectedKols.filter((kol) => kol.status === 'candidate');
  const allVisibleSelected =
    visible.length > 0 && visible.every((kol) => selected.has(kol.id));
  const panelKol =
    panel?.type === 'baseline'
      ? kols.find((kol) => kol.id === panel.kolId)
      : null;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmApproach(false);
  }

  function toggleAll() {
    setSelected(
      allVisibleSelected ? new Set() : new Set(visible.map((kol) => kol.id)),
    );
    setConfirmApproach(false);
  }

  async function compute(id: string) {
    setRunning((current) => new Set(current).add(id));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    const result = await computeBaselineAction(id);
    setRunning((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (!result.ok)
      setRowErrors((current) => ({ ...current, [id]: result.error }));
    return result.ok;
  }

  async function computeMany(ids: string[]) {
    stopRef.current = false;
    let done = 0;
    let failed = 0;
    setBatch({ done, total: ids.length });
    for (const id of ids) {
      if (stopRef.current) break;
      const ok = await compute(id);
      done += 1;
      if (!ok) failed += 1;
      setBatch({ done, total: ids.length });
    }
    setBatch(null);
    setMessage(
      failed
        ? {
            tone: 'error',
            text: `${done - failed} baseline tersimpan, ${failed} gagal. Lihat keterangan di tiap baris.`,
          }
        : {
            tone: 'info',
            text: `${done} baseline baru tersimpan sebagai snapshot.`,
          },
    );
  }

  async function approach() {
    const ids = approachable.map((kol) => kol.id);
    const result = await markApproachedAction(ids);
    setConfirmApproach(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setSelected(new Set());
    setMessage({
      tone: 'info',
      text: `${result.data.updated} KOL ditandai approached — baseline aktifnya kini terkunci.`,
    });
  }

  return (
    <main className="kg-page">
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">KOL</h1>
          <p className="page-sub">
            ER sebelum approach, dihitung dari 12 postingan terakhir. Setiap
            perhitungan disimpan sebagai snapshot baru.
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => setPanel({ type: 'add' })}
          >
            <Icon name="plus" />
            Tambah KOL
          </button>
          <Link href="/dashboard/import" className="btn primary">
            <Icon name="upload" />
            Import CSV / Excel
          </Link>
        </div>
      </div>

      {message && (
        <Alert tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <section aria-label="Daftar KOL">
        <div className="toolbar">
          <div className="toolbar-group tight">
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
            <label htmlFor="status-filter" className="sr-only">
              Status
            </label>
            <select
              id="status-filter"
              className="select sm"
              style={{ width: 'auto' }}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as StatusFilter)
              }
            >
              <option value="all">Semua status</option>
              <option value="pending">Belum dihitung</option>
              <option value="candidate">Kandidat</option>
              <option value="approached">Approached</option>
            </select>
            <div className="search">
              <Icon name="search" style={{ color: 'var(--muted)' }} />
              <label htmlFor="kol-search" className="sr-only">
                Cari KOL
              </label>
              <input
                id="kol-search"
                type="search"
                placeholder="Cari handle atau nama"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="toolbar-group tight">
            {selected.size > 0 ? (
              <>
                <span className="toolbar-note">{selected.size} dipilih</span>
                {confirmApproach ? (
                  <>
                    <button
                      type="button"
                      className="btn md quiet"
                      onClick={() => setConfirmApproach(false)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn md primary"
                      onClick={approach}
                    >
                      <Icon name="lock" />
                      Ya, kunci {approachable.length} baseline
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn md"
                    disabled={!approachable.length || !!batch}
                    title={
                      approachable.length
                        ? undefined
                        : 'Hanya kandidat yang sudah punya baseline'
                    }
                    onClick={() => setConfirmApproach(true)}
                  >
                    Tandai approached ({approachable.length})
                  </button>
                )}
              </>
            ) : batch ? (
              <>
                <span className="progress-inline">
                  Menghitung {Math.min(batch.done + 1, batch.total)} /{' '}
                  {batch.total}…
                </span>
                <button
                  type="button"
                  className="btn md quiet"
                  onClick={() => {
                    stopRef.current = true;
                  }}
                >
                  Hentikan
                </button>
              </>
            ) : (
              <>
                <span className="toolbar-note">
                  {pending.length
                    ? `${pending.length} KOL belum punya baseline`
                    : 'Semua KOL sudah punya baseline'}
                </span>
                {pending.length > 0 && (
                  <button
                    type="button"
                    className="btn md accent"
                    onClick={() => computeMany(pending.map((kol) => kol.id))}
                  >
                    Hitung semua yang belum ({pending.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 1280 }}>
            <thead>
              <tr>
                <th className="check-cell">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th style={{ width: 250 }}>KOL</th>
                <th>Platform</th>
                <th className="num">Followers</th>
                <th className="num">ER sebelum</th>
                <th className="num">Postingan</th>
                <th>Diambil</th>
                <th>Sumber</th>
                <th>Status</th>
                <th className="end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((kol) => {
                const isRunning = running.has(kol.id);
                const baseline = kol.baseline;
                const dot = isRunning ? 'running' : kol.status;
                return (
                  <tr key={kol.id}>
                    <td className="check-cell">
                      <input
                        type="checkbox"
                        aria-label={`Pilih @${kol.handle}`}
                        checked={selected.has(kol.id)}
                        onChange={() => toggle(kol.id)}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/kols/${encodeURIComponent(kol.id)}`}
                        className="cell-link"
                      >
                        <span className="cell-strong">@{kol.handle}</span>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {kol.name || '—'}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <PlatformTag platform={kol.platform} />
                    </td>
                    <td className="num">
                      {fmtNum(baseline?.followers ?? kol.followers, '—')}
                    </td>
                    <td className="num">
                      <span className="cell-stack end">
                        <span className="er-big">
                          {fmtPct(baseline?.erPercent, '—')}
                        </span>
                        <span
                          className="cell-sub"
                          style={{ fontFamily: 'var(--sans)' }}
                        >
                          {baseline
                            ? basisLabel(baseline.basis)
                            : 'belum ada baseline'}
                        </span>
                      </span>
                    </td>
                    <td className="num">
                      {fmtNum(baseline?.postsAnalyzed, '—')}
                    </td>
                    <td
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtDateTime(baseline?.capturedAt ?? '')}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                      {sourceLabel(kol)}
                    </td>
                    <td>
                      <span className="cell-stack">
                        <span className="kg-status">
                          <span className={`dot ${dot}`} />
                          {isRunning ? 'Menghitung' : STATUS_LABEL[kol.status]}
                          {kol.status === 'approached' && (
                            <Icon name="lock" size={14} aria-label="Terkunci" />
                          )}
                        </span>
                        {rowErrors[kol.id] && (
                          <span
                            className="cell-sub red"
                            style={{ maxWidth: 200 }}
                          >
                            {rowErrors[kol.id]}
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {isRunning ? (
                          <span className="running-text">Menghitung…</span>
                        ) : kol.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              className="btn sm quiet"
                              onClick={() =>
                                setPanel({
                                  type: 'baseline',
                                  kolId: kol.id,
                                  mode: 'manual',
                                })
                              }
                            >
                              Manual
                            </button>
                            <button
                              type="button"
                              className="btn sm"
                              style={{ background: 'var(--white)' }}
                              disabled={!!batch}
                              onClick={() => compute(kol.id)}
                            >
                              Hitung ER
                            </button>
                          </>
                        ) : kol.status === 'candidate' ? (
                          <button
                            type="button"
                            className="btn sm quiet"
                            onClick={() =>
                              setPanel({
                                type: 'baseline',
                                kolId: kol.id,
                                mode: 'manual',
                              })
                            }
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn sm quiet"
                            onClick={() =>
                              setPanel({
                                type: 'baseline',
                                kolId: kol.id,
                                mode: 'correction',
                              })
                            }
                          >
                            Koreksi
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

        {visible.length === 0 && (
          <div className="empty">
            {kols.length ? (
              <>
                <strong>Tidak ada KOL yang cocok</strong>
                Ubah filter atau kata kunci pencarian.
              </>
            ) : (
              <>
                <strong>Belum ada KOL</strong>
                Tambah KOL satu per satu atau import banyak sekaligus dari CSV /
                Excel.
              </>
            )}
          </div>
        )}

        <div className="table-foot">
          <span>
            {visible.length} dari {kols.length} KOL · {withBaseline} punya
            baseline
          </span>
          <span className="kg-legend">
            <span>
              <span className="dot approached" />
              Approached — baseline dikunci
            </span>
            <span>
              <span className="dot candidate" />
              Kandidat — masih bisa diedit
            </span>
            <span>
              <span className="dot pending" />
              Belum dihitung
            </span>
          </span>
        </div>
      </section>

      {panel?.type === 'add' && (
        <KolDrawer
          onClose={() => setPanel(null)}
          onCreated={(kol, computeNow) => {
            setMessage({ tone: 'info', text: `@${kol.handle} ditambahkan.` });
            if (computeNow) void compute(kol.id);
          }}
        />
      )}
      {panel?.type === 'baseline' && panelKol && (
        <BaselineDrawer
          kol={panelKol}
          mode={panel.mode}
          onClose={() => setPanel(null)}
          onSaved={(baseline) =>
            setMessage({
              tone: 'info',
              text: `Baseline @${panelKol.handle} disimpan sebagai v${baseline.version} (${fmtPct(baseline.erPercent)}).`,
            })
          }
        />
      )}
    </main>
  );
}
