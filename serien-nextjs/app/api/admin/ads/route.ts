import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidateTag } from 'next/cache';

type CustomVariant = {
  label?: string;
  html?: string;
  weight?: number;
  isActive?: boolean;
};

const VALID_DEVICES = new Set(['mobile', 'desktop']);

const isValidDevice = (raw: unknown): raw is 'mobile' | 'desktop' =>
  typeof raw === 'string' && VALID_DEVICES.has(raw);

// GET all ad slots (both devices). Admin UI gruppiert clientseitig nach
// `device`. Frontend für die Live-Seite holt sich Slots über
// /api/ads/slots (siehe app/api/ads/slots/route.ts).
export async function GET() {
  try {
    const adSlots = await prisma.ad_slots.findMany({
      orderBy: [{ device: 'asc' }, { position: 'asc' }],
    });
    const decorated = adSlots.map((s) => {
      let customHtmlVariants: CustomVariant[] = [];
      if (s.customHtmlJson) {
        try {
          const parsed = JSON.parse(s.customHtmlJson);
          if (Array.isArray(parsed)) customHtmlVariants = parsed;
        } catch {
          customHtmlVariants = [];
        }
      }
      return { ...s, customHtmlVariants };
    });
    return NextResponse.json(decorated);
  } catch (error) {
    console.error('Error fetching ad slots:', error);
    return NextResponse.json({ error: 'Failed to fetch ad slots' }, { status: 500 });
  }
}

// POST create or update ad slot. Eindeutigkeit: (position, device).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      position, name, description,
      provider,
      adClient, adSlot,
      customHtmlVariants,
      rotationMode,
      width, height, isActive,
    } = body;
    // Device-Default ist 'mobile' wenn KEIN device-Feld geschickt wurde
    // (Back-compat für alten Admin-Client). Wenn explizit gesetzt aber
    // ungültig → 400.
    let device: 'mobile' | 'desktop';
    if (body.device === undefined || body.device === null) {
      device = 'mobile';
    } else if (isValidDevice(body.device)) {
      device = body.device;
    } else {
      return NextResponse.json({ error: 'device muss mobile oder desktop sein' }, { status: 400 });
    }

    if (!position || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!VALID_DEVICES.has(device)) {
      return NextResponse.json({ error: 'device muss mobile oder desktop sein' }, { status: 400 });
    }

    const resolvedProvider = 'custom' as const;

    // AdSense wurde Feb 2026 komplett aus der Seite entfernt. Nur noch
    // Custom-HTML-Slots (TheMoneytizer, Plista, Outbrain, Direct-Deals)
    // sind zulässig. Ein explizit gesetztes provider='adsense' wird hier
    // hart abgewiesen — sonst würde die Admin-UI stillschweigend Slots
    // anlegen, die nirgends mehr ausgeliefert werden.
    if (provider === 'adsense') {
      return NextResponse.json({ error: 'AdSense wurde vollständig entfernt. Nur provider="custom" ist zulässig.' }, { status: 400 });
    }

    let customHtmlJson: string | null = null;
    if (!Array.isArray(customHtmlVariants) || customHtmlVariants.length === 0) {
      return NextResponse.json({ error: 'Custom-Provider braucht mindestens ein HTML-Variant' }, { status: 400 });
    }
    const hasAnyHtml = (customHtmlVariants as CustomVariant[]).some((v) => v?.html?.trim());
    if (!hasAnyHtml) {
      return NextResponse.json({ error: 'Mindestens ein Variant braucht HTML-Inhalt' }, { status: 400 });
    }
    customHtmlJson = JSON.stringify(customHtmlVariants);

    const now = new Date();
    const baseData = {
      name,
      description,
      provider: resolvedProvider,
      adClient: adClient || '',
      adSlot: adSlot || '',
      customHtmlJson,
      rotationMode: ['random', 'weighted', 'first'].includes(rotationMode) ? rotationMode : 'random',
      width: Number.isFinite(parseInt(width)) ? parseInt(width) : 300,
      height: Number.isFinite(parseInt(height)) ? parseInt(height) : 250,
      isActive: isActive ?? true,
      // Backwards-compat-Felder: aus `device` abgeleitet, damit alter Code
      // der noch `mobileOnly`/`desktopOnly` liest weiter funktioniert.
      mobileOnly: device === 'mobile',
      desktopOnly: device === 'desktop',
      updatedAt: now,
    };

    const adSlotRecord = await prisma.ad_slots.upsert({
      where: { position_device: { position, device } },
      update: baseData,
      create: {
        id: `ad_${position}_${device}_${Date.now()}`,
        position,
        device,
        ...baseData,
      },
    });

    revalidateTag('ad-slots');
    return NextResponse.json(adSlotRecord);
  } catch (error) {
    console.error('Error saving ad slot:', error);
    return NextResponse.json({ error: 'Failed to save ad slot' }, { status: 500 });
  }
}

// DELETE ad slot — braucht position UND device, sonst würde der
// gegenseitige Slot mitgelöscht.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position');
    const rawDevice = searchParams.get('device');

    if (!position) {
      return NextResponse.json({ error: 'Position required' }, { status: 400 });
    }
    // DELETE muss device EXPLIZIT bekommen — sonst würde der
    // gegenseitige Slot mitgelöscht (destruktiv). Fehlender device-Param
    // → 400.
    if (rawDevice === null) {
      return NextResponse.json({ error: 'device-Parameter erforderlich (mobile|desktop)' }, { status: 400 });
    }
    if (!isValidDevice(rawDevice)) {
      return NextResponse.json({ error: 'device muss mobile oder desktop sein' }, { status: 400 });
    }
    const device = rawDevice;

    await prisma.ad_slots
      .delete({ where: { position_device: { position, device } } })
      .catch(() => null);

    revalidateTag('ad-slots');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ad slot:', error);
    return NextResponse.json({ error: 'Failed to delete ad slot' }, { status: 500 });
  }
}
