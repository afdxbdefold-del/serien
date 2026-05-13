import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidateTag } from 'next/cache';

// GET all ad slots
export async function GET() {
  try {
    const adSlots = await prisma.ad_slots.findMany({
      orderBy: { position: 'asc' }
    });
    // Parse customHtmlJson into an array on the way out so the admin UI
    // can edit it directly without re-parsing.
    const decorated = adSlots.map((s) => {
      let customHtmlVariants: any[] = [];
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

// POST create or update ad slot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      position, name, description,
      provider,
      adClient, adSlot,
      customHtmlVariants,
      rotationMode,
      width, height, isActive, mobileOnly, desktopOnly,
    } = body;

    if (!position || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resolvedProvider = provider === 'custom' ? 'custom' : 'adsense';

    // Provider-specific validation: AdSense requires a slot ID, custom
    // requires at least one variant with non-empty html.
    if (resolvedProvider === 'adsense' && !adSlot) {
      return NextResponse.json({ error: 'AdSense-Provider braucht eine Slot-ID' }, { status: 400 });
    }
    let customHtmlJson: string | null = null;
    if (resolvedProvider === 'custom') {
      if (!Array.isArray(customHtmlVariants) || customHtmlVariants.length === 0) {
        return NextResponse.json({ error: 'Custom-Provider braucht mindestens ein HTML-Variant' }, { status: 400 });
      }
      const hasAnyHtml = customHtmlVariants.some((v: any) => v?.html?.trim());
      if (!hasAnyHtml) {
        return NextResponse.json({ error: 'Mindestens ein Variant braucht HTML-Inhalt' }, { status: 400 });
      }
      customHtmlJson = JSON.stringify(customHtmlVariants);
    }

    const now = new Date();
    const baseData = {
      name,
      description,
      provider: resolvedProvider,
      adClient: adClient || 'ca-pub-8583619451045805',
      adSlot: adSlot || '',
      customHtmlJson,
      rotationMode: ['random', 'weighted', 'first'].includes(rotationMode) ? rotationMode : 'random',
      width: parseInt(width) || 300,
      height: parseInt(height) || 250,
      isActive: isActive ?? true,
      mobileOnly: mobileOnly ?? false,
      desktopOnly: desktopOnly ?? false,
      updatedAt: now,
    };

    const adSlotRecord = await prisma.ad_slots.upsert({
      where: { position },
      update: baseData,
      create: {
        id: `ad_${position}_${Date.now()}`,
        position,
        ...baseData,
      },
    });

    // Invalidate the public /api/ads/slots cache so changes go live
    // within seconds instead of waiting for the 5-min revalidate window.
    revalidateTag('ad-slots');

    return NextResponse.json(adSlotRecord);
  } catch (error) {
    console.error('Error saving ad slot:', error);
    return NextResponse.json({ error: 'Failed to save ad slot' }, { status: 500 });
  }
}

// DELETE ad slot
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position');

    if (!position) {
      return NextResponse.json({ error: 'Position required' }, { status: 400 });
    }

    await prisma.ad_slots.delete({
      where: { position }
    });

    revalidateTag('ad-slots');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ad slot:', error);
    return NextResponse.json({ error: 'Failed to delete ad slot' }, { status: 500 });
  }
}
