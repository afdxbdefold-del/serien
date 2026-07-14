'use client';

/**
 * TheMoneytizer Sidebar-Slot — generisches HTML-Snippet-Injection.
 *
 * Nutzt `injectHtmlWithScripts` weil <script>-Tags aus innerHTML nicht
 * ausgeführt werden. Injection läuft EINMAL pro Mount — TheMoneytizer's
 * SDK managed URL-Changes intern.
 *
 * Nur Desktop (≥ md = 768 px), analog aller anderen TMN/Yieldlab-Slots.
 * Mobile-Sperre per matchMedia zusätzlich zur CSS-Regel, damit auf Mobile
 * gar kein Script geladen wird.
 *
 * Verwendung:
 *   <TMNSidebarSlot formatId={2} label="MPU Top" />
 *   <TMNSidebarSlot formatId={4} label="Skyscraper" />
 */

import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';

interface Props {
  /** TheMoneytizer Format-ID — z.B. 2 (MPU 300×250) oder 4 (Skyscraper 300×600) */
  formatId: number;
  /** aria-label für die <section> */
  label: string;
  /** Optional Tailwind-Klassen für den Wrapper (z.B. sticky positioning) */
  className?: string;
}

const SITE_ID = 141665;

export default function TMNSidebarSlot({ formatId, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return;
    if (!ref.current || injected.current) return;
    const html = `<div id="${SITE_ID}-${formatId}"><script src="//ads.themoneytizer.com/s/gen.js?type=${formatId}"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=${SITE_ID}&formatId=${formatId}"></script></div>`;
    injectHtmlWithScripts(ref.current, html);
    injected.current = true;
  }, [formatId]);

  return (
    <div
      aria-label={label}
      data-tmn-slot={`sidebar-${formatId}`}
      className={className ?? 'hidden md:block'}
    >
      <div ref={ref} />
    </div>
  );
}
