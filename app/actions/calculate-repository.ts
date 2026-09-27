'use server';

import { client } from '@/config/config';

export type KOL = {
  url: string;
  number_post?: number;
};

export type InstaStats = {
  shortcode: string;
  url: string;
  likes: number;
  comments: number;
  views: number | null;
};

export type InstaStatsResult =
  { success: true; data: InstaStats } | { success: false; error: string };

type InstagramDatasetItem = {
  url?: string;
  type?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  playCount?: number;
  followersCount?: number;
  ownerUsername?: string;
};

export type InstaPost = {
  username?: string;
  url: string;
  type: string;
  likes: number;
  comments: number;
  views: number | null;
};

export type InstaNPostResult =
  | {
      success: true;
      data: { profileUrl: string; requested: number; posts: InstaPost[] };
    }
  | { success: false; error: string };

export async function getInstaStats(input: KOL): Promise<InstaStatsResult> {
  if (!input.url?.trim()) {
    return { success: false, error: 'URL Instagram wajib diisi.' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url.trim());
  } catch {
    return { success: false, error: 'Format URL tidak valid.' };
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, '');
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const supportedType = pathParts[0];
  const shortcode = pathParts[1];

  if (
    hostname !== 'instagram.com' ||
    !['p', 'reel', 'tv'].includes(supportedType) ||
    !shortcode
  ) {
    return {
      success: false,
      error:
        'Gunakan URL post atau reel Instagram, misalnya instagram.com/reel/SHORTCODE/.',
    };
  }

  const postUrl = `https://www.instagram.com/${supportedType}/${shortcode}/`;

  try {
    const run = await client.actor('apify/instagram-scraper').call({
      directUrls: [postUrl],
      resultsType: 'details',
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) {
      return { success: false, error: 'Statistik konten tidak ditemukan.' };
    }

    const postData = items[0] as InstagramDatasetItem;
    return {
      success: true,
      data: {
        shortcode,
        url: postUrl,
        likes: postData.likesCount ?? 0,
        comments: postData.commentsCount ?? 0,
        views: postData.videoPlayCount ?? postData.playCount ?? null,
      },
    };
  } catch (error) {
    console.error('Gagal mengambil statistik Instagram:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal mengambil statistik Instagram.',
    };
  }
}

export async function getInstaNPost(input: KOL): Promise<InstaNPostResult> {
  if (!input.url?.trim()) {
    return { success: false, error: 'URL profil Instagram wajib diisi.' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url.trim());
  } catch {
    return { success: false, error: 'Format URL profil tidak valid.' };
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, '');
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const username = pathParts[0];

  if (
    hostname !== 'instagram.com' ||
    !username ||
    pathParts.length !== 1 ||
    ['p', 'reel', 'tv', 'stories', 'explore'].includes(username)
  ) {
    return {
      success: false,
      error: 'Gunakan URL profil Instagram, misalnya instagram.com/username/.',
    };
  }

  const requested = Math.min(
    Math.max(Math.trunc(input.number_post ?? 5), 1),
    20,
  );
  const profileUrl = `https://www.instagram.com/${username}/`;

  try {
    const run = await client.actor('apify/instagram-scraper').call({
      directUrls: [profileUrl],
      resultsType: 'posts',
      resultsLimit: requested,
      username: username,
    });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    const posts = (items as InstagramDatasetItem[]).map((post) => ({
      username: post.ownerUsername ?? '',
      url: post.url ?? profileUrl,
      type: post.type ?? 'Post',
      likes: post.likesCount ?? 0,
      comments: post.commentsCount ?? 0,
      views:
        post.videoViewCount ?? post.playCount ?? post.videoPlayCount ?? null,
      followers: post.followersCount,
    }));

    if (posts.length === 0) {
      return {
        success: false,
        error: 'Postingan tidak ditemukan atau profil bersifat privat.',
      };
    }

    return { success: true, data: { profileUrl, requested, posts } };
  } catch (error) {
    console.error('Gagal mengambil postingan Instagram:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal mengambil postingan Instagram.',
    };
  }
}
