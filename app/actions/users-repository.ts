'use server';

import { LoginUser, RegisterUser } from '../../types/user';
import bycrypt from 'bcryptjs';
import { saveUser } from '@/lib/google-sheets';

import { authenticateUser } from '../services/auth.services';
import { setSession } from '@/lib/session';

export async function loginUser(input: LoginUser) {
  if (!input.email || !input.password) {
    throw new Error('Email dan password wajib diisi');
  }

  const { user, token } = await authenticateUser(input);
  await setSession(token, true);

  return {
    success: true,
    message: 'Login berhasil',
    token,
    user,
  };
}

export async function registerUser(input: RegisterUser) {
  if (!input.email || !input.password) {
    throw new Error('Email and password are required');
  }

  const hashedPassword = await bycrypt.hash(input.password, 10);

  await saveUser({
    id: crypto.randomUUID(),
    name: input.name ?? '',
    email: input.email,
    password_hash: hashedPassword,
    provider: 'local',
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'User registered successfully',
  };
}
