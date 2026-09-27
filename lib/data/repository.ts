import 'server-only';
import {
  insertRecords,
  readTables,
  updateRecords,
  type TableRecord,
} from '@/lib/google-sheets';
import {
  BASELINE_TABLE,
  CAMPAIGN_TABLE,
  CONTENT_TABLE,
  KOL_TABLE,
  SNAPSHOT_TABLE,
  bool,
  num,
  str,
} from '@/lib/data/schema';
import {
  FORMULA_VERSION,
  bestSnapshot,
  computeBaseline,
  engagementOf,
  weightedRate,
} from '@/lib/er';
import {
  PLATFORM_LABEL,
  parseContentUrl,
  parsePlatform,
  parseProfile,
  profileUrlFor,
} from '@/lib/platform';
import { averageOf, scrapeContent, scrapeProfile } from '@/lib/scrapers';
import type {
  Baseline,
  BaselineInput,
  BaselineKind,
  Campaign,
  CampaignReport,
  CampaignSummary,
  Content,
  Kol,
  KolDetail,
  Metric,
  MetricValues,
  Platform,
  Snapshot,
} from '@/types/er';

type Row<T> = T & { row: number };

/* ---------------------------- record mapping ---------------------------- */

function kolIdOf(values: Record<string, unknown>) {
  const profileUrl =
    str(values.profile_url) || str(values.instagram_url) || str(values.url);
  const handle =
    str(values.handle) ||
    str(values.username) ||
    profileUrl.split('/').filter(Boolean).at(-1) ||
    '';
  return (
    str(values.id) ||
    str(values.kol_id) ||
    handle.replace(/^@/, '').toLowerCase()
  );
}

function toKolBase({
  row,
  values,
}: TableRecord): Row<Omit<Kol, 'status' | 'baseline'>> {
  const profileUrl =
    str(values.profile_url) || str(values.instagram_url) || str(values.url);
  const handle = (
    str(values.handle) ||
    str(values.username) ||
    profileUrl.split('/').filter(Boolean).at(-1) ||
    ''
  )
    .replace(/^@/, '')
    .toLowerCase();
  const platform: Platform =
    parsePlatform(values.platform) ??
    (profileUrl.includes('tiktok.com') ? 'TT' : 'IG');
  return {
    row,
    id: kolIdOf(values),
    handle,
    name: str(values.name) || str(values.nama),
    platform,
    profileUrl: profileUrl || (handle ? profileUrlFor(platform, handle) : ''),
    followers: num(values.followers),
    category: str(values.category),
    approachedAt: str(values.approached_at),
    createdAt: str(values.created_at),
  };
}

function toBaseline({ row, values }: TableRecord): Row<Baseline> {
  const kind = str(values.kind) as BaselineKind;
  return {
    row,
    id: str(values.id),
    kolId: str(values.kol_id),
    version: num(values.version) ?? 1,
    active: str(values.status || 'active') === 'active',
    kind: ['auto', 'manual', 'import', 'correction'].includes(kind)
      ? kind
      : 'manual',
    lockedAt: str(values.locked_at),
    capturedAt: str(values.captured_at),
    followers: num(values.followers),
    postsAnalyzed: num(values.posts_analyzed),
    avgViews: num(values.avg_views),
    avgLikes: num(values.avg_likes),
    avgComments: num(values.avg_comments),
    avgShares: num(values.avg_shares),
    avgSaves: num(values.avg_saves),
    avgEngagement: num(values.avg_engagement),
    erPercent: num(values.er_percent),
    basis: str(values.denominator_type) === 'views' ? 'views' : 'followers',
    source: str(values.source),
    evidence: str(values.evidence),
    reason: str(values.reason),
    supersedesId: str(values.supersedes_id),
    createdBy: str(values.created_by),
    createdAt: str(values.created_at),
  };
}

function toCampaign({ values }: TableRecord): Campaign {
  return {
    id: str(values.id),
    name: str(values.name),
    startDate: str(values.start_date),
    endDate: str(values.end_date),
    createdAt: str(values.created_at),
  };
}

function toContent({
  row,
  values,
}: TableRecord): Row<Omit<Content, 'snapshots'>> {
  return {
    row,
    id: str(values.id),
    campaignId: str(values.campaign_id),
    kolId: str(values.kol_id),
    title: str(values.title),
    url: str(values.content_url),
    postedAt: str(values.posted_at),
    scheduledAt: str(values.scheduled_at),
  };
}

function toSnapshot({
  row,
  values,
}: TableRecord): Row<Snapshot> & { active: boolean } {
  return {
    row,
    active: str(values.status || 'active') === 'active',
    id: str(values.id),
    contentId: str(values.content_id),
    capturedAt: str(values.captured_at),
    views: num(values.views),
    reach: num(values.reach),
    likes: num(values.likes),
    comments: num(values.comments),
    shares: num(values.shares),
    saves: num(values.saves),
    source: str(values.source),
    evidence: str(values.evidence),
    isFinal: bool(values.is_final),
    supersedesId: str(values.supersedes_id),
    createdBy: str(values.created_by),
    createdAt: str(values.created_at),
  };
}

function strip<T extends { row: number }>(item: T): Omit<T, 'row'> {
  const { row: _row, ...rest } = item;
  void _row;
  return rest;
}

function activeBaseline(versions: Row<Baseline>[]) {
  return (
    versions
      .filter((item) => item.active)
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

function assembleKols(
  kolRecords: TableRecord[],
  baselineRecords: TableRecord[],
) {
  const baselines = baselineRecords.map(toBaseline);
  const byKol = new Map<string, Row<Baseline>[]>();
  for (const baseline of baselines) {
    byKol.set(baseline.kolId, [...(byKol.get(baseline.kolId) ?? []), baseline]);
  }
  const seen = new Set<string>();
  return kolRecords
    .map(toKolBase)
    .filter((kol) => kol.handle && !seen.has(kol.id) && seen.add(kol.id))
    .map((kol) => {
      const current = activeBaseline(byKol.get(kol.id) ?? []);
      const status: Kol['status'] = kol.approachedAt
        ? 'approached'
        : current
          ? 'candidate'
          : 'pending';
      return {
        ...kol,
        status,
        baseline: current ? (strip(current) as Baseline) : null,
      };
    });
}

function assembleContents(
  contentRecords: TableRecord[],
  snapshotRecords: TableRecord[],
) {
  const snapshots = snapshotRecords
    .map(toSnapshot)
    .filter((item) => item.active);
  const byContent = new Map<string, Snapshot[]>();
  for (const snapshot of snapshots) {
    const { active: _active, ...rest } = strip(snapshot);
    void _active;
    byContent.set(snapshot.contentId, [
      ...(byContent.get(snapshot.contentId) ?? []),
      rest,
    ]);
  }
  return contentRecords.map(toContent).map((content) => ({
    ...content,
    snapshots: (byContent.get(content.id) ?? []).sort(
      (a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt),
    ),
  }));
}

const STATUS_ORDER: Record<Kol['status'], number> = {
  approached: 0,
  candidate: 1,
  pending: 2,
};

function publicKol(kol: Row<Kol>): Kol {
  return strip(kol);
}

/* -------------------------------- reads -------------------------------- */

export async function listKols(): Promise<Kol[]> {
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
  });
  return assembleKols(tables.kols, tables.baselines)
    .map(publicKol)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.handle.localeCompare(b.handle),
    );
}

export async function getKolDetail(id: string): Promise<KolDetail | null> {
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
    campaigns: CAMPAIGN_TABLE,
    contents: CONTENT_TABLE,
    snapshots: SNAPSHOT_TABLE,
  });
  const kol = assembleKols(tables.kols, tables.baselines).find(
    (item) => item.id === id,
  );
  if (!kol) return null;
  const versions = tables.baselines
    .map(toBaseline)
    .filter((item) => item.kolId === id)
    .sort((a, b) => b.version - a.version)
    .map((item) => strip(item) as Baseline);
  const contents = assembleContents(tables.contents, tables.snapshots)
    .filter((item) => item.kolId === id)
    .map((item) => strip(item) as Content);
  const campaigns = tables.campaigns
    .map(toCampaign)
    .filter((campaign) =>
      contents.some((content) => content.campaignId === campaign.id),
    )
    .sort((a, b) =>
      (b.startDate || b.createdAt).localeCompare(a.startDate || a.createdAt),
    )
    .map((campaign) => ({
      campaign,
      contents: contents.filter(
        (content) => content.campaignId === campaign.id,
      ),
    }));
  return { kol: publicKol(kol), versions, campaigns };
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const tables = await readTables({
    campaigns: CAMPAIGN_TABLE,
    contents: CONTENT_TABLE,
    snapshots: SNAPSHOT_TABLE,
  });
  const contents = assembleContents(tables.contents, tables.snapshots);
  return tables.campaigns
    .map(toCampaign)
    .filter((campaign) => campaign.id && campaign.name)
    .map((campaign) => {
      const own = contents.filter(
        (content) => content.campaignId === campaign.id,
      );
      const picked = own
        .map(bestSnapshot)
        .filter((item): item is Snapshot => !!item);
      const after = weightedRate(
        picked.map((snapshot) => ({
          engagement: engagementOf(snapshot).total,
          denominator: snapshot.views,
        })),
      );
      return {
        ...campaign,
        kolCount: new Set(own.map((content) => content.kolId)).size,
        contentCount: own.length,
        postedCount: own.filter((content) => content.url).length,
        erAfter: after.value,
        lastCapturedAt:
          own
            .flatMap((content) =>
              content.snapshots.map((snapshot) => snapshot.capturedAt),
            )
            .sort()
            .at(-1) ?? '',
      };
    })
    .sort((a, b) =>
      (b.startDate || b.createdAt).localeCompare(a.startDate || a.createdAt),
    );
}

export async function getCampaignReport(
  id: string,
): Promise<CampaignReport | null> {
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
    campaigns: CAMPAIGN_TABLE,
    contents: CONTENT_TABLE,
    snapshots: SNAPSHOT_TABLE,
  });
  const campaign = tables.campaigns
    .map(toCampaign)
    .find((item) => item.id === id);
  if (!campaign) return null;
  const contents = assembleContents(tables.contents, tables.snapshots)
    .filter((content) => content.campaignId === id)
    .map((item) => strip(item) as Content);
  const kols = assembleKols(tables.kols, tables.baselines).map(publicKol);
  return { campaign, contents, kols };
}

export async function listCampaignOptions() {
  const tables = await readTables({ campaigns: CAMPAIGN_TABLE });
  return tables.campaigns
    .map(toCampaign)
    .filter((campaign) => campaign.id && campaign.name)
    .sort((a, b) =>
      (b.startDate || b.createdAt).localeCompare(a.startDate || a.createdAt),
    );
}

/* --------------------------------- KOL --------------------------------- */

export type KolInput = {
  profile: string;
  platform: Platform | null;
  name: string;
  category: string;
  followers: Metric;
};

function kolRecord(
  id: string,
  platform: Platform,
  handle: string,
  input: KolInput,
  actor: string,
) {
  const profileUrl = profileUrlFor(platform, handle);
  const name = input.name.trim() || handle;
  return {
    id,
    kol_id: id,
    handle,
    username: handle,
    name,
    nama: name,
    platform,
    profile_url: profileUrl,
    instagram_url: platform === 'IG' ? profileUrl : '',
    url: profileUrl,
    followers: input.followers,
    category: input.category.trim(),
    approached_at: '',
    created_by: actor,
    created_at: new Date().toISOString(),
  };
}

function resolveProfile(input: KolInput) {
  const parsed = parseProfile(input.profile, input.platform);
  if (!parsed.ok) throw new Error(parsed.error);
  if (input.platform && parsed.platform !== input.platform) {
    throw new Error(
      `Link adalah profil ${PLATFORM_LABEL[parsed.platform]}, bukan ${PLATFORM_LABEL[input.platform]}.`,
    );
  }
  return parsed;
}

export async function createKol(input: KolInput, actor: string): Promise<Kol> {
  const { platform, handle } = resolveProfile(input);
  const tables = await readTables({ kols: KOL_TABLE });
  const existing = tables.kols
    .map(toKolBase)
    .find((kol) => kol.platform === platform && kol.handle === handle);
  if (existing) {
    throw new Error(
      `@${handle} (${PLATFORM_LABEL[platform]}) sudah ada di daftar KOL.`,
    );
  }
  const record = kolRecord(crypto.randomUUID(), platform, handle, input, actor);
  await insertRecords(KOL_TABLE, [record]);
  return {
    id: record.id,
    handle,
    name: record.name,
    platform,
    profileUrl: record.profile_url,
    followers: input.followers,
    category: record.category,
    approachedAt: '',
    status: 'pending',
    baseline: null,
    createdAt: record.created_at,
  };
}

/** Untuk impor: pakai KOL yang sudah ada (platform + handle sama) atau buat baru. */
export async function findOrCreateKol(input: KolInput, actor: string) {
  const { platform, handle } = resolveProfile(input);
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
  });
  const kols = assembleKols(tables.kols, tables.baselines);
  const existing = kols.find(
    (kol) => kol.platform === platform && kol.handle === handle,
  );
  if (existing) {
    const patch: Record<string, string | number> = {};
    if (!existing.name || existing.name === handle) {
      if (input.name.trim()) patch.name = input.name.trim();
    }
    if (!existing.category && input.category.trim())
      patch.category = input.category.trim();
    const raw = tables.kols.find((record) => record.row === existing.row);
    if (!str(raw?.values.platform)) patch.platform = platform;
    if (Object.keys(patch).length) {
      await updateRecords(KOL_TABLE, [{ row: existing.row, values: patch }]);
    }
    return {
      kol: publicKol({ ...existing, ...patch } as Row<Kol>),
      existed: true,
    };
  }
  const kol = await createKol({ ...input, platform }, actor);
  return { kol, existed: false };
}

export async function markApproached(ids: string[], actor: string) {
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
  });
  const kols = assembleKols(tables.kols, tables.baselines).filter((kol) =>
    ids.includes(kol.id),
  );
  const eligible = kols.filter(
    (kol) => kol.status === 'candidate' && kol.baseline,
  );
  const now = new Date().toISOString();
  await updateRecords(
    KOL_TABLE,
    eligible.map((kol) => ({
      row: kol.row,
      values: { approached_at: now, approached_by: actor },
    })),
  );
  const baselineRows = tables.baselines
    .map(toBaseline)
    .filter((baseline) =>
      eligible.some((kol) => kol.baseline?.id === baseline.id),
    );
  await updateRecords(
    BASELINE_TABLE,
    baselineRows.map((baseline) => ({
      row: baseline.row,
      values: { locked_at: now },
    })),
  );
  return { updated: eligible.length, skipped: kols.length - eligible.length };
}

/* ------------------------------- baseline ------------------------------- */

export type SaveBaselineInput = BaselineInput & {
  kolId: string;
  kind: BaselineKind;
  capturedAt?: string;
};

function validateBaseline(input: BaselineInput) {
  const { engagement, denominator, er } = computeBaseline(input);
  if (engagement.total === null) {
    throw new Error(
      'Isi minimal satu komponen engagement (likes/comments/shares/saves).',
    );
  }
  if (!denominator) {
    throw new Error(
      input.basis === 'views'
        ? 'Rata-rata views wajib diisi untuk basis views.'
        : 'Followers wajib diisi dan lebih dari 0.',
    );
  }
  if (er !== null && er > 1000) {
    throw new Error('ER di atas 1000% — periksa kembali angka yang diinput.');
  }
  return { engagement, er };
}

export async function saveBaseline(
  input: SaveBaselineInput,
  actor: string,
): Promise<Baseline> {
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
  });
  const kol = assembleKols(tables.kols, tables.baselines).find(
    (item) => item.id === input.kolId,
  );
  if (!kol) throw new Error('KOL tidak ditemukan.');
  const locked = kol.status === 'approached';
  if (input.kind === 'correction') {
    if (!locked)
      throw new Error('Koreksi hanya untuk baseline yang sudah terkunci.');
    if (!input.reason.trim()) throw new Error('Alasan koreksi wajib diisi.');
  } else if (locked) {
    throw new Error(
      'Baseline terkunci karena KOL sudah di-approach. Gunakan koreksi.',
    );
  }
  const { engagement, er } = validateBaseline(input);

  const versions = tables.baselines
    .map(toBaseline)
    .filter((item) => item.kolId === kol.id);
  const previous = activeBaseline(versions);
  const now = new Date().toISOString();
  const baseline: Baseline = {
    id: crypto.randomUUID(),
    kolId: kol.id,
    version: Math.max(0, ...versions.map((item) => item.version)) + 1,
    active: true,
    kind: input.kind,
    lockedAt: input.kind === 'correction' ? now : '',
    capturedAt: input.capturedAt || now,
    followers: input.followers,
    postsAnalyzed: input.postsAnalyzed,
    avgViews: input.avgViews,
    avgLikes: input.avgLikes,
    avgComments: input.avgComments,
    avgShares: input.avgShares,
    avgSaves: input.avgSaves,
    avgEngagement: engagement.total,
    erPercent: er === null ? null : Math.round(er * 10000) / 10000,
    basis: input.basis,
    source: input.source,
    evidence: input.evidence.trim(),
    reason: input.reason.trim(),
    supersedesId: previous?.id ?? '',
    createdBy: actor,
    createdAt: now,
  };

  await insertRecords(BASELINE_TABLE, [
    {
      id: baseline.id,
      kol_id: baseline.kolId,
      version: baseline.version,
      status: 'active',
      kind: baseline.kind,
      captured_at: baseline.capturedAt,
      followers: baseline.followers,
      posts_analyzed: baseline.postsAnalyzed,
      avg_views: baseline.avgViews,
      avg_likes: baseline.avgLikes,
      avg_comments: baseline.avgComments,
      avg_shares: baseline.avgShares,
      avg_saves: baseline.avgSaves,
      avg_engagement: baseline.avgEngagement,
      er_percent: baseline.erPercent,
      denominator_type: baseline.basis,
      formula_version: FORMULA_VERSION,
      source: baseline.source,
      evidence: baseline.evidence,
      reason: baseline.reason,
      supersedes_id: baseline.supersedesId,
      locked_at: baseline.lockedAt,
      created_by: actor,
      created_at: now,
    },
  ]);
  if (previous) {
    await updateRecords(BASELINE_TABLE, [
      { row: previous.row, values: { status: 'superseded' } },
    ]);
  }
  if (input.followers !== null && input.followers !== kol.followers) {
    await updateRecords(KOL_TABLE, [
      { row: kol.row, values: { followers: input.followers } },
    ]);
  }
  return baseline;
}

/** Ambil N postingan terakhir lewat Apify lalu simpan sebagai versi baseline baru. */
export async function computeBaselineFromPosts(
  kolId: string,
  actor: string,
  options: { followers?: Metric; kind?: BaselineKind } = {},
) {
  const kols = await listKols();
  const kol = kols.find((item) => item.id === kolId);
  if (!kol) throw new Error('KOL tidak ditemukan.');
  if (kol.status === 'approached') {
    throw new Error(
      'Baseline terkunci karena KOL sudah di-approach. Gunakan koreksi.',
    );
  }
  const scraped = await scrapeProfile(kol.platform, kol.handle, 12);
  const followers = options.followers ?? scraped.followers ?? kol.followers;
  if (!followers) throw new Error('Jumlah followers tidak ditemukan.');
  const posts = scraped.posts;
  return saveBaseline(
    {
      kolId,
      kind: options.kind ?? 'auto',
      followers,
      postsAnalyzed: posts.length,
      avgViews: averageOf(posts.map((post) => post.views)),
      avgLikes: averageOf(posts.map((post) => post.likes)),
      avgComments: averageOf(posts.map((post) => post.comments)),
      avgShares: averageOf(posts.map((post) => post.shares)),
      avgSaves: averageOf(posts.map((post) => post.saves)),
      basis: 'followers',
      source: 'Apify',
      evidence: kol.profileUrl,
      reason: '',
    },
    actor,
  );
}

/* ------------------------------- campaign ------------------------------- */

export async function createCampaign(
  input: { name: string; startDate: string; endDate: string },
  actor: string,
): Promise<Campaign> {
  const name = input.name.trim();
  if (!name) throw new Error('Nama campaign wajib diisi.');
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new Error('Tanggal selesai tidak boleh sebelum tanggal mulai.');
  }
  const campaign: Campaign = {
    id: crypto.randomUUID(),
    name,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: new Date().toISOString(),
  };
  await insertRecords(CAMPAIGN_TABLE, [
    {
      id: campaign.id,
      name: campaign.name,
      start_date: campaign.startDate,
      end_date: campaign.endDate,
      created_by: actor,
      created_at: campaign.createdAt,
    },
  ]);
  return campaign;
}

async function contentContext() {
  const tables = await readTables({
    kols: KOL_TABLE,
    baselines: BASELINE_TABLE,
    campaigns: CAMPAIGN_TABLE,
    contents: CONTENT_TABLE,
  });
  return {
    kols: assembleKols(tables.kols, tables.baselines),
    campaigns: tables.campaigns.map(toCampaign),
    contents: tables.contents.map(toContent),
    contentRecords: tables.contents,
  };
}

function resolveContentUrl(
  url: string,
  kol: { platform: Platform },
  contents: { id: string; url: string; row: number }[],
  records: TableRecord[],
  selfId?: string,
) {
  const parsed = parseContentUrl(url);
  if (!parsed.ok) throw new Error(parsed.error);
  if (parsed.platform !== kol.platform) {
    throw new Error(
      `URL adalah konten ${PLATFORM_LABEL[parsed.platform]}, sedangkan KOL ada di ${PLATFORM_LABEL[kol.platform]}.`,
    );
  }
  const duplicate = contents.find((content) => {
    if (content.id === selfId) return false;
    const record = records.find((item) => item.row === content.row);
    const key =
      str(record?.values.content_key) ||
      (content.url ? parseContentUrlKey(content.url) : '');
    return key === parsed.key;
  });
  if (duplicate)
    throw new Error('URL konten ini sudah tertaut ke deliverable lain.');
  return parsed;
}

function parseContentUrlKey(url: string) {
  const parsed = parseContentUrl(url);
  return parsed.ok ? parsed.key : url;
}

export async function createContent(
  input: {
    campaignId: string;
    kolId: string;
    title: string;
    url: string;
    postedAt: string;
    scheduledAt: string;
  },
  actor: string,
) {
  const context = await contentContext();
  if (!context.campaigns.some((campaign) => campaign.id === input.campaignId)) {
    throw new Error('Campaign tidak ditemukan.');
  }
  const kol = context.kols.find((item) => item.id === input.kolId);
  if (!kol) throw new Error('Pilih KOL terlebih dahulu.');
  const title = input.title.trim();
  if (!title) throw new Error('Nama konten wajib diisi, mis. “Reel 1”.');
  const parsed = input.url.trim()
    ? resolveContentUrl(
        input.url,
        kol,
        context.contents,
        context.contentRecords,
      )
    : null;
  await insertRecords(CONTENT_TABLE, [
    {
      id: crypto.randomUUID(),
      campaign_id: input.campaignId,
      kol_id: kol.id,
      title,
      content_url: parsed?.url ?? '',
      content_key: parsed?.key ?? '',
      posted_at: parsed ? input.postedAt || new Date().toISOString() : '',
      scheduled_at: input.scheduledAt,
      created_by: actor,
      created_at: new Date().toISOString(),
    },
  ]);
}

export async function linkContent(input: {
  contentId: string;
  url: string;
  postedAt: string;
}) {
  const context = await contentContext();
  const content = context.contents.find((item) => item.id === input.contentId);
  if (!content) throw new Error('Deliverable tidak ditemukan.');
  const kol = context.kols.find((item) => item.id === content.kolId);
  if (!kol) throw new Error('KOL deliverable ini tidak ditemukan.');
  const parsed = resolveContentUrl(
    input.url,
    kol,
    context.contents,
    context.contentRecords,
    content.id,
  );
  await updateRecords(CONTENT_TABLE, [
    {
      row: content.row,
      values: {
        content_url: parsed.url,
        content_key: parsed.key,
        posted_at: input.postedAt || new Date().toISOString(),
      },
    },
  ]);
}

/* ------------------------------- snapshots ------------------------------- */

export type SnapshotInput = {
  contentId: string;
  baseSnapshotId: string;
  values: MetricValues;
  capturedAt: string;
  source: string;
  evidence: string;
  isFinal: boolean;
};

export async function saveSnapshot(
  input: SnapshotInput,
  actor: string,
): Promise<Snapshot> {
  const tables = await readTables({
    contents: CONTENT_TABLE,
    snapshots: SNAPSHOT_TABLE,
  });
  const content = tables.contents
    .map(toContent)
    .find((item) => item.id === input.contentId);
  if (!content) throw new Error('Konten tidak ditemukan.');
  const values = input.values;
  if (Object.values(values).every((value) => value === null)) {
    throw new Error('Isi minimal satu metrik.');
  }
  if (Object.values(values).some((value) => value !== null && value < 0)) {
    throw new Error('Metrik tidak boleh negatif.');
  }
  const own = tables.snapshots
    .map(toSnapshot)
    .filter((item) => item.contentId === content.id && item.active);
  const base = input.baseSnapshotId
    ? own.find((item) => item.id === input.baseSnapshotId)
    : null;
  if (input.baseSnapshotId && !base) {
    throw new Error('Snapshot yang diedit sudah direvisi. Muat ulang halaman.');
  }
  const now = new Date().toISOString();
  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    contentId: content.id,
    capturedAt: input.capturedAt || now,
    ...values,
    source: input.source,
    evidence: input.evidence.trim(),
    isFinal: input.isFinal,
    supersedesId: base?.id ?? '',
    createdBy: actor,
    createdAt: now,
  };
  await insertRecords(SNAPSHOT_TABLE, [
    {
      id: snapshot.id,
      content_id: snapshot.contentId,
      captured_at: snapshot.capturedAt,
      views: values.views,
      reach: values.reach,
      likes: values.likes,
      comments: values.comments,
      shares: values.shares,
      saves: values.saves,
      total_engagement: engagementOf(values).total,
      source: snapshot.source,
      evidence: snapshot.evidence,
      is_final: snapshot.isFinal,
      status: 'active',
      supersedes_id: snapshot.supersedesId,
      created_by: actor,
      created_at: now,
    },
  ]);
  const updates = own
    .filter((item) => item.id === base?.id || (input.isFinal && item.isFinal))
    .map((item) => ({
      row: item.row,
      values:
        item.id === base?.id
          ? { status: 'superseded', is_final: false }
          : { is_final: false },
    }));
  await updateRecords(SNAPSHOT_TABLE, updates);
  return snapshot;
}

/** Ambil metrik publik terbaru lewat Apify dan simpan sebagai snapshot baru. */
export async function refreshContentMetrics(contentId: string, actor: string) {
  const context = await contentContext();
  const content = context.contents.find((item) => item.id === contentId);
  if (!content) throw new Error('Konten tidak ditemukan.');
  if (!content.url) throw new Error('Konten belum tayang — tautkan URL dulu.');
  const kol = context.kols.find((item) => item.id === content.kolId);
  const platform = parseContentUrl(content.url);
  const values = await scrapeContent(
    platform.ok ? platform.platform : (kol?.platform ?? 'IG'),
    content.url,
  );
  return saveSnapshot(
    {
      contentId,
      baseSnapshotId: '',
      values,
      capturedAt: new Date().toISOString(),
      source: 'Apify',
      evidence: content.url,
      isFinal: false,
    },
    actor,
  );
}

/* --------------------------------- import --------------------------------- */

export async function baselineImportContext() {
  const kols = await listKols();
  return kols.map((kol) => ({
    id: kol.id,
    platform: kol.platform,
    handle: kol.handle,
    status: kol.status,
  }));
}

export async function metricsImportContext(campaignId: string) {
  const tables = await readTables({
    kols: KOL_TABLE,
    campaigns: CAMPAIGN_TABLE,
    contents: CONTENT_TABLE,
    snapshots: SNAPSHOT_TABLE,
  });
  if (
    !tables.campaigns
      .map(toCampaign)
      .some((campaign) => campaign.id === campaignId)
  ) {
    throw new Error('Campaign tidak ditemukan.');
  }
  const kols = tables.kols.map(toKolBase);
  const contents = assembleContents(tables.contents, tables.snapshots).filter(
    (content) => content.campaignId === campaignId && content.url,
  );
  return contents.map((content) => {
    const record = tables.contents.find((item) => item.row === content.row);
    const kol = kols.find((item) => item.id === content.kolId);
    return {
      id: content.id,
      key: str(record?.values.content_key) || parseContentUrlKey(content.url),
      title: content.title,
      handle: kol?.handle ?? '',
      platform: kol?.platform ?? 'IG',
      followers: kol?.followers ?? null,
      snapshotCount: content.snapshots.length,
    };
  });
}
