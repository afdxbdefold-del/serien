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

const HTML = `<div id="141665-6"><script src="//ads.themoneytizer.com/s/gen.js?type=6"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=6"></script></div>`;

export default function TMNSlideInFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return;
    if (!ref.current || injected.current) return;
    injectHtmlWithScripts(ref.current, HTML);
    injected.current = true;
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
