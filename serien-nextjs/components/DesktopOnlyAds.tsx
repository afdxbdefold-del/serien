'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { canLoadDesktopAds, subscribeDesktopAds } from '@/lib/desktop-ads';

const serverSnapshot = () => false;

export function useDesktopAds(): boolean {
  return useSyncExternalStore(subscribeDesktopAds, canLoadDesktopAds, serverSnapshot);
}

/** No ad markup, effects, preloads or empty ad space outside desktop. */
export default function DesktopOnlyAds({ children }: { children: ReactNode }) {
  return useDesktopAds() ? <>{children}</> : null;
}
