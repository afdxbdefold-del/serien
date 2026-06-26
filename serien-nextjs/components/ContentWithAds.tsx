'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { injectHtmlWithScripts, pickAdVariant, AdVariant } from '@/lib/ad-html-injector';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface ContentWithAdsProps {
  html: string;
  className?: string;
}

interface AdConfig {
  provider?: 'adsense' | 'custom';
  adClient: string;
  adSlot: string;
  customHtmlVariants?: AdVariant[];
  rotationMode?: 'random' | 'weighted' | 'first';
  width: number;
  height: number;
}

/**
 * Renders article content with ads inserted after every 2nd paragraph.
 * Route-aware: re-injects ads on SPA navigation via usePathname().
 */
export default function ContentWithAds({ 
  html, 
  className = ''
}: ContentWithAdsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adConfig, setAdConfig] = useState<AdConfig | null>(null);
  const pathname = usePathname();

  // Fetch ad config once
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/ads/slots');
        if (res.ok) {
          const slots = await res.json();
          const inContentConfig = slots['in_content'];
          if (inContentConfig) {
            setAdConfig(inContentConfig);
          }
        }
      } catch (error) {
        console.error('Failed to load in-content ad config:', error);
      }
    };
    loadConfig();
  }, []);

  // Inject ads whenever html changes OR pathname changes (SPA navigation)
  useEffect(() => {
    if (!containerRef.current || !adConfig) return;

    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Remove previously injected ads first
    const oldAds = containerRef.current.querySelectorAll('.content-ad-unit');
    oldAds.forEach(el => el.remove());

    // Find all paragraphs and insert ads
    const paragraphs = containerRef.current.querySelectorAll('p');
    let paragraphCount = 0;
    let adsInserted = 0;
    const maxAds = 2;
    const insertEveryNth = 4;
    const timers: ReturnType<typeof setTimeout>[] = [];

    paragraphs.forEach((el) => {
      paragraphCount++;

      if (paragraphCount % insertEveryNth === 0 && adsInserted < maxAds) {
        const adContainer = document.createElement('div');
        adContainer.className = 'content-ad-unit not-prose';
        adContainer.setAttribute('data-ad-position', 'in_content');
        // overflow:hidden verhindert horizontales Auslaufen, falls ein Creative
        // doch breiter als der Container rendern will.
        adContainer.style.cssText = `display:block;padding:10px 0;text-align:center;overflow:hidden;`;

        if (adConfig.provider === 'custom') {
          const variants = adConfig.customHtmlVariants || [];
          const picked = pickAdVariant(variants, adConfig.rotationMode || 'random');
          if (picked) {
            el.after(adContainer);
            injectHtmlWithScripts(adContainer, picked.html);
            adsInserted++;
          }
          return;
        }

        // Standard responsive Display-Ad-Pattern (data-ad-format=auto +
        // data-full-width-responsive=true). Funktioniert mit JEDEM
        // AdSense-Slot-Typ (Display, In-article, In-feed) und passt sich
        // automatisch der Container-Breite an. Kein Cutoff, kein fixed-size
        // fallback. Genau das, was WordPress-Themes auch tun.
        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', adConfig.adClient);
        ins.setAttribute('data-ad-slot', adConfig.adSlot);
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
        adContainer.appendChild(ins);

        el.after(adContainer);

        // Stagger push calls to avoid overwhelming AdSense
        const delay = 300 + (adsInserted * 150);
        const timer = setTimeout(() => {
          try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } catch (e) {
            // AdSense push error
          }
        }, delay);
        timers.push(timer);

        adsInserted++;
      }
    });

    // Unfilled-Slot-Cleanup: AdSense markiert nicht gefüllte <ins>-Elemente
    // mit data-ad-status="unfilled". Wir entfernen diese Wrapper komplett,
    // damit kein riesiges leeres Loch im Artikel zurückbleibt. Wichtig vor
    // allem bei mehrfacher Verwendung derselben Custom-HTML-Variante: nur
    // ein Slot füllt sich, die anderen 3 würden sonst als unsichtbare aber
    // raumfressende Container im Layout stehen.
    const cleanupTimer = setTimeout(() => {
      if (!containerRef.current) return;
      const wrappers = containerRef.current.querySelectorAll<HTMLElement>('.content-ad-unit');
      wrappers.forEach((wrapper) => {
        const insEl = wrapper.querySelector<HTMLElement>('ins.adsbygoogle');
        if (!insEl) return;
        const status = insEl.getAttribute('data-ad-status');
        const iframe = insEl.querySelector<HTMLIFrameElement>('iframe');
        const iframeHeight = iframe?.offsetHeight ?? 0;
        // Entfernen wenn AdSense explizit unfilled meldet ODER der iframe
        // 0 px hoch geblieben ist (kein Creative geladen).
        if (status === 'unfilled' || (iframe && iframeHeight === 0)) {
          wrapper.remove();
        }
      });
    }, 3000);
    timers.push(cleanupTimer);

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [html, adConfig, pathname]);

  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
