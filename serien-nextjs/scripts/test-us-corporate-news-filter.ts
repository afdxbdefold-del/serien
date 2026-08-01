/**
 * Smoke test for us-corporate-news-filter.
 * Run: npx ts-node --transpile-only scripts/test-us-corporate-news-filter.ts
 */
import { checkUsCorporateNews } from '../lib/us-corporate-news-filter';

let pass = 0;
let fail = 0;

function expect(label: string, condition: boolean, hint?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${hint ? ' — ' + hint : ''}`);
    fail++;
  }
}

console.log('\n=== US-Corporate/Business-News-Filter ===\n');

// 1. Kern-Fall: AMC-Quartalskrise, Netflix nur Aufhänger
{
  const r = checkUsCorporateNews({
    headline:
      'Netflix verlängert The Walking Dead für 460 Mio. trotz AMC-Quartalskrise',
    body:
      'AMC Networks hat die Wall-Street-Erwartungen im zweiten Quartal verfehlt. ' +
      'Die Aktie fällt sechs Prozent, während Netflix die Rechte an The Walking Dead ' +
      'für 460 Millionen Dollar verlängert.',
    metaDescription:
      'AMC Global Media verfehlt die Wall-Street-Erwartungen im zweiten Quartal. ' +
      'Aktie fällt sechs Prozent, während The Walking Dead bei Netflix verlängert wird.',
    sourceTitle: 'AMC misses Wall Street expectations in Q2 2026',
  });
  expect(
    `AMC-Quartalskrise + Netflix-Aufhänger → blocked`,
    r.blocked,
    JSON.stringify(r.signals),
  );
}

// 2. Reine Show-News mit AMC-Erwähnung als Produzent → nicht blocken
{
  const r = checkUsCorporateNews({
    headline:
      'The Walking Dead: Daryl Dixon startet mit vierter Staffel bei Netflix',
    body:
      'Die von AMC produzierte Spin-off-Serie The Walking Dead: Daryl Dixon ' +
      'geht in die vierte Runde. Netflix zeigt die neuen Folgen ab November.',
  });
  expect(
    `Show-News ohne Börsen-Signal → nicht blocked`,
    !r.blocked,
    JSON.stringify(r.signals),
  );
}

// 3. Warner Bros. Discovery + Umsatzeinbruch → blocken
{
  const r = checkUsCorporateNews({
    headline: 'Warner Bros. Discovery meldet Umsatzeinbruch bei Streaming-Sparte',
    body:
      'Der Konzern Warner Bros. Discovery hat für das dritte Quartal einen Umsatzrückgang ' +
      'von 7 Prozent gemeldet. Anleger reagieren enttäuscht, die Aktie fällt.',
  });
  expect(
    `WBD + Umsatzeinbruch → blocked`,
    r.blocked,
    JSON.stringify(r.signals),
  );
}

// 4. Paramount Global + Fusionsgerüchte (kein Business-Signal aus unserer Liste) → nicht blocken
{
  const r = checkUsCorporateNews({
    headline: 'Paramount Global plant neue Zeichentrickserie',
    body:
      'Paramount Global kündigt eine neue Animationsserie an, die auf Paramount+ starten soll.',
  });
  expect(
    `Paramount + reine Content-News → nicht blocked`,
    !r.blocked,
    JSON.stringify(r.signals),
  );
}

// 5. Comcast/NBCUniversal + CEO tritt zurück → blocken
{
  const r = checkUsCorporateNews({
    headline: 'NBCUniversal: CEO tritt überraschend zurück',
    body:
      'Der langjährige NBCUniversal-Chef tritt zurück. Die Comcast-Aktie fällt in New York um 4 Prozent.',
  });
  expect(
    `NBCUniversal + CEO tritt zurück → blocked`,
    r.blocked,
    JSON.stringify(r.signals),
  );
}

// 6. Reine Netflix-Content-News → nicht blocken (kein US-Konzern-Subjekt)
{
  const r = checkUsCorporateNews({
    headline: 'Netflix bestätigt Staffel 5 von Stranger Things',
    body: 'Die finale Staffel startet im November. Netflix hat den Start heute bestätigt.',
  });
  expect(
    `Netflix-Content-News → nicht blocked`,
    !r.blocked,
    JSON.stringify(r.signals),
  );
}

// 7. AMC ohne Business-Signal → nicht blocken
{
  const r = checkUsCorporateNews({
    headline: 'AMC Networks kündigt Spin-off zu Interview with the Vampire an',
    body: 'AMC Networks erweitert das Anne-Rice-Universum um eine neue Serie.',
  });
  expect(
    `AMC ohne Börsen-Signal → nicht blocked`,
    !r.blocked,
    JSON.stringify(r.signals),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
