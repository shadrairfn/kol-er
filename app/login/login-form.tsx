'use client';

import { useActionState, useState } from 'react';
import { login, type LoginState } from '@/app/actions/auth-actions';
import { Icon } from '@/components/app/icons';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [hint, setHint] = useState<'reset' | 'access' | null>(null);

  return (
    <form action={action} className="login-form" noValidate>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2>Masuk</h2>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>
          Gunakan akun tim Anda.
        </p>
      </div>

      {state?.error && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}

      <input type="hidden" name="next" value={next} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="field">
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            placeholder="nama@perusahaan.com"
            autoComplete="email"
            defaultValue={state?.email}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <div className="field-row" style={{ alignItems: 'baseline' }}>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <button
              type="button"
              className="link-btn"
              style={{ fontWeight: 400, color: 'var(--muted)' }}
              aria-expanded={hint === 'reset'}
              onClick={() => setHint(hint === 'reset' ? null : 'reset')}
            >
              Lupa password?
            </button>
          </div>
          <div className="password-box">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimal 8 karakter"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
          {hint === 'reset' && (
            <span className="field-hint">
              Hubungi admin workspace untuk mengatur ulang password Anda.
            </span>
          )}
        </div>
        <label className="check" style={{ fontSize: 14, minHeight: 24 }}>
          <input type="checkbox" name="remember" defaultChecked />
          Ingat saya di perangkat ini
        </label>
      </div>

      <button type="submit" className="btn primary block" disabled={pending}>
        <span>{pending ? 'Memproses…' : 'Masuk'}</span>
        <Icon name="arrowRight" size={18} />
      </button>

      <p className="login-foot">
        Belum punya akun?{' '}
        <button
          type="button"
          className="link-btn"
          style={{ fontSize: 14 }}
          aria-expanded={hint === 'access'}
          onClick={() => setHint(hint === 'access' ? null : 'access')}
        >
          Minta akses ke admin
        </button>
        {hint === 'access' && (
          <span
            className="field-hint"
            style={{ display: 'block', marginTop: 8 }}
          >
            Akun dibuat oleh admin workspace. Kirim email kerja Anda ke admin
            untuk dibuatkan akses.
          </span>
        )}
      </p>
    </form>
  );
}
