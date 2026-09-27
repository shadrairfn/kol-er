'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { registerUser } from '@/app/actions/users-repository';

type RegisterFormProps = {
  onSuccess?: () => void;
  onSwitchToLogin: () => void;
};

export function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: RegisterFormProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await registerUser({ name, email, password });
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span className="brand-mark">KG</span>
      <h2 id="login-title">Buat Akun Baru</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Nama Lengkap</label>
        <input
          ref={nameRef}
          id="name"
          type="text"
          placeholder="Nama Lengkap"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="nama@perusahaan.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="label-row">
          <label htmlFor="pass">Password</label>
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
          <span>Sudah punya akun?</span>
          <button
            type="button"
            className="register-link"
            onClick={onSwitchToLogin}
          >
            Masuk
          </button>
        </div>

        <button
          type="submit"
          className="button primary full"
          disabled={loading}
        >
          {loading ? 'Mendaftar...' : 'Buat Akun'}
        </button>
      </form>
    </>
  );
}
