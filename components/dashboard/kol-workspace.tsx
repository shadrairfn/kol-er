'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createKol, getKols } from '@/app/actions/kol-repository';
import { Icon } from '@/components/ui/icon';
import type { KolRecord } from '@/types/kol';

export function KolWorkspace() {
  const [url, setUrl] = useState('');
  const [kols, setKols] = useState<KolRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getKols().then((response) => {
      if (response.success) setKols(response.data);
      else setError(response.error);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const response = await createKol(url);
    if (response.success) {
      setKols((current) => [...current, response.data]);
      setUrl('');
      setMessage(response.message);
    } else setError(response.error);
    setLoading(false);
  }

  return (
    <div className="single-form-workspace">
      <section className="panel instagram-lookup">
        <header>
          <div>
            <h3>Tambah profil KOL</h3>
            <p>Username diambil otomatis dari URL dan disimpan ke tab KOL.</p>
          </div>
          <span className="source-badge">Google Sheets</span>
        </header>
        <form onSubmit={submit}>
          <label htmlFor="kol-profile-url">URL profil Instagram</label>
          <div className="lookup-input-row">
            <input
              id="kol-profile-url"
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.instagram.com/username/"
            />
            <button className="button primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan KOL'}
            </button>
          </div>
          <small>Gunakan URL profil, bukan URL post atau reel.</small>
        </form>
        {error && (
          <div className="lookup-message error" role="alert">
            <Icon name="close" size={16} />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="lookup-message success" role="status">
            <Icon name="check" size={16} />
            <span>{message}</span>
          </div>
        )}
      </section>
      <section className="panel kol-list">
        <header>
          <div>
            <h3>KOL tersimpan</h3>
            <p>{kols.length} profil dari tab KOL</p>
          </div>
        </header>
        {kols.length ? (
          <div className="kol-list-grid">
            {kols.map((kol) => (
              <a
                key={kol.id}
                href={kol.profileUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>@</span>
                <div>
                  <b>@{kol.username}</b>
                  <small>{kol.profileUrl}</small>
                </div>
                <strong>↗</strong>
              </a>
            ))}
          </div>
        ) : (
          <div className="simple-empty">Belum ada profil KOL.</div>
        )}
      </section>
    </div>
  );
}
