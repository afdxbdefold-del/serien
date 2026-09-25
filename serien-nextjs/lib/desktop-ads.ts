import policy from '../public/desktop-ads-policy';

export const DESKTOP_ADS_MEDIA_QUERY = policy.mediaQuery;

/** Never infer desktop during SSR or from viewport width alone. */
export function canLoadDesktopAds(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
    && policy.canLoadDesktopAds(window, navigator);
}

export function subscribeDesktopAds(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  try {
    const media = window.matchMedia(DESKTOP_ADS_MEDIA_QUERY);
    const update = () => onChange();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', update);
    else media.addListener(update);
    window.addEventListener('pageshow', update);
    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', update);
      else media.removeListener(update);
      window.removeEventListener('pageshow', update);
    };
  } catch {
    return () => {};
  }
}
