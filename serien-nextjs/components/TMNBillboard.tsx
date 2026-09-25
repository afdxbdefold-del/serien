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
import { canLoadDesktopAds } from '@/lib/desktop-ads';
import DesktopOnlyAds from './DesktopOnlyAds';

const HTML = `<div style="text-align:center;" id="141665-31"><script src="//ads.themoneytizer.com/s/gen.js?type=31"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=31"></script></div>`;

function TMNBillboardInner() {
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
      className="hidden lg:flex w-full justify-center pt-4 pb-2 px-4"
      aria-label="Werbung Billboard"
      data-tmn-slot="billboard-31"
    >
      <div ref={ref} />
    </div>
  );
}

export default function TMNBillboard() {
  return <DesktopOnlyAds><TMNBillboardInner /></DesktopOnlyAds>;
}
