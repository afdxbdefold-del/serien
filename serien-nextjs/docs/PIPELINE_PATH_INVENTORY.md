# Automatische Redaktion: vollständiges Pfadinventar

Stand: 21. September 2026. Geprüfter Ausgangspunkt: Branch `codex/takeover`, Commit `3cdadaed`. Ergänzt um die lokalen Reparaturen dieser Arbeitsrunde. **Dieses Dokument bestätigt keinen Rollout und keinen erfolgreichen Produktionslauf.** Coolify-Zeitpläne und tatsächlich laufende Prozesse müssen getrennt live abgeglichen werden.

## Prüfumfang und Aussagegrenzen

Erfasst wurden alle elf Routen unter `app/api/cron`, der optionale News-Dauerläufer, die P3-/P4-Entdeckung und Generierung, sämtliche im Repository gefundenen direkten Aufrufe von `runPipelineV2`, alle zwölf direkten `articles.create`-Stellen unter `app`, `lib` und `scripts` sowie die benannten Import-/Legacy-Pfade. Zusätzlich wurden `Dockerfile`, `vercel.json`, Paket-Skripte und Dateien mit Scheduler-/Worker-/Cron-/Supervisor-/Compose-Bezug geprüft.

„Erreichbar“ bedeutet: Der Anwendungscode stellt den Pfad bereit. Es bedeutet **nicht**, dass Coolify ihn momentan regelmäßig aufruft. „Dormant“ bedeutet: Im geprüften Repository wurde kein aktiver aufrufender Anwendungspfad oder hinterlegter Zeitplan gefunden; ein unbekannter externer Prozess kann allein durch Quelltextprüfung nicht ausgeschlossen werden.

Keine Produktionsaufrufe, Datenänderungen, Migrationen, Provider-Ausgaben oder Zugangsdaten waren für diese lokale Bestandsaufnahme erforderlich.

## Alle elf HTTP-Cronpfade

Alle elf Einstiegspunkte verwenden `requireCronAuth`. Die Nachrichtenerzeugung ist auf die ersten drei Zeilen beschränkt; die übrigen Pfade sind Begleitdienste, keine neuen Nachrichtenartikel.

| Einstiegspunkt | Ablauf und Datenwirkung | Lokaler Schutz / verbleibende Einschränkung |
| --- | --- | --- |
| `/api/cron/news` | `processAllNews` → RSS-Auswahl → Pipeline V2 → Artikelentwurf oder Veröffentlichung → öffentliche Sichtbarkeitsprüfung | Gemeinsame Pause, atomare News-Lease, Retry-Abstand, Zeit-/Mengenbegrenzung, Recovery ohne Neugenerierung. Nur bestätigte Sichtbarkeit zählt als neue Veröffentlichung. |
| `/api/cron/trends` | Google Trends → `trending_topics` → P3 → Artikelentwurf | Lokal repariert: Pause vor Discovery, eigene P3-Lease, frühe Bestandsprüfung, Queue-Verknüpfung in derselben Transaktion wie der Entwurf. Keine automatische Veröffentlichung. |
| `/api/cron/youtube` | Kanal-RSS → `youtube_videos` → P4 → Artikelentwurf | Lokal repariert: Pause vor Discovery, eigene P4-Lease, frühe Video-/Artikel-Dedupe, atomare Draft-Verknüpfung. Keine automatische Veröffentlichung. |
| `/api/cron/videos` | `stats` liest Queue; `enqueue` legt Downloadjobs an; `process` lädt Trailer und verändert bestehende Artikel | Kein Nachrichtenwriter. Diese Runde ergänzt separate redaktionelle Video-Schutzregeln. Queue-Claim, Wiederaufnahme hängender Downloads und Fehlersummen benötigen eigene Abnahme; siehe Restbefunde. |
| `/api/cron/releases` | TMDB-Discovery/Details → Ersetzung von `streaming_releases` → Cache-Revalidierung | Schützt gegen leere bzw. auffällig stark geschrumpfte Ergebnisse. Kein Artikelwriter. Globale Erstausstrahlung plus aktueller deutscher Anbieter ist kein Beleg für einen deutschen Erscheinungstermin. |
| `/api/cron/tmdb-top10` | TMDB → Plattform-Ranglisten → Cache-Revalidierung | Kein Artikelwriter. Providerfehler werden im Ingest noch zu Nullergebnissen; die Route kann dadurch fälschlich erfolgreich aussehen. |
| `/api/cron/flixpatrol` | FlixPatrol → Plattform-Ranglisten → Cache-Revalidierung | Alter alternativer Ranglistenpfad, weiterhin erreichbar. Fehler werden ebenfalls in Nullergebnisse umgewandelt. Tatsächlichen Zeitplan prüfen. |
| `/api/cron/seo` | Datenbank-/HTTP-SEO-Audit und optionale KI-Zusammenfassung → SEO-Ergebnisse | Kein Artikelwriter. Teilfehler der zusätzlichen Audits können trotz `success:true` auftreten; keine eigene Run-Lease. Die News-Pause ist kein globaler Kill-Switch für alle SEO-Ausgaben. |
| `/api/cron/downgrade-stale` | Bestehende DISCOVER-Artikel älter als 48 Stunden → `SEARCH_ONLY`; News-Sitemap erneuern | Kein Writer neuer Nachrichten und keine Löschung. Separate bestehende Datensatzänderung. |
| `/api/cron/tmdb-sync` | Explizite Antwort `disabled:true` | Im Code deaktiviert, kein laufender Import aus diesem Handler. |
| `/api/cron/backfill-streaming-series` | Explizite Antwort `disabled:true` | Im Code deaktiviert, kein laufender Import aus diesem Handler. |

Belege: jeweilige `app/api/cron/<Name>/route.ts`; zentraler News-Schutz in `scripts/news-scraper.ts`, P3/P4-Schutz in `lib/draft-pipeline-reliability.ts`.

## Scheduler und weitere erreichbare Einstiege

| Pfad | Einordnung |
| --- | --- |
| `scripts/news-scheduler.ts:17` | Optionaler, seriell wartender Dauerläufer. Ruft denselben geschützten `processAllNews` auf wie die News-Cronroute. Kein separater Veröffentlichungsbypass. |
| `Dockerfile:89` | Startet ausschließlich `node server.js`. Kein News-Scheduler, Supervisor oder Nebenworker wird hier gestartet. Ein separater CLI-Worker benötigt eigene Runtime und Bereitstellung. |
| `vercel.json:7` | `crons` ist leer. Kein hier hinterlegter Vercel-Zeitplan. Vercel ist daraus nicht als aktuelle Produktion abzuleiten. |
| `app/api/admin/pipeline/route.ts` | Authentifizierte Einzel-/Batchaufrufe und Cron-Anstöße. P3/P4 verwenden jetzt denselben Pause-/Lease-/Dedupe-Schutz wie Cron; ihre Antwort unterscheidet Entwurf, vorhanden, übersprungen und Fehler. Pipeline-V2-/P2-Antworten werden separat über den öffentlichen Veröffentlichungsnachweis geprüft. |
| `scripts/p3-trends.ts` CLI | Einzelthema oder Queue. Geschützter P3-Einstieg; immer Entwurf. Ein expliziter manueller Einzelauftrag darf das Discovery-Alter überschreiten, umgeht aber weder Pause noch Lease. |
| `scripts/p4-yt.ts` CLI | Kanalinitialisierung, Discovery, Video-/Queueverarbeitung. Discovery und Generierung sind geschützt. Initialisierung ist eine gesonderte Konfigurationshandlung. |
| `scripts/google-trends-scraper.ts` CLI | Ausschließlich Discovery und Trend-Queue, keine Artikel. Jetzt ebenfalls P3-Pause/-Lease; RSS-/TMDB-Ausfälle werden nicht als „keine Trends“ verborgen. |
| `app/api/qa/generate/route.ts` | Erzeugt/ersetzt FAQ an einem bestehenden Artikel. Durch Middleware-Adminschutz beschränkt, kein öffentlicher anonymer Publisher. Kein automatischer Caller gefunden; redaktionelle Wiederprüfung nach manueller Inhaltsänderung bleibt erforderlich. |
| `app/api/admin/trailers/backfill/route.ts` | Authentifizierter manueller Backfill, verändert bestehende Serien-/Trailerdaten. Kein neuer Artikelwriter. Nicht als Cron konfigurieren, ohne Kosten-/Laufzeit-/Lease-Konzept. |

Ein im Admin-Dashboard berechneter „nächster Cronlauf“ ist allein **kein** Nachweis eines vorhandenen Coolify-Zeitplans. Für den Betriebsnachweis sind reale Scheduled Tasks, letzter Lauf und Datenbank-Runstatus abzugleichen.

## Direkte Pipeline-V2-Nebenwege

Diese Aufrufer verwenden zwar den Kernwriter mit seinen Qualitäts-/Release-Regeln, aber nicht zwangsläufig die äußere News-Import-Pause, Lease, faire Quellenauswahl und Wiederholungsbegrenzung. Es wurde kein Repository-Zeitplan gefunden, der die Legacy-Scraper startet.

| Datei / Beleg | Risiko |
| --- | --- |
| `scripts/tvline-scraper.ts:180` | Direkter `runPipelineV2`-Aufruf mit `trigger:'cron'`; der äußere Scraper zählt jedes nichtleere Resultat als verarbeitet, auch Entwurf oder unbestätigte Veröffentlichung. Nicht zusätzlich zum Hauptimport schedulen. |
| `scripts/screenrant-scraper.ts:346` | Direkter V2-Aufruf mit Cron-Trigger. Der aktuelle schwache-Quellen-Filter schließt ScreenRant im Kern aus; alter separater Scraper ist daher kein funktionierender Ersatzimport. |
| `scripts/trends-processor.ts:226` | **Technisch defekt:** alte Signatur `runPipelineV2(url, options)` passt nicht zum heutigen Objektparameter. Zähler wird anschließend trotzdem erhöht; auch der Trend-Create passt nicht vollständig zum Prisma-Schema. Dormanter CLI, nicht der P3-Cronpfad. |
| `scripts/replay-rejected.ts:50` | Startet beim Skriptaufruf einen Replay aus einer Datei; verwendet manuelle Trigger. Kann Alters-/Auswahlregeln umgehen und prüft nur Datenbankstatus. Nicht als automatische Fehlerbehebung einsetzen. |
| `scripts/manual-run-boroughs.ts`, `scripts/manual-run-murder-mindfully.ts` | Explizite einmalige, themenspezifische Hilfsskripte. Keine laufenden Scheduler gefunden. |
| `scripts/pipeline-v2.ts` CLI | Direkter Kernaufruf. Ein Wartungswerkzeug, kein Ersatz für den geschützten Hauptimport. |

## Alle zwölf direkten Artikel-Neuanlagen

| Artikel-Neuanlage | Status / Erreichbarkeit |
| --- | --- |
| `scripts/pipeline-v2.ts:2715` | Aktueller Kernwriter: Entwurf oder gated Veröffentlichung mit nachgelagerter öffentlicher Prüfung. |
| `scripts/p3-trends.ts` (`tx.articles.create`) | Aktiver P3-Pfad, lokal dauerhaft Draft-only. Speichert Queue-Verknüpfung atomar mit dem Entwurf. |
| `scripts/p4-yt.ts` (`tx.articles.create`) | Aktiver P4-Pfad, lokal dauerhaft Draft-only. Videoquelle bleibt identifizierbar; keine erneute Generierung desselben gespeicherten Entwurfs. |
| `scripts/demo-ende-erklaert.mjs:236` | Expliziter Demo-CLI; speichert `draft`, kein automatischer Publisher. |
| `scripts/crawler.ts:116` | **Dormanter direkter Publisher.** Hardcodierte Beispielmeldung; setzt `published` und startet beim Skriptaufruf automatisch. |
| `scripts/crawler-tmdb-auto.ts:124` | **Dormanter direkter Publisher.** Hardcodierter Beispieltext; setzt `published`, kein aktueller News-/Quellennachweis. |
| `scripts/crawler-real.ts:140` | **Dormanter direkter Publisher.** Verarbeitet hinterlegte Beispieldaten, setzt `published`. |
| `scripts/create-from-tmdb.ts:204` | **Dormanter direkter Publisher.** Baut Artikel aus TMDB-Daten statt belastbarer aktueller Nachricht und setzt `published`. |
| `scripts/import-cinemaholic-news.ts:20` | **Dormanter direkter Publisher.** Hardcodierter historischer Einmalimport, `published`. |
| `scripts/import-from-serien-de.ts:554` | Historischer Website-/Archivimport; übernimmt veröffentlichte Artikel direkt. Kein normaler News-Worker, nur nach gesonderter Importprüfung verwenden. |
| `lib/pipeline-v2-ranking.ts:525` | Alter Rankingwriter, setzt `published`; keine Aufrufer gefunden. Veraltete Prisma-Feldnamen machen eine Wiederinbetriebnahme zusätzlich unsicher. |
| `lib/pipeline/article-creator.ts:114` | Alter Export/Barrel-Pfad, direkte Veröffentlichung; kein aktueller Anwendungscaller gefunden. Umgeht den heutigen Vollquellen-/Bild-/Sichtbarkeitsnachweis. |

Die acht Legacy-Direktpublisher (sechs Skripte und zwei Bibliothekspfade) wurden in dieser Runde nicht pauschal verändert oder ausgeführt. Vor einer späteren Reaktivierung müssen sie ausdrücklich stillgelegt oder auf denselben abgesicherten Importpfad umgestellt werden. Bestehende Reparatur-/Migrationsskripte, die Artikel nur ändern, sind ebenfalls **keine** autorisierten automatischen Scheduler.

## Lokal behobene P3-/P4-Fehler

1. **P3 war fast den ganzen Tag blockiert:** Trends werden unter dem Tagesdatum 00:00 gespeichert (`google-trends-scraper.ts`, `today.setHours`), aber zuvor wie ein exakter Publikationszeitpunkt gegen 30 Minuten geprüft. Jetzt wird das 24-Stunden-Discoveryfenster vor Recherche geprüft. `sourcePublishedAt` bleibt ausdrücklich `null`; frische Entdeckung wird nicht als frische Nachricht ausgegeben.
2. **P4 hatte widersprüchliche Altersfenster:** Queue wählte 24 Stunden, Generator akzeptierte nur 30 Minuten. Beide verwenden jetzt das reale Video-Publikationsdatum innerhalb von 24 Stunden. Die Altersregel wird nicht per `?trigger=manual` auf der Cronroute aufgehoben.
3. **Entwürfe verursachten wiederkehrende Ausgaben:** Bisher blieben sie in der unverarbeiteten Queue und wurden erst spät über zufällige neue Titel/Slugs erkannt. Jetzt Bestandsprüfung vor LLM über Queueartikel, stabile Quelle und frühere Runs; Entwurf und Queuebezug werden gemeinsam gespeichert. `processed` bedeutet „Generierungsauftrag erledigt“, nicht „öffentlich“.
4. **Pause und Parallelität:** Dieselbe globale Pause wirkt vor Discovery und Generierung. P3 und P4 haben jeweils eine atomare, erneuerte 30-Minuten-Lease. Verschachtelte Batch-/Einzelaufrufe verwenden dieselbe Lease. Unterschiedliche Pipelines blockieren einander nicht. Bei Pause, DB-Ausfall oder verlorenem Lease wird nicht still weitergeschrieben.
5. **Wahrheitsgemäße Ergebnisse:** Cron trennt neue Entwürfe, vorhandene Artikel, übersprungene Aufträge und echte Fehler. Technische Fehler ergeben HTTP 503. Ein Entwurf ist kein Veröffentlichungsfehler, aber auch kein Veröffentlichungserfolg. Admin zeigt Review-/Wartezustände statt falscher grüner Publikation.
6. **Discovery-/Queue-Fortschritt:** Eine leere oder ausgefallene Discovery blockiert vorhandene Queueartikel nicht. Providerfehler bleiben erkennbar. Ein kaputter YouTube-Kanal verhindert nicht die Prüfung späterer Kanäle. Absichtlich deaktivierte Kanäle verursachen keine endlose Initialisierungsrekursion.
7. **Begrenzung:** Das gemeinsame Startbudget beträgt 210 Sekunden inklusive Discovery. Danach beginnen keine weiteren Artikel. Bereits begonnene Artikel dürfen ihren begrenzten Ablauf abschließen; HTTP-Laufzeitmetadaten betragen 900 Sekunden. Dies ist kein Ersatz für Provider-Timeouts und keinen realen Abnahmelauf.
8. **Veraltete Inhaltssignale:** Festes Suchjahr 2025 durch aktuelles Jahr ersetzt; News-Ziel jetzt 300–650 statt künstlich 1500+ Wörter. Bereits bekannte Landscape-Backdrops bleiben auch für gehaltene P4-Entwürfe erhalten. Das erweitert **nicht** ihre Publikationsfreigabe.

## Verbleibende Risiken und nächste Entscheidungen

- **Priorität 1 – reales Wiring:** Coolify-Schedules, angehängte Worker, Produktionsbranch und Push-/Deploytrigger mit diesem Inventar vergleichen. Ein funktionierender HTTP-Handler allein löst keine regelmäßigen Läufe aus.
- **Priorität 1 – Legacy-Publisher nicht starten:** Die acht direkten Altpfade haben keinen heutigen Veröffentlichungsvertrag. Solange ihre tatsächliche Inaktivität nicht bestätigt ist, besteht ein möglicher Nebenweg um aktuelle Sicherheitsregeln.
- **Priorität 2 – Video-Downloadqueue:** Am Prüfstand verwendete `cron/videos` ein nichtatomisches Find→Update-Claim und keine Wiederaufnahme alter `downloading`-Jobs. Der Downloader kann länger als die alte 60-Sekunden-Laufzeit arbeiten. Ergebniszählung war unabhängig von tatsächlichen Fehlern grün. Die parallele redaktionelle Trailerkorrektur ersetzt diese Queue-Abnahme nicht.
- **Priorität 2 – Ranglisten falsch grün:** `lib/tmdb-top10-ingest.ts:200` und `lib/flixpatrol-ingest.ts:274` fangen Plattformfehler ab und liefern Nullergebnisse; ihre Cronrouten geben `ok:true` zurück. Fehlerzustand getrennt von legitim leerer Rangliste modellieren.
- **Priorität 2 – Releasekalender:** In `cron/releases` sind ein deutscher Anbieter und globale TMDB-Ausstrahlungsdaten noch kein belastbarer lokaler Starttermin. Außerdem brauchen die sequenziellen externen Anfragen eine vollständige Timeout-/Teilversagensstrategie.
- **Priorität 2 – alter Emergent-Nebenworker:** `scripts/poll-claude-and-regen-bios.sh:16` enthält einen 10-Minuten-Dauerlauf, der den alten Provider prüft und bei Erfolg Autorenbios mit `--apply` regeneriert (Zeile 32). Kein News-Publisher, aber ein möglicher externer Kosten-/Mutationspfad. Kein Startnachweis im Repository; nicht ohne gesonderte Prüfung betreiben.
- **Priorität 3 – SEO-Teilstatus:** Ausgefallenes HTTP-Audit oder KI-Zusammenfassung in `cron/seo` sollte einen Teilstatus ergeben, nicht uneingeschränkten Gesamterfolg.

## Abnahme und sichere Reihenfolge

Offline-Regressionsdatei: `tests/draft-pipeline-reliability.test.ts`. Sie prüft Pause ohne Provideraufruf, getrennte und verschachtelte Leases, Konkurrenz, Leaseverlust, 24h-Datumsgrenzen, stabile Quellidentität, Legacy-Draft-Dedupe, Retry-Abstand, wahrheitsgemäße Cron-/Adminzustände und die erhaltenen Draft-only-Grenzen. Alle Prüfungen verwenden Fakes bzw. lokale Quelltexte, keine Produktion.

Vor Liveänderungen: Datenbank- **und** Volume-Backup samt Restore-Pfad verifizieren; Coolify-Produktionsbranch und automatische Trigger prüfen; nur freigegebenen lokalen Stand bereitstellen; dann einen begleiteten automatischen News-Test durchführen und Quelle, Artikeltext, öffentliches Bild, Canonical, Startseiten-/Newsanzeige sowie persistierten Runstatus gemeinsam prüfen. P3/P4 bleiben bis zu separater Vollquellen-/Videoquellen-Abnahme im Review. Erst danach regelmäßige Taktung und Kostenlimits belastbar freigeben.
