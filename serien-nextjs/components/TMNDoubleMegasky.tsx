'use client';

/**
 * TheMoneytizer Double Megasky Floating (Format 20) — fixed rechts,
 * z-index sehr hoch. Positionierung kommt aus dem eingebetteten <style>
 * (sas_26706 → position:fixed; right:0; top:90px).
 *
 * Nur ab Desktop (≥ lg = 1024 px) sinnvoll, weil bei kleineren Viewports
 * mit Content-Overlap. Zusätzlich gilt die gemeinsame Desktop-Geräteprüfung.
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
import { canLoadDesktopAds } from '@/lib/desktop-ads';
import DesktopOnlyAds from './DesktopOnlyAds';

const HTML = `<style>@media (min-width: 1024px) { #sas_26706 { position: fixed; right: 0px; top: 90px; z-index: 99999999;}}</style><div id="141665-20"><script src="//ads.themoneytizer.com/s/gen.js?type=20"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=20"></script></div>`;

function TMNDoubleMegaskyInner() {
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
      className="hidden lg:block"
      aria-label="Werbung Double Megasky"
      data-tmn-slot="double-megasky-20"
    >
      <div ref={ref} />
    </div>
  );
}

export default function TMNDoubleMegasky() {
  return <DesktopOnlyAds><TMNDoubleMegaskyInner /></DesktopOnlyAds>;
}
