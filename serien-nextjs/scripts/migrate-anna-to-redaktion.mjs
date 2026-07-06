/**
 * One-shot migration: Anna Schneider (author_007) → Redaktion.
 *
 * - Legt "Redaktion"-User an (id `redaktion`)
 * - Zieht ALLE Artikel von author_007 auf Redaktion um
 * - Legt 301-Redirect /autor/anna-schneider → /autor/redaktion an
 * - Löscht Anna Schneider (author_007) aus `users`
 *
 * Idempotent: Doppelter Aufruf ist ungefährlich.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-anna-to-redaktion.mjs           # DRY-RUN
 *   node --env-file=.env scripts/migrate-anna-to-redaktion.mjs --execute # WIRKLICH ANWENDEN
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');

const REDAKTION = {
  id: 'redaktion',
  name: 'Redaktion',
  email: 'redaktion@serien.de',
  role: 'author',
  image: null,
  bio: 'Die Redaktion von serien.de – kuratierte News, Analysen und Reviews aus dem Serienuniversum.',
  fullBio:
    '<p>Die serien.de-Redaktion versammelt die Beiträge unseres Teams unter einer gemeinsamen Kennung. Hier erscheinen redaktionell verantwortete Meldungen, Übersichten und aktualisierte Beiträge, die nicht einem einzelnen Autor zugeordnet sind. Alle Inhalte werden nach den redaktionellen Richtlinien von serien.de recherchiert und geprüft.</p>',
  expertise: [],
};

const log = (msg) => console.log(`[migrate-anna] ${msg}`);
const step = (n, title) => console.log(`\n──[ Step ${n}: ${title} ]${'─'.repeat(Math.max(0, 60 - title.length))}`);

async function main() {
  log(`Mode: ${EXECUTE ? 'EXECUTE (writing to DB)' : 'DRY-RUN (no writes)'}`);

  // ── Step 1: Check Anna
  step(1, 'Anna Schneider (author_007) laden');
  const anna = await p.users.findUnique({ where: { id: 'author_007' } });
  if (!anna) {
    log('author_007 nicht gefunden — nichts zu migrieren. Exit.');
    return;
  }
  log(`Gefunden: ${anna.name} <${anna.email}>`);
  const annaArticleCount = await p.articles.count({ where: { authorId: 'author_007' } });
  log(`Artikel von Anna: ${annaArticleCount}`);

  // ── Step 2: Redaktion-User anlegen
  step(2, 'Redaktion-User anlegen (upsert)');
  const existing = await p.users.findUnique({ where: { id: REDAKTION.id } });
  if (existing) {
    log(`Redaktion existiert bereits: ${existing.id}`);
  } else {
    log(`Wird neu angelegt: id=${REDAKTION.id}, name=${REDAKTION.name}`);
    if (EXECUTE) {
      await p.users.create({
        data: {
          ...REDAKTION,
          createdAt: new Date(),
        },
      });
      log('✅ Redaktion-User erstellt');
    }
  }

  // ── Step 3: Artikel umziehen
  step(3, 'Artikel von author_007 → redaktion umziehen');
  log(`Umzuziehen: ${annaArticleCount} Artikel`);
  if (EXECUTE) {
    const res = await p.articles.updateMany({
      where: { authorId: 'author_007' },
      data: { authorId: REDAKTION.id },
    });
    log(`✅ ${res.count} Artikel umgezogen`);
  } else {
    log('(dry-run: nicht ausgeführt)');
  }

  // ── Step 4: 301-Redirect anlegen
  step(4, '301-Redirect /autor/anna-schneider → /autor/redaktion');
  const existingRedirect = await p.redirects.findUnique({ where: { fromPath: '/autor/anna-schneider' } });
  if (existingRedirect) {
    log(`Redirect existiert bereits: ${existingRedirect.fromPath} → ${existingRedirect.toPath}`);
  } else if (EXECUTE) {
    await p.redirects.create({
      data: {
        fromPath: '/autor/anna-schneider',
        toPath: '/autor/redaktion',
        type: 301,
        createdAt: new Date(),
      },
    });
    log('✅ Redirect angelegt');
  } else {
    log('(dry-run: würde angelegt werden)');
  }

  // ── Step 5: Anna löschen
  step(5, 'Anna Schneider (author_007) aus users löschen');
  // Sanity-Check: keine Artikel mehr, keine sonstigen Referenzen
  const remaining = await p.articles.count({ where: { authorId: 'author_007' } });
  const comments = await p.comments.count({ where: { userId: 'author_007' } });
  const follows = await p.follows.count({ where: { userId: 'author_007' } });
  const notifs = await p.notifications.count({ where: { userId: 'author_007' } });
  log(`Verbleibende Refs: articles=${remaining}, comments=${comments}, follows=${follows}, notifications=${notifs}`);
  if (remaining > 0 && EXECUTE) {
    log('⚠️  Es gibt noch Artikel-Refs — Löschen würde diese kaskadierend entfernen. ABBRUCH.');
    return;
  }
  if (EXECUTE) {
    await p.users.delete({ where: { id: 'author_007' } });
    log('✅ Anna Schneider gelöscht');
  } else {
    log('(dry-run: nicht ausgeführt)');
  }

  step(6, 'Fertig');
  log(EXECUTE ? '✅ Migration abgeschlossen.' : '💡 Dry-Run ok. Erneut mit --execute starten.');
}

main()
  .catch((e) => {
    console.error('[migrate-anna] FEHLER:', e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
