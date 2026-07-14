'use client';

/**
 * TheMoneytizer Double Megasky Floating (Format 20) — fixed rechts,
 * z-index sehr hoch. Positionierung kommt aus dem eingebetteten <style>
 * (sas_26706 → position:fixed; right:0; top:90px).
 *
 * Nur ab Desktop (≥ lg = 1024 px) sinnvoll, weil bei kleineren Viewports
 * mit Content-Overlap. Zusätzlich matchMedia-Check im Widget.
 *
 * Hardcoded snippet:
 *   <style>@media (min-width: 1024px) { #sas_26706 { position: fixed; right: 0px; top: 90px; z-index: 99999999;}}</style>
 *   <div id="141665-20">
 *     <script src="//ads.themoneytizer.com/s/gen.js?type=20"></script>
 *     <script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=20"></script>
 *   </div>
 */
import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';

const HTML = `<style>@media (min-width: 1024px) { #sas_26706 { position: fixed; right: 0px; top: 90px; z-index: 99999999;}}</style><div id="141665-20"><script src="//ads.themoneytizer.com/s/gen.js?type=20"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=20"></script></div>`;

export default function TMNDoubleMegasky() {
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
      className="hidden lg:block"
      aria-label="Werbung Double Megasky"
      data-tmn-slot="double-megasky-20"
    >
      <div ref={ref} />
    </div>
  );
}
