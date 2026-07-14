'use client';

/**
 * TheMoneytizer Billboard (Format 31, 970×250) — Global Top Banner.
 *
 * Hardcoded snippet:
 *   <div style="text-align:center;" id="141665-31">
 *     <script src="//ads.themoneytizer.com/s/gen.js?type=31"></script>
 *     <script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=31"></script>
 *   </div>
 */
import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';

const HTML = `<div style="text-align:center;" id="141665-31"><script src="//ads.themoneytizer.com/s/gen.js?type=31"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=31"></script></div>`;

export default function TMNBillboard() {
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
      className="hidden lg:flex w-full justify-center pt-4 pb-2 px-4"
      aria-label="Werbung Billboard"
      data-tmn-slot="billboard-31"
    >
      <div ref={ref} />
    </div>
  );
}
