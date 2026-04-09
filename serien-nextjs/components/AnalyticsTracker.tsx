'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

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

  return { category: 'referral', name: new URL(referrer).hostname.replace('www.', '') };
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

export default function AnalyticsTracker() {
  const pathname = usePathname();
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

    const source = classifySource(document.referrer);

    trackEvent({
      event: 'page_view',
      path: pathname,
      referrer: document.referrer || undefined,
      sourceCategory: source.category,
      sourceName: source.name,
      articleId,
      seriesId,
    });
  }, [pathname]);

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

    // Calculate engagement: low / medium / high
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
