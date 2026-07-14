'use client';

/**
 * TheMoneytizer In-Text Ad (Format 11).
 *
 * Wird innerhalb des Artikel-Body-Contents zwischen zwei Absätzen eingebaut.
 * Client-side injiziert — TMN kümmert sich um Größe/Positionierung.
 *
 * <div id="141665-11">
 *   <script src="//ads.themoneytizer.com/s/gen.js?type=11"></script>
 *   <script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=11"></script>
 * </div>
 */
import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';

const HTML = `<div id="141665-11"><script src="//ads.themoneytizer.com/s/gen.js?type=11"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=11"></script></div>`;

export default function TMNInText({ className = '' }: { className?: string }) {
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
      className={`hidden md:flex justify-center my-8 ${className}`}
      data-tmn-slot="in-text-11"
      aria-label="Werbung In-Text"
    >
      <div ref={ref} />
    </div>
  );
}
