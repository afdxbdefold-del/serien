'use client';

import { useEffect, useRef, useCallback, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let visitorId = localStorage.getItem('_vid');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('_vid', visitorId);
  }
  return visitorId;
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem('_sid');
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('_sid', sessionId);
  }
  return sessionId;
}

/** (a) Parse UTM parameters from URL */
function getUtmParams(): { source?: string; medium?: string; campaign?: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (!source && !medium && !campaign) return null;
  return {
    source: source || undefined,
    medium: medium || undefined,
    campaign: campaign || undefined,
  };
}

/** (b) Read server-side referrer from cookie set by middleware */
function getServerReferrer(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)_ssref=([^;]*)/);
  if (match) {
    // Clear cookie after reading (one-time use)
    document.cookie = '_ssref=; path=/; max-age=0';
    return decodeURIComponent(match[1]);
  }
  return '';
}

/** (d) Check if middleware detected Discover via User-Agent */
function getServerSourceHint(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)_ssrc=([^;]*)/);
  if (match) {
    document.cookie = '_ssrc=; path=/; max-age=0';
    return match[1];
  }
  return null;
}

/** (e) First-touch attribution — store original source */
function getFirstTouchSource(): { category: string; name: string } | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem('_fts');
  if (stored) {
    try { return JSON.parse(stored); } catch { return null; }
  }
  return null;
}

function setFirstTouchSource(source: { category: string; name: string }) {
  if (typeof localStorage === 'undefined') return;
  if (!localStorage.getItem('_fts')) {
    localStorage.setItem('_fts', JSON.stringify(source));
  }
}

/** Map UTM medium to source category */
function utmToCategory(utm: { source?: string; medium?: string }): { category: string; name: string } {
  const source = (utm.source || '').toLowerCase();
  const medium = (utm.medium || '').toLowerCase();

  if (source === 'google' && medium === 'discover') return { category: 'discover', name: 'Google Discover' };
  if (source === 'google' && medium === 'news') return { category: 'google_news', name: 'Google News' };
  if (medium === 'cpc' || medium === 'ppc') return { category: 'paid_search', name: utm.source || 'Paid' };
  if (medium === 'social' || medium === 'social-media') return { category: 'social', name: utm.source || 'Social' };
  if (medium === 'email' || medium === 'newsletter') return { category: 'email', name: utm.source || 'E-Mail' };
  if (medium === 'referral') return { category: 'referral', name: utm.source || 'Referral' };
  if (source === 'facebook' || source === 'fb') return { category: 'social', name: 'Facebook' };
  if (source === 'instagram') return { category: 'social', name: 'Instagram' };
  if (source === 'twitter' || source === 'x') return { category: 'social', name: 'X (Twitter)' };
  if (source === 'whatsapp') return { category: 'messaging', name: 'WhatsApp' };
  if (source === 'telegram') return { category: 'messaging', name: 'Telegram' };

  return { category: 'campaign', name: utm.source || 'Kampagne' };
}

/** Classify traffic source from referrer URL */
function classifySource(referrer: string): { category: string; name: string } {
  if (!referrer) return { category: 'direct', name: 'Direkt' };

  const r = referrer.toLowerCase();

  // Google Discover / Google App
  if (r.includes('googleapis.com') || r.includes('google.com/discover') || r.includes('com.google.android.googlequicksearchbox')) {
    return { category: 'discover', name: 'Google Discover' };
  }
  // Google News
  if (r.includes('news.google') || r.includes('google.com/news')) {
    return { category: 'google_news', name: 'Google News' };
  }
  // Google Search
  if (r.includes('google.') && !r.includes('news') && !r.includes('discover')) {
    return { category: 'organic_search', name: 'Google Suche' };
  }
  // Bing
  if (r.includes('bing.com')) return { category: 'organic_search', name: 'Bing' };
  // DuckDuckGo
  if (r.includes('duckduckgo')) return { category: 'organic_search', name: 'DuckDuckGo' };
  // Ecosia
  if (r.includes('ecosia')) return { category: 'organic_search', name: 'Ecosia' };
  // Yahoo
  if (r.includes('search.yahoo')) return { category: 'organic_search', name: 'Yahoo' };
  // Startpage
  if (r.includes('startpage')) return { category: 'organic_search', name: 'Startpage' };
  // Brave
  if (r.includes('search.brave')) return { category: 'organic_search', name: 'Brave' };
  // Yandex
  if (r.includes('yandex')) return { category: 'organic_search', name: 'Yandex' };

  // Social Media
  if (r.includes('facebook.com') || r.includes('fb.com') || r.includes('l.facebook') || r.includes('m.facebook')) {
    return { category: 'social', name: 'Facebook' };
  }
  if (r.includes('instagram.com') || r.includes('l.instagram')) return { category: 'social', name: 'Instagram' };
  if (r.includes('twitter.com') || r.includes('t.co') || r.includes('x.com')) return { category: 'social', name: 'X (Twitter)' };
  if (r.includes('reddit.com')) return { category: 'social', name: 'Reddit' };
  if (r.includes('tiktok.com')) return { category: 'social', name: 'TikTok' };
  if (r.includes('linkedin.com')) return { category: 'social', name: 'LinkedIn' };
  if (r.includes('youtube.com') || r.includes('youtu.be')) return { category: 'social', name: 'YouTube' };
  if (r.includes('pinterest.com') || r.includes('pin.it')) return { category: 'social', name: 'Pinterest' };

  // Messaging
  if (r.includes('whatsapp.com') || r.includes('wa.me')) return { category: 'messaging', name: 'WhatsApp' };
  if (r.includes('t.me') || r.includes('telegram')) return { category: 'messaging', name: 'Telegram' };

  // Aggregators
  if (r.includes('flipboard.com')) return { category: 'aggregator', name: 'Flipboard' };
  if (r.includes('upday.com')) return { category: 'aggregator', name: 'Upday' };
  if (r.includes('newsbreak')) return { category: 'aggregator', name: 'NewsBreak' };
  if (r.includes('opera.com') || r.includes('opera-mini')) return { category: 'aggregator', name: 'Opera News' };
  if (r.includes('smartnews')) return { category: 'aggregator', name: 'SmartNews' };

  // Internal
  if (r.includes('serien.de')) return { category: 'internal', name: 'Intern' };

  try {
    return { category: 'referral', name: new URL(referrer).hostname.replace('www.', '') };
  } catch {
    return { category: 'referral', name: referrer.substring(0, 40) };
  }
}

/**
 * Determine traffic source with priority:
 * 1. UTM params (highest priority — explicit campaign tagging)
 * 2. Server-side Discover hint from User-Agent (middleware cookie)
 * 3. Server-side Referrer (middleware cookie — more reliable)
 * 4. Client-side document.referrer (fallback)
 */
function determineSource(): { category: string; name: string; method: string; utm?: object } {
  // (a) UTM parameters — highest priority
  const utm = getUtmParams();
  if (utm) {
    const src = utmToCategory(utm);
    return { ...src, method: 'utm', utm };
  }

  // (d) Server-side Discover detection via User-Agent
  const serverHint = getServerSourceHint();
  if (serverHint === 'discover') {
    return { category: 'discover', name: 'Google Discover', method: 'ua_hint' };
  }

  // (b) Server-side referrer from middleware cookie
  const serverRef = getServerReferrer();
  if (serverRef) {
    const src = classifySource(serverRef);
    return { ...src, method: 'server_ref' };
  }

  // Fallback: client-side document.referrer
  const clientRef = document.referrer || '';
  const src = classifySource(clientRef);
  return { ...src, method: 'client_ref' };
}

interface TrackEventData {
  event: string;
  path: string;
  referrer?: string;
  duration?: number;
  scrollDepth?: number;
  articleId?: string;
  seriesId?: string;
  sourceCategory?: string;
  sourceName?: string;
  metadata?: Record<string, any>;
}

async function trackEvent(data: TrackEventData) {
  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    if (!visitorId || !sessionId) return;

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, sessionId, ...data }),
      keepalive: true,
    });
  } catch {
    // Silent fail
  }
}

function AnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startTime = useRef<number>(Date.now());
  const maxScroll = useRef<number>(0);
  const lastPath = useRef<string>('');

  // Track page view on route change
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    startTime.current = Date.now();
    maxScroll.current = 0;

    let articleId: string | undefined;
    let seriesId: string | undefined;

    if (pathname.match(/^\/[a-z0-9-]+$/) && !pathname.startsWith('/serie') && !pathname.startsWith('/figur') && !pathname.startsWith('/person')) {
      articleId = pathname.slice(1);
    }
    if (pathname.startsWith('/serie/')) seriesId = pathname.replace('/serie/', '');

    const source = determineSource();

    // (e) Store first-touch attribution
    if (source.category !== 'direct' && source.category !== 'internal') {
      setFirstTouchSource({ category: source.category, name: source.name });
    }

    const firstTouch = getFirstTouchSource();

    trackEvent({
      event: 'page_view',
      path: pathname,
      referrer: document.referrer || undefined,
      sourceCategory: source.category,
      sourceName: source.name,
      articleId,
      seriesId,
      metadata: {
        detectionMethod: source.method,
        ...(source.utm ? { utm: source.utm } : {}),
        ...(firstTouch ? { firstTouch } : {}),
      },
    });
  }, [pathname, searchParams]);

  // Track scroll depth (throttled)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
          maxScroll.current = Math.max(maxScroll.current, Math.round((window.scrollY / scrollHeight) * 100));
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement;
      if (!link || !link.href.includes('serien.de') || link.href === window.location.href) return;

      const linkType = link.closest('[data-testid="breadcrumb"]') ? 'breadcrumb'
        : link.closest('.series-card, [data-testid*="series"]') ? 'series_card'
        : link.closest('article, .content') ? 'inline_link'
        : link.closest('nav') ? 'navigation'
        : 'other';

      trackEvent({
        event: 'internal_click',
        path: pathname,
        metadata: { targetUrl: link.pathname, linkType },
      });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  // Track page exit with engagement data
  const sendExit = useCallback(() => {
    const duration = Math.round((Date.now() - startTime.current) / 1000);
    const scroll = maxScroll.current;

    let engagement = 'low';
    if (scroll >= 75 && duration >= 60) engagement = 'high';
    else if (scroll >= 25 && duration >= 15) engagement = 'medium';

    navigator.sendBeacon('/api/analytics/track', JSON.stringify({
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      event: 'page_exit',
      path: pathname,
      duration,
      scrollDepth: scroll,
      metadata: { engagement },
    }));
  }, [pathname]);

  useEffect(() => {
    window.addEventListener('beforeunload', sendExit);
    return () => window.removeEventListener('beforeunload', sendExit);
  }, [sendExit]);

  // Heartbeat every 30s
  useEffect(() => {
    const heartbeat = setInterval(() => {
      trackEvent({ event: 'heartbeat', path: pathname });
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [pathname]);

  return null;
}

export default function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerInner />
    </Suspense>
  );
}
