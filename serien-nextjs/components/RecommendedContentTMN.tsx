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

const TMN_RECOMMENDED_HTML = `<div class="outbrain-tm" id="141665-16"><script src="//ads.themoneytizer.com/s/gen.js?type=16"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=16"></script></div>`;

export default function RecommendedContentTMN() {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    // Mobile-Sperre: KEINE Ads/Recommendations auf Mobile
    // (User-Vorgabe Feb 2026). Widget ist Desktop-only.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return;
    if (!ref.current || injected.current) return;
    injectHtmlWithScripts(ref.current, TMN_RECOMMENDED_HTML);
    injected.current = true;
  }, []);

  return (
    <section
      aria-label="Empfohlene Inhalte"
      className="hidden md:block w-full py-8 md:py-10"
      data-tmn-slot="recommended-content-16"
    >
      <div className="max-w-[1000px] mx-auto px-4">
        <div ref={ref} />
      </div>
    </section>
  );
}
