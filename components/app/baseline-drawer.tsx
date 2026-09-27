'use client';

import { useState } from 'react';
import { saveBaselineAction } from '@/app/actions/er-actions';
import { Drawer } from './drawer';
import { Icon } from './icons';
import { Alert, CountInput } from './ui';
import {
  baselineFormula,
  computeBaseline,
  fmtDate,
  fmtNum,
  fmtPct,
  parseCount,
} from '@/lib/er';
import type { Baseline, BaselineBasis, Kol } from '@/types/er';

const SOURCES = ['Manual', 'Apify', 'CSV', 'Social Blade (referensi)'];

function initial(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * mode "manual": buat/ubah baseline KOL yang belum terkunci (disimpan sebagai versi baru).
 * mode "correction": koreksi baseline terkunci; alasan wajib, versi lama tetap untuk audit.
 */
export function BaselineDrawer({
  kol,
  mode,
  onClose,
  onSaved,
}: {
  kol: Kol;
  mode: 'manual' | 'correction';
  onClose: () => void;
  onSaved?: (baseline: Baseline) => void;
}) {
  const current = kol.baseline;
  const nextVersion = (current?.version ?? 0) + 1;
  const [followers, setFollowers] = useState(
    initial(current?.followers ?? kol.followers),
  );
  const [posts, setPosts] = useState(initial(current?.postsAnalyzed ?? 12));
  const [avgViews, setAvgViews] = useState(initial(current?.avgViews));
  const [likes, setLikes] = useState(initial(current?.avgLikes));
  const [comments, setComments] = useState(initial(current?.avgComments));
  const [shares, setShares] = useState(initial(current?.avgShares));
  const [saves, setSaves] = useState(initial(current?.avgSaves));
  const [naShares, setNaShares] = useState(
    current ? current.avgShares === null : kol.platform === 'IG',
  );
  const [naSaves, setNaSaves] = useState(
    current ? current.avgSaves === null : kol.platform === 'IG',
  );
  const [basis, setBasis] = useState<BaselineBasis>(
    current?.basis ?? 'followers',
  );
  const [reason, setReason] = useState('');
  const [source, setSource] = useState(
    mode === 'correction' ? 'Manual' : (current?.source ?? 'Manual'),
  );
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const values = {
    basis,
    followers: parseCount(followers),
    avgViews: parseCount(avgViews),
    avgLikes: parseCount(likes),
    avgComments: parseCount(comments),
    avgShares: naShares ? null : parseCount(shares),
    avgSaves: naSaves ? null : parseCount(saves),
  };
  const { er, denominator, engagement } = computeBaseline(values);
  const needsReason = mode === 'correction';
  const cantSave =
    saving ||
    (needsReason && !reason.trim()) ||
    engagement.total === null ||
    !denominator;

  async function submit() {
    setSaving(true);
    setError('');
    const result = await saveBaselineAction({
      kolId: kol.id,
      kind: mode,
      ...values,
      postsAnalyzed: parseCount(posts),
      source,
      evidence,
      reason,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved?.(result.data);
    onClose();
  }

  const rows = [
    {
      id: 'f-likes',
      label: 'Likes',
      value: likes,
      set: setLikes,
      na: false,
      setNa: null,
    },
    {
      id: 'f-comments',
      label: 'Comments',
      value: comments,
      set: setComments,
      na: false,
      setNa: null,
    },
    {
      id: 'f-shares',
      label: 'Shares',
      value: shares,
      set: setShares,
      na: naShares,
      setNa: setNaShares,
    },
    {
      id: 'f-saves',
      label: 'Saves',
      value: saves,
      set: setSaves,
      na: naSaves,
      setNa: setNaSaves,
    },
  ];

  return (
    <Drawer
      title={
        mode === 'correction'
          ? 'Koreksi baseline'
          : current
            ? 'Edit baseline'
            : 'Isi baseline manual'
      }
      subtitle={`@${kol.handle} · ${kol.platform}${kol.name && kol.name !== kol.handle ? ` · ${kol.name}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <div className="stat-row two">
            {current ? (
              <div className="stat">
                <span className="stat-label">
                  V{current.version} (
                  {mode === 'correction' ? 'TERKUNCI' : 'SAAT INI'})
                </span>
                <span className="stat-value na" style={{ fontWeight: 400 }}>
                  {fmtPct(current.erPercent)}
                </span>
              </div>
            ) : (
              <div className="stat">
                <span className="stat-label">ENGAGEMENT RATA²</span>
                <span className="stat-value">{fmtNum(engagement.total)}</span>
              </div>
            )}
            <div className="stat">
              <span className="stat-label" style={{ color: 'var(--ink)' }}>
                V{nextVersion} ({mode === 'correction' ? 'KOREKSI' : 'BARU'})
              </span>
              <span className="stat-value">{fmtPct(er)}</span>
            </div>
          </div>
          <p className="formula">{baselineFormula(values)}</p>
          {error && <Alert>{error}</Alert>}
          <div className="drawer-buttons">
            <button type="button" className="btn quiet" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={cantSave}
              onClick={submit}
            >
              {saving ? 'Menyimpan…' : `Simpan sebagai v${nextVersion}`}
            </button>
          </div>
        </>
      }
    >
      {mode === 'correction' && current ? (
        <div className="notice">
          <Icon name="lock" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <p>
            Baseline <b>v{current.version}</b> terkunci sejak KOL di-approach
            {kol.approachedAt ? ` pada ${fmtDate(kol.approachedAt)}` : ''}.
            Koreksi disimpan sebagai <b>v{nextVersion}</b>; v{current.version}{' '}
            tetap tersimpan untuk audit dan tidak bisa dihapus.
          </p>
        </div>
      ) : current ? (
        <div className="notice">
          <p>
            Menyimpan membuat <b>v{nextVersion}</b>. Versi v{current.version}{' '}
            tetap ada di riwayat. Baseline masih bisa diubah sampai KOL ditandai
            approached.
          </p>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="f-followers" className="field-label">
            Followers
          </label>
          <CountInput
            id="f-followers"
            value={followers}
            onChange={setFollowers}
            placeholder="48200"
          />
        </div>
        <div className="field">
          <label htmlFor="f-posts" className="field-label">
            Postingan dianalisis
          </label>
          <CountInput
            id="f-posts"
            value={posts}
            onChange={setPosts}
            placeholder="12"
          />
        </div>
      </div>

      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <legend className="kg-eyebrow">Rata-rata per postingan</legend>
        {rows.map((row) => (
          <div key={row.id} className="metric-row">
            <label htmlFor={row.id} style={{ fontSize: 14 }}>
              {row.label}
            </label>
            <CountInput
              id={row.id}
              value={row.value}
              onChange={row.set}
              disabled={row.na}
            />
            {row.setNa ? (
              <label className="check" style={{ minHeight: 44 }}>
                <input
                  type="checkbox"
                  checked={row.na}
                  onChange={() => row.setNa?.(!row.na)}
                />
                Tidak tersedia
              </label>
            ) : (
              <span />
            )}
          </div>
        ))}
      </fieldset>

      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend className="kg-eyebrow" style={{ marginBottom: 10 }}>
          Basis ER
        </legend>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <label
            className="check"
            style={{ fontSize: 14, color: 'var(--ink)', minHeight: 32 }}
          >
            <input
              type="radio"
              name="basis"
              checked={basis === 'followers'}
              onChange={() => setBasis('followers')}
            />
            Followers
          </label>
          <label
            className="check"
            style={{ fontSize: 14, color: 'var(--ink)', minHeight: 32 }}
          >
            <input
              type="radio"
              name="basis"
              checked={basis === 'views'}
              onChange={() => setBasis('views')}
            />
            Rata-rata views
          </label>
        </div>
        {basis === 'views' && (
          <div className="field">
            <label htmlFor="f-views" className="field-label">
              Rata-rata views per postingan
            </label>
            <CountInput id="f-views" value={avgViews} onChange={setAvgViews} />
          </div>
        )}
      </fieldset>

      <div className="field">
        <label htmlFor="f-reason" className="field-label">
          {needsReason ? (
            <>
              Alasan koreksi <span className="red">*</span>
            </>
          ) : (
            'Catatan (opsional)'
          )}
        </label>
        <textarea
          id="f-reason"
          rows={3}
          className="textarea"
          value={reason}
          required={needsReason}
          onChange={(event) => setReason(event.target.value)}
        />
        <span className="field-hint">
          {needsReason
            ? 'Wajib. Tampil di riwayat versi dan audit trail.'
            : 'Tampil di riwayat versi.'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px, 160px) minmax(0, 1fr)',
          gap: 16,
        }}
      >
        <div className="field">
          <label htmlFor="f-source" className="field-label">
            Sumber
          </label>
          <select
            id="f-source"
            className="select"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            {[...new Set([...SOURCES, source])].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-proof" className="field-label">
            Bukti (URL / catatan)
          </label>
          <input
            id="f-proof"
            className="input"
            placeholder="https://"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
          />
        </div>
      </div>
    </Drawer>
  );
}
