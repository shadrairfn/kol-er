'use client';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
export function ThemeToggle({
  className = 'icon-button',
}: {
  className?: string;
}) {
  const { dark, toggle } = useTheme();
  return (
    <button className={className} onClick={toggle} aria-label="Ganti tema">
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}
