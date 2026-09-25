'use client';

/**
 * TheMoneytizer Recommended-Content Widget — HARDCODED.
 *
 * Format 16 (Outbrain-Style Content Recommendations). Snippet vom
 * TMN-Dashboard:
 *
 *   <div class="outbrain-tm" id="141665-16">
 *     <script src="//ads.themoneytizer.com/s/gen.js?type=16"></script>
 *     <script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=16"></script>
 *   </div>
 *
 * Genau wie bei CornerVideoTMN nutzen wir `injectHtmlWithScripts` weil
 * <script>-Tags aus innerHTML nicht ausgeführt werden. Injection läuft
 * EINMAL pro Mount — TheMoneytizer's SDK managed URL-Changes intern.
 *
 * Rendert im 1000-px-Content-Container mit Abstand nach oben/unten, damit
 * das Widget optisch abgesetzt vor dem Footer sitzt.
 */

import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';
import { canLoadDesktopAds } from '@/lib/desktop-ads';
import DesktopOnlyAds from './DesktopOnlyAds';

const TMN_RECOMMENDED_HTML = `<div class="outbrain-tm" id="141665-16"><script src="//ads.themoneytizer.com/s/gen.js?type=16"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=16"></script></div>`;

function RecommendedContentTMNInner() {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    const container = ref.current;
    if (!container || injected.current || !canLoadDesktopAds()) return;
    injectHtmlWithScripts(container, TMN_RECOMMENDED_HTML);
    injected.current = true;
    return () => {
      container.innerHTML = '';
      injected.current = false;
    };
  }, []);

  return (
    <section
      aria-label="Empfohlene Inhalte"
      className="hidden lg:block w-full py-8 lg:py-10"
      data-tmn-slot="recommended-content-16"
    >
      <div className="max-w-[1000px] mx-auto px-4">
        <div ref={ref} />
      </div>
    </section>
  );
}

// Still deliberately unmounted by the application; do not re-enable this ad.
export default function RecommendedContentTMN() {
  return <DesktopOnlyAds><RecommendedContentTMNInner /></DesktopOnlyAds>;
}
