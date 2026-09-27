'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { loginUser } from '@/app/actions/users-repository';
import { useRouter } from 'next/navigation';

type LoginFormProps = {
  onSuccess?: () => void;
  onSwitchToRegister: () => void;
};

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginUser({ email, password });

      if (response.success && response.token) {
        // 1. Simpan JWT token di localStorage
        localStorage.setItem('auth_token', response.token);
        // 2. Simpan informasi user (opsional, untuk tampilan profil/avatar)
        if (response.user) {
          localStorage.setItem('auth_user', JSON.stringify(response.user));
        }

        // 3. Callback onSuccess (misal untuk menutup modal atau redirect)
        onSuccess?.();
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal masuk');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span className="brand-mark">KG</span>
      <h2 id="login-title">Selamat Datang Kembali</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          ref={emailRef}
          id="email"
          type="email"
          placeholder="nama@perusahaan.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="label-row">
          <label htmlFor="pass">Password</label>
          <a href="#">Lupa password?</a>
        </div>
        <div className="password">
          <input
            id="pass"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimal 8 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Tampilkan password"
          >
            <Icon name="eye" size={18} />
          </button>
        </div>

        <div className="login-options">
          <label className="checkbox">
            <input type="checkbox" /> Ingat saya di perangkat ini
          </label>
          <button
            type="button"
            className="register-link"
            onClick={onSwitchToRegister}
          >
            Daftar Akun
          </button>
        </div>

        <button
          type="submit"
          className="button primary full"
          disabled={loading}
        >
          {loading ? 'Memproses...' : 'Login'}
        </button>
      </form>
    </>
  );
}
