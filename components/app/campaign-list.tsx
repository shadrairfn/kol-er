'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CampaignDrawer } from './content-drawers';
import { Icon } from './icons';
import { fmtDateTime, fmtPct, fmtRange } from '@/lib/er';
import type { CampaignSummary } from '@/types/er';

export function CampaignList({ campaigns }: { campaigns: CampaignSummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <main className="kg-page">
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Campaign</h1>
          <p className="page-sub">
            Report performa konten setelah posting, dibandingkan dengan baseline
            ER sebelum approach.
          </p>
        </div>
        <div className="actions">
          <Link href="/dashboard/import?type=metrics" className="btn">
            <Icon name="upload" />
            Import metrik
          </Link>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" />
            Buat campaign
          </button>
        </div>
      </div>

      <section aria-label="Daftar campaign">
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Periode</th>
                <th className="num">KOL</th>
                <th className="num">Deliverable</th>
                <th className="num">ER setelah</th>
                <th>Diperbarui</th>
                <th className="end">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="cell-strong"
                      style={{ textDecoration: 'none' }}
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    {fmtRange(campaign.startDate, campaign.endDate)}
                  </td>
                  <td className="num">{campaign.kolCount}</td>
                  <td className="num">
                    {campaign.postedCount}/{campaign.contentCount}
                    <span
                      className="cell-sub"
                      style={{ display: 'block', fontFamily: 'var(--sans)' }}
                    >
                      sudah tayang
                    </span>
                  </td>
                  <td className="num">
                    <span className="cell-stack end">
                      <span
                        className={`er-big ${campaign.erAfter === null ? 'na' : 'blue'}`}
                      >
                        {fmtPct(campaign.erAfter, '—')}
                      </span>
                      <span
                        className="cell-sub"
                        style={{ fontFamily: 'var(--sans)' }}
                      >
                        by views
                      </span>
                    </span>
                  </td>
                  <td
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--ink-2)' }}
                  >
                    {fmtDateTime(campaign.lastCapturedAt)}
                  </td>
                  <td className="end">
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="btn sm quiet"
                    >
                      Buka report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.length === 0 && (
          <div className="empty">
            <strong>Belum ada campaign</strong>
            Buat campaign, lalu tambahkan deliverable tiap KOL untuk mulai
            mencatat metrik setelah posting.
          </div>
        )}
      </section>

      {creating && (
        <CampaignDrawer
          onClose={() => setCreating(false)}
          onCreated={(campaign) =>
            router.push(`/dashboard/campaigns/${campaign.id}`)
          }
        />
      )}
    </main>
  );
}
