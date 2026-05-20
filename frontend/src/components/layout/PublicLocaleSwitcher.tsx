'use client';

/**
 * Tiny EN/SV toggle for public pages (login, password-reset, etc.).
 *
 * Shares the same NEXT_LOCALE cookie + reload-after-set mechanic as
 * the AdminShell's LocaleSwitcher — they're intentionally kept separate
 * because PublicShell doesn't always render a header to drop the
 * Admin one into. Default position: fixed top-right, so the caller
 * doesn't have to find a slot in their layout.
 */

import { Button } from 'antd';
import { CSSProperties, useState } from 'react';

interface Props {
  /** Override the floating position if the caller wants to anchor it
   *  inside a card / panel instead of the viewport. */
  style?: CSSProperties;
}

export function PublicLocaleSwitcher({ style }: Props) {
  const [locale, setLocale] = useState<'sv' | 'en'>(() => {
    if (typeof document === 'undefined') return 'sv';
    const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    return m?.[1] === 'en' ? 'en' : 'sv';
  });

  const toggle = () => {
    const next = locale === 'sv' ? 'en' : 'sv';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    window.location.reload();
  };

  const defaultStyle: CSSProperties = {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 10,
    fontWeight: 600,
    fontSize: 13,
    color: '#555',
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };

  return (
    <Button
      type="text"
      size="small"
      onClick={toggle}
      title={locale === 'sv' ? 'Switch to English' : 'Byt till Svenska'}
      style={{ ...defaultStyle, ...style }}
    >
      {locale === 'sv' ? '🇬🇧 EN' : '🇸🇪 SV'}
    </Button>
  );
}
