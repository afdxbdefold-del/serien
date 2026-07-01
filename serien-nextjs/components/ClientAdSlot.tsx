'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { injectHtmlWithScripts, pickAdVariant } from '@/lib/ad-html-injector';
import {
  fetchAdSlots,
  pickSlotForViewport,
  isMobileViewport,
  type AdConfig,
} from '@/lib/ad-slots-client';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface ClientAdSlotProps {
  position: string;
  className?: string;
}

/**
 * AdSlotInner: Creates fresh <ins> via raw DOM on every mount.
 * Because the parent uses key={pathname}, this fully remounts on SPA navigation.
 * Raw DOM ensures AdSense sees a truly new element without React attributes.
 */
function AdSlotInner({ config }: { config: AdConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');

    // Custom HTML provider (TheMoneytizer, Plista, Outbrain, AWIN, Belboon,
    // Direct-Deal Creatives, …): Code wird 1:1 so ausgeliefert wie er im
    // Admin gespeichert ist — KEIN iframe-Wrapping, KEINE forcierten Größen,
    // KEINE Style-Overrides. Slot-Maße aus dem Admin sind nur noch
    // organisatorische Metadaten (Übersicht im Admin-UI), sie werden nicht
    // mehr aufs DOM angewendet. Ad-Networks dimensionieren ihre Creatives
    // selbst über das gelieferte Markup. Daher auch auf Preview/Localhost
    // live ausgeführt (kein AdSense-Policy-Risiko bei Admin-kontrolliertem
    // Code).
    if (config.provider === 'custom') {
      const variants = config.customHtmlVariants || [];
      const picked = pickAdVariant(variants, config.rotationMode || 'random');
      if (picked) {
        injectHtmlWithScripts(container, picked.html);
      }
      return () => {
        container.innerHTML = '';
      };
    }

    // AdSense provider: auf Preview/Localhost SKIPPEN (Policy — AdSense
    // verbietet Test-Domains und kann das Konto sperren).
    if (!isProd) return;

    // AdSense provider: create fresh <ins> via raw DOM (not React JSX) so
    // adsbygoogle.push() always sees a clean, never-seen-before element.
    //
    // Minimal, AdSense-empfohlenes Pattern für Fixed-Size-Slots:
    //   - `<ins class="adsbygoogle" style="display:inline-block;width:Xpx;height:Ypx" data-ad-client data-ad-slot>`
    //   - KEIN `data-ad-format`-Attribut (weder leer noch gesetzt)
    //   - KEIN `data-full-width-responsive`-Attribut
    //   - KEIN forced Container-Layout
    // Diese Variante hat sich gegenüber jedem Hardening-Versuch als robuster
    // erwiesen — andere Slots laufen damit problemlos. AdSense entscheidet
    // basierend auf der Console-Slot-Konfiguration; Slot-Größen-Anomalien
    // (300×250 statt 300×600) müssen in der AdSense Console für die jeweilige
    // Slot-ID korrigiert werden, nicht im Code.
    container.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'inline-block';
    ins.style.width = `${config.width}px`;
    ins.style.height = `${config.height}px`;
    ins.setAttribute('data-ad-client', config.adClient);
    ins.setAttribute('data-ad-slot', config.adSlot);
    container.appendChild(ins);

    // Retry mechanism: wait for adsbygoogle to be available.
    // INP-optimiert: max 5 statt 20 Attempts + 500 ms Intervall statt
    // 200 ms — dämpft die Wahrscheinlichkeit, dass ein Retry-Task
    // exakt mit einem User-Tap kollidiert (Google misst dann die
    // gesamte Task-Länge als INP).
    let attempts = 0;
    const maxAttempts = 5;
    let retryTimer: ReturnType<typeof setTimeout>;
    const tryPush = () => {
      attempts++;
      if (typeof window.adsbygoogle !== 'undefined') {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          // AdSense errors are expected in some cases
        }
      } else if (attempts < maxAttempts) {
        retryTimer = setTimeout(tryPush, 500);
      }
    };

    retryTimer = setTimeout(tryPush, 500);

    return () => {
      clearTimeout(retryTimer);
      container.innerHTML = '';
    };
  }, [config]);

  return <div ref={containerRef} />;
}

/**
 * ClientAdSlot: Route-aware ad component that properly reloads ads on SPA navigation.
 * Uses key={pathname} on AdSlotInner to force complete unmount/remount on route change,
 * ensuring a fresh <ins> element and a fresh adsbygoogle.push() call.
 */
export default function ClientAdSlot({ position, className = '' }: ClientAdSlotProps) {
  const pathname = usePathname();
  const [config, setConfig] = useState<AdConfig | null>(null);

  useEffect(() => {
    const mobile = isMobileViewport();
    fetchAdSlots().then((slots) => {
      setConfig(pickSlotForViewport(slots, position, mobile));
    });
  }, [position]);

  if (!config) return null;

  // Dev-Mode-Placeholder NUR für AdSense — Custom-HTML (TheMoneytizer,
  // Plista, AWIN, …) ist User-kontrolliert und muss auch auf Preview/
  // Localhost live rendern, damit Integration (z.B. TheMoneytizer
  // iframe) getestet werden kann. AdSense bleibt im Preview gemockt
  // wegen Policy/Invalid-Traffic-Risiko.
  const isPreviewHost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname.includes('preview'));
  if (isPreviewHost && config.provider !== 'custom') {
    return (
      <div className={`ad-container flex justify-center ${className}`} data-ad-position={position} data-testid={`ad-slot-${position}`}>
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Werbeanzeige {config.device.toUpperCase()} ({config.width}x{config.height}) - {position}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-container flex justify-center ${className}`} data-ad-position={position} data-ad-device={config.device} data-testid={`ad-slot-${position}`}>
      <AdSlotInner key={`${pathname}-${position}`} config={config} />
    </div>
  );
}
