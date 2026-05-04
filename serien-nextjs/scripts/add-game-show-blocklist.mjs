import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const entries = [
  {
    label: 'Wheel of Fortune (Game Show)',
    titleKeywords: ['wheel of fortune', 'celebrity wheel of fortune'],
    urlPatterns: ['wheel-of-fortune'],
    note: 'US Game Show — TMDB liefert leere Genres, daher hartes Block. Keine DACH-Streaming-Relevanz.',
  },
  {
    label: 'Jeopardy! (Game Show)',
    titleKeywords: ['jeopardy!', 'jeopardy '],
    urlPatterns: ['jeopardy'],
    note: 'US Game Show — keine DACH-Streaming-Relevanz.',
  },
  {
    label: 'The Price Is Right (Game Show)',
    titleKeywords: ['the price is right', 'price is right'],
    urlPatterns: ['price-is-right'],
    note: 'US Game Show — keine DACH-Streaming-Relevanz.',
  },
  {
    label: 'Family Feud (Game Show)',
    titleKeywords: ['family feud', 'celebrity family feud'],
    urlPatterns: ['family-feud'],
    note: 'US Game Show — keine DACH-Streaming-Relevanz.',
  },
];

for (const e of entries) {
  // Check if already exists by label
  const existing = await prisma.blocklist_entries.findFirst({ where: { label: e.label } });
  if (existing) {
    console.log(`SKIP (exists): ${e.label}`);
    continue;
  }
  const created = await prisma.blocklist_entries.create({
    data: {
      label: e.label,
      titleKeywords: e.titleKeywords,
      urlPatterns: e.urlPatterns,
      tmdbIds: [],
      enabled: true,
      note: e.note,
    },
  });
  console.log(`CREATED: ${created.label} (id=${created.id})`);
}

const total = await prisma.blocklist_entries.count({ where: { enabled: true } });
console.log(`\nTotal enabled blocklist entries: ${total}`);

await prisma.$disconnect();
