import 'server-only';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUsers } from '@/lib/google-sheets';
import { LoginUser } from '@/types/user';

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur`);
  }

  return value;
}

// Payload data yang disimpan di dalam token JWT
export interface TokenPayload {
  id?: string;
  name?: string;
  email: string;
  role?: string;
}

// 1. Fungsi Generate Token
export function generateToken(payload: TokenPayload): string {
  const secret = env('JWT_SECRET');

  return jwt.sign(payload, secret, {
    expiresIn: '7d', // Masa aktif token 7 hari
  });
}

// 2. Fungsi Verifikasi Token
export function verifyToken(token: string): TokenPayload {
  const secret = env('JWT_SECRET');
  return jwt.verify(token, secret) as TokenPayload;
}

// 3. Service untuk verifikasi kredensial login & generate token
export async function authenticateUser(input: LoginUser) {
  const users = await getUsers();
  const user = users.find(
    (u) => u.email?.toLowerCase() === input.email?.toLowerCase(),
  );

  if (!user || !user.password_hash) {
    throw new Error('Email atau password salah');
  }

  const isPasswordValid = await bcrypt.compare(
    input.password,
    user.password_hash,
  );
  if (!isPasswordValid) {
    throw new Error('Email atau password salah');
  }

  const token = generateToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
    },
    token,
  };
}
