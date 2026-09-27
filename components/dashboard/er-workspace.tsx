'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  getInstaNPost,
  getInstaStats,
  type InstaPost,
  type InstaStats,
} from '@/app/actions/calculate-repository';
import { getKols } from '@/app/actions/kol-repository';
import { Icon } from '@/components/ui/icon';
import type { KolRecord } from '@/types/kol';

type Mode = 'er' | 'posts' | 'detail';

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('id-ID', {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="lookup-message error" role="alert">
      <Icon name="close" size={16} />
      <span>{message}</span>
    </div>
  );
}

export function InstagramStatsWorkspace() {
  const [kols, setKols] = useState<KolRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<Mode>('er');
  const [numberPost, setNumberPost] = useState(5);
  const [contentUrl, setContentUrl] = useState('');
  const [posts, setPosts] = useState<InstaPost[]>([]);
  const [detail, setDetail] = useState<InstaStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingKols, setLoadingKols] = useState(true);

  useEffect(() => {
    void getKols().then((response) => {
      if (response.success) {
        setKols(response.data);
        setSelectedId(response.data[0]?.id ?? '');
      } else setError(response.error);
      setLoadingKols(false);
    });
  }, []);

  const selectedKol = kols.find((kol) => kol.id === selectedId);
  const erSummary = useMemo(() => {
    const videoPosts = posts.filter((post) => post.views && post.views > 0);
    const views = videoPosts.reduce((sum, post) => sum + (post.views ?? 0), 0);
    const engagement = videoPosts.reduce(
      (sum, post) => sum + post.likes + post.comments,
      0,
    );
    return {
      er: views ? (engagement / views) * 100 : null,
      views,
      engagement,
      videoCount: videoPosts.length,
    };
  }, [posts]);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setPosts([]);
    setDetail(null);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKol) {
      setError('Pilih KOL terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    setPosts([]);
    setDetail(null);

    if (mode === 'detail') {
      const response = await getInstaStats({ url: contentUrl });
      if (response.success) setDetail(response.data);
      else setError(response.error);
    } else {
      const response = await getInstaNPost({
        url: selectedKol.profileUrl,
        number_post: numberPost,
      });
      if (response.success) setPosts(response.data.posts);
      else setError(response.error);
    }
    setLoading(false);
  }

  return (
    <div className="instagram-workspace">
      <section className="panel kol-picker-panel">
        <div>
          <label htmlFor="kol-selector">Pilih KOL</label>
          <p>Daftar username diambil dari tab KOL pada Google Sheets.</p>
        </div>
        <select
          id="kol-selector"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={loadingKols || !kols.length}
        >
          {loadingKols && <option>Memuat data KOL...</option>}
          {!loadingKols && !kols.length && <option>Belum ada KOL</option>}
          {kols.map((kol) => (
            <option value={kol.id} key={kol.id}>
              @{kol.username}
              {kol.name && kol.name !== kol.username ? ` — ${kol.name}` : ''}
            </option>
          ))}
        </select>
      </section>

      <div
        className="tool-tabs"
        role="tablist"
        aria-label="Opsi Instagram Stats"
      >
        <button
          role="tab"
          aria-selected={mode === 'er'}
          className={mode === 'er' ? 'active' : ''}
          onClick={() => changeMode('er')}
        >
          Hitung ER
        </button>
        <button
          role="tab"
          aria-selected={mode === 'posts'}
          className={mode === 'posts' ? 'active' : ''}
          onClick={() => changeMode('posts')}
        >
          Ambil N postingan
        </button>
        <button
          role="tab"
          aria-selected={mode === 'detail'}
          className={mode === 'detail' ? 'active' : ''}
          onClick={() => changeMode('detail')}
        >
          Detail konten
        </button>
      </div>

      <section className="panel instagram-lookup">
        <header>
          <div>
            <h3>
              {mode === 'er'
                ? 'Hitung estimated ER'
                : mode === 'posts'
                  ? 'Ambil postingan terbaru'
                  : 'Ambil detail konten'}
            </h3>
            <p>
              {mode === 'detail'
                ? 'Masukkan URL post atau reel Instagram.'
                : `Menggunakan profil ${selectedKol ? `@${selectedKol.username}` : 'KOL yang dipilih'}.`}
            </p>
          </div>
          <span className="source-badge">via Apify</span>
        </header>
        <form onSubmit={submit}>
          {mode === 'detail' ? (
            <>
              <label htmlFor="instagram-content-url">
                URL konten Instagram
              </label>
              <div className="lookup-input-row">
                <input
                  id="instagram-content-url"
                  type="url"
                  required
                  value={contentUrl}
                  onChange={(event) => setContentUrl(event.target.value)}
                  placeholder="https://www.instagram.com/reel/SHORTCODE/"
                />
                <button
                  className="button primary"
                  disabled={loading || !selectedKol}
                >
                  {loading ? 'Mengambil...' : 'Ambil detail'}
                </button>
              </div>
            </>
          ) : (
            <div className="profile-form-grid stats-count-grid">
              <label htmlFor="instagram-post-count">Jumlah postingan</label>
              <input
                id="instagram-post-count"
                type="number"
                required
                min="1"
                max="20"
                value={numberPost}
                onChange={(event) => setNumberPost(Number(event.target.value))}
              />
              <small>Maksimal 20 postingan terbaru dari profil publik.</small>
              <button
                className="button primary"
                disabled={loading || !selectedKol}
              >
                {loading
                  ? 'Mengambil...'
                  : mode === 'er'
                    ? 'Hitung ER'
                    : 'Ambil postingan'}
              </button>
            </div>
          )}
        </form>
        {error && <ErrorMessage message={error} />}
        {mode === 'er' && posts.length > 0 && (
          <div className="er-result" aria-live="polite">
            <span>ESTIMATED ER BY VIEWS</span>
            <b>
              {erSummary.er === null ? 'N/A' : `${erSummary.er.toFixed(2)}%`}
            </b>
            <p>
              {compactNumber(erSummary.engagement)} likes + comments ÷{' '}
              {compactNumber(erSummary.views)} views
            </p>
            <small>
              {erSummary.videoCount} dari {posts.length} postingan video
              dihitung.
            </small>
          </div>
        )}
        {mode === 'posts' && posts.length > 0 && <PostsTable posts={posts} />}
        {detail && (
          <div className="lookup-result" aria-live="polite">
            <div>
              <span>Views</span>
              <b>{compactNumber(detail.views)}</b>
            </div>
            <div>
              <span>Likes</span>
              <b>{compactNumber(detail.likes)}</b>
            </div>
            <div>
              <span>Comments</span>
              <b>{compactNumber(detail.comments)}</b>
            </div>
            <a href={detail.url} target="_blank" rel="noreferrer">
              Buka konten ↗
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function PostsTable({ posts }: { posts: InstaPost[] }) {
  return (
    <div className="recent-post-results" aria-live="polite">
      <div className="recent-post-summary">
        <span>{posts.length} postingan ditemukan</span>
        <small>Views dapat N/A untuk konten non-video.</small>
      </div>
      <div className="table-scroll">
        <table className="recent-post-table">
          <thead>
            <tr>
              <th>Post</th>
              <th>Tipe</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post, index) => (
              <tr key={`${post.url}-${index}`}>
                <td>
                  <a href={post.url} target="_blank" rel="noreferrer">
                    <b>Post {index + 1}</b>
                    <small>Buka di Instagram ↗</small>
                  </a>
                </td>
                <td>
                  <span className="content-type">{post.type}</span>
                </td>
                <td>{compactNumber(post.views)}</td>
                <td>{compactNumber(post.likes)}</td>
                <td>{compactNumber(post.comments)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
