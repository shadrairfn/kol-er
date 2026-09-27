'use server';

import { revalidatePath } from 'next/cache';
import { currentActor } from '@/lib/session';
import {
  baselineImportContext,
  computeBaselineFromPosts,
  findOrCreateKol,
  metricsImportContext,
  saveBaseline,
  saveSnapshot,
} from '@/lib/data/repository';
import { engagementOf } from '@/lib/er';
import { contentKey, parsePlatform } from '@/lib/platform';
import type { ActionResult, BaselineBasis, Metric, Platform } from '@/types/er';

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Terjadi kesalahan. Coba lagi.';
}

function metric(value: unknown): Metric {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export type ImportContext =
  | {
      type: 'baseline';
      kols: {
        id: string;
        platform: Platform;
        handle: string;
        status: string;
      }[];
    }
  | {
      type: 'metrics';
      contents: {
        id: string;
        key: string;
        title: string;
        handle: string;
        platform: Platform;
        followers: Metric;
        snapshotCount: number;
      }[];
    };

export async function getImportContextAction(
  type: 'baseline' | 'metrics',
  campaignId: string,
): Promise<ActionResult<ImportContext>> {
  await currentActor();
  try {
    if (type === 'metrics') {
      return {
        ok: true,
        data: { type, contents: await metricsImportContext(text(campaignId)) },
      };
    }
    return {
      ok: true,
      data: { type: 'baseline', kols: await baselineImportContext() },
    };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export type BaselineRowInput = {
  profile: string;
  platform: string;
  name: string;
  category: string;
  followers: Metric;
  postsAnalyzed: Metric;
  avgViews: Metric;
  avgLikes: Metric;
  avgComments: Metric;
  avgShares: Metric;
  avgSaves: Metric;
};

export type BaselineRowResult =
  | {
      ok: true;
      data: {
        kolId: string;
        followers: Metric;
        postsAnalyzed: Metric;
        avgEngagement: Metric;
        erPercent: Metric;
        basis: BaselineBasis;
        source: string;
        version: number;
        existed: boolean;
      };
    }
  | { ok: false; error: string; kolId?: string };

/**
 * Satu baris impor baseline: cari/buat KOL, lalu simpan baseline dari angka di
 * file (bila ada) atau hitung dari 12 postingan terakhir lewat Apify.
 */
export async function importBaselineRowAction(
  row: BaselineRowInput,
): Promise<BaselineRowResult> {
  const actor = await currentActor();
  let kolId: string | undefined;
  try {
    const { kol, existed } = await findOrCreateKol(
      {
        profile: text(row.profile),
        platform: parsePlatform(row.platform),
        name: text(row.name),
        category: text(row.category),
        followers: metric(row.followers),
      },
      actor,
    );
    kolId = kol.id;
    if (kol.status === 'approached') {
      throw new Error(
        'Baseline terkunci (sudah approached). Gunakan koreksi di detail KOL.',
      );
    }
    const fromFile = {
      avgLikes: metric(row.avgLikes),
      avgComments: metric(row.avgComments),
      avgShares: metric(row.avgShares),
      avgSaves: metric(row.avgSaves),
    };
    const hasFileEngagement =
      engagementOf({
        likes: fromFile.avgLikes,
        comments: fromFile.avgComments,
        shares: fromFile.avgShares,
        saves: fromFile.avgSaves,
      }).total !== null;
    const baseline = hasFileEngagement
      ? await saveBaseline(
          {
            kolId: kol.id,
            kind: 'import',
            followers: metric(row.followers) ?? kol.followers,
            postsAnalyzed: metric(row.postsAnalyzed),
            avgViews: metric(row.avgViews),
            ...fromFile,
            basis: 'followers',
            source: 'CSV',
            evidence: '',
            reason: '',
          },
          actor,
        )
      : await computeBaselineFromPosts(kol.id, actor, {
          followers: metric(row.followers) ?? undefined,
        });
    revalidatePath('/dashboard', 'layout');
    return {
      ok: true,
      data: {
        kolId: kol.id,
        followers: baseline.followers,
        postsAnalyzed: baseline.postsAnalyzed,
        avgEngagement: baseline.avgEngagement,
        erPercent: baseline.erPercent,
        basis: baseline.basis,
        source: baseline.source,
        version: baseline.version,
        existed,
      },
    };
  } catch (error) {
    console.error(error);
    if (kolId) revalidatePath('/dashboard', 'layout');
    return { ok: false, error: message(error), kolId };
  }
}

export type MetricsRowInput = {
  url: string;
  views: Metric;
  reach: Metric;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  saves: Metric;
  capturedAt: string;
};

export type MetricsRowResult =
  | { ok: true; data: { contentId: string; snapshotId: string } }
  | { ok: false; error: string };

export async function importMetricsRowAction(
  campaignId: string,
  row: MetricsRowInput,
): Promise<MetricsRowResult> {
  const actor = await currentActor();
  try {
    const contents = await metricsImportContext(text(campaignId));
    const key = contentKey(text(row.url));
    const content = contents.find((item) => item.key === key);
    if (!content) {
      throw new Error(
        'URL konten tidak cocok dengan deliverable mana pun di campaign ini.',
      );
    }
    const snapshot = await saveSnapshot(
      {
        contentId: content.id,
        baseSnapshotId: '',
        values: {
          views: metric(row.views),
          reach: metric(row.reach),
          likes: metric(row.likes),
          comments: metric(row.comments),
          shares: metric(row.shares),
          saves: metric(row.saves),
        },
        capturedAt: text(row.capturedAt),
        source: 'CSV',
        evidence: '',
        isFinal: false,
      },
      actor,
    );
    revalidatePath('/dashboard', 'layout');
    return {
      ok: true,
      data: { contentId: content.id, snapshotId: snapshot.id },
    };
  } catch (error) {
    console.error(error);
    return { ok: false, error: message(error) };
  }
}
