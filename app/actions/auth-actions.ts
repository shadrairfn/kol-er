'use server';

import { redirect } from 'next/navigation';
import { authenticateUser } from '@/app/services/auth.services';
import { clearSession, setSession } from '@/lib/session';

export type LoginState = { error: string; email: string } | null;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/dashboard') && !next.startsWith('//')
    ? next
    : '/dashboard/kols';
}

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const remember = formData.get('remember') === 'on';
  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.', email };
  }
  try {
    const { token } = await authenticateUser({ email, password });
    await setSession(token, remember);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal masuk. Coba lagi.',
      email,
    };
  }
  redirect(safeNext(formData.get('next')));
}

export async function logout() {
  await clearSession();
  redirect('/login');
}
