'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Generate or get visitor ID
function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  
  let visitorId = localStorage.getItem('_vid');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('_vid', visitorId);
  }
  return visitorId;
}

// Generate session ID (new per browser session)
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('_sid');
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('_sid', sessionId);
  }
  return sessionId;
}

interface TrackEventData {
  event: string;
  path: string;
  referrer?: string;
  duration?: number;
  scrollDepth?: number;
  articleId?: string;
  seriesId?: string;
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
      body: JSON.stringify({
        visitorId,
        sessionId,
        ...data,
      }),
      // Don't wait for response
      keepalive: true,
    });
  } catch (error) {
    // Silent fail - don't break user experience
    console.debug('Analytics tracking failed:', error);
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
    
    // Reset tracking for new page
    startTime.current = Date.now();
    maxScroll.current = 0;

    // Get article/series ID from URL if applicable
    let articleId: string | undefined;
    let seriesId: string | undefined;
    
    // Article pages are at root level with slug
    if (pathname.match(/^\/[a-z0-9-]+$/) && !pathname.startsWith('/serie') && !pathname.startsWith('/figur')) {
      articleId = pathname.slice(1);
    }
    // Series pages
    if (pathname.startsWith('/serie/')) {
      seriesId = pathname.replace('/serie/', '');
    }

    // Track page view
    trackEvent({
      event: 'page_view',
      path: pathname,
      referrer: document.referrer || undefined,
      articleId,
      seriesId,
    });
  }, [pathname]);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);
        maxScroll.current = Math.max(maxScroll.current, scrollPercent);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track time on page when leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      const duration = Math.round((Date.now() - startTime.current) / 1000);
      
      // Use sendBeacon for reliable tracking on page exit
      navigator.sendBeacon('/api/analytics/track', JSON.stringify({
        visitorId: getVisitorId(),
        sessionId: getSessionId(),
        event: 'page_exit',
        path: pathname,
        duration,
        scrollDepth: maxScroll.current,
      }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pathname]);

  // Heartbeat to keep session active
  useEffect(() => {
    const heartbeat = setInterval(() => {
      trackEvent({
        event: 'heartbeat',
        path: pathname,
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeat);
  }, [pathname]);

  return null; // This component doesn't render anything
}
