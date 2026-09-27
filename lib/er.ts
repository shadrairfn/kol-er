import type {
  Baseline,
  BaselineBasis,
  Content,
  ContentBasis,
  Metric,
  MetricValues,
  Snapshot,
} from '@/types/er';

export const FORMULA_VERSION = 'er-v1';

export const ENGAGEMENT_KEYS = [
  'likes',
  'comments',
  'shares',
  'saves',
] as const;
export type EngagementKey = (typeof ENGAGEMENT_KEYS)[number];

/**
 * Total engagement = likes + comments + shares + saves.
 * Komponen N/A tidak dihitung sebagai 0; total null bila semua N/A.
 */
export function engagementOf(values: Record<EngagementKey, Metric>) {
  const available = ENGAGEMENT_KEYS.filter((key) => values[key] !== null);
  const missing = ENGAGEMENT_KEYS.filter((key) => values[key] === null);
  const total = available.length
    ? available.reduce((sum, key) => sum + (values[key] as number), 0)
    : null;
  return { total, available, missing };
}

export function rate(engagement: Metric, denominator: Metric): Metric {
  if (engagement === null || !denominator) return null;
  return (engagement / denominator) * 100;
}

/** Weighted ER = Σ engagement ÷ Σ denominator × 100, hanya item dengan denominator. */
export function weightedRate(
  items: { engagement: Metric; denominator: Metric }[],
) {
  const usable = items.filter(
    (item) => item.engagement !== null && !!item.denominator,
  );
  const engagement = usable.reduce(
    (sum, item) => sum + (item.engagement ?? 0),
    0,
  );
  const denominator = usable.reduce(
    (sum, item) => sum + (item.denominator ?? 0),
    0,
  );
  return {
    value: denominator ? (engagement / denominator) * 100 : null,
    count: usable.length,
  };
}

export function baselineEngagement(input: {
  avgLikes: Metric;
  avgComments: Metric;
  avgShares: Metric;
  avgSaves: Metric;
}) {
  return engagementOf({
    likes: input.avgLikes,
    comments: input.avgComments,
    shares: input.avgShares,
    saves: input.avgSaves,
  });
}

export function baselineDenominator(input: {
  basis: BaselineBasis;
  followers: Metric;
  avgViews: Metric;
}) {
  return input.basis === 'views' ? input.avgViews : input.followers;
}

export function computeBaseline(input: {
  basis: BaselineBasis;
  followers: Metric;
  avgViews: Metric;
  avgLikes: Metric;
  avgComments: Metric;
  avgShares: Metric;
  avgSaves: Metric;
}) {
  const engagement = baselineEngagement(input);
  const denominator = baselineDenominator(input);
  return {
    engagement,
    denominator,
    er: rate(engagement.total, denominator),
  };
}

export function baselineFormula(
  input: {
    basis: BaselineBasis;
    followers: Metric;
    avgViews: Metric;
    avgLikes: Metric;
    avgComments: Metric;
    avgShares: Metric;
    avgSaves: Metric;
  },
  missingNote?: string,
) {
  const { engagement, denominator, er } = computeBaseline(input);
  const parts = [
    input.avgLikes,
    input.avgComments,
    input.avgShares,
    input.avgSaves,
  ]
    .filter((value): value is number => value !== null)
    .map((value) => fmtNum(value));
  const left = parts.length ? `(${parts.join(' + ')})` : '(N/A)';
  const suffix = er === null ? '' : ` = ${fmtPct(er)}`;
  const missing = engagement.missing.length
    ? ` · ${missingNote ?? `${engagement.missing.join(' & ')} N/A`}`
    : '';
  return `${left} ÷ ${fmtNum(denominator)} × 100${suffix}${missing}`;
}

export function basisLabel(basis: BaselineBasis | ContentBasis) {
  if (basis === 'views') return 'by views';
  if (basis === 'reach') return 'by reach';
  return 'by followers';
}

export function snapshotEngagement(snapshot: MetricValues) {
  return engagementOf(snapshot);
}

export function snapshotDenominator(
  snapshot: MetricValues,
  basis: ContentBasis,
  followers: Metric,
): Metric {
  if (basis === 'views') return snapshot.views;
  if (basis === 'reach') return snapshot.reach;
  return followers;
}

export function latestSnapshot(content: Content): Snapshot | null {
  return content.snapshots.at(-1) ?? null;
}

export function finalSnapshot(content: Content): Snapshot | null {
  return content.snapshots.find((snapshot) => snapshot.isFinal) ?? null;
}

/** Snapshot final bila ada, selain itu snapshot terbaru. */
export function bestSnapshot(content: Content): Snapshot | null {
  return finalSnapshot(content) ?? latestSnapshot(content);
}

export function isBaselineUsable(
  baseline: Baseline | null,
): baseline is Baseline {
  return !!baseline && baseline.erPercent !== null;
}

/* ---------- Formatting (locale Indonesia, zona WIB, deterministik) ---------- */

const numberFormat = new Intl.NumberFormat('id-ID');
const percentFormat = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtNum(value: Metric | undefined, empty = 'N/A') {
  return value === null || value === undefined
    ? empty
    : numberFormat.format(value);
}

export function fmtPct(value: Metric | undefined, empty = 'N/A') {
  return value === null || value === undefined
    ? empty
    : `${percentFormat.format(value)}%`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibParts(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  const date = new Date(time + WIB_OFFSET_MS);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
    hour: String(date.getUTCHours()).padStart(2, '0'),
    minute: String(date.getUTCMinutes()).padStart(2, '0'),
  };
}

/** "24 Agu 2026, 10.05" */
export function fmtDateTime(iso: string, empty = '—') {
  const parts = iso ? wibParts(iso) : null;
  if (!parts) return empty;
  return `${parts.day} ${MONTHS[parts.month]} ${parts.year}, ${parts.hour}.${parts.minute}`;
}

/** "24 Agu 2026" */
export function fmtDate(iso: string, empty = '—') {
  const parts = iso ? wibParts(iso) : null;
  if (!parts) return empty;
  return `${parts.day} ${MONTHS[parts.month]} ${parts.year}`;
}

/** "24 Agu" */
export function fmtShortDate(iso: string, empty = '—') {
  const parts = iso ? wibParts(iso) : null;
  if (!parts) return empty;
  return `${parts.day} ${MONTHS[parts.month]}`;
}

/** "1–30 Sep 2026" / "28 Agu – 30 Sep 2026" */
export function fmtRange(start: string, end: string) {
  const a = start ? wibParts(start) : null;
  const b = end ? wibParts(end) : null;
  if (!a && !b) return 'Periode belum diatur';
  if (!a || !b) return fmtDate(start || end);
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTHS[b.month]} ${b.year}`;
  }
  if (a.year === b.year) {
    return `${a.day} ${MONTHS[a.month]} – ${b.day} ${MONTHS[b.month]} ${b.year}`;
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** Label checkpoint snapshot, mis. "H+7 · 10 Sep". */
export function snapshotLabel(snapshot: Snapshot, postedAt: string) {
  const captured = Date.parse(snapshot.capturedAt);
  const posted = Date.parse(postedAt);
  const date = fmtShortDate(snapshot.capturedAt);
  if (Number.isNaN(captured) || Number.isNaN(posted)) return date;
  const days = Math.max(0, Math.floor((captured - posted) / 86_400_000));
  return `H+${days} · ${date}`;
}

/** ISO → nilai untuk <input type="datetime-local"> dalam WIB. */
export function toLocalInput(iso: string) {
  const parts = iso ? wibParts(iso) : null;
  if (!parts) return '';
  const month = String(parts.month + 1).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}T${parts.hour}:${parts.minute}`;
}

/** Nilai <input type="datetime-local"> (WIB) → ISO. */
export function fromLocalInput(value: string) {
  if (!value) return '';
  const time = Date.parse(
    `${value.length === 16 ? `${value}:00` : value}+07:00`,
  );
  return Number.isNaN(time) ? '' : new Date(time).toISOString();
}

/** Nilai <input type="date"> (WIB) → ISO tengah malam WIB. */
export function fromDateInput(value: string) {
  return value ? fromLocalInput(`${value}T00:00`) : '';
}

export function toDateInput(iso: string) {
  return toLocalInput(iso).slice(0, 10);
}

/** Parsing angka dari input pengguna/CSV: "48.200", "48,200", "48200" → 48200. */
export function parseCount(raw: unknown): Metric {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number')
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  const text = String(raw).trim().toLowerCase();
  if (!text || ['n/a', 'na', '-', '—', 'null'].includes(text)) return null;
  if (text.startsWith('-')) return null;
  if (/^\d+[.,]\d{1,2}$/.test(text))
    return Math.round(Number(text.replace(',', '.')));
  const compact = text.match(/^([\d.,]+)\s*(rb|k|jt|m)$/);
  if (compact) {
    const base = Number(compact[1].replace(',', '.'));
    const factor =
      compact[2] === 'rb' || compact[2] === 'k' ? 1_000 : 1_000_000;
    return Number.isFinite(base) ? Math.round(base * factor) : null;
  }
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '··';
  const letters =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts.at(-1)![0];
  return letters.toUpperCase();
}
