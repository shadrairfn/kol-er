'use client';

import { useState } from 'react';
import {
  createCampaignAction,
  createContentAction,
  linkContentAction,
} from '@/app/actions/er-actions';
import { Drawer } from './drawer';
import { Alert } from './ui';
import { fromDateInput, toDateInput } from '@/lib/er';
import { parseContentUrl } from '@/lib/platform';
import type { Campaign, Content, Kol } from '@/types/er';

export function CampaignDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await createCampaignAction({
      name,
      startDate: fromDateInput(start),
      endDate: fromDateInput(end),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
  }

  return (
    <Drawer
      title="Buat campaign"
      subtitle="Deliverable KOL dan metrik setelah posting dikelompokkan per campaign."
      onClose={onClose}
      footer={
        <>
          {error && <Alert>{error}</Alert>}
          <div className="drawer-buttons">
            <button type="button" className="btn quiet" onClick={onClose}>
              Batal
            </button>
            <button
              type="submit"
              form="campaign-form"
              className="btn primary"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Menyimpan…' : 'Buat campaign'}
            </button>
          </div>
        </>
      }
    >
      <form
        id="campaign-form"
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div className="field">
          <label htmlFor="c-name" className="field-label">
            Nama campaign
          </label>
          <input
            id="c-name"
            className="input"
            placeholder="Glow Serum Launch"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="c-start" className="field-label">
              Mulai
            </label>
            <input
              id="c-start"
              type="date"
              className="input mono"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="c-end" className="field-label">
              Selesai
            </label>
            <input
              id="c-end"
              type="date"
              className="input mono"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </div>
        </div>
      </form>
    </Drawer>
  );
}

/** Tambah deliverable baru ke campaign, atau tautkan URL ke deliverable yang belum tayang. */
export function DeliverableDrawer({
  campaign,
  kols,
  content,
  today,
  onClose,
}: {
  campaign: Campaign;
  kols: Kol[];
  /** Diisi = mode tautkan URL. */
  content?: Content;
  /** YYYY-MM-DD (WIB), default tanggal posting. */
  today: string;
  onClose: () => void;
}) {
  const linking = !!content;
  const linkedKol = content
    ? kols.find((kol) => kol.id === content.kolId)
    : undefined;
  const [kolId, setKolId] = useState(content?.kolId ?? '');
  const [title, setTitle] = useState(content?.title ?? '');
  const [scheduled, setScheduled] = useState(
    toDateInput(content?.scheduledAt ?? ''),
  );
  const [url, setUrl] = useState(content?.url ?? '');
  const [posted, setPosted] = useState(
    toDateInput(content?.postedAt ?? '') || today,
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const kol = kols.find((item) => item.id === kolId);
  const parsed = url.trim() ? parseContentUrl(url) : null;
  const mismatch = parsed?.ok && kol && parsed.platform !== kol.platform;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = content
      ? await linkContentAction({
          contentId: content.id,
          url,
          postedAt: fromDateInput(posted),
        })
      : await createContentAction({
          campaignId: campaign.id,
          kolId,
          title,
          url,
          postedAt: url.trim() ? fromDateInput(posted) : '',
          scheduledAt: fromDateInput(scheduled),
        });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  const disabled = saving || (linking ? !url.trim() : !kolId || !title.trim());

  return (
    <Drawer
      title={linking ? 'Tautkan konten' : 'Tambah deliverable'}
      subtitle={
        linking && linkedKol
          ? `@${linkedKol.handle} · ${linkedKol.platform} · ${content?.title}`
          : campaign.name
      }
      onClose={onClose}
      footer={
        <>
          {error && <Alert>{error}</Alert>}
          <div className="drawer-buttons">
            <button type="button" className="btn quiet" onClick={onClose}>
              Batal
            </button>
            <button
              type="submit"
              form="deliverable-form"
              className="btn primary"
              disabled={disabled}
            >
              {saving
                ? 'Menyimpan…'
                : linking
                  ? 'Tautkan'
                  : 'Tambah deliverable'}
            </button>
          </div>
        </>
      }
    >
      <form
        id="deliverable-form"
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {!linking && (
          <>
            <div className="field">
              <label htmlFor="d-kol" className="field-label">
                KOL
              </label>
              <select
                id="d-kol"
                className="select"
                value={kolId}
                onChange={(event) => setKolId(event.target.value)}
                required
              >
                <option value="">Pilih KOL…</option>
                {kols.map((item) => (
                  <option key={item.id} value={item.id}>
                    @{item.handle} · {item.platform}
                    {item.status === 'approached'
                      ? ''
                      : ` · ${item.status === 'candidate' ? 'kandidat' : 'belum ada baseline'}`}
                  </option>
                ))}
              </select>
              {kol && kol.status !== 'approached' && (
                <span className="field-hint">
                  KOL ini belum ditandai approached — baseline sebelum
                  approach-nya belum terkunci.
                </span>
              )}
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="d-title" className="field-label">
                  Nama konten
                </label>
                <input
                  id="d-title"
                  className="input"
                  placeholder="Reel 1, Video 2…"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="d-scheduled" className="field-label">
                  Jadwal tayang
                </label>
                <input
                  id="d-scheduled"
                  type="date"
                  className="input mono"
                  value={scheduled}
                  onChange={(event) => setScheduled(event.target.value)}
                />
              </div>
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="d-url" className="field-label">
            URL konten {linking ? '' : '(kosongkan bila belum tayang)'}
          </label>
          <input
            id="d-url"
            className="input"
            placeholder="https://www.instagram.com/reel/…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required={linking}
          />
          {parsed && (
            <span
              className={!parsed.ok || mismatch ? 'error-text' : 'field-hint'}
              style={{ fontSize: 12 }}
            >
              {!parsed.ok
                ? parsed.error
                : mismatch
                  ? `URL ${parsed.platform === 'IG' ? 'Instagram' : 'TikTok'}, sedangkan KOL ada di ${kol?.platform === 'IG' ? 'Instagram' : 'TikTok'}.`
                  : parsed.url}
            </span>
          )}
        </div>
        {(linking || url.trim()) && (
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="d-posted" className="field-label">
              Tanggal posting
            </label>
            <input
              id="d-posted"
              type="date"
              className="input mono"
              value={posted}
              onChange={(event) => setPosted(event.target.value)}
            />
          </div>
        )}
      </form>
    </Drawer>
  );
}
