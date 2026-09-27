import 'server-only';
import { client } from '@/config/config';
import type { Metric, MetricValues, Platform } from '@/types/er';
import { profileUrlFor } from '@/lib/platform';

const INSTAGRAM_ACTOR = 'apify/instagram-scraper';
const TIKTOK_ACTOR = 'clockworks/tiktok-scraper';
const RUN_OPTIONS = { timeout: 240, log: null } as const;

export type ScrapedPost = {
  url: string;
  views: Metric;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  saves: Metric;
};

export type ProfileScrape = {
  followers: Metric;
  name: string;
  posts: ScrapedPost[];
};

type InstagramPost = {
  url?: string;
  shortCode?: string;
  likesCount?: number | null;
  commentsCount?: number | null;
  videoViewCount?: number | null;
  videoPlayCount?: number | null;
  playCount?: number | null;
};

type InstagramProfile = InstagramPost & {
  followersCount?: number | null;
  fullName?: string;
  private?: boolean;
  latestPosts?: InstagramPost[];
  error?: string;
};

type TikTokItem = {
  webVideoUrl?: string;
  playCount?: number | null;
  diggCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  collectCount?: number | null;
  authorMeta?: { fans?: number | null; nickName?: string; name?: string };
  error?: string;
};

/** Instagram menyembunyikan likes dengan nilai negatif; anggap N/A. */
function count(value: number | null | undefined): Metric {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

async function runActor<T>(
  actor: string,
  input: Record<string, unknown>,
  maxItems: number,
) {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN belum diatur di environment.');
  }
  const run = await client
    .actor(actor)
    .call(input, { ...RUN_OPTIONS, maxItems });
  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Scraper berhenti dengan status ${run.status}.`);
  }
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: maxItems });
  return items as T[];
}

function fromInstagram(post: InstagramPost): ScrapedPost {
  return {
    url:
      post.url ??
      (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : ''),
    views: count(post.videoPlayCount ?? post.videoViewCount ?? post.playCount),
    likes: count(post.likesCount),
    comments: count(post.commentsCount),
    shares: null,
    saves: null,
  };
}

function fromTikTok(item: TikTokItem): ScrapedPost {
  return {
    url: item.webVideoUrl ?? '',
    views: count(item.playCount),
    likes: count(item.diggCount),
    comments: count(item.commentCount),
    shares: count(item.shareCount),
    saves: count(item.collectCount),
  };
}

const tiktokInput = {
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSubtitles: false,
  shouldDownloadSlideshowImages: false,
};

/** Followers + N postingan terakhir sebuah akun. */
export async function scrapeProfile(
  platform: Platform,
  handle: string,
  limit = 12,
): Promise<ProfileScrape> {
  if (platform === 'IG') {
    const [profile] = await runActor<InstagramProfile>(
      INSTAGRAM_ACTOR,
      {
        directUrls: [profileUrlFor('IG', handle)],
        resultsType: 'details',
        resultsLimit: 1,
      },
      1,
    );
    if (!profile || profile.error)
      throw new Error('Profil privat / tidak ditemukan.');
    if (profile.private)
      throw new Error('Profil privat — postingan tidak bisa diambil.');
    let posts = (profile.latestPosts ?? []).slice(0, limit).map(fromInstagram);
    if (!posts.length) {
      const items = await runActor<InstagramPost & { error?: string }>(
        INSTAGRAM_ACTOR,
        {
          directUrls: [profileUrlFor('IG', handle)],
          resultsType: 'posts',
          resultsLimit: limit,
        },
        limit,
      );
      posts = items.filter((item) => !item.error).map(fromInstagram);
    }
    if (!posts.length)
      throw new Error('Tidak ada postingan publik yang bisa dianalisis.');
    return {
      followers: count(profile.followersCount),
      name: profile.fullName ?? '',
      posts,
    };
  }

  const items = await runActor<TikTokItem>(
    TIKTOK_ACTOR,
    {
      ...tiktokInput,
      profiles: [handle],
      resultsPerPage: limit,
      profileSorting: 'latest',
    },
    limit,
  );
  const videos = items.filter((item) => !item.error && item.webVideoUrl);
  if (!videos.length) throw new Error('Profil privat / tidak ditemukan.');
  const author = videos[0].authorMeta;
  return {
    followers: count(author?.fans),
    name: author?.nickName ?? author?.name ?? '',
    posts: videos.slice(0, limit).map(fromTikTok),
  };
}

/** Metrik publik satu konten. Reach tidak tersedia secara publik → N/A. */
export async function scrapeContent(
  platform: Platform,
  url: string,
): Promise<MetricValues> {
  if (platform === 'IG') {
    const [post] = await runActor<InstagramPost & { error?: string }>(
      INSTAGRAM_ACTOR,
      { directUrls: [url], resultsType: 'details', resultsLimit: 1 },
      1,
    );
    if (!post || post.error)
      throw new Error('Konten tidak ditemukan atau privat.');
    const { views, likes, comments, shares, saves } = fromInstagram(post);
    return { views, reach: null, likes, comments, shares, saves };
  }
  const [item] = await runActor<TikTokItem>(
    TIKTOK_ACTOR,
    { ...tiktokInput, postURLs: [url] },
    1,
  );
  if (!item || item.error)
    throw new Error('Video tidak ditemukan atau privat.');
  const { views, likes, comments, shares, saves } = fromTikTok(item);
  return { views, reach: null, likes, comments, shares, saves };
}

export function averageOf(values: Metric[]): Metric {
  const known = values.filter((value): value is number => value !== null);
  return known.length
    ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length)
    : null;
}
