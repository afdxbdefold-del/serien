'use client';

/**
 * TheMoneytizer Corner-Video Slot — HARDCODED.
 *
 * Vorher via DB-Slot `desktop_corner_video` gerendert. Jetzt fest im Code:
 * TheMoneytizer siteId=141665, formatId=38. Der Code entspricht dem
 * offiziellen Snippet vom Ad-Network-Dashboard:
 *
 *   <div id="141665-38">
 *     <script src="//ads.themoneytizer.com/s/gen.js?type=38"></script>
 *     <script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=38"></script>
 *   </div>
 *
 * WICHTIG:
 * - Wir setzen den HTML-Blob nicht via dangerouslySetInnerHTML — dann würden
 *   die <script>-Tags NIE feuern (Browser-Standard). Stattdessen unser
 *   `injectHtmlWithScripts()` das die Scripts als frische DOM-Nodes
 *   rekonstruiert und anhängt.
 * - Bei SPA-Navigation (Next.js Route-Change) NICHT re-injecten — TheMoneytizer
 *   hängt sich mit `#141665-38` an einen festen Container. Das erste Mount
 *   pro Session reicht. Deshalb `useEffect(...,[])` mit leerem Dep-Array.
 */

import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';

const TMN_CORNER_VIDEO_HTML = `<div id="141665-38"><script src="//ads.themoneytizer.com/s/gen.js?type=38"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=38"></script></div>`;

export default function CornerVideoTMN() {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (!ref.current || injected.current) return;
    injectHtmlWithScripts(ref.current, TMN_CORNER_VIDEO_HTML);
    injected.current = true;
  }, []);

  return <div ref={ref} data-tmn-slot="corner-video-38" />;
}
