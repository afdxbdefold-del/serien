import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET all ad slots
export async function GET() {
  try {
    const adSlots = await prisma.ad_slots.findMany({
      orderBy: { position: 'asc' }
    });
    return NextResponse.json(adSlots);
  } catch (error) {
    console.error('Error fetching ad slots:', error);
    return NextResponse.json({ error: 'Failed to fetch ad slots' }, { status: 500 });
  }
}

// POST create or update ad slot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { position, name, description, adClient, adSlot, width, height, isActive, mobileOnly, desktopOnly } = body;

    if (!position || !name || !adSlot || !width || !height) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adSlotRecord = await prisma.ad_slots.upsert({
      where: { position },
      update: {
        name,
        description,
        adClient: adClient || 'ca-pub-8583619451045805',
        adSlot,
        width: parseInt(width),
        height: parseInt(height),
        isActive: isActive ?? true,
        mobileOnly: mobileOnly ?? false,
        desktopOnly: desktopOnly ?? false,
      },
      create: {
        position,
        name,
        description,
        adClient: adClient || 'ca-pub-8583619451045805',
        adSlot,
        width: parseInt(width),
        height: parseInt(height),
        isActive: isActive ?? true,
        mobileOnly: mobileOnly ?? false,
        desktopOnly: desktopOnly ?? false,
      },
    });

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ad slot:', error);
    return NextResponse.json({ error: 'Failed to delete ad slot' }, { status: 500 });
  }
}
