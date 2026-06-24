/**
 * One-shot DB cleanup: sets `profilePath` + `localProfilePath` to NULL for ALL
 * person rows. Required by ticket „Bereinigung der Personen- und Schauspieler-
 * seiten" (Juni 2026) — Vermeidung von Urheberrechtsverletzungen.
 *
 * Run: npx tsx scripts/bereinige-personenbilder.ts
 * Wiederholungs-sicher (idempotent) — kann beliebig oft ohne Schaden laufen.
 */
import prisma from '../lib/prisma';

async function main() {
  console.log('🧹 Lösche profilePath + localProfilePath aus allen persons-Rows …');

  // Wie viele Rows haben aktuell noch ein Bild gesetzt?
  const before = await prisma.persons.count({
    where: {
      OR: [
        { profilePath: { not: null } },
        { localProfilePath: { not: null } },
      ],
    },
  });
  console.log(`   📊 Rows mit Bild-Daten VORHER: ${before}`);

  const result = await prisma.persons.updateMany({
    where: {
      OR: [
        { profilePath: { not: null } },
        { localProfilePath: { not: null } },
      ],
    },
    data: { profilePath: null, localProfilePath: null },
  });

  console.log(`   ✅ Gesetzt auf NULL: ${result.count} Rows`);

  const after = await prisma.persons.count({
    where: {
      OR: [
        { profilePath: { not: null } },
        { localProfilePath: { not: null } },
      ],
    },
  });
  console.log(`   📊 Rows mit Bild-Daten NACHHER: ${after}`);

  if (after !== 0) {
    console.error('   ❌ FEHLER: Nach Cleanup verbleiben Rows mit Bild-Daten!');
    process.exit(1);
  }
  console.log('🎉 Fertig. Alle Person-Bildpfade entfernt.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
