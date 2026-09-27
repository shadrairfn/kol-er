'use client';

import type { ReactNode } from 'react';
import { Icon } from './icons';
import type { KolStatus, Platform } from '@/types/er';

export const STATUS_LABEL: Record<KolStatus, string> = {
  approached: 'Approached',
  candidate: 'Kandidat',
  pending: 'Belum dihitung',
};

export function PlatformTag({ platform }: { platform: Platform }) {
  return (
    <span className="tag" title={platform === 'IG' ? 'Instagram' : 'TikTok'}>
      {platform}
    </span>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Alert({
  children,
  tone = 'error',
  onDismiss,
}: {
  children: ReactNode;
  tone?: 'error' | 'info';
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`alert ${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={16} />
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="link-btn" onClick={onDismiss}>
          Tutup
        </button>
      )}
    </div>
  );
}

/** Input angka yang menerima "48.200" / "48200"; kosong = N/A. */
export function CountInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      id={id}
      className="input mono"
      inputMode="numeric"
      autoComplete="off"
      value={disabled ? '' : value}
      disabled={disabled}
      placeholder={disabled ? 'N/A' : placeholder}
      required={required}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
