import { fromLocalInput, parseCount } from '@/lib/er';
import {
  PLATFORM_LABEL,
  contentKey,
  parseContentUrl,
  parsePlatform,
  parseProfile,
} from '@/lib/platform';
import type {
  BaselineRowInput,
  ImportContext,
  MetricsRowInput,
} from '@/app/actions/import-actions';
import type { Platform } from '@/types/er';

export type ImportType = 'baseline' | 'metrics';

export type FieldDef = {
  key: string;
  label: string;
  note: string;
  numeric?: boolean;
  synonyms: string[];
};

export const BASELINE_FIELDS: FieldDef[] = [
  {
    key: 'handle',
    label: 'Handle',
    note: 'Wajib bila tidak ada URL profil',
    synonyms: ['username', 'handle', 'akun', 'namaakun', 'user', 'idakun'],
  },
  {
    key: 'platform',
    label: 'Platform',
    note: 'IG / TikTok',
    synonyms: ['platform', 'sosmed', 'media', 'socialmedia'],
  },
  {
    key: 'profile_url',
    label: 'URL profil',
    note: 'Dipakai untuk ambil 12 postingan',
    synonyms: [
      'linkprofil',
      'urlprofil',
      'profil',
      'profileurl',
      'profile',
      'link',
      'url',
      'instagramurl',
      'tiktokurl',
    ],
  },
  {
    key: 'name',
    label: 'Nama',
    note: '',
    synonyms: ['nama', 'name', 'namakol', 'fullname', 'namalengkap'],
  },
  {
    key: 'category',
    label: 'Kategori',
    note: '',
    synonyms: ['kategori', 'category', 'niche'],
  },
  {
    key: 'followers',
    label: 'Followers',
    note: 'Kosong → diambil otomatis',
    numeric: true,
    synonyms: ['followers', 'follower', 'pengikut', 'jumlahfollowers'],
  },
  {
    key: 'posts',
    label: 'Postingan dianalisis',
    note: '',
    numeric: true,
    synonyms: [
      'postingan',
      'jumlahpostingan',
      'posts',
      'postsanalyzed',
      'postingandianalisis',
    ],
  },
  {
    key: 'avg_views',
    label: 'Rata-rata views',
    note: '',
    numeric: true,
    synonyms: ['ratarataviews', 'avgviews', 'averageviews', 'rataratatayangan'],
  },
  {
    key: 'avg_likes',
    label: 'Rata-rata likes',
    note: 'Isi → baseline dari file',
    numeric: true,
    synonyms: ['rataratalikes', 'avglikes', 'averagelikes', 'rataratalike'],
  },
  {
    key: 'avg_comments',
    label: 'Rata-rata comments',
    note: 'Isi → baseline dari file',
    numeric: true,
    synonyms: [
      'rataratacomments',
      'rataratakomentar',
      'avgcomments',
      'averagecomments',
    ],
  },
  {
    key: 'avg_shares',
    label: 'Rata-rata shares',
    note: 'Kosong → N/A',
    numeric: true,
    synonyms: ['rataratashares', 'rataratashare', 'avgshares', 'averageshares'],
  },
  {
    key: 'avg_saves',
    label: 'Rata-rata saves',
    note: 'Kosong → N/A',
    numeric: true,
    synonyms: ['rataratasaves', 'rataratasimpan', 'avgsaves', 'averagesaves'],
  },
];

export const METRICS_FIELDS: FieldDef[] = [
  {
    key: 'content_url',
    label: 'URL konten',
    note: 'Wajib · dicocokkan ke deliverable',
    synonyms: [
      'linkkonten',
      'urlkonten',
      'konten',
      'contenturl',
      'linkpost',
      'linkvideo',
      'link',
      'url',
    ],
  },
  {
    key: 'views',
    label: 'Views',
    note: '',
    numeric: true,
    synonyms: ['views', 'view', 'tayangan', 'plays', 'playcount'],
  },
  {
    key: 'reach',
    label: 'Reach',
    note: 'Kosong → N/A, bukan 0',
    numeric: true,
    synonyms: ['reach', 'jangkauan'],
  },
  {
    key: 'likes',
    label: 'Likes',
    note: '',
    numeric: true,
    synonyms: ['likes', 'like', 'suka'],
  },
  {
    key: 'comments',
    label: 'Comments',
    note: '',
    numeric: true,
    synonyms: ['komentar', 'comments', 'comment'],
  },
  {
    key: 'shares',
    label: 'Shares',
    note: '',
    numeric: true,
    synonyms: ['share', 'shares', 'bagikan', 'dibagikan'],
  },
  {
    key: 'saves',
    label: 'Saves',
    note: '',
    numeric: true,
    synonyms: ['simpan', 'saves', 'save', 'saved', 'disimpan', 'collect'],
  },
  {
    key: 'captured_at',
    label: 'Waktu pengambilan',
    note: 'Kosong → waktu impor',
    synonyms: [
      'tanggalambil',
      'waktuambil',
      'waktupengambilan',
      'capturedat',
      'tanggal',
      'waktu',
      'date',
    ],
  },
];

export const TEMPLATES: Record<ImportType, string[]> = {
  baseline: [
    'Username',
    'Platform',
    'Link Profil',
    'Nama',
    'Kategori',
    'Followers',
    'Rata-rata Likes',
    'Rata-rata Komentar',
    'Rata-rata Share',
    'Rata-rata Simpan',
  ],
  metrics: [
    'Link Konten',
    'Views',
    'Reach',
    'Likes',
    'Komentar',
    'Share',
    'Simpan',
    'Tanggal Ambil',
  ],
};

export function fieldsFor(type: ImportType) {
  return type === 'baseline' ? BASELINE_FIELDS : METRICS_FIELDS;
}

export type Sheet = {
  fileName: string;
  size: number;
  sheetName: string;
  headers: string[];
  /** Nomor baris di file (1-based) dan nilai sel per kolom. */
  rows: { line: number; cells: unknown[] }[];
};

/** Kolom → field sistem ('' = abaikan). */
export type Mapping = string[];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function guessMapping(headers: string[], type: ImportType): Mapping {
  const fields = fieldsFor(type);
  const used = new Set<string>();
  const exact = headers.map((header) => {
    const key = normalize(header);
    const field = fields.find(
      (item) => !used.has(item.key) && item.synonyms.includes(key),
    );
    if (field) used.add(field.key);
    return field?.key ?? '';
  });
  return exact.map((key, index) => {
    if (key) return key;
    const normalized = normalize(headers[index]);
    if (!normalized) return '';
    const field = fields.find(
      (item) =>
        !used.has(item.key) &&
        item.synonyms.some(
          (synonym) => synonym.length > 3 && normalized.includes(synonym),
        ),
    );
    if (field) used.add(field.key);
    return field?.key ?? '';
  });
}

/** Tebak jenis data dari header: ada kolom URL konten → metrik. */
export function guessType(headers: string[]): ImportType {
  const keys = headers.map(normalize);
  return keys.some((key) =>
    ['linkkonten', 'urlkonten', 'contenturl', 'linkpost', 'linkvideo'].includes(
      key,
    ),
  )
    ? 'metrics'
    : 'baseline';
}

export function sampleOf(sheet: Sheet, column: number) {
  const found = sheet.rows.find((row) => cellText(row.cells[column]));
  return found ? cellText(found.cells[column]) : '(kosong)';
}

export function cellText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return value.toISOString().slice(0, 16).replace('T', ' ');
  return String(value).trim();
}

function toIso(value: unknown) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  const text = cellText(value);
  if (!text) return '';
  const local = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (local && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    return fromLocalInput(`${local[1]}T${local[2] ?? '09:00'}`);
  }
  const time = Date.parse(text);
  return Number.isNaN(time) ? '' : new Date(time).toISOString();
}

export type Issue = { line: number | null; text: string; count?: number };

export type BaselineItem = {
  type: 'baseline';
  line: number;
  handle: string;
  platform: Platform;
  followers: number | null;
  fromFile: boolean;
  existing: boolean;
  input: BaselineRowInput;
};

export type MetricsItem = {
  type: 'metrics';
  line: number;
  handle: string;
  title: string;
  platform: Platform;
  views: number | null;
  engagement: number | null;
  input: MetricsRowInput;
};

export type QueueInput = BaselineItem | MetricsItem;

export type Validation = {
  items: QueueInput[];
  errors: Issue[];
  infos: Issue[];
  /** Nomor baris + pesan untuk laporan error (.csv). */
  errorRows: { line: number; text: string; cells: unknown[] }[];
  missingRequired: string;
};

function valueGetter(mapping: Mapping, cells: unknown[]) {
  return (key: string) => {
    const index = mapping.indexOf(key);
    return index >= 0 ? cells[index] : undefined;
  };
}

function numericErrors(fields: FieldDef[], get: (key: string) => unknown) {
  return fields
    .filter((field) => field.numeric)
    .filter(
      (field) =>
        cellText(get(field.key)) && parseCount(get(field.key)) === null,
    )
    .map(
      (field) =>
        `${field.label} “${cellText(get(field.key))}” bukan angka valid.`,
    );
}

export function validate(
  sheet: Sheet,
  mapping: Mapping,
  type: ImportType,
  context: ImportContext | null,
): Validation {
  const errorRows: Validation['errorRows'] = [];
  const items: QueueInput[] = [];
  const counters = {
    existing: 0,
    emptyReach: 0,
    hasSnapshot: 0,
    fromFile: 0,
    apify: 0,
  };

  const missingRequired =
    type === 'baseline'
      ? mapping.includes('handle') || mapping.includes('profile_url')
        ? ''
        : 'Petakan kolom Handle atau URL profil.'
      : mapping.includes('content_url')
        ? ''
        : 'Petakan kolom URL konten.';

  if (!missingRequired) {
    const seen = new Map<string, number>();
    for (const row of sheet.rows) {
      const get = valueGetter(mapping, row.cells);
      const fail = (text: string) =>
        errorRows.push({ line: row.line, text, cells: row.cells });

      if (type === 'baseline') {
        const rawPlatform = cellText(get('platform'));
        const platform = parsePlatform(rawPlatform);
        if (rawPlatform && !platform) {
          fail(
            `Platform “${rawPlatform}” belum didukung. Hanya Instagram dan TikTok.`,
          );
          continue;
        }
        const profileText =
          cellText(get('profile_url')) || cellText(get('handle'));
        const profile = parseProfile(profileText, platform);
        if (!profile.ok) {
          fail(profileText ? profile.error : 'Handle dan URL profil kosong.');
          continue;
        }
        if (platform && platform !== profile.platform) {
          fail(
            `Link adalah profil ${PLATFORM_LABEL[profile.platform]}, tetapi kolom platform “${rawPlatform}”.`,
          );
          continue;
        }
        const numbers = numericErrors(BASELINE_FIELDS, get);
        if (numbers.length) {
          fail(numbers[0]);
          continue;
        }
        const key = `${profile.platform}:${profile.handle}`;
        if (seen.has(key)) {
          fail(
            `Duplikat @${profile.handle} (sama dengan baris ${seen.get(key)}).`,
          );
          continue;
        }
        seen.set(key, row.line);
        const existing =
          context?.type === 'baseline'
            ? context.kols.find(
                (kol) =>
                  kol.platform === profile.platform &&
                  kol.handle === profile.handle,
              )
            : undefined;
        if (existing?.status === 'approached') {
          fail(
            `@${profile.handle} sudah approached — baseline terkunci. Gunakan koreksi di detail KOL.`,
          );
          continue;
        }
        const input: BaselineRowInput = {
          profile: profile.profileUrl,
          platform: profile.platform,
          name: cellText(get('name')),
          category: cellText(get('category')),
          followers: parseCount(get('followers')),
          postsAnalyzed: parseCount(get('posts')),
          avgViews: parseCount(get('avg_views')),
          avgLikes: parseCount(get('avg_likes')),
          avgComments: parseCount(get('avg_comments')),
          avgShares: parseCount(get('avg_shares')),
          avgSaves: parseCount(get('avg_saves')),
        };
        const fromFile = [
          input.avgLikes,
          input.avgComments,
          input.avgShares,
          input.avgSaves,
        ].some((value) => value !== null);
        if (fromFile && !input.followers) {
          fail(
            'Rata-rata engagement diisi, tetapi Followers kosong — ER tidak bisa dihitung.',
          );
          continue;
        }
        if (existing) counters.existing += 1;
        if (fromFile) counters.fromFile += 1;
        else counters.apify += 1;
        items.push({
          type: 'baseline',
          line: row.line,
          handle: profile.handle,
          platform: profile.platform,
          followers: input.followers,
          fromFile,
          existing: !!existing,
          input,
        });
      } else {
        const urlText = cellText(get('content_url'));
        const parsed = parseContentUrl(urlText);
        if (!parsed.ok) {
          fail(urlText ? parsed.error : 'URL konten kosong.');
          continue;
        }
        const numbers = numericErrors(METRICS_FIELDS, get);
        if (numbers.length) {
          fail(numbers[0]);
          continue;
        }
        const content =
          context?.type === 'metrics'
            ? context.contents.find((item) => item.key === contentKey(urlText))
            : undefined;
        if (!content) {
          fail(
            'URL konten tidak cocok dengan deliverable mana pun di campaign ini.',
          );
          continue;
        }
        const input: MetricsRowInput = {
          url: parsed.url,
          views: parseCount(get('views')),
          reach: parseCount(get('reach')),
          likes: parseCount(get('likes')),
          comments: parseCount(get('comments')),
          shares: parseCount(get('shares')),
          saves: parseCount(get('saves')),
          capturedAt: toIso(get('captured_at')),
        };
        const metrics = [
          input.views,
          input.reach,
          input.likes,
          input.comments,
          input.shares,
          input.saves,
        ];
        if (metrics.every((value) => value === null)) {
          fail('Semua kolom metrik kosong.');
          continue;
        }
        if (input.reach === null) counters.emptyReach += 1;
        if (content.snapshotCount > 0) counters.hasSnapshot += 1;
        const parts = [
          input.likes,
          input.comments,
          input.shares,
          input.saves,
        ].filter((value): value is number => value !== null);
        items.push({
          type: 'metrics',
          line: row.line,
          handle: content.handle,
          title: content.title,
          platform: content.platform,
          views: input.views,
          engagement: parts.length
            ? parts.reduce((sum, value) => sum + value, 0)
            : null,
          input,
        });
      }
    }
  }

  const errors: Issue[] = errorRows.map((row) => ({
    line: row.line,
    text: row.text,
  }));
  const infos: Issue[] = [];
  if (type === 'baseline') {
    if (counters.existing) {
      infos.push({
        line: null,
        count: counters.existing,
        text: 'KOL sudah ada di database. Baseline baru ditambahkan sebagai snapshot; baseline lama tidak ditimpa.',
      });
    }
    if (counters.fromFile) {
      infos.push({
        line: null,
        count: counters.fromFile,
        text: 'Punya rata-rata engagement di file → baseline disimpan dari angka file.',
      });
    }
    if (counters.apify) {
      infos.push({
        line: null,
        count: counters.apify,
        text: 'Tanpa angka engagement → 12 postingan terakhir diambil lewat Apify.',
      });
    }
  } else {
    if (counters.emptyReach) {
      infos.push({
        line: null,
        count: counters.emptyReach,
        text: 'Reach kosong → disimpan sebagai N/A. ER dihitung by views.',
      });
    }
    if (counters.hasSnapshot) {
      infos.push({
        line: null,
        count: counters.hasSnapshot,
        text: 'Konten sudah punya snapshot. Data ini disimpan sebagai snapshot baru.',
      });
    }
  }
  return { items, errors, infos, errorRows, missingRequired };
}
