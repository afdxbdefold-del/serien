'use client';

/**
 * TheMoneytizer Slide-in Footer (Format 6) — fixed am unteren Bildschirm,
 * volle Breite, zentriert. Kommt "reingeschoben" wenn User scrollt.
 *
 * Hardcoded snippet:
 *   <div id="141665-6">
 *     <script src="//ads.themoneytizer.com/s/gen.js?type=6"></script>
 *     <script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=6"></script>
 *   </div>
 */
import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';
import { canLoadDesktopAds } from '@/lib/desktop-ads';
import DesktopOnlyAds from './DesktopOnlyAds';

const HTML = `<div id="141665-6"><script src="//ads.themoneytizer.com/s/gen.js?type=6"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=6"></script></div>`;

function TMNSlideInFooterInner() {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    const container = ref.current;
    if (!container || injected.current || !canLoadDesktopAds()) return;
    injectHtmlWithScripts(container, HTML);
    injected.current = true;
    return () => {
      container.innerHTML = '';
      injected.current = false;
    };
  }, []);

  return (
    <div
      className="hidden lg:flex fixed bottom-0 left-0 right-0 z-30 justify-center pointer-events-auto"
      aria-label="Werbung Footer Slide-in"
      data-tmn-slot="slide-in-6"
    >
      <div ref={ref} />
    </div>
  );
}

export default function TMNSlideInFooter() {
  return <DesktopOnlyAds><TMNSlideInFooterInner /></DesktopOnlyAds>;
}
