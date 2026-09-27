import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, type TokenPayload } from '@/app/services/auth.services';

export const SESSION_COOKIE = 'kg_session';
const SEVEN_DAYS = 60 * 60 * 24 * 7;

export const getSession = cache(async (): Promise<TokenPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect('/login');
  return {
    ...session,
    displayName: session.name?.trim() || session.email,
  };
}

/** Nama pelaku untuk audit trail (created_by). */
export async function currentActor() {
  const user = await requireUser();
  return user.displayName;
}

export async function setSession(token: string, remember: boolean) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: SEVEN_DAYS } : {}),
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
