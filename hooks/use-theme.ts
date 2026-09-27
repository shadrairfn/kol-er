'use client';
import { useEffect, useState } from 'react';
export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setDark(document.documentElement.dataset.theme === 'dark'),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('kolgia-theme', next ? 'dark' : 'light');
  }
  return { dark, toggle };
}
