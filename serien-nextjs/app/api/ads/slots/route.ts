import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

type CustomVariant = { label?: string; html?: string; weight?: number; isActive?: boolean };

interface PublicSlot {
  provider: 'custom';
  customHtmlVariants?: CustomVariant[];
  rotationMode: string;
  width: number;
  height: number;
  /**
   * Device der Konfiguration. Backward-compat-Felder mobileOnly/desktopOnly
   * werden aus device abgeleitet, damit alter Code (z.B. ClientAdSlot vor
   * dem Refactor) weiter funktioniert während wir den Frontend-Code
   * migrieren.
   */
  device: 'mobile' | 'desktop';
  mobileOnly: boolean;
  desktopOnly: boolean;
}

const getCachedAdSlots = unstable_cache(
  async () => {
    return prisma.ad_slots.findMany({
      where: { isActive: true },
    });
  },
  ['ad-slots'],
  { revalidate: 300, tags: ['ad-slots'] },
);

/**
 * Public Endpoint für Frontend-Slot-Lookups.
 *
 * Response-Shape (NEU mit Mobile/Desktop-Trennung):
 *   {
 *     mobile:  { [position]: PublicSlot },
 *     desktop: { [position]: PublicSlot },
 *   }
 *
 * Der Client (ClientAdSlot, MobileTopAd …) erkennt den Viewport per
 * `matchMedia('(max-width: 767px)')` und greift dann auf die jeweilige
 * Map zu. Wenn eine Position für ein Device gar nicht konfiguriert
 * wurde, rendert ClientAdSlot nichts (return null).
 */
export async function GET() {
  try {
    const adSlots = await getCachedAdSlots();
    const out: { mobile: Record<string, PublicSlot>; desktop: Record<string, PublicSlot> } = {
      mobile: {},
      desktop: {},
    };
    for (const slot of adSlots) {
      // AdSense wurde Feb 2026 komplett entfernt — Legacy-DB-Zeilen mit
      // provider='adsense' werden übersprungen, sodass sie nichts mehr
      // ausliefern.
      if (slot.provider !== 'custom') continue;
      const device: 'mobile' | 'desktop' = slot.device === 'desktop' ? 'desktop' : 'mobile';
      let customHtmlVariants: CustomVariant[] | undefined;
      if (slot.customHtmlJson) {
        try {
          const parsed = JSON.parse(slot.customHtmlJson);
          if (Array.isArray(parsed)) customHtmlVariants = parsed;
        } catch {
          customHtmlVariants = undefined;
        }
      }
      out[device][slot.position] = {
        provider: 'custom',
        customHtmlVariants,
        rotationMode: slot.rotationMode || 'random',
        width: slot.width,
        height: slot.height,
        device,
        mobileOnly: device === 'mobile',
        desktopOnly: device === 'desktop',
      };
    }
    return NextResponse.json(out, {
      headers: {
        // Vercel Edge Network cached diese Response für 5 min. Bei Cache-Hit
        // läuft die Function GAR NICHT — spart ~90 % Function Invocations
        // dieser Route (bei ~200k Client-Aufrufen/Tag: von 200k → ~500/Tag).
        // Kein Ad-Revenue-Risiko: die Slot-Config enthält keine User-Daten,
        // und die eigentliche Ad-Auktion läuft im TheMoneytizer-Client-JS.
        // Bei Admin-Änderung: max. 5 min Propagations-Delay (akzeptabel).
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    console.error('Error fetching ad slots:', error);
    return NextResponse.json({ mobile: {}, desktop: {} }, { status: 200 });
  }
}
