# Astra-News: lokaler Umbau und Abnahme

Stand: 21. September 2026, ausschließlich Branch `codex/takeover`.
Ausgangspunkt dieser Runde: `b04d34de634120f7a4636f04b31066ce796194b4`.
**Lokal umgesetzt, nicht gepusht oder ausgerollt.** Der vorherige Live-Audit
bleibt historischer Produktionsbeleg; ein erfolgreicher GPT-5.4-Probeaufruf
ist kein Nachweis für Astra-Zugriff oder redaktionelle Qualität.

## Verbindlicher redaktioneller Auftrag

Nur für Deutschland relevante Seriennachrichten. Keine lokale britische
Talkshow, kein isolierter US-Sendeplatz, keine Auslandsquote oder beliebiger
Prominentenklatsch. Eine bekannte Plattformmarke ist kein Deutschlandbeleg.

Die Schlussprüfung verlangt `germanyRelevance` samt exaktem Beleg:

- Originalquelle mit tatsächlichem Deutschlandbezug oder belastbarer
  weltweiter Veröffentlichung einschließlich Deutschlands; kein beliebiges
  Wort „global“ und keine ausdrücklich ausgeschlossenen deutschen Zuschauer.
- Alternativ: serverseitig beobachteter deutscher Katalogeintrag derselben
  Serie **und** wesentliche Casting-, Produktions-, Staffel-, Trailer- oder
  Serienpreis-Nachricht.
  Der Katalog beweist weder den Deutschlandstart noch den Anbieter neuer Folgen.
- Deutsche Seriencharts, Quoten und Rekorde brauchen einen Originalbeleg für
  den tatsächlichen deutschen Markt. Ein deutscher Katalogeintrag macht aus
  einem US-Rekord keine deutsche Chartmeldung.

Die Prüfung berücksichtigt den Nachrichtenkern. Ein beiläufiger deutscher
Katalogeintrag macht eine ausländische Talkshow-Gastankündigung oder lokale
Sendeplatzverschiebung nicht relevant. Fehlt der Beleg, bleibt die Freigabe
gesperrt, ohne mit einer Umschreibung einen Bezug hinzuzuerfinden. Dieselbe
Anforderung gilt bei der manuellen NEWS-Freigabe im Adminbereich.
Ein widersprüchliches altes Ranking-Kennzeichen darf eine ausdrücklich als
NEWS markierte Meldung nicht von dieser Prüfung ausnehmen.

## Aktive Kette

1. Pause, Laufsperre, Quellenwahl, vorhandene Artikel und Retry-Abstände prüfen.
2. Volltext direkt beim Originalanbieter lesen, Quelle und Datum prüfen.
3. Astra klassifiziert anhand der vollständigen Quelle; Serie wird gegen
   tatsächlichen Quelltext sowie beobachtete TMDB-Namen abgeglichen.
4. Vorhandene Meldungen zum konkreten Ereignis vergleichen; ähnliche Wörter
   oder dieselbe Serie allein bedeuten kein Duplikat.
5. Fakten extrahieren, ein vollständiges Artikelpaket schreiben.
6. Gesamtes Paket einschließlich Deutschlandbezug am Original prüfen;
   höchstens eine begründete Revision und erneute Prüfung.
7. Tatsächliches passendes Bild prüfen, freigegebenen Inhalt speichern,
   Cache aktualisieren und öffentliche Artikel-/Listenanzeige bestätigen.

Normalfall: vier Modellaufrufe, bei vorhandenen Vergleichsartikeln fünf.
Eine inhaltliche Revision ergänzt zwei Aufrufe. Begrenzte technische Retries
kommen gegebenenfalls hinzu. Fehlende Freigabe ist keine Veröffentlichung.

## Modell und Kompatibilität

News-Rollen verwenden zentral `gpt-6-astra`, `reasoning_effort: low`.
`low` ist der kompatible Ausgangspunkt für die bisher implizite Einstellung;
eine höhere Stufe erst anhand realer Qualität, Laufzeit und Kosten bewerten.
Keine Temperature-/Top-p-/Logprob-Parameter, keine Tools im Chat-Completions-
Textpfad. Strikte JSON-Schemas für Klassifikation, Ereignisvergleich, Fakten
und Review; Writer-Ausgaben werden auf Vollständigkeit geprüft.
Keine automatische Modell-, Konto- oder Provider-Ausweichlösung.

Budgets: Klassifikation/Dubletten je 4096, Writer 8192,
Fakten/Review/Revision je 12000 Completion-Tokens inklusive Reasoning.
Klassifikation/Dubletten je zwei explizite Versuche ohne SDK-Doppelretry;
bei 4xx/Verweigerung keine heuristische „Rettung“. Bestehende begrenzte
90-/120-Sekunden-Zeitlimits für die Redaktion bleiben erhalten.
Grundlage: [offizielle Astra-Migrationsanleitung](https://developers.openai.com/api/docs/guides/latest-model).

Bios, SEO, Bilder und manuell angeforderte Nicht-NEWS-Formate wurden nicht
pauschal auf das teurere News-Modell umgestellt. Der Diagnoseendpunkt prüft
dagegen ausdrücklich das konfigurierte News-Modell und gibt keine Rohfehler aus.

## Bereinigte Altlasten

- Die überlappenden pauschalen Keyword-/URL-Auslandsfilter wurden für NEWS
  entfernt. Explizite Serien-/Quellensperren einschließlich der vorhandenen
  US-Talkshow-Markenliste bleiben bestehen. Belegte Deutschlandrelevanz ist
  zusätzlich eine notwendige Freigabebedingung.
- Kein starres Fünf-Artikel-pro-Serie-Monatslimit; tägliche Kostenbegrenzung bleibt.
- Genre, altes Serienende oder „Untitled“ im Textanfang widerlegen keine neue Meldung.
- Kein Stop aufgrund ähnlicher Überschriften oder verlustbehafteter historischer
  Fakten-Fingerprints. Textähnlichkeit bleibt sichtbarer Hinweis, kein eigenständiger
  NEWS-Ablehnungsgrund. Ereignisduplikate und Originalquellenprüfung bleiben.
- „True Story“ oder „Ending Explained“ im Titel überschreibt eine belegte
  Nachrichtenklassifikation nicht mehr automatisch mit einem anderen Format.
- Keine stille Kürzung des Writer-Originals auf 24000 Zeichen und keine blinde
  Veränderung von Gedankenstrichen/Zitatzeichen in NEWS.
- P3/P4: keine zusätzlichen Quality-/Anti-AI-/TMDB-Fact-Safety-Modellaufrufe,
  kein toter Tone-Rewriter mit Emergent-Fallback und keine automatischen
  Charakter-/Cast-Bioimporte. TMDB-Handlungstexte sind keine Nachrichtenquelle.
  Beide Pfade bleiben Entwürfe mit ausdrücklich ausstehender Quellenprüfung.
- Alte Fehlentscheidungen entfernter Gates bleiben in der Laufhistorie erhalten,
  sind aber nach gewöhnlicher Abkühlzeit wieder prüfbar. Keine Datenbankbereinigung.

Explizite Quell-/Seriensperrlisten, Kosten- und Laufzeitgrenzen, eigene echte
Dubletten, sichere HTML-Verarbeitung, Bildnachweis, redaktionelle Freigabe und
öffentliche Sichtbarkeitskontrolle bleiben erhalten. Ruhende Legacy-Publisher,
SEO-/Releasekalender- und Videoqueue-Restbefunde aus `PIPELINE_PATH_INVENTORY.md`
sind nicht dadurch vollständig modernisiert oder für Automatik freigegeben.

## Nachweise und offene Abnahme

- `npm test` einschließlich `test:news-astra`: bestanden, ohne echte Modell-/DB-Aufrufe.
- `npm run eval:news`: sieben synthetische Fälle gültig, inklusive UK-only-Talkshow
  und territorial begrenztem Start. Offline ist **keine** Modellqualitätsbewertung.
- Next.js Compile-Build bestanden, mit lokalen Platzhalterkonfigurationen;
  kein produktiver Datenbank-Prerender und kein Deployment.
- Der neue direkte Leser wurde zusätzlich an je einem aktuellen öffentlichen
  RSS-Artikel von Deadline, Variety und Hollywood Reporter geprüft. Alle drei
  lieferten einen Artikelvolltext und Publikationsdatum. Dabei wurde ein echter
  Variety-Selektorfehler gefunden und korrigiert. Kein flächendeckender Nachweis
  aller Publisher, Paywalls oder künftiger HTML-Varianten.
- Neue und gezielt geprüfte Redaktionsmodule/-tests ohne ESLint-Befund.
  Der vollständige Projekt-Typecheck ist kein grüner Abnahmenachweis:
  bereits der Ausgangscommit weist mit den aktuellen Abhängigkeiten 148
  Typdiagnosen auf. Der Vergleich verwendet dieselbe Konfiguration und
  generierten Dateien: aktueller Stand ebenfalls 148, keine neuen Diagnosen.
  Vier explizite Array-Typen beseitigen zusätzliche Inferenzfehler, ohne das
  erzeugte JavaScript zu verändern. Compile-Build und Regressionstests
  ersetzen die spätere Behebung der übrigen Typfehler nicht.

Noch erforderlich vor Produktion:

1. Astra-Modellzugriff über das vorhandene eigene OpenAI-Projekt sicher prüfen;
   lokale Implementierung und Mocktests bestätigen keine Accountberechtigung.
2. Echte Modellabnahme der sieben Fälle und zusätzlicher aktueller Originalquellen:
   natürliche deutsche Sprache, Fakten, Deutschlandrelevanz, Laufzeiten/Kosten.
   Keine synthetischen Artikel veröffentlichen.
3. Frische Datenbank-/Volume-Backups und isolierten Restore-Weg erneut bestätigen,
   externe private Kopie und fehlenden automatischen Backupplan klären.
4. Separate Betreiberfreigabe für Rollout. **Push nach `codex/takeover` kann
   Produktion deployen**, daher auch keinen bloßen „Testpush“ durchführen.
5. Coolify-Task-Timeout auf vollständigen Einzellauf abstimmen; der letzte Audit
   zeigte 300 Sekunden Tasklimit, 900 Sekunden Handlerlimit und 210 Sekunden
   weiches Startbudget. Das Startbudget beendet keinen laufenden Artikel.
6. Ein begleiteter freigegebener End-to-End-Lauf, echtes Bild und öffentliche
   Anzeige kontrollieren; erst danach Pausenschalter/Automatik freigeben.

Keine Prisma-Migration, Secretrotation, DNS-, R2-Berechtigungs- oder Coolify-
Änderung gehört zu diesem lokalen Umbau.
