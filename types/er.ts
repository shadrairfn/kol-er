export type Platform = 'IG' | 'TT';

/** pending = belum ada baseline, candidate = baseline bisa diedit, approached = baseline terkunci */
export type KolStatus = 'pending' | 'candidate' | 'approached';

/** Denominator ER baseline. */
export type BaselineBasis = 'followers' | 'views';

/** Denominator ER konten setelah posting. */
export type ContentBasis = 'views' | 'reach' | 'followers';

export type Metric = number | null;

/** Cara versi baseline dibuat. */
export type BaselineKind = 'auto' | 'manual' | 'import' | 'correction';

export type Baseline = {
  id: string;
  kolId: string;
  version: number;
  active: boolean;
  kind: BaselineKind;
  lockedAt: string;
  capturedAt: string;
  followers: Metric;
  postsAnalyzed: Metric;
  avgViews: Metric;
  avgLikes: Metric;
  avgComments: Metric;
  avgShares: Metric;
  avgSaves: Metric;
  avgEngagement: Metric;
  erPercent: Metric;
  basis: BaselineBasis;
  source: string;
  evidence: string;
  reason: string;
  supersedesId: string;
  createdBy: string;
  createdAt: string;
};

export type Kol = {
  id: string;
  handle: string;
  name: string;
  platform: Platform;
  profileUrl: string;
  followers: Metric;
  category: string;
  approachedAt: string;
  status: KolStatus;
  baseline: Baseline | null;
  createdAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
};

export type Snapshot = {
  id: string;
  contentId: string;
  capturedAt: string;
  views: Metric;
  reach: Metric;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  saves: Metric;
  source: string;
  evidence: string;
  isFinal: boolean;
  supersedesId: string;
  createdBy: string;
  createdAt: string;
};

export type Content = {
  id: string;
  campaignId: string;
  kolId: string;
  title: string;
  url: string;
  postedAt: string;
  scheduledAt: string;
  /** Snapshot aktif (bukan yang sudah direvisi), urut dari yang paling lama. */
  snapshots: Snapshot[];
};

export type CampaignSummary = Campaign & {
  kolCount: number;
  contentCount: number;
  postedCount: number;
  erAfter: Metric;
  lastCapturedAt: string;
};

export type CampaignReport = {
  campaign: Campaign;
  contents: Content[];
  kols: Kol[];
};

export type KolDetail = {
  kol: Kol;
  versions: Baseline[];
  campaigns: { campaign: Campaign; contents: Content[] }[];
};

export type MetricValues = {
  views: Metric;
  reach: Metric;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  saves: Metric;
};

export type BaselineInput = {
  followers: Metric;
  postsAnalyzed: Metric;
  avgViews: Metric;
  avgLikes: Metric;
  avgComments: Metric;
  avgShares: Metric;
  avgSaves: Metric;
  basis: BaselineBasis;
  source: string;
  evidence: string;
  reason: string;
};

export type ActionResult<T = null> =
  { ok: true; data: T } | { ok: false; error: string };
