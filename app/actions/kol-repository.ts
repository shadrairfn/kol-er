'use server';

import { revalidatePath } from 'next/cache';
import { appendSheetRecord, getSheetRecords } from '@/lib/google-sheets';
import type { KolRecord } from '@/types/kol';

type KolListResult =
  { success: true; data: KolRecord[] } | { success: false; error: string };

type CreateKolResult =
  | { success: true; data: KolRecord; message: string }
  | { success: false; error: string };

function valueOf(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '')
      return String(value);
  }
  return '';
}

function parseProfileUrl(input: string) {
  const parsed = new URL(input.trim());
  const hostname = parsed.hostname.replace(/^www\./, '');
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (
    hostname !== 'instagram.com' ||
    parts.length !== 1 ||
    ['p', 'reel', 'tv', 'stories', 'explore'].includes(parts[0])
  ) {
    throw new Error(
      'Gunakan URL profil Instagram, misalnya instagram.com/username/.',
    );
  }
  return {
    username: parts[0].replace(/^@/, '').toLowerCase(),
    profileUrl: `https://www.instagram.com/${parts[0].replace(/^@/, '')}/`,
  };
}

export async function getKols(): Promise<KolListResult> {
  try {
    const records = await getSheetRecords('KOL');
    const data = records
      .map((record) => {
        const normalized = Object.fromEntries(
          Object.entries(record).map(([key, value]) => [
            key.toLowerCase().replace(/[\s-]+/g, '_'),
            value,
          ]),
        );
        const profileUrl = valueOf(
          normalized,
          'instagram_url',
          'profile_url',
          'url',
        );
        const username =
          valueOf(normalized, 'username', 'handle') ||
          profileUrl.split('/').filter(Boolean).at(-1) ||
          '';
        return {
          id: valueOf(normalized, 'id', 'kol_id') || username,
          username: username.replace(/^@/, ''),
          profileUrl,
          name: valueOf(normalized, 'name', 'nama'),
          followers:
            Number(valueOf(normalized, 'followers', 'audience_count')) ||
            undefined,
          createdAt: valueOf(normalized, 'created_at'),
        } satisfies KolRecord;
      })
      .filter((kol) => kol.username && kol.profileUrl);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal membaca data KOL.',
    };
  }
}

export async function createKol(
  profileInput: string,
): Promise<CreateKolResult> {
  try {
    if (!profileInput?.trim())
      return { success: false, error: 'URL profil Instagram wajib diisi.' };
    const { username, profileUrl } = parseProfileUrl(profileInput);
    const existing = await getKols();
    if (
      existing.success &&
      existing.data.some((kol) => kol.username.toLowerCase() === username)
    ) {
      return { success: false, error: `@${username} sudah ada di tab KOL.` };
    }

    const createdAt = new Date().toISOString();
    const data: KolRecord = {
      id: crypto.randomUUID(),
      username,
      profileUrl,
      name: username,
      createdAt,
    };
    await appendSheetRecord('KOL', {
      id: data.id,
      kol_id: data.id,
      name: data.name ?? username,
      nama: data.name ?? username,
      instagram_url: profileUrl,
      profile_url: profileUrl,
      url: profileUrl,
      username,
      handle: username,
      followers: '',
      created_at: createdAt,
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/kols');
    return { success: true, data, message: `@${username} berhasil disimpan.` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan KOL.',
    };
  }
}
