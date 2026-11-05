'use client';

import { useEffect } from 'react';
import { HOME_HINT_COOKIE, type HomeHint as Home } from '@/lib/home-hint';

/** Records this device's home for the launch shortcut in middleware.ts. */
export function HomeHint({ home }: { home: Home }) {
  useEffect(() => {
    document.cookie = `${HOME_HINT_COOKIE}=${home}; path=/; max-age=31536000; samesite=lax`;
  }, [home]);
  return null;
}
