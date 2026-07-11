/**
 * Seed-Script: Legt die 3 neuen Ad-Slots für /news/ an:
 *
 *   1. news_billboard_top       (Desktop 970×250) ← klont desktop_billboard_header
 *   2. news_infeed              (Desktop 300×250) ← klont in_content
 *   3. desktop_sidebar_megasky_2 (Desktop 300×600) ← klont desktop_sidebar_halfpage
 *
 * Slots werden mit `provider='custom'` + demselben `customHtmlJson` wie
 * das jeweilige Quell-Slot angelegt, damit sie SOFORT rendern und Ads
 * ausliefern (gleicher CPM/Fillrate wie das Quell-Slot). Der User kann
 * sie später im Admin (/admin/ads) mit dedizierten Codes ersetzen falls
 * das Ad-Netzwerk unterschiedliche Slot-IDs pro Placement empfiehlt.
 *
 * Idempotent: Bei erneutem Lauf wird der bestehende Slot NUR aktualisiert
 * wenn `--force` gesetzt ist, sonst bleibt er unangetastet.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const p = new PrismaClient();
const force = process.argv.includes('--force');

const clones = [
  {
    from: 'desktop_billboard_header',
    to: 'news_billboard_top',
    name: '/news · Billboard über Filter-Pills',
    description: 'Above-Fold Billboard direkt unter dem Cyan-Hero, über den Filter-Pills. Nur /news/.',
    width: 970,
    height: 250,
  },
  {
    from: 'in_content',
    to: 'news_infeed',
    name: '/news · In-Feed Ad-Card',
    description: 'Erscheint alle 6 Cards inline im /news-Grid, visuell wie eine NewsCard.',
    width: 300,
    height: 250,
  },
  {
    from: 'desktop_sidebar_halfpage',
    to: 'desktop_sidebar_megasky_2',
    name: '/news · Sidebar Megasky #2',
    description: 'Zweiter 300×600 unter dem bestehenden Halfpage in der Sidebar (löst sich beim Scrollen aus dem sticky Stack).',
    width: 300,
    height: 600,
  },
];

async function main() {
  for (const c of clones) {
    const src = await p.ad_slots.findUnique({
      where: { position_device: { position: c.from, device: 'desktop' } },
    });
    if (!src) {
      console.log(`⚠️  Quell-Slot ${c.from} (desktop) nicht gefunden — überspringe ${c.to}`);
      continue;
    }

    const existing = await p.ad_slots.findUnique({
      where: { position_device: { position: c.to, device: 'desktop' } },
    });
    if (existing && !force) {
      console.log(`✓ ${c.to} existiert bereits (isActive=${existing.isActive}) — skip (--force zum Überschreiben)`);
      continue;
    }

    const payload = {
      position: c.to,
      device: 'desktop',
      name: c.name,
      description: c.description,
      provider: src.provider,
      adClient: src.adClient,
      adSlot: src.adSlot,
      customHtmlJson: src.customHtmlJson,
      rotationMode: src.rotationMode,
      width: c.width,
      height: c.height,
      isActive: true,
      mobileOnly: false,
      desktopOnly: true,
      updatedAt: new Date(),
    };

    if (existing) {
      await p.ad_slots.update({
        where: { id: existing.id },
        data: payload,
      });
      console.log(`↻ ${c.to} aktualisiert (aus ${c.from})`);
    } else {
      await p.ad_slots.create({
        data: { id: randomUUID(), ...payload },
      });
      console.log(`+ ${c.to} angelegt (Clone von ${c.from}) → aktiv`);
    }
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
