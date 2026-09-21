# News-Pipeline und LLM-Integration

Stand: 21. September 2026, lokaler Astra-Arbeitsstand auf `codex/takeover`.

**Die neue Pipeline ist lokal umgesetzt, aber noch nicht ausgerollt.
Dieses Dokument beschreibt den Code, keinen erfolgreichen Produktivlauf.**
Konfiguration und Betriebsablauf stehen in
[PIPELINE_SCHEDULER.md](PIPELINE_SCHEDULER.md).

## Ziel und Grenze

Automatisch publiziert werden sollen ausschließlich **für Deutschland relevante**,
eigenständige, konkrete und belegte Serienmeldungen. Umfang richtet sich nach der Substanz. Die Pipeline
veröffentlicht bei fehlender Evidenz nicht ungeprüft und dokumentiert
den Grund. Auch diese Prüfungen garantieren keine absolute Fehlerfreiheit.

Produktion einschließlich PostgreSQL läuft auf Hetzner/Coolify, nicht
Neon. Bekannter Startweg sind Coolify Scheduled Tasks gegen Next.js-Routen.
Vor einem Rollout tatsächlichen Branch, Commit und Deploy-Trigger prüfen.
`main` ohne ausdrückliche Freigabe nicht ändern, mergen oder deployen.

## Direkter OpenAI-Zugang

`lib/llm-config.ts` verwendet ausschließlich den eigenen
`OPENAI_API_KEY` und `https://api.openai.com/v1`.
Die aktive News-Klassifikation, Dublettenprüfung, Faktenextraktion, der NEWS-Writer
und die vollständige Schlussprüfung einschließlich Revision verwenden
`gpt-6-astra` mit `reasoning_effort: low`, zentral über `getNewsRequestConfig`.
`low` ist eine kompatible Ausgangskonfiguration, kein Qualitätsnachweis.
Andere Formate, Bios und SEO behalten vorerst ihren vorhandenen `gpt-5.4`-Pfad.
Ein fehlender Key oder Emergent-Key im OpenAI-Feld führt zu einem Fehler.
Es gibt für den gemeinsamen Text-Client keinen stillen Anbieterwechsel
und keinen Emergent-Fallback.

Der SDK-Client verwendet 90 Sekunden Timeout und höchstens eine
SDK-Wiederholung. Die vollständige Redaktionsprüfung verwendet für ihre
strukturierten Aufrufe 120 Sekunden Timeout und höchstens eine
SDK-Wiederholung. Technische Wiederholungen sind von der einmaligen
inhaltlichen Überarbeitung zu unterscheiden.

Klassifikation und Dublettenprüfung haben je höchstens zwei explizite Versuche,
ohne zusätzliche SDK-Retries. Astra erhält keine `temperature`, `top_p`,
`top_logprobs` oder `logprobs`. Der Textpfad verwendet keine Tools und bleibt
deshalb bei Chat Completions. Limits: Klassifikation/Dubletten je 4096,
Writer 8192, Fakten/Review/Revision je 12000 Completion-Tokens, einschließlich
Reasoning. Quelle und Providerfehler werden nie zu einer erfundenen Freigabe.
Migrationsgrundlage: [offizielle Astra-Anleitung](https://developers.openai.com/api/docs/guides/latest-model).

Die Aufrufe verwenden `max_completion_tokens`. Die Redaktionsprüfung
verlangt ein striktes JSON-Schema. Abgebrochene oder verweigerte Antworten,
ungültiges JSON und fehlende Felder bestehen keine Prüfung. Auch der
Writer akzeptiert nur vollständige Antworten mit Titel, Vorspann,
Beschreibung und gültigen Textabschnitten.

`parseLLMJson()` bleibt für andere Aufrufer vorhanden, ersetzt aber nicht
die neue Paketvalidierung. `EMERGENT_LLM_KEY` in der Beispielkonfiguration
gehört zu verbleibenden Legacy-Funktionen außerhalb dieses gemeinsamen
Textzugangs und wird nicht als News-Ausweichlösung aktiviert.

## 1. Quellen finden und Arbeit begrenzen

`/api/cron/news` authentifiziert den Aufruf und startet
`processAllNews()` in `scripts/news-scraper.ts`. Vor Arbeitsbeginn
stehen Pausenschalter, gemeinsame Datenbanksperre und gegebenenfalls
Nachprüfung bereits gespeicherter Veröffentlichungen.

Die HTTP-Route nutzt Cinemaholic, Deadline, Variety, Hollywood Reporter,
Netflix Tudum und TVLine. Der Funktionsstandard enthält zusätzlich
Google News Streaming. Blockierte Quellen wie ScreenRant, Collider,
What's on Netflix und TVInsider werden nicht durch bloßes Hinzufügen
zu einer Feedliste zugelassen.

RSS-Discovery sammelt standardmäßig bis zu 24 Stunden alte Einträge;
einzelne Quellen haben eigene Fenster. Das frühe harte Pipeline-Altersgate
liegt bei 72 Stunden für nichtmanuelle Kandidaten mit belastbarem Datum.
Zusätzlich gelten die spätere Quellzeitpunkt- und Aktualitätsprüfung.
Entdeckungsfenster und Publikationsfreigabe sind unterschiedliche Dinge.

Bestehende `sourceUrl`-Datensätze und Laufhistorie werden **vor** dem
Gesamtlimit geprüft. Standardmäßig werden höchstens fünf Kandidaten
insgesamt aus wechselnden Quellen verarbeitet. Quellenfehler, Entwürfe,
zurückgestellte Kandidaten und verifizierte Veröffentlichungen sind
getrennte Ergebnisse; es gibt keine Pflicht, eine Artikelquote zu füllen.

## 2. Serie, Relevanz und Originalquelle

`scripts/pipeline-v2.ts` protokolliert jeden Kandidaten. Vorhandene
Quellen-/Serienblocklisten, Film-/Serien- und Themenfilter,
Serienzuordnung, eigene Ereignis-Dublettenprüfung und tägliche Kostenbegrenzung bleiben aktiv.
Die pauschale Fünf-Artikel-pro-Serie-Monatsquote entfällt. Deutschlandrelevanz
und regionale Behauptungen von NEWS prüft die Quellenredaktion ausdrücklich.
Ein ausländischer Produktionssender oder ein älterer Konkurrenzartikel zum
gleichen Schauspieler ist kein pauschaler Ablehnungsgrund für eine neue Meldung.
Ähnlich benannte Sendungen sind kein korrekter Serientreffer.

Der bisherige pauschale Ausschluss wegen deutscher Berichterstattung
(`german-angle-coverage`) gilt nicht mehr als hartes News-Gate: Ein Bericht
über denselben Schauspieler oder dieselbe Serie beweist kein identisches
Ereignis. Eigene Ereignis-/Artikeldublettenprüfung und Quellenprüfung
bleiben erhalten. Alte Ablehnungen dieses Schritts erhalten keine
dauerhafte inhaltliche Sperre mehr.

Ohne explizite Autor-ID verwendet die Pipeline
`AUTOMATED_EDITORIAL_AUTHOR_ID`, standardmäßig `redaktion`.
Das Konto muss mit Rolle `author` existieren. Automatischer Inhalt erhält
keine zufällige fremde Autorenidentität.

Originalvolltext und belastbarer Quellzeitpunkt sind Grundlage der
Faktenextraktion und Schlussprüfung. Letztere verlangt mindestens
600 Zeichen Quelltext; Feedtitel oder Suchsnippet genügen nicht.
Bei Überschreitung des vollständigen Prüfbudgets wird kein Rest
stillschweigend ungeprüft weggelassen.
Automatische News nutzen den direkten, DNS-geprüften Originalabruf aus
`editorial-source-fetch.ts`, ohne Jina- oder RSS-Teaser-Fallback. Mehrdeutige
Artikelcontainer, Paywall-Kurztexte und fehlende Originale halten den Lauf an.
Klassifikation, Dublettenvergleich, Writer und Schlussredaktion sehen den
vollständigen verfügbaren Originaltext statt nur seiner ersten Absätze.

Internationale Produktions-, Casting- oder Verlängerungsnachrichten
können relevant sein, ohne dass ein Deutschlandtermin bekannt ist, aber nur
mit positiv belegtem Deutschlandbezug der Serie. `germanyRelevance` ist ein
Pflichtfeld der strukturierten Schlussprüfung: exakter Quellenbeleg oder
serverseitig abgefragter deutscher Katalogeintrag derselben Serie plus
wesentliche Produktions-, Casting-, Staffel-, Trailer- oder Serienpreis-Nachricht.
Deutsche Seriencharts/Quoten/Rekorde brauchen dagegen einen Originalbeleg
zum deutschen Markt; ein DE-Katalogeintrag genügt für Auslandszahlen nicht.
Ausländische lokale Talkshows, Sendeplatzänderungen, reine Auslandsstarts,
Quoten und Klatsch reichen nicht; auch ein beiläufiger Netflix-Verweis nicht.
Fehlender oder unklarer Bezug verhindert die Freigabe, statt durch Umschreiben
einen Deutschlandbezug zu erfinden.
Eine Benelux-, US- oder UK-Mitteilung belegt aber keinen deutschen Start.
TMDB-Katalogverfügbarkeit alter Staffeln bestätigt weder Termin noch
Anbieter einer neuen Staffel. Fehlende TMDB-Daten beweisen umgekehrt
keine Nichtverfügbarkeit.

## 3. Eigenständige Nachrichten schreiben

`lib/news-writing-policy.ts` definiert den News-Auftrag;
`lib/structured-content-generator.ts` erstellt Headline,
Meta-Beschreibung, separaten Vorspann und Artikelkörper.

- Wichtigste belegte Neuigkeit zuerst, konkrete Namen und aktive Verben.
- Umfang nach Quellenlage; die begrenzte Prompt-Zielgröße ist eine
  Orientierung, kein Grund zum Auffüllen.
- Keine verpflichtenden 1500 Wörter, keine Pflicht-FAQ, kein Standardfazit
  und keine generischen „Was bedeutet das?“-Kästen für News.
- Zwischenüberschriften nur, wenn sie beim Lesen helfen.
- Keine erfundenen Zitate, Fanreaktionen, Konflikte, Rekorde,
  Währungsumrechnungen oder Deutschlandtermine.
- Den tatsächlichen Urheber nennen; Fremdrecherche nicht als eigene
  Bestätigung ausgeben.
- Konkrete Daten statt alternder Headline-Angaben wie „morgen“.

Der frühere „Faithful“-Übersetzungsweg ist für `NEWS` kein
Veröffentlichungspfad. Alte Zielgrößen und Sonderformate anderer Module
sind keine Anforderungen an reguläre Nachrichten. News werden
eigenständig formuliert und anschließend am Original geprüft.

## 4. Vollständige Quellenprüfung und eine gezielte Revision

`lib/editorial-review.ts` erhält das fertige Veröffentlichungspaket:
Headline, Vorspann, Meta-Beschreibung und vollständiges HTML,
Originalquelle sowie ausdrücklich beobachteten Kontext.
Die Prüfung erfolgt nach den redaktionellen Textbearbeitungen.
Anschließend darf kein ungeprüfter FAQ- oder Erklärungstext angehängt werden.

Die strukturierte Prüfausgabe bestätigt jedes Kurztextfeld und jeden
sichtbaren Fließtextabsatz. Externe Tatsachen benötigen Artikelpassagen
und exakte Belege aus dem gelieferten Original oder Kontext. Der Code
prüft, ob die zitierten Passagen dort tatsächlich vorkommen.
Unbelegte oder widersprochene Aussagen, ausgelassene Absätze und ein
fehlender sichtbarer Quellenlink verhindern die Freigabe.

Nachrichtenwert, Klarheit und eigenständige Sprache sind eigene Kriterien.
Klarheit und Eigenständigkeit benötigen jeweils mindestens 4 von 5.
Diese Skalen sind Prüfheuristiken, keine Garantie journalistischer Qualität.

Bei behebbaren Mängeln erfolgt **höchstens eine gezielte Überarbeitung**
anhand konkreter Befunde. Das gesamte überarbeitete Paket wird erneut
geprüft. Ein ausdrückliches `reject` oder weiter bestehende Mängel
werden nicht durch endlose Rewrite-Schleifen umgangen.

## 5. Struktur und abschließende Freigabe

`lib/article-structure.ts` liest echte HTML-/Markdown-Blöcke statt
aus zusammengezogenem Text die Absatzstruktur zu erraten.
Datumsangaben und übliche deutsche Abkürzungen werden bei der
Satzzählung berücksichtigt.

Für News gelten:

- Strukturwert mindestens 70, ohne harten Strukturfehler.
- Mindestens 120 belegte eigenständige Wörter, nicht 1500.
- Mindestens zwei Absätze, ab 320 Wörtern mindestens drei.
- Vorspann höchstens drei Sätze und 80 Wörter.
- Lange oder wiederholte Absätze ergeben konkrete Befunde; mehr als
  fünf Sätze oder 140 Wörter in einem Absatz sind ein harter Fehler.

Das abschließende Tor verlangt Quellenprüfung, HTML-Sicherheit, Qualität,
Sprache, Faktensicherheit, gültige Quelle, Aktualität, belegte
Artikelaussagen und eingeschalteten Release-Modus. Für News beruhen
inhaltliche Qualitäts-/Faktenentscheidungen auf der vollständigen
Schlussprüfung, nicht auf mehreren widersprüchlichen Kurztexturteilen.

Nur `AUTOMATED_NEWS_PUBLISHING_ENABLED=true` erlaubt automatische
Veröffentlichung. Fehlende Freigabe oder verbleibende redaktionelle
Befunde führen zum Entwurf. Eine technisch nicht abgeschlossene
Quellenprüfung führt zu `editorial-dependency`, einem später
wiederholbaren Fehler. Ein technisch ungeprüfter Entwurf soll die
Quell-URL nicht dauerhaft blockieren.

## 6. Passendes Bild vor Veröffentlichung bestätigen

`lib/publication-verification.ts` prüft das tatsächliche Artikelbild.
Reguläre News brauchen ein echtes TMDB-Backdrop der zugeordneten Serie;
die Bilddatei muss in deren abgefragter Galerie vorkommen.
Generierte Illustrationen und allgemeine Streamerlogos ersetzen
diesen Beleg nicht.

Die Prüfung lädt begrenzte Bilddaten von zugelassenen Ursprüngen,
dekodiert das Rasterbild und verlangt mindestens 1200 × 500 Pixel
im Querformat (auch ein echtes 2,39:1-Breitbild ist zulässig).
HTTP 200 allein genügt nicht. Bei einer defekten ersten Auswahl werden
höchstens zwei weitere bereits der Serie zugeordnete Galeriemotive geprüft.
`image-verification` verhindert bei einem Fehler den
Publikations-Insert. Ein Entwurf darf einen statischen Platzhalter
tragen; das bestätigt kein veröffentlichungsfähiges Artikelbild.

Cloudflare R2 ist die vorhandene eigene Speicheranbindung; ein direkter
TMDB-Link braucht keinen R2-Upload. Vercel-Blob- und Bildgeneratorpfade
anderer Formate sind gesonderter Altbestand und kein News-Fallback.

## 7. Speichern und öffentliche Anzeige bestätigen

Nach dem Artikel-Insert werden relevante Cache-Tags und Seiten
aktualisiert: Artikel, Startseite, `/news` und Sitemaps.
Bevorzugt wird ein separater authentifizierter HTTP-Request mit
`REVALIDATE_SECRET`. Die direkte Revalidierung im laufenden Next.js-
Handler wird bis zu seiner Antwort nur **vorgemerkt**. Ein gleichzeitig
ausgeführter GET kann weiterhin den alten Cache sehen.

Die Live-Prüfung kontrolliert kanonische Artikelseite, sichtbare
Headline, eingebundenes und tatsächlich geladenes Hero-Bild sowie die
erwartete Startseiten-/Carousel- und News-Anzeige. Auch Next.js-
optimierte Bild-URLs werden geprüft.
`publicationVerified=true` kennzeichnet den bestätigten Zustand.

Ein Datenbankstatus `published` allein zählt nicht als voller Erfolg.
Bleibt die Anzeige unbestätigt, bleibt der Artikel bestehen und sein Lauf
erhält `partial` mit `publication-verification`. Der nächste Cronlauf
prüft eine begrenzte Zahl gespeicherter Artikel erneut, ohne sie erneut
zu generieren oder einzufügen. Das gilt insbesondere nach vorgemerkter
In-process-Revalidierung ohne verfügbaren HTTP-Secret-Fallback.

Sitemap-/Indexierungs- und Social-Nachbearbeitung haben eigene Resultate.
Eine bestätigte Artikelseite beweist weder Google-Aufnahme noch
Social-Zustellung. `DISCOVER` und `SEARCH_ONLY` sind interne Einstufungen,
keine Zusage einer Google-Ausspielung.

## Abgrenzung anderer Wege

`scripts/p3-trends.ts` und `scripts/p4-yt.ts` bleiben **draft-only**.
Ihre bisherigen Trend-/Video-Abläufe ersetzen nicht die vollständige
neue News-Prüfung. Das News-Flag öffnet diese alten Publisher nicht.
Die separaten Quality-/Anti-AI-/TMDB-Fact-Safety-Aufrufe und automatischen
Figuren-/Cast-Bioimporte sind dort entfernt. Entwürfe melden ehrlich
`source-grounding` ausstehend und benötigen vor Freigabe denselben vollständigen
Originalquellen- und Deutschlandreview. TMDB-Handlungsbeschreibungen sind keine
zusätzliche Nachrichtenquelle.

Bio-, Figuren-, Serien- und sonstige Batchskripte sind ebenfalls kein
Teil des regulären News-Schedulers. Kosten und Nebenwirkungen ihrer
manuellen Ausführung sind getrennt zu prüfen.

## Diagnose und Einführung

`pipeline_runs` mit `errorStep`, Artikelzuordnung und Abschlusszeit ist
der erste Diagnosepunkt. Die Scheduler-Referenz erläutert Pausenschalter,
Laufsperre, Backoff, Recovery und echte Ergebniszähler. Ein öffentlicher
Healthcheck prüft nicht automatisch Datenbank, Anbieter und Pipeline.

Bei OpenAI 429 konkrete Fehlerkategorie und dem Key zugeordnetes Projekt
prüfen: Rate-Limit, Projektquote und Abrechnung sind verschiedene
Ursachen. Guthaben in einem anderen Projekt oder Konto ist kein Beleg
für den verwendeten Zugang. Keine Keys im Chat senden und nicht blind
auf einen Proxy ausweichen.

Bei PostgreSQL-Fehlern Coolify-Service, Netzwerk und Verbindungsgrenzen
prüfen. Bei `image-verification` Bildzuordnung und Bildantwort prüfen.
Bei `publication-verification` öffentliche Anzeige und Cache prüfen,
statt denselben Artikel erneut einzufügen.

Vor jeder Produktionsänderung **Datenbank- und Volume-Backups samt
Wiederherstellungsweg verifizieren**. Produktionsbranch, Commit und
Deploy-Trigger bestätigen; keine Prisma-Migration gegen Produktion.
Nach dem Rollout ist ein begleiteter automatischer Einzellauf mit
Quellen-, Fakten-, Regions-, Bild- und Sichtbarkeitskontrolle erforderlich.
Gegebenenfalls den anschließenden Recovery-Lauf mitprüfen.

Lokal steht `npm run test:pipeline` für isolierte Regressionstests bereit:
Faktenextraktion, Schreib-/Strukturregeln, vollständige Quellenprüfung,
einmalige Revision, Bild-/Publikationskontrolle, Retry, Sperre und Recovery.
Das ersetzt keine Produktionsabnahme. Bis zu diesem separaten Nachweis
sind die dokumentierten Änderungen **lokal, nicht live verifiziert**.

### Vertiefung und Qualitätsabnahme vom 21. September

Alle Cron-, Publisher- und Nebenwege sind in `PIPELINE_PATH_INVENTORY.md`
erfasst; tatsächliche Coolify-Konfiguration, Taskpause und Restore-Belege in
`PIPELINE_LIVE_AUDIT_2026-09-21.md`. P2/Admin, P3/P4 sowie nachträgliche
generische Video-Anreicherung sind lokal zusätzlich abgesichert. Ruhende
Alt-Publisher dürfen nicht als Ersatz für den neuen Import gestartet werden.

`npm run eval:news` prüft nur die synthetischen Testfälle und ihre
Erwartungen, ohne Netzwerk oder Modell. Ein ausdrückliches `--live` aktiviert
den echten Faktenextraktor, NEWS-Writer und Prüfer; mit `--case <id>` begrenzen.
`--output-dir <neues-absolutes-lokales-Verzeichnis>` speichert ausschließlich
als synthetisch gekennzeichnete Texte, Ergebnisse und eine menschliche Rubrik.
Keine Datenbank, kein automatisches Nachladen von URLs und keine Publikation.
Der Lauf testet auch absichtliche Falschbehauptungen in unterschiedlichen
Artikelfeldern. Ein automatisches Pass ist keine menschliche Freigabe.
Vor dem Rollout zusätzlich aktuelle echte Originalquellen und echte Bilder
in einer getrennten Umgebung prüfen. Der synthetische Modelllauf wurde
in dieser Arbeitsrunde noch nicht durchgeführt.
