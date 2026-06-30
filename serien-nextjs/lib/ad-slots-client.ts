/**
 * Shared client-side helper to fetch ad slot configurations once per page
 * load and pick the correct slot based on viewport (mobile <768px vs.
 * desktop ≥768px).
 *
 * Backend returns `/api/ads/slots` in shape:
 *   { mobile: { [position]: AdConfig }, desktop: { [position]: AdConfig } }
 *
 * Two breakpoints exist in code (LayoutWrapper uses md:hidden = 768px,
 * ClientAdSlot historically used 1024px). We standardise on Tailwind's
 * `md` breakpoint = 768px so the served slot matches what `md:hidden`
 * containers actually show. Anything below 768px = mobile.
 */
import type { AdVariant } from '@/lib/ad-html-injector';

export interface AdConfig {
  provider: 'adsense' | 'custom';
  adClient: string;
  adSlot: string;
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
  if (adSlotsCache) return Promise.resolve(adSlotsCache);
  if (adSlotsFetchPromise) return adSlotsFetchPromise;

  adSlotsFetchPromise = fetch('/api/ads/slots')
    .then((res) => (res.ok ? res.json() : EMPTY_RESPONSE))
    .then((data: SlotsResponse) => {
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

/** True when viewport is < 768px (Tailwind `md` breakpoint). */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
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
  const bucket = mobile ? slots.mobile : slots.desktop;
  return bucket[position] || null;
}
