/**
 * Social-Referrer Fraud/Truth-Classifier.
 *
 * Erkennt aus HTTP-Signalen, ob ein Request mit angeblichem Social-Referrer
 * (Facebook, X/Twitter, Instagram, TikTok, …) wahrscheinlich ECHT oder
 * SPOOFED ist. Rein signalbasiert, kein External-API-Call, Edge-runtime-safe.
 *
 * Kernidee: Echte Social-Klicks laufen fast IMMER durch einen Redirect-Host
 * oder haben charakteristische In-App-Webview-User-Agents. Spoofer setzen
 * dagegen nackte Domain-Referrer und rohe Chrome-/Safari-UAs.
 *
 * Wir loggen NUR (keine Blocks!) — der Wert dieser Klassifikation liegt in
 * der Analyse-Ansicht /admin/social-referrer.
 */

export type ClaimedSource =
  | 'facebook'
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'reddit'
  | 'linkedin'
  | 'pinterest'
  | 'youtube'
  | 'whatsapp'
  | 'telegram'
  | 'snapchat';

export type Verdict = 'real' | 'suspicious' | 'fake';

export type UaFamily =
  | 'fb-inapp'
  | 'ig-inapp'
  | 'tiktok-inapp'
  | 'twitter-inapp'
  | 'ios-safari'
  | 'ios-chrome'
  | 'android-chrome'
  | 'desktop-chrome'
  | 'desktop-firefox'
  | 'desktop-safari'
  | 'other';

export interface Classification {
  claimedSource: ClaimedSource;
  verdict: Verdict;
  country: string;
  uaFamily: UaFamily;
  /** Pipe-getrennte Signal-Codes, warum wir dieses Verdict gewählt haben. */
  signalsKey: string;
}

const SOURCE_HOSTS: Array<{ source: ClaimedSource; hosts: string[] }> = [
  { source: 'facebook', hosts: ['facebook.com', 'l.facebook.com', 'm.facebook.com', 'lm.facebook.com', 'business.facebook.com', 'web.facebook.com'] },
  { source: 'x', hosts: ['x.com', 'twitter.com', 't.co', 'mobile.twitter.com', 'mobile.x.com'] },
  { source: 'instagram', hosts: ['instagram.com', 'l.instagram.com', 'www.instagram.com'] },
  { source: 'tiktok', hosts: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'] },
  { source: 'reddit', hosts: ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'redd.it', 'out.reddit.com'] },
  { source: 'linkedin', hosts: ['linkedin.com', 'www.linkedin.com', 'lnkd.in'] },
  { source: 'pinterest', hosts: ['pinterest.com', 'www.pinterest.com', 'pinterest.de', 'pin.it'] },
  { source: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'] },
  { source: 'whatsapp', hosts: ['whatsapp.com', 'wa.me', 'api.whatsapp.com', 'l.wl.co'] },
  { source: 'telegram', hosts: ['telegram.org', 't.me', 'telegram.me'] },
  { source: 'snapchat', hosts: ['snapchat.com', 'story.snapchat.com'] },
];

const DACH_COUNTRIES = new Set(['DE', 'AT', 'CH', 'LI', 'LU']);

function hostFromRef(ref: string): string | null {
  try {
    const u = new URL(ref);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pathFromRef(ref: string): string {
  try {
    return new URL(ref).pathname;
  } catch {
    return '';
  }
}

function matchSource(host: string): ClaimedSource | null {
  for (const { source, hosts } of SOURCE_HOSTS) {
    if (hosts.includes(host)) return source;
  }
  return null;
}

function detectUaFamily(ua: string): UaFamily {
  // In-App-Webviews haben eindeutige Marker — das ist ECHTER Social-Traffic.
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'fb-inapp';
  if (/Instagram/i.test(ua)) return 'ig-inapp';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok-inapp';
  if (/Twitter/i.test(ua)) return 'twitter-inapp';

  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  if (isMobile) {
    if (/iPhone|iPad|iPod/i.test(ua)) {
      if (/CriOS/i.test(ua)) return 'ios-chrome';
      if (/Safari/i.test(ua)) return 'ios-safari';
      return 'other';
    }
    if (/Chrome|Chromium/i.test(ua)) return 'android-chrome';
    return 'other';
  }
  // Desktop
  if (/Firefox/i.test(ua)) return 'desktop-firefox';
  if (/Edg\//i.test(ua)) return 'desktop-chrome'; // Edge ≈ Chromium
  if (/Chrome/i.test(ua)) return 'desktop-chrome';
  if (/Safari/i.test(ua)) return 'desktop-safari';
  return 'other';
}

/**
 * Klassifiziert einen Request. Liefert `null`, wenn der Referrer nicht
 * social ist (keine Log-Row nötig).
 */
export function classifySocialReferrer(
  referer: string,
  ua: string,
  headers: Headers,
  country: string,
): Classification | null {
  if (!referer) return null;
  const host = hostFromRef(referer);
  if (!host) return null;

  const source = matchSource(host);
  if (!source) return null;

  const refPath = pathFromRef(referer);
  const uaFamily = detectUaFamily(ua);
  const signals: string[] = [];

  // --- Signal 1: "Nackter Referrer" ---
  // Echte Klicks aus FB/IG/X gehen fast immer durch einen Redirect-Wrapper
  // mit Path (l.facebook.com/l.php, t.co/xxx, l.instagram.com/…). Wenn nur
  // die nackte Domain ohne Path als Referrer kommt, ist das ein starkes
  // Fake-Signal.
  const isBareRef = refPath === '' || refPath === '/';
  const bareRefRisky =
    (source === 'facebook' && host === 'facebook.com' && isBareRef) ||
    (source === 'x' && (host === 'x.com' || host === 'twitter.com') && isBareRef) ||
    (source === 'instagram' && host === 'instagram.com' && isBareRef) ||
    (source === 'tiktok' && (host === 'tiktok.com' || host === 'www.tiktok.com') && isBareRef);
  if (bareRefRisky) signals.push('bare_ref');

  // --- Signal 2: Sec-Fetch-* fehlt bei modernem Chromium-UA ---
  // Chrome/Edge/Opera senden IMMER `Sec-Fetch-Site` seit v76. Wenn die UA
  // sich als Chrome ausgibt, aber diese Header fehlen → curl/Bot-Impersonator.
  const secFetchSite = headers.get('sec-fetch-site');
  const secFetchDest = headers.get('sec-fetch-dest');
  const looksChromium = /Chrome|Chromium|Edg\//i.test(ua) && !/OPR\/|Opera/i.test(ua);
  if (looksChromium && !secFetchSite) signals.push('no_sfs');
  if (looksChromium && !secFetchDest) signals.push('no_sfd');

  // --- Signal 3: Accept-Language fehlt ---
  // Jeder echte Browser sendet Accept-Language. Curl/Puppeteer-Default nicht.
  const acceptLang = headers.get('accept-language');
  if (!acceptLang) signals.push('no_lang');

  // --- Signal 4: Client-Hints fehlen bei Chrome-Mobile ---
  // Chrome-Mobile sendet Sec-Ch-Ua-Mobile: ?1. Fehlt bei Bots.
  const secChUa = headers.get('sec-ch-ua');
  const secChUaMobile = headers.get('sec-ch-ua-mobile');
  if (looksChromium && !secChUa) signals.push('no_ch_ua');
  if (looksChromium && /Mobile/i.test(ua) && !secChUaMobile) signals.push('no_ch_mobile');

  // --- Signal 5: UA/Referrer-Mismatch ---
  // Nackter FB-Referrer aber KEIN FB-InApp-UA = suspicious. Echte mobile
  // FB-Klicks kommen aus dem In-App-Browser mit FBAN/FBAV.
  if (source === 'facebook' && bareRefRisky && uaFamily !== 'fb-inapp') signals.push('ua_mismatch_fb');
  if (source === 'instagram' && bareRefRisky && uaFamily !== 'ig-inapp') signals.push('ua_mismatch_ig');
  if (source === 'tiktok' && bareRefRisky && uaFamily !== 'tiktok-inapp') signals.push('ua_mismatch_tt');

  // --- Signal 6: Non-DACH-Land bei DACH-Site ---
  // serien.de ist rein DACH. Non-DACH mit Social-Referrer ist ungewöhnlich —
  // eigenständig kein Fake-Signal (Reisende gibt's), aber kombiniert Gewicht.
  if (country && !DACH_COUNTRIES.has(country.toUpperCase())) signals.push('country_non_dach');

  // --- Score-Aggregation ---
  const weights: Record<string, number> = {
    bare_ref: 25,
    no_sfs: 20,
    no_sfd: 10,
    no_lang: 15,
    no_ch_ua: 8,
    no_ch_mobile: 8,
    ua_mismatch_fb: 20,
    ua_mismatch_ig: 20,
    ua_mismatch_tt: 20,
    country_non_dach: 5,
  };
  const score = signals.reduce((s, code) => s + (weights[code] ?? 0), 0);

  // --- Overrides: Echte Signal-Nachweise ---
  // In-App-UA + passender Ref-Host = quasi garantiert echt.
  const uaProvesReal =
    (source === 'facebook' && uaFamily === 'fb-inapp') ||
    (source === 'instagram' && uaFamily === 'ig-inapp') ||
    (source === 'tiktok' && uaFamily === 'tiktok-inapp') ||
    (source === 'x' && uaFamily === 'twitter-inapp');

  // t.co-Redirect ist X's einziger legitimer Klick-Path (Standard-Verhalten).
  const refProvesReal =
    (source === 'x' && host === 't.co') ||
    (source === 'facebook' && host === 'l.facebook.com') ||
    (source === 'instagram' && host === 'l.instagram.com');

  let verdict: Verdict;
  if (uaProvesReal || refProvesReal) verdict = 'real';
  else if (score >= 45) verdict = 'fake';
  else if (score >= 20) verdict = 'suspicious';
  else verdict = 'real';

  return {
    claimedSource: source,
    verdict,
    country: (country || '').toUpperCase().slice(0, 4),
    uaFamily,
    signalsKey: signals.length ? signals.sort().join('|').slice(0, 120) : 'none',
  };
}
