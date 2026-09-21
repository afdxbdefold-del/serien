# Astra-News: Umbau, Abnahme und Rollout

Stand: 21. September 2026, ausschließlich Branch `codex/takeover`.
Ausgangspunkt dieser Runde: `b04d34de634120f7a4636f04b31066ce796194b4`.
**Rollout wegen starker Host-Überlastung gestoppt; Astra noch nicht live.**
Der Takeover-Stand ist auf GitHub verfügbar. Coolify hat am 21. September 2026
um 09:35 UTC das manuelle Deployment von
`fbd68a98163631251e7b1e19e306780bfbc80db1` begonnen. Ein gestarteter Build ist
noch kein Nachweis, dass dieser Commit gesund in Produktion läuft oder ein
erster echter Artikel erfolgreich veröffentlicht wurde. Die bisherige Produktion
`2d75e26` ist nach dem Abbruch wieder gesund. `main` bleibt unberührt.
Der frühere GPT-5.4-Test bleibt nur historischer Beleg; der Astra-Zugriff wurde
für diesen Rollout separat geprüft, siehe datierten Nachtrag unten.

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

## Rollout-Nachtrag: 21. September 2026, 09:35 UTC

Nach Betreiberfreigabe wurden folgende Voraussetzungen tatsächlich geprüft:

- Der vorhandene eigene OpenAI-Zugang beantwortete den getrennten Probeaufruf
  für `gpt-6-astra` mit HTTP 200. Das bestätigt Modellzugriff, nicht allein
  Artikelqualität; keine Zugangsdaten wurden ausgegeben.
- Die sieben synthetischen Redaktionsfälle liefen mit echten Astra-Aufrufen
  in einer getrennten Node-20-Testumgebung. Alle sieben automatischen
  Fallprüfungen bestanden; sämtliche manipulierten Fakten-Gegenproben des
  Harness wurden erkannt. Keine Datenbankanbindung und keine Veröffentlichung
  synthetischer Texte. Geprüfter Quellenstand: `efc1621e`; Writer, Quellenreview
  und Evaluationsfälle sind im Deploystand `fbd68a98` identisch.
- Die erzeugten Texte wurden zusätzlich durch den Agenten sprachlich gesichtet.
  Das ist **keine menschliche Redaktionsabnahme**. Eine solche wird hier nicht
  behauptet; die synthetischen Fälle beweisen auch noch keinen echten RSS-,
  TMDB-, Datenbank-, Bild- oder öffentlichen Publikationslauf.
- Die am selben Morgen erstellten logischen und physischen Sicherungen unter
  `/data/coolify/backups/serien-manual/20260921-onQQ0y/` sind isoliert
  wiederhergestellt worden. Prüfsummen und Restore-Nachweise wurden vor dem
  Rollout erneut geprüft. Eine frische private Offsite-Kopie und eine
  automatische überwachte Backupplanung bleiben offen.
- Der automatische Deploytrigger wurde vor dem Push vorübergehend auf
  ausschließlich manuelle Deployments gestellt. So konnte der geprüfte Branch
  bereitgestellt werden, ohne bereits durch den Push Produktion zu ersetzen.
  Das genannte Deployment wurde anschließend gezielt manuell gestartet.
- Für die begleitete Abnahme sind `NEWS_LIMIT=1` und
  `AUTOMATED_NEWS_PUBLISHING_ENABLED=true` gesetzt, während
  `pipeline.cron.paused` weiterhin aktiv bleibt. Ein gesetztes Release-Flag
  allein hebt die globale Pause nicht auf. Ein Kandidat bedeutet außerdem
  nicht garantiert einen freigegebenen Artikel.
- Das News-Task-Zeitfenster wurde auf 3600 Sekunden abgestimmt. Die einzelnen
  Modellversuche können einschließlich einer Revision bereits bis zu
  1500 Sekunden beanspruchen, zusätzlich zu Wartezeiten und übrigen Diensten.
  Bestehende TMDB-Aufrufe sind nicht durchgehend zeitbegrenzt: 3600 Sekunden
  sind ein praktisches beaufsichtigtes Fenster, **keine garantierte maximale
  Laufzeit**. Das 210-Sekunden-Startbudget und `maxDuration=900` ersetzen keinen
  zuverlässigen Abbruch laufender Arbeit. Nach Client-Timeout zuerst Run und
  Lease prüfen, niemals unbesehen einen zweiten Import auslösen.
- Der zusätzliche Dashboard-Fix verhindert, dass bloßes Öffnen der Übersicht
  laufende Jobs nach zehn Minuten als fehlgeschlagen markiert. Vollständige
  lokale Regressionstests und Compile-Build des Deploystands bestanden;
  die bekannten projektweiten Typdiagnosen sind dadurch nicht behoben.

Noch offen bei Beginn dieses Deployments:

1. Erfolgreichen Coolify-Build, tatsächlich gestarteten Commit, Containerzustand
   und öffentliche Website bestätigen. Bis dahin nicht als live abgeschlossen
   melden; keinen zweiten Deploy parallel starten.
2. Genau einen beaufsichtigten echten Quellenkandidaten unter Ausschluss
   konkurrierender News-/P3-/P4-Läufe prüfen. Globale Pause erst dafür kurz
   freigeben und bis zur Abnahme wieder aktivieren. Originalquelle, belegten
   Deutschlandbezug, natürliches Deutsch, Fakten und Artikelpaket prüfen.
3. Bei einer tatsächlichen Veröffentlichung den gespeicherten Datensatz,
   Canonical, ausgelieferte Bilddatei, Startseiten-Karussell und News-Liste
   gemeinsam bestätigen. `partial/publication-verification` verlangt einen
   Sichtbarkeits-Recheck des bestehenden Artikels, keine neue Generierung.
4. Erst nach bestandener Ende-zu-Ende-Abnahme die regelmäßige Automatik
   freigeben und Fehler-/Freshness-Beobachtung bestätigen. Offsite-Sicherung
   und automatische Backupplanung bleiben als getrennte Betriebsaufgaben offen.

Keine Prisma-Migration, Secretrotation, DNS- oder R2-Berechtigungsänderung ist
Teil dieses Rollouts. Coolify-Änderungen beschränken sich auf den kontrollierten
Deploytrigger, die genannte News-Laufzeitkonfiguration und das freigegebene
App-Deployment; die Produktionsdatenbank wird nicht neu gestartet.

## Abbruch und sichere Wiederaufnahme

Der Build vom 21. September 09:34:58 UTC verursachte auf dem 3819-MiB-Host
ohne Swap starke Speicher- und I/O-Belastung. Gemessen wurden 151 MiB freier
verfügbarer Speicher und eine Last von 52.64; öffentliche Website und Coolify
lieferten vorübergehend Timeouts. Ein OOM-Kill ist damit nicht nachgewiesen.
Nur der neue Build-Helfer wurde gezielt gestoppt, nicht App oder Datenbank.
Coolify führt das Deployment nach 09m12s als fehlgeschlagen.

Danach verschwanden die beobachteten Build-Prozesse. Um 09:46 UTC antworteten
Origin und öffentlicher Healthcheck mit HTTP 200; die alte App war gesund,
hatte weiterhin null Neustarts und `OOMKilled=false`. Rund 1144 MiB waren
wieder verfügbar. Die Datenbank zeigte unverändert 4360 Artikel und die
aktive globale Pipeline-Pause. Auch die öffentliche Startseite wurde danach
mit HTTP 200 und vorhandenem Artikelinhalt geprüft.

News-, YouTube- und Video-Schedules bleiben für die nicht abgeschlossene
Abnahme deaktiviert. Push-Deployments bleiben bewusst gesperrt; ein erneuter
unbegrenzter Build könnte die Website wieder beeinträchtigen. Die neuen
Runtime-Variablen sind in Coolify hinterlegt, aber nicht in den weiterhin
laufenden alten Container übernommen. Es wurde kein News-Testlauf in
Produktion gestartet und kein synthetischer Artikel veröffentlicht.

Lokal sind nun ein einzelner Next-Seitenworker, eine parallele Seitengenerierung
und Webpack-Speicheroptimierung mit Regressionstests vorbereitet. Vollständige
Tests, gezielter Lint und Compile-Build bestanden. Ein vollständiger lokaler
Build kompilierte erfolgreich und erreichte die statische Generierung, stoppte
dann erwartungsgemäß am Datenbank-Prerender mit der absichtlich unerreichbaren
Platzhalterdatenbank. Das ist kein grüner vollständiger Produktionsbuild.

Diese Next-Einstellungen sind kein Gesamt-Speicherlimit. Vor dem nächsten
Versuch muss entweder das tatsächlich ausführende Build-Cgroup wirksam
begrenzt und geprüft werden oder ein freigegebener separater Linux-Builder
verwendet werden. Ein App-Runtime- oder Helper-Limit allein genügt nicht.
Docker Engine 29.6.1 und Buildx 0.35.0 wurden beobachtet; lokale Docker-
Build-Infrastruktur ist nicht eingerichtet. Danach folgen weiterhin die
oben beschriebenen echten Quellen-, Bild- und Sichtbarkeitsprüfungen vor
Freigabe der Automatik. Keine Änderung der Servergröße oder neue kostenpflichtige
Infrastruktur ohne Betreiberentscheidung.
