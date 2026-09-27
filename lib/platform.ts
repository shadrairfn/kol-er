import type { Platform } from '@/types/er';

export const PLATFORM_LABEL: Record<Platform, string> = {
  IG: 'Instagram',
  TT: 'TikTok',
};

const IG_RESERVED = [
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
];

export function parsePlatform(value: unknown): Platform | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (['ig', 'instagram', 'insta'].includes(text)) return 'IG';
  if (['tt', 'tiktok'].includes(text)) return 'TT';
  return null;
}

function toUrl(input: string) {
  const text = input.trim();
  if (!/^[a-z]+:\/\//i.test(text)) {
    return new URL(`https://${text}`);
  }
  return new URL(text);
}

function hostOf(url: URL) {
  return url.hostname.replace(/^(www\.|m\.|vm\.|vt\.)/, '').toLowerCase();
}

export function profileUrlFor(platform: Platform, handle: string) {
  return platform === 'IG'
    ? `https://www.instagram.com/${handle}/`
    : `https://www.tiktok.com/@${handle}`;
}

type ProfileResult =
  | { ok: true; platform: Platform; handle: string; profileUrl: string }
  | { ok: false; error: string };

/**
 * Menerima URL profil (instagram.com/handle, tiktok.com/@handle) atau handle
 * polos ("@handle") bila platform diketahui.
 */
export function parseProfile(
  input: string,
  platformHint?: Platform | null,
): ProfileResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Handle atau URL profil wajib diisi.' };

  if (!/[/.]com/i.test(text)) {
    const handle = text.replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      return { ok: false, error: `Handle “${text}” tidak valid.` };
    }
    if (!platformHint) {
      return {
        ok: false,
        error: 'Platform wajib diisi bila hanya memakai handle.',
      };
    }
    return {
      ok: true,
      platform: platformHint,
      handle,
      profileUrl: profileUrlFor(platformHint, handle),
    };
  }

  let url: URL;
  try {
    url = toUrl(text);
  } catch {
    return { ok: false, error: 'Format URL tidak valid.' };
  }
  const host = hostOf(url);
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com') {
    if (parts.length !== 1 || IG_RESERVED.includes(parts[0].toLowerCase())) {
      return {
        ok: false,
        error: 'URL bukan profil (instagram.com/p/…). Gunakan link profil.',
      };
    }
    const handle = parts[0].replace(/^@/, '').toLowerCase();
    return {
      ok: true,
      platform: 'IG',
      handle,
      profileUrl: profileUrlFor('IG', handle),
    };
  }
  if (host === 'tiktok.com') {
    if (parts.length !== 1 || !parts[0].startsWith('@')) {
      return {
        ok: false,
        error: 'URL bukan profil TikTok. Gunakan tiktok.com/@handle.',
      };
    }
    const handle = parts[0].slice(1).toLowerCase();
    return {
      ok: true,
      platform: 'TT',
      handle,
      profileUrl: profileUrlFor('TT', handle),
    };
  }
  if (/youtube\.com|youtu\.be/.test(host)) {
    return {
      ok: false,
      error: 'Platform YouTube belum didukung. Hanya Instagram dan TikTok.',
    };
  }
  return { ok: false, error: 'Hanya URL Instagram dan TikTok yang didukung.' };
}

type ContentResult =
  | { ok: true; platform: Platform; url: string; key: string }
  | { ok: false; error: string };

/** Normalisasi URL konten. `key` dipakai untuk mencocokkan konten yang sama. */
export function parseContentUrl(input: string): ContentResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'URL konten wajib diisi.' };
  let url: URL;
  try {
    url = toUrl(text);
  } catch {
    return { ok: false, error: 'Format URL konten tidak valid.' };
  }
  const host = hostOf(url);
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com') {
    const index = parts.findIndex((part) =>
      ['p', 'reel', 'reels', 'tv'].includes(part),
    );
    const code = index >= 0 ? parts[index + 1] : undefined;
    if (!code) {
      return {
        ok: false,
        error: 'Gunakan URL post/reel Instagram (instagram.com/reel/KODE).',
      };
    }
    const type = parts[index] === 'reels' ? 'reel' : parts[index];
    return {
      ok: true,
      platform: 'IG',
      url: `https://www.instagram.com/${type}/${code}/`,
      key: `IG:${code}`,
    };
  }
  if (host === 'tiktok.com') {
    const index = parts.findIndex(
      (part) => part === 'video' || part === 'photo',
    );
    const id = index >= 0 ? parts[index + 1] : undefined;
    if (id && /^\d+$/.test(id)) {
      const user = parts.find((part) => part.startsWith('@')) ?? '@_';
      return {
        ok: true,
        platform: 'TT',
        url: `https://www.tiktok.com/${user}/${parts[index]}/${id}`,
        key: `TT:${id}`,
      };
    }
    if (parts.length === 1 && !parts[0].startsWith('@')) {
      // Short link (vm.tiktok.com/XXXX) — id asli belum diketahui.
      return {
        ok: true,
        platform: 'TT',
        url: url.toString(),
        key: `TT:${url.toString()}`,
      };
    }
    return {
      ok: false,
      error: 'Gunakan URL video TikTok (tiktok.com/@user/video/ID).',
    };
  }
  return {
    ok: false,
    error: 'Hanya URL konten Instagram dan TikTok yang didukung.',
  };
}

export function contentKey(url: string) {
  const parsed = parseContentUrl(url);
  return parsed.ok ? parsed.key : url.trim().toLowerCase();
}
