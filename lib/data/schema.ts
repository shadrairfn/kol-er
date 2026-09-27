import 'server-only';
import type { TableSpec } from '@/lib/google-sheets';

/**
 * Tab Google Sheets yang dipakai aplikasi. Tab dan kolom yang belum ada dibuat
 * otomatis saat pertama kali dibaca/ditulis. Tab KOL lama tetap dipakai; kolom
 * alias lamanya (kol_id, username, nama, instagram_url, url) tetap diisi.
 */
export const KOL_TABLE = {
  sheet: 'KOL',
  headers: [
    'id',
    'handle',
    'name',
    'platform',
    'profile_url',
    'followers',
    'category',
    'approached_at',
    'approached_by',
    'created_by',
    'created_at',
  ],
} satisfies TableSpec;

export const BASELINE_TABLE = {
  sheet: 'Baselines',
  headers: [
    'id',
    'kol_id',
    'version',
    'status',
    'kind',
    'captured_at',
    'followers',
    'posts_analyzed',
    'avg_views',
    'avg_likes',
    'avg_comments',
    'avg_shares',
    'avg_saves',
    'avg_engagement',
    'er_percent',
    'denominator_type',
    'formula_version',
    'source',
    'evidence',
    'reason',
    'supersedes_id',
    'locked_at',
    'created_by',
    'created_at',
  ],
} satisfies TableSpec;

export const CAMPAIGN_TABLE = {
  sheet: 'Campaigns',
  headers: ['id', 'name', 'start_date', 'end_date', 'created_by', 'created_at'],
} satisfies TableSpec;

export const CONTENT_TABLE = {
  sheet: 'Contents',
  headers: [
    'id',
    'campaign_id',
    'kol_id',
    'title',
    'content_url',
    'content_key',
    'posted_at',
    'scheduled_at',
    'created_by',
    'created_at',
  ],
} satisfies TableSpec;

export const SNAPSHOT_TABLE = {
  sheet: 'Snapshots',
  headers: [
    'id',
    'content_id',
    'captured_at',
    'views',
    'reach',
    'likes',
    'comments',
    'shares',
    'saves',
    'total_engagement',
    'source',
    'evidence',
    'is_final',
    'status',
    'supersedes_id',
    'created_by',
    'created_at',
  ],
} satisfies TableSpec;

export function str(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = str(value);
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function bool(value: unknown) {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'ya', 'yes'].includes(str(value).toLowerCase());
}
