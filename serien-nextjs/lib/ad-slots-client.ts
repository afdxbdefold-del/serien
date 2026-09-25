/**
 * Shared client-side helper to fetch ad slot configurations once per page
 * load. Only eligible desktop devices may request or use ad configurations.
 *
 * Backend returns `/api/ads/slots` in shape:
 *   { mobile: { [position]: AdConfig }, desktop: { [position]: AdConfig } }
 *
 * The shared desktop policy includes the 1024px breakpoint, input capability
 * and mobile/tablet exclusion. Legacy mobile configurations are kept in the DB
 * but are never selected.
 */
import type { AdVariant } from '@/lib/ad-html-injector';
import { canLoadDesktopAds } from './desktop-ads';

export interface AdConfig {
  provider: 'custom';
  customHtmlVariants?: AdVariant[];
  rotationMode?: 'random' | 'weighted' | 'first';
  width: number;
  height: number;
  device: 'mobile' | 'desktop';
  mobileOnly: boolean;
  desktopOnly: boolean;
}

interface SlotsResponse {
  mobile: Record<string, AdConfig>;
  desktop: Record<string, AdConfig>;
}

let adSlotsCache: SlotsResponse | null = null;
let adSlotsFetchPromise: Promise<SlotsResponse> | null = null;

const EMPTY_RESPONSE: SlotsResponse = { mobile: {}, desktop: {} };

export function fetchAdSlots(): Promise<SlotsResponse> {
  if (!canLoadDesktopAds()) return Promise.resolve(EMPTY_RESPONSE);
  if (adSlotsCache) return Promise.resolve(adSlotsCache);
  if (adSlotsFetchPromise) return adSlotsFetchPromise;

  adSlotsFetchPromise = fetch('/api/ads/slots')
    .then((res) => (res.ok ? res.json() : EMPTY_RESPONSE))
    .then((data: SlotsResponse) => {
      if (!canLoadDesktopAds()) {
        adSlotsFetchPromise = null;
        return EMPTY_RESPONSE;
      }
      // Defensive: tolerate legacy flat response if Vercel-Cache spits
      // out an outdated copy briefly after deploy.
      const normalised: SlotsResponse =
        data && typeof data === 'object' && ('mobile' in data || 'desktop' in data)
          ? { mobile: data.mobile || {}, desktop: data.desktop || {} }
          : EMPTY_RESPONSE;
      adSlotsCache = normalised;
      adSlotsFetchPromise = null;
      return normalised;
    })
    .catch(() => {
      adSlotsFetchPromise = null;
      return EMPTY_RESPONSE;
    });

  return adSlotsFetchPromise;
}

/** Legacy name: all non-desktop devices are excluded, including tablets. */
export function isMobileViewport(): boolean {
  return !canLoadDesktopAds();
}

/**
 * Pick the slot config for a position based on the current viewport.
 * Returns null if no config exists for the current device — caller should
 * render nothing in that case.
 */
export function pickSlotForViewport(
  slots: SlotsResponse,
  position: string,
  mobile: boolean,
): AdConfig | null {
  if (mobile || !canLoadDesktopAds()) return null;
  const slot = slots.desktop[position];
  return slot && slot.device === 'desktop' && !slot.mobileOnly ? slot : null;
}
