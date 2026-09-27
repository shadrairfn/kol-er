'use client';

import { useState } from 'react';
import { createKolAction } from '@/app/actions/er-actions';
import { Drawer } from './drawer';
import { Alert, CountInput, Segmented } from './ui';
import { parseCount } from '@/lib/er';
import { parseProfile } from '@/lib/platform';
import type { Kol, Platform } from '@/types/er';

export function KolDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (kol: Kol, computeNow: boolean) => void;
}) {
  const [profile, setProfile] = useState('');
  const [platform, setPlatform] = useState<Platform>('IG');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [followers, setFollowers] = useState('');
  const [computeNow, setComputeNow] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const detected = profile.trim() ? parseProfile(profile, platform) : null;
  const effectivePlatform = detected?.ok ? detected.platform : platform;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await createKolAction({
      profile,
      platform: effectivePlatform,
      name,
      category,
      followers: parseCount(followers),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data, computeNow);
    onClose();
  }

  return (
    <Drawer
      title="Tambah KOL"
      subtitle="Baseline dihitung dari 12 postingan terakhir, atau isi manual."
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
              form="kol-form"
              className="btn primary"
              disabled={saving || !profile.trim()}
            >
              {saving ? 'Menyimpan…' : 'Simpan KOL'}
            </button>
          </div>
        </>
      }
    >
      <form
        id="kol-form"
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div className="field">
          <span className="field-label" id="platform-label">
            Platform
          </span>
          <Segmented
            label="Platform"
            value={effectivePlatform}
            onChange={setPlatform}
            options={[
              { value: 'IG', label: 'Instagram' },
              { value: 'TT', label: 'TikTok' },
            ]}
          />
        </div>
        <div className="field">
          <label htmlFor="k-profile" className="field-label">
            Link profil atau handle
          </label>
          <input
            id="k-profile"
            className="input"
            placeholder={
              effectivePlatform === 'IG'
                ? 'instagram.com/username'
                : 'tiktok.com/@username'
            }
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
            required
          />
          <span
            className={detected && !detected.ok ? 'error-text' : 'field-hint'}
            style={{ fontSize: 12 }}
          >
            {detected
              ? detected.ok
                ? `@${detected.handle} · ${detected.profileUrl}`
                : detected.error
              : 'Gunakan link profil, bukan link post atau reel.'}
          </span>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="k-name" className="field-label">
              Nama
            </label>
            <input
              id="k-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="k-category" className="field-label">
              Kategori
            </label>
            <input
              id="k-category"
              className="input"
              placeholder="Food, Beauty, Tech…"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="k-followers" className="field-label">
            Followers (opsional)
          </label>
          <CountInput
            id="k-followers"
            value={followers}
            onChange={setFollowers}
            placeholder="Kosong → diambil otomatis"
          />
        </div>
        <label className="check-lg">
          <input
            type="checkbox"
            checked={computeNow}
            onChange={() => setComputeNow(!computeNow)}
          />
          <span className="check-text">
            <b style={{ fontWeight: 600 }}>Langsung hitung ER</b>
            <span>
              Ambil 12 postingan terakhir lewat Apify setelah KOL disimpan.
            </span>
          </span>
        </label>
      </form>
    </Drawer>
  );
}
