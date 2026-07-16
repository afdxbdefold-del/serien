'use client';

/**
 * Megabanner-Ads (TheMoneytizer Format 1 + 28) — hardgecodet.
 *
 *   • ThemePageAdTop    → Format 1  (728×90 zentriert, direkt unter dem Billboard)
 *   • ThemePageAdBottom → Format 28 (728×90 zentriert, direkt vor dem Footer-Bereich)
 *
 * Werden im LayoutWrapper auf ALLEN Public-Seiten (nicht Legal/Admin) gerendert.
 * Der Namen-Prefix "ThemePage…" ist historisch — sie laufen jetzt überall.
 */
import { useEffect, useRef } from 'react';
import { injectHtmlWithScripts } from '@/lib/ad-html-injector';

const TOP_HTML = `<div id="141665-1"><script src="//ads.themoneytizer.com/s/gen.js?type=1"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=1"></script></div>`;
const BOTTOM_HTML = `<div id="141665-28"><script src="//ads.themoneytizer.com/s/gen.js?type=28"></script><script src="//ads.themoneytizer.com/s/requestform.js?siteId=141665&formatId=28"></script></div>`;

function TMNMegabanner({ html, label, formatId, containerCls }: { html: string; label: string; formatId: number; containerCls: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return;
    if (!ref.current || injected.current) return;
    injectHtmlWithScripts(ref.current, html);
    injected.current = true;
  }, [html]);

  return (
    <div
      className={containerCls}
      aria-label={label}
      data-tmn-slot={`megabanner-${formatId}`}
    >
      <div ref={ref} />
    </div>
  );
}

export function ThemePageAdTop() {
  return (
    <TMNMegabanner
      html={TOP_HTML}
      label="Werbung Megabanner Top"
      formatId={1}
      containerCls="hidden lg:flex w-full max-w-[1000px] mx-auto justify-center pt-4 pb-2 px-4"
    />
  );
}

export function ThemePageAdBottom() {
  return (
    <TMNMegabanner
      html={BOTTOM_HTML}
      label="Werbung Megabanner Bottom"
      formatId={28}
      containerCls="hidden lg:flex w-full justify-center pt-6 pb-4 px-4"
    />
  );
}
