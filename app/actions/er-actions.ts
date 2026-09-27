'use server';

import { revalidatePath } from 'next/cache';
import { currentActor } from '@/lib/session';
import {
  computeBaselineFromPosts,
  createCampaign,
  createContent,
  createKol,
  linkContent,
  markApproached,
  refreshContentMetrics,
  saveBaseline,
  saveSnapshot,
  type KolInput,
  type SaveBaselineInput,
  type SnapshotInput,
} from '@/lib/data/repository';
import { parsePlatform } from '@/lib/platform';
import type { ActionResult, Metric, MetricValues } from '@/types/er';

async function run<T>(
  task: (actor: string) => Promise<T>,
): Promise<ActionResult<T>> {
  const actor = await currentActor();
  try {
    const data = await task(actor);
    revalidatePath('/dashboard', 'layout');
    return { ok: true, data };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan. Coba lagi.',
    };
  }
}

function metric(value: unknown): Metric {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function metrics(values: Partial<MetricValues>): MetricValues {
  return {
    views: metric(values.views),
    reach: metric(values.reach),
    likes: metric(values.likes),
    comments: metric(values.comments),
    shares: metric(values.shares),
    saves: metric(values.saves),
  };
}

export async function createKolAction(input: KolInput) {
  return run((actor) =>
    createKol(
      {
        profile: text(input.profile),
        platform: parsePlatform(input.platform),
        name: text(input.name),
        category: text(input.category),
        followers: metric(input.followers),
      },
      actor,
    ),
  );
}

export async function computeBaselineAction(kolId: string) {
  return run((actor) => computeBaselineFromPosts(text(kolId), actor));
}

export async function saveBaselineAction(input: SaveBaselineInput) {
  return run((actor) =>
    saveBaseline(
      {
        kolId: text(input.kolId),
        kind: input.kind === 'correction' ? 'correction' : 'manual',
        followers: metric(input.followers),
        postsAnalyzed: metric(input.postsAnalyzed),
        avgViews: metric(input.avgViews),
        avgLikes: metric(input.avgLikes),
        avgComments: metric(input.avgComments),
        avgShares: metric(input.avgShares),
        avgSaves: metric(input.avgSaves),
        basis: input.basis === 'views' ? 'views' : 'followers',
        source: text(input.source) || 'Manual',
        evidence: text(input.evidence),
        reason: text(input.reason),
      },
      actor,
    ),
  );
}

export async function markApproachedAction(kolIds: string[]) {
  return run((actor) =>
    markApproached(
      Array.isArray(kolIds) ? kolIds.map(text).filter(Boolean) : [],
      actor,
    ),
  );
}

export async function createCampaignAction(input: {
  name: string;
  startDate: string;
  endDate: string;
}) {
  return run((actor) =>
    createCampaign(
      {
        name: text(input.name),
        startDate: text(input.startDate),
        endDate: text(input.endDate),
      },
      actor,
    ),
  );
}

export async function createContentAction(input: {
  campaignId: string;
  kolId: string;
  title: string;
  url: string;
  postedAt: string;
  scheduledAt: string;
}) {
  return run((actor) =>
    createContent(
      {
        campaignId: text(input.campaignId),
        kolId: text(input.kolId),
        title: text(input.title),
        url: text(input.url),
        postedAt: text(input.postedAt),
        scheduledAt: text(input.scheduledAt),
      },
      actor,
    ),
  );
}

export async function linkContentAction(input: {
  contentId: string;
  url: string;
  postedAt: string;
}) {
  return run(() =>
    linkContent({
      contentId: text(input.contentId),
      url: text(input.url),
      postedAt: text(input.postedAt),
    }),
  );
}

export async function saveSnapshotAction(input: SnapshotInput) {
  return run((actor) =>
    saveSnapshot(
      {
        contentId: text(input.contentId),
        baseSnapshotId: text(input.baseSnapshotId),
        values: metrics(input.values ?? {}),
        capturedAt: text(input.capturedAt),
        source: text(input.source) || 'Manual',
        evidence: text(input.evidence),
        isFinal: input.isFinal === true,
      },
      actor,
    ),
  );
}

export async function refreshContentAction(contentId: string) {
  return run((actor) => refreshContentMetrics(text(contentId), actor));
}
