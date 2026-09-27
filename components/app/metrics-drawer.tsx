'use client';

import { useState } from 'react';
import { saveSnapshotAction } from '@/app/actions/er-actions';
import { Drawer } from './drawer';
import { Alert, CountInput } from './ui';
import {
  engagementOf,
  fmtDateTime,
  fmtNum,
  fmtPct,
  fromLocalInput,
  parseCount,
  rate,
  snapshotLabel,
  toLocalInput,
} from '@/lib/er';
import type { Content, MetricValues, Platform, Snapshot } from '@/types/er';

const FIELDS: { key: keyof MetricValues; label: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
];

const SOURCES = ['Manual · insight kreator', 'Apify', 'CSV'];

type Draft = {
  values: Record<keyof MetricValues, string>;
  na: Record<keyof MetricValues, boolean>;
  capturedAt: string;
  source: string;
  isFinal: boolean;
};

function draftFrom(
  snapshot: Snapshot | null,
  platform: Platform,
  now: string,
): Draft {
  const pick = (key: keyof MetricValues) =>
    snapshot && snapshot[key] !== null ? String(snapshot[key]) : '';
  return {
    values: {
      views: pick('views'),
      reach: pick('reach'),
      likes: pick('likes'),
      comments: pick('comments'),
      shares: pick('shares'),
      saves: pick('saves'),
    },
    na: snapshot
      ? {
          views: snapshot.views === null,
          reach: snapshot.reach === null,
          likes: snapshot.likes === null,
          comments: snapshot.comments === null,
          shares: snapshot.shares === null,
          saves: snapshot.saves === null,
        }
      : {
          views: false,
          reach: platform === 'TT',
          likes: false,
          comments: false,
          shares: false,
          saves: false,
        },
    capturedAt: toLocalInput(snapshot?.capturedAt || now),
    source: snapshot?.source || SOURCES[0],
    isFinal: snapshot?.isFinal ?? false,
  };
}

export function MetricsDrawer({
  content,
  handle,
  platform,
  initialSnapshotId,
  openedAt,
  onClose,
  onSaved,
}: {
  content: Content;
  handle: string;
  platform: Platform;
  /** '' = snapshot baru */
  initialSnapshotId: string;
  /** ISO time the panel was opened; default waktu pengambilan untuk snapshot baru. */
  openedAt: string;
  onClose: () => void;
  onSaved?: (snapshot: Snapshot) => void;
}) {
  const snapshots = [...content.snapshots].reverse();
  const [snapshotId, setSnapshotId] = useState(initialSnapshotId);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(
      snapshots.find((item) => item.id === initialSnapshotId) ?? null,
      platform,
      openedAt,
    ),
  );
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function pickSnapshot(id: string) {
    setSnapshotId(id);
    setDraft(
      draftFrom(
        snapshots.find((item) => item.id === id) ?? null,
        platform,
        openedAt,
      ),
    );
  }

  const values: MetricValues = {
    views: draft.na.views ? null : parseCount(draft.values.views),
    reach: draft.na.reach ? null : parseCount(draft.values.reach),
    likes: draft.na.likes ? null : parseCount(draft.values.likes),
    comments: draft.na.comments ? null : parseCount(draft.values.comments),
    shares: draft.na.shares ? null : parseCount(draft.values.shares),
    saves: draft.na.saves ? null : parseCount(draft.values.saves),
  };
  const engagement = engagementOf(values);
  const noValues = Object.values(values).every((value) => value === null);

  async function submit() {
    setSaving(true);
    setError('');
    const result = await saveSnapshotAction({
      contentId: content.id,
      baseSnapshotId: snapshotId,
      values,
      capturedAt: fromLocalInput(draft.capturedAt),
      source: draft.source,
      evidence,
      isFinal: draft.isFinal,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved?.(result.data);
    onClose();
  }

  return (
    <Drawer
      title={snapshotId ? 'Edit metrik konten' : 'Tambah snapshot'}
      subtitle={
        <>
          @{handle} · {platform} · {content.title}
          {content.url && (
            <>
              {' · '}
              <a
                href={content.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--muted)' }}
              >
                Buka konten ↗
              </a>
            </>
          )}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <dl className="stat-row">
            <div className="stat">
              <dt>ENGAGEMENT</dt>
              <dd>{fmtNum(engagement.total)}</dd>
            </div>
            <div className="stat">
              <dt style={{ color: 'var(--blue)' }}>ER BY VIEWS</dt>
              <dd className="blue">
                {fmtPct(rate(engagement.total, values.views))}
              </dd>
            </div>
            <div className="stat">
              <dt style={{ color: 'var(--blue)' }}>ER BY REACH</dt>
              <dd className="blue">
                {fmtPct(rate(engagement.total, values.reach))}
              </dd>
            </div>
          </dl>
          <p className="field-hint" style={{ margin: 0 }}>
            {engagement.missing.length
              ? `Engagement tanpa ${engagement.missing.join(' & ')} (N/A, tidak dihitung sebagai 0).`
              : 'likes + comments + shares + saves. Basis yang dipakai di report mengikuti pilihan di halaman report.'}
          </p>
          {error && <Alert>{error}</Alert>}
          <div className="drawer-buttons">
            <button type="button" className="btn quiet" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={saving || noValues}
              onClick={submit}
            >
              {saving ? 'Menyimpan…' : 'Simpan snapshot'}
            </button>
          </div>
        </>
      }
    >
      <div className="field">
        <label htmlFor="f-snap" className="field-label">
          Snapshot
        </label>
        <select
          id="f-snap"
          className="select"
          value={snapshotId}
          onChange={(event) => pickSnapshot(event.target.value)}
        >
          {snapshots.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {snapshotLabel(snapshot, content.postedAt)} ·{' '}
              {fmtDateTime(snapshot.capturedAt).split(', ')[1]}
              {snapshot.isFinal ? ' · Final' : ''}
            </option>
          ))}
          <option value="">+ Snapshot baru</option>
        </select>
        <span className="field-hint">
          {snapshotId
            ? 'Menyimpan membuat revisi baru dari snapshot ini. Nilai lama tetap ada di riwayat. Baseline sebelum approach tidak ikut berubah.'
            : 'Menyimpan menambah snapshot baru untuk konten ini. Baseline sebelum approach tidak ikut berubah.'}
        </span>
      </div>

      <fieldset>
        <legend className="kg-eyebrow">Metrik</legend>
        <div className="grid-2">
          {FIELDS.map((field) => {
            const id = `m-${field.key}`;
            const na = draft.na[field.key];
            return (
              <div key={field.key} className="field">
                <div className="field-row">
                  <label htmlFor={id} className="field-label">
                    {field.label}
                  </label>
                  <label className="check" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={na}
                      style={{ width: 14, height: 14 }}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          na: { ...current.na, [field.key]: !na },
                        }))
                      }
                    />
                    N/A
                  </label>
                </div>
                <CountInput
                  id={id}
                  value={draft.values[field.key]}
                  disabled={na}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      values: { ...current.values, [field.key]: value },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="f-time" className="field-label">
            Waktu pengambilan (WIB)
          </label>
          <input
            id="f-time"
            type="datetime-local"
            className="input mono"
            style={{ fontSize: 13 }}
            value={draft.capturedAt}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                capturedAt: event.target.value,
              }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="f-src" className="field-label">
            Sumber
          </label>
          <select
            id="f-src"
            className="select"
            value={draft.source}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                source: event.target.value,
              }))
            }
          >
            {[...new Set([...SOURCES, draft.source])].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-evidence" className="field-label">
          Bukti (URL screenshot / catatan)
        </label>
        <input
          id="f-evidence"
          className="input"
          placeholder="https://drive.google.com/…"
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
        />
      </div>

      <label className="check-lg">
        <input
          type="checkbox"
          checked={draft.isFinal}
          onChange={() =>
            setDraft((current) => ({ ...current, isFinal: !current.isFinal }))
          }
        />
        <span className="check-text">
          <b style={{ fontWeight: 600 }}>Snapshot final</b>
          <span>
            Dipakai untuk total campaign saat campaign ditutup. Hanya satu
            snapshot final per konten.
          </span>
        </span>
      </label>
    </Drawer>
  );
}
