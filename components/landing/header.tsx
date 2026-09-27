'use client';
import { useState } from 'react';
import { Brand } from '@/components/ui/brand';
import { Icon } from '@/components/ui/icon';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AuthModal } from '../login/AuthModal';
export function LandingHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return isOpen ? (
    <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
  ) : (
    <>
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Navigasi utama"></nav> 
        <div className="nav-actions">
          <button
            className="button primary"
            onClick={() => setIsOpen(true)}
          >
            Masuk <Icon name="arrow" size={17} />
          </button>
        </div> 
      </header>
    </>
  );
}
