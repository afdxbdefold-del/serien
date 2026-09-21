# Betrieb der automatischen News-Pipeline

Stand: 21. September 2026, lokaler Arbeitsstand auf `codex/takeover`.

**Die beschriebenen Verbesserungen sind lokal implementiert und noch nicht
ausgerollt. Dieses Dokument bestätigt keinen erfolgreichen Produktivlauf
und keine aktuell eingeschaltete automatische Veröffentlichung.**

## Produktionsumgebung

serien.de und PostgreSQL laufen auf Hetzner unter Coolify. Die
Management-Oberfläche `http://168.119.171.20:8000/` spricht auf Port 8000
HTTP. Neon wird nicht verwendet.

Das bekannte Betriebsmodell ist ein Next.js-Anwendungscontainer mit einem
separaten PostgreSQL-Service. Coolify Scheduled Tasks rufen geschützte
`/api/cron/*`-Routen auf. Tatsächlicher Produktionsbranch, Commit,
Dockerfile, Task-Liste und Deploy-Trigger müssen vor dem Rollout erneut
geprüft werden. Ältere Aussagen über `main` sind keine Deploy-Freigabe.

Die bisherigen Behauptungen über separate TVLine-/Cinemaholic-Supervisor-
Jobs, automatisch rotierte Logdateien und „fully operational“ waren kein
belastbarer Produktionsnachweis. Für den neuen News-Betrieb gilt:

```text
Coolify Scheduled Task → /api/cron/news
  → Pause und gemeinsame Laufsperre
  → gespeicherte Artikel gegebenenfalls erneut sichtbar prüfen
  → Quellen finden und bereits behandelte Kandidaten aussortieren
  → begrenzt schreiben, prüfen und gegebenenfalls veröffentlichen
  → Cache-Aktualisierung und öffentliche Prüfung
  → tatsächliches Ergebnis protokollieren
```

## Aufruf und Einstellungen

`GET` und `POST /api/cron/news` verlangen einen Bearer-Header mit dem
intern gesetzten `CRON_SECRET`. Keine Secrets in URL-Parametern.
Fehlende Serverkonfiguration ergibt HTTP 503, ungültige Authentifizierung
HTTP 401. Secret-Werte niemals in Chat, Dokumentation oder Logs ausgeben.

Der produktive Rhythmus wird in **Coolify Scheduled Tasks** eingestellt.
`NEWS_INTERVAL_HOURS` verändert diesen Zeitplan nicht.

| Einstellung | Verhalten im lokalen Code |
| --- | --- |
| `OPENAI_API_KEY` | Eigener direkter OpenAI-Zugang; NEWS `gpt-6-astra` / `low`, kein Emergent-Fallback |
| `TMDB_API_KEY` | Serienzuordnung, Metadaten und Backdrops |
| `AUTOMATED_NEWS_PUBLISHING_ENABLED` | Nur exakt `true` erlaubt nach bestandenen Prüfungen das Veröffentlichen; Beispielkonfiguration bleibt `false` |
| `AUTOMATED_EDITORIAL_AUTHOR_ID` | Vorhandenes Konto mit Rolle `author`; Standard `redaktion` |
| `NEWS_LIMIT` | Standard 5 Kandidaten insgesamt pro Lauf, zulässig 1–20; keine vorgeschriebene Veröffentlichungszahl |
| `NEWS_RUN_BUDGET_MS` | Standard 210000 ms; Route/Daemon begrenzen auf 600000 ms |
| `CRON_SECRET` | Authentifizierung des Scheduled Tasks |
| `REVALIDATE_SECRET` | Authentifizierung des separaten internen Cache-Requests |
| `NEWS_INTERVAL_HOURS` | Nur optionaler Daemon: Standard 1 Stunde, positive Ganzzahl bis 24 |

P3-Trends und P4-YouTube bleiben unabhängig vom News-Flag **Entwurfswege**.
Details zu Inhalten und Prüfungen:
[PIPELINE_AND_LLM.md](PIPELINE_AND_LLM.md).

## Pause, Laufsperre und Laufzeit

In `app_settings` trägt der Pausenschalter den Schlüssel
`pipeline.cron.paused`. Die Werte `true` oder `1` pausieren den Import.
Route, normaler CLI-Import und optionaler Daemon prüfen vor Arbeitsbeginn
und erneut vor jedem neuen Kandidaten. Ist die Einstellung nicht lesbar,
stoppt der Lauf. Ein bereits laufender Artikel wird nicht abrupt beendet.

Eine atomar übernommene Sperre unter `pipeline.news.import.lease` in
derselben vorhandenen Tabelle schützt gegen parallele News-Importe über
mehrere Prozesse/Container. Es ist keine Migration nötig.

- Eindeutiger Besitzer je Lauf, Erneuerung alle 30 Sekunden.
- Nach 30 Minuten ohne Erneuerung ist eine verwaiste Sperre übernehmbar.
- Nur der Besitzer darf erneuern oder freigeben.
- Verliert ein Lauf seine Sperre, beginnt er keinen weiteren Kandidaten.
- Ein konkurrierender Aufruf meldet `skipped: true` und
  `reason: already-running`; das ist keine Veröffentlichung.

Das Zeitbudget stoppt den **Beginn weiterer Arbeit**. Bereits laufende
Generierung oder Veröffentlichung wird abgewartet. Ein Timeout wird nicht
mit einem unbeaufsichtigt weiterpublizierenden Hintergrundprozess
verwechselt. Die Route deklariert `maxDuration = 900`; Coolify-Aufrufer
und Proxy brauchen passende eigene Timeouts. Die Code-Deklaration
konfiguriert diese Infrastruktur nicht automatisch.

RSS-/HTML-Anfragen haben jeweils 20 Sekunden Timeout. Zwischen
Kandidaten liegen zwei Sekunden Pause. Google-News-Decoding besitzt
zusätzliche begrenzte Netzwerkaufrufe.

## Auswahl und Wiederholungen

Die HTTP-Route nutzt Cinemaholic, Deadline, Variety, Hollywood Reporter,
Netflix Tudum und TVLine. Der Funktionsstandard des optionalen Workers
enthält zusätzlich Google News Streaming.

Pro Quelle gelangen höchstens 60 gefundene Artikel in den Auswahlpool.
Bestehende `sourceUrl`-Datensätze und bisherige Versuche werden **vor**
dem Gesamtlimit geprüft. Alte Einträge am Feedanfang blockieren dadurch
nicht mehr neue Meldungen dahinter. Quellen wechseln sich ab; der
Startpunkt rotiert in 15-Minuten-Schritten.

- Bestehender Artikel, auch Entwurf: keine erneute Generierung derselben
  Quelle. Entwürfe gezielt redaktionell bearbeiten.
- Erfolg innerhalb 24 Stunden oder laufender Versuch innerhalb einer
  Stunde: zurückstellen.
- Bekannte inhaltliche Ausschlussgründe: bis zu sieben Tage zurückstellen.
  Zweimalige inhaltliche Klassifikationsablehnung innerhalb 72 Stunden
  verhindert wiederkehrende Klassifikationsschleifen.
- Vorübergehende Fehler: nach einem Fehler 15 Minuten, nach zwei Fehlern
  eine Stunde, ab drei Fehlern sechs Stunden Pause. Grundlage ist die
  Endzeit des letzten Versuchs, falls vorhanden.
- Anbieter-, Netzwerk- und Quotenprobleme erzeugen keine pauschale
  siebentägige Artikelsperre. Erkannte Anbieterfehler beenden den Batch;
  weitere Kandidaten bleiben verfügbar.
- `editorial-dependency` bedeutet nicht abgeschlossene Quellenprüfung;
  `image-verification` bedeutet nicht bestätigtes Artikelbild.
  Beides zählt als Fehler, nicht als Veröffentlichung.

RSS-Discovery verwendet standardmäßig 24 Stunden; das harte frühe
Pipeline-Altersgate liegt bei 72 Stunden. Weitere Prüfungen des
Quellzeitpunkts und Nachrichtenwerts gelten zusätzlich. Ein altes
Ereignis wird nicht durch ein frisches Importdatum zur Neuigkeit.
Das abschließende automatische NEWS-Gate verwendet dasselbe 72-Stunden-Fenster.
Entfernte Keyword-, Genre-, Quoten- und unscharfe Dublettenfilter sperren
Kandidaten über ihre alte Laufhistorie nicht länger sieben Tage. Ihre Historie
bleibt erhalten; Retry-Abstand, explizite Sperrlisten und aktuelle echte
Ereignis-Dubletten bleiben wirksam.

## Öffentliche Anzeige nachholen

Nach dem Artikel-Insert werden Cache-Aktualisierung und öffentliche
Kontrolle angestoßen. Ein separater authentifizierter HTTP-Request mit
`REVALIDATE_SECRET` wird bevorzugt. Die direkte Next.js-Revalidierung
im laufenden Handler ist bis zu dessen Antwort **vorgemerkt**; sie ist
kein Nachweis, dass ein gleichzeitig ausgeführter öffentlicher GET schon
neue Daten sieht. Ohne Secret kann deshalb der nächste Cronlauf die
erste vollständige Sichtbarkeitsbestätigung liefern.

Ein gespeicherter Artikel zählt erst bei bestätigter kanonischer Seite,
Headline, tatsächlich ausgeliefertem Bild und erwarteter Listenanzeige
als verifizierte Veröffentlichung. Bei unbestätigter Anzeige bleibt der
Datensatz bestehen; der Lauf erhält `partial` und
`errorStep: publication-verification`.

Der nächste Import prüft bis zu drei solche Artikel aus den letzten
36 Stunden erneut, mit mindestens 15 Minuten Abstand je Artikel.
Er aktualisiert den Cache und prüft die Anzeige; er generiert keinen
neuen Text und fügt keinen zweiten Artikel ein. Bei Erfolg wird der
bisher unbestätigte Lauf auf `success` gesetzt.

Die Carousel-Erwartung folgt der Startseite: neueste Meldungen, höchstens
eine pro Serie, dann die ersten fünf. Inzwischen verdrängte Meldungen
müssen nicht dauerhaft im Carousel bleiben; kanonische Seite und Bild
werden weiterhin geprüft. Offene veröffentlichte Artikel bleiben auch
bei Cooldown oder ausgeschöpftem Prüfkontingent als ausstehend sichtbar.
Der offene Bestand zählt eindeutige noch publizierte Artikel, keine
gelöschten oder zurückgezogenen Datensätze. Offene Fälle außerhalb des
36-Stunden-Fensters bleiben sichtbar, benötigen aber eine gezielte
Untersuchung statt weiterer automatischer Nachprüfungen.

## Resultate richtig lesen

| Feld | Bedeutung |
| --- | --- |
| `processed` / `attempted` | Angefangene Kandidaten, auch bei Ablehnung oder Fehler |
| `published` | Neu gespeichert und öffentlich verifiziert |
| `drafted` | Entwürfe, keine Veröffentlichung |
| `publicationPending` | Noch offene öffentliche Bestätigungen gespeicherter Artikel |
| `publicationRecovered` | Frühere Veröffentlichung jetzt erfolgreich nachgeprüft |
| `failed` / `sourceErrors` | Kandidatenfehler / fehlgeschlagene Quellenabfragen |
| `deferred` | Wegen Limit, Budget, Pause oder Anbieterproblem zurückgestellt |
| `skipped` | Bereits behandelte oder inhaltlich ausgeschlossene Kandidaten |

Ein `cron-news`-Lauf kann auch ohne neue Meldung technisch erfolgreich
enden. HTTP 200 oder sein `status: success` allein beweisen **keinen
neuen Artikel**. Einzelne `pipeline-v2`-Läufe, Artikeldatensätze und
öffentliche Kontrollen sind maßgeblich.

Entwürfe, unbestätigte Anzeige, Teilfehler und Budgetende ergeben
Teilerfolg. Wenn alle Quellen scheitern, ein Anbieter ausfällt oder
trotz eingeschalteter Automatik über 36 Stunden kein automatisch
veröffentlichter Artikel nachweisbar ist, antwortet die Route mit
HTTP 503. Manuelle Artikel verdecken diesen Ausfall nicht.

Lesende Diagnose ohne Konfigurationswerte:

```sql
SELECT pipeline, trigger, status, "errorStep", "articleSlug",
       "startedAt", "completedAt", "durationMs"
FROM pipeline_runs
WHERE pipeline IN ('pipeline-v2', 'cron-news')
ORDER BY "startedAt" DESC
LIMIT 30;
```

Interne Altlogs vor Weitergabe auf Secrets prüfen. Die neuen
Scheduler-Fehlerausgaben verwenden sichere Fehlerkategorien.

## Optionaler Daemon

`scripts/news-scheduler.ts` ist eine ausdrücklich einzurichtende
Alternative zum HTTP-Scheduled-Task. Er wartet einen Import vollständig
ab und beginnt erst danach die konfigurierte Wartezeit. Er nutzt
denselben Pausenschalter und dieselbe Sperre. Ein Stoppsignal wartet
den aktiven Import ab.

Logs gehen nach stdout. Aufbewahrung und Rotation müssen im eingesetzten
Containerbetrieb eingerichtet und geprüft werden. Ein eigenes unbegrenzt
wachsendes `news-scheduler.log` wird nicht mehr erzeugt. Einen zusätzlichen
Supervisor-Job nicht ohne bewusste Betriebsumstellung starten.

## Einführung in Produktion

1. Produktionsbranch, Commit, Build-Konfiguration, Scheduled Tasks und
   Deploy-on-push-Trigger live bestätigen. Auf `codex/takeover` bleiben;
   `main` ohne ausdrückliche Freigabe weder ändern noch mergen oder deployen.
2. Vor jeder Produktionsänderung aktuelles Datenbankbackup **und**
   persistente Volume-Backups samt Wiederherstellungsweg verifizieren:
   Zeitpunkt, Integrität und erreichbaren Speicherort belegen.
   Ein vorhandenes Volume ist kein Backup.
3. Lokal `npm run test:pipeline` ausführen und Änderungen prüfen.
   Isolierte Tests ersetzen keinen Live-Lauf.
4. Den geprüften Stand über den bestätigten Deploymentweg ausrollen.
   Anbieterzugang, Autorenkonto und Cron-Authentifizierung ohne
   Secret-Ausgabe prüfen. Keine Prisma-Migration gegen Produktion.
5. Einen begleiteten automatischen Einzellauf mit kleinem Kandidatenlimit
   über den regulären Cronweg durchführen. Quelle, Fakten, Region,
   Bildzuordnung, gespeicherten Status, kanonische Seite, geladenes Bild,
   Startseite/Carousel und `/news` gemeinsam kontrollieren. Falls die
   Revalidierung vorgemerkt blieb, auch den Recovery-Lauf prüfen.
6. Erst nach diesem Nachweis regelmäßige Automatik freigeben
   beziehungsweise fortsetzen und die ersten Ergebnisse kontrollieren.
   Bei Fehlern pausieren und diagnostizieren, nicht Prüfungen abschalten.

Dies ist die Anleitung für die noch ausstehende Einführung. Durchführung
und Live-Erfolg sind danach separat zu dokumentieren.
