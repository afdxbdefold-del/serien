import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const arts = await p.articles.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    select: { title: true },
    take: 100,
  });

  // Formula patterns in headlines
  const patterns: Record<string, RegExp> = {
    '"Erst X, jetzt Y" / "Früher X, jetzt Y"': /\b(erst|früher)\s+.{1,25},\s*jetzt\b/i,
    '"Doch noch…"':                             /\bdoch\s+noch\b/i,
    '"Offiziell:…"':                            /^offiziell[:\s]/i,
    '"Jetzt bestätigt:…"':                       /^jetzt\s+bestätigt/i,
    '"Plötzlich…"':                              /\bplötzlich\b/i,
    '"Trotz…" / "Ausgerechnet…"':                /\b(trotz|ausgerechnet)\b/i,
    '"Niemand/Keiner…"':                         /\b(niemand|keiner)\b/i,
    'Rotten Tomatoes / %-Score':                 /(rotten\s*tomatoes|\d{2,3}\s*%|\b10\/10\b)/i,
    'Top N / Platz N / #N':                      /(top\s*\d|platz\s*\d|#\d|beste[rns]?\b)/i,
    '"Millionen sahen…" / Viewership-Zahl':      /(\d+\s*millionen|\bzuschauer\b|sahen|streaming-hit|globaler\s*hit)/i,
    '"Staffel N…" im Titel':                     /(staffel\s*\d|season\s*\d)/i,
    '"Bestätigt" irgendwo':                      /\bbestätigt/i,
  };

  const counts: Record<string, number> = {};
  for (const name of Object.keys(patterns)) counts[name] = 0;
  for (const a of arts) {
    for (const [name, rx] of Object.entries(patterns)) {
      if (rx.test(a.title || '')) counts[name]++;
    }
  }

  console.log(`=== Headline-Formel-Analyse über ${arts.length} Artikel ===\n`);
  const rows = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  for (const [name, n] of rows) {
    const pct = (n/arts.length*100).toFixed(0);
    const bar = '█'.repeat(Math.round(n/arts.length*40));
    console.log(`${pct.padStart(3)}% (${String(n).padStart(3)}) ${bar} ${name}`);
  }

  // Anzahl Titel die MINDESTENS 1 Formel matchen
  const anyMatch = arts.filter(a => Object.values(patterns).some(rx => rx.test(a.title||''))).length;
  console.log(`\nTitel mit mindestens 1 Formel: ${anyMatch}/${arts.length} (${(anyMatch/arts.length*100).toFixed(0)}%)`);

  await p.$disconnect();
})();
