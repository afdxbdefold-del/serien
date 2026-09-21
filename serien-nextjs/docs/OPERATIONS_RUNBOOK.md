# Betriebs-Runbook

Praktische Troubleshooting-Anleitung für die häufigsten Ausfallmuster.
Bei jedem Punkt: **erst reproduzieren/verifizieren, dann fixen** — nicht
raten.

**Produktionsstand 21. September 2026:** Die Anwendung und PostgreSQL laufen
als zwei getrennte Coolify-Ressourcen auf einem Hetzner-Server. Der
Anwendungscontainer startet ausschließlich `next-server`; es gibt keinen
Supervisor-, Worker- oder separaten Scheduler-Container. Automatisierung läuft
über Coolify Scheduled Tasks gegen `/api/cron/*`.

Coolify ist lokal unter `http://168.119.171.20:8000/` erreichbar. Port 8000
spricht ausschließlich HTTP; bei Betriebsprüfungen nicht automatisch auf HTTPS
wechseln. Die Anwendung baut inzwischen Branch `codex/takeover`, und
Auto-Deploy bleibt auf **„Manual deployments only“**. Laufender Commit seit
dem erfolgreichen Deployment `bqwzdqac1fw9xfyw5ve38vr7` um 14:28 UTC:
`cbd216ffb3868ca91a986a601984a46db0f71961`. Neuer Container
`i8e996hq5t8moyf9fw8p0pbs-142026647632`: gesund, Neustartzähler 0,
`OOMKilled=false`. PostgreSQL und Schema blieben unverändert; `main` ebenfalls.
Der frühere Tages-Snapshot `PIPELINE_LIVE_AUDIT_2026-09-21.md` ist für die
Rollout-Angaben durch diesen Nachtrag und `TAKEOVER_STATUS.md` überholt.

**Astra-Code live, unbeaufsichtigte News-Automatik noch nicht freigegeben.**
News-, YouTube- und Video-Tasks sind deaktiviert. Sieben synthetische
Modellfälle bestanden; zwei echte Quellenläufe scheiterten an der zu kleinen
2-MiB-HTML-Grenze. Netflix lieferte vollständig rund 3,6 MB HTML in etwa einer
Sekunde. `destroy()` löste vor der Fehlerfestschreibung ein `aborted` aus,
das fälschlich als Timeout kategorisiert wurde. Der Folgefix begrenzt HTML
auf 8 MiB, bewahrt die Ursache und belässt Quelltextgrenze und Qualitätsregeln.
Tests für Streaming-Grenze/Redirects und eine vollständige Extraktion von
1.351 Wörtern bestanden. Die originale Netflix-Veröffentlichung war vom
17. September; ein erfolgreicher Abruf macht diese alte Quelle nicht zu
einer aktuellen News. Die globale Pause wird während Einzeltests kontrolliert
behandelt und muss vor jeder Aktion neu geprüft werden. Keine erfolgreiche
automatische Veröffentlichung allein aus dem grünen Deployment ableiten.

Öffentliche Nachprüfung: Startseiten-Karussell mit fünf geladenen Bildern,
`/news` mit HTTP 200/HTML und vier Sitemaps mit HTTP 200/XML. Die um 14:30 UTC
erneut bestätigten Backup-Prüfsummen gehören zum erfolgreich logisch und
physisch isoliert wiederhergestellten Satz vom 21. September; dessen
Offsite-Kopie bleibt offen.

## Vor jedem weiteren Build

Der erfolgreiche Build nutzte `serien-bounded` mit nachgewiesenen
Kernel-Grenzen von 1024 MiB RAM, maximal 2048 MiB Swap und 0,75 CPU sowie
einen 4-GiB-Host-Swap-Puffer (root/0600). Dieser Swap wird **nach einem
Host-Neustart nicht automatisch aktiviert**. Builder und Sicherheitswächter
sind nach Abschluss gestoppt, kein fortlaufender Schutzdienst wird behauptet.
Vor einem neuen Build Backup, aktiven Swap, RAM-/Datenträgerreserve, Grenzen
und Überwachung erneut prüfen; Auto-Deploy nicht beiläufig freischalten.
Vollständiger Ablauf: `BOUNDED_BUILD_RUNBOOK.md`.

## "Keine neuen News erscheinen"

Reihenfolge der Prüfung (jeder Schritt kann die Ursache sein — der Bug ist
in der Vergangenheit mehrfach an unterschiedlichen Stellen der Kette
aufgetreten):

1. **Laufen die Coolify Scheduled Tasks?** In der Anwendung unter
   `Scheduled Tasks` den letzten Status und die Ausführungsausgabe prüfen.
   Aktuell sind News-, YouTube- und Video-Task absichtlich deaktiviert,
   bis die fachliche Abnahme bestanden ist. Im früheren Snapshot am
   21. September waren zehn Jobs aktiv und kein `trends`-Task sichtbar;
   News antwortete damals mit `skipped / pipeline.cron.paused` trotz grünem
   Tasklabel. Deshalb immer aktuellen Taskzustand, Pause und Antwort prüfen.
   Die am 12. September beobachteten HTTP-401-Fehler von `downgrade-stale`
   und `videos` sind historische Befunde, nicht erneut aktuell nachgewiesen.

2. **Entspricht jeder Job einer vorhandenen Route?** Route und HTTP-Methode
   im aktuellen Branch prüfen. `tmdb-sync` und `backfill-streaming-series`
   sind derzeit absichtliche No-ops; `flixpatrol` ist gegenüber
   dem Coolify-Job `tmdb-top10-daily` veraltet. Dessen Code-Endpunkt heißt
   `/api/cron/tmdb-top10`. Ein grüner Jobstatus beweist deshalb noch keine
   fachliche Wirkung.

3. **Laufen Anwendung und Datenbank gesund?** Containerstatus, Healthcheck,
   Neustartzähler und aktuelle Logs in Coolify prüfen. Der öffentliche
   `/api/health`-Endpunkt testet nur die Erreichbarkeit des Next.js-Prozesses,
   nicht PostgreSQL, R2 oder die News-Pipeline.

4. **`pipeline_runs`-Tabelle abfragen** — zeigt die echte Ursache präziser
   als jedes Text-Log:
   ```sql
   SELECT id, pipeline, trigger, status, "errorStep", "errorMessage", "startedAt"
   FROM pipeline_runs
   ORDER BY "startedAt" DESC
   LIMIT 20;
   ```
   - `errorStep = 'us-corporate-news'` oder andere alte Schlagwortfilter →
     zuerst laufenden Commit prüfen. Der ausgerollte Astra-NEWS-Pfad ersetzt solche
     Pauschalsperren durch vollständige Quellen- und Deutschlandprüfung.
     Eine alte Ablehnung ist kein Beweis, dass die Meldung irrelevant war.
   - `errorMessage` enthält `429`/`credits` → OpenAI-Billing-Problem, siehe
     unten.
   - Keine neuen Zeilen seit Stunden trotz ausgeführtem Coolify-Task →
     Task-Ausgabe und App-Logs prüfen. Die Route kann vor dem ersten
     Pipeline-Call abbrechen, etwa bereits beim Scraping einer nicht
     erreichbaren Quelle.

5. **Niemals allein auf "processed: N" in Task-/App-Logs vertrauen** — das
   zählt nur "keine Exception geflogen", nicht "wirklich publiziert". Immer
   gegen `articles.status = 'published'` mit passendem `publishedAt`
   gegenprüfen.

## "OpenAI 429 — You have no credits remaining"

Die ausgerollte NEWS-Konfiguration ist `gpt-6-astra` / `low`. Sieben
synthetische Astra-Modellfälle wurden erfolgreich geprüft; das ist keine
vollständige Quellen-/Veröffentlichungsabnahme. Modellberechtigung und echte
Textqualität bleiben getrennte Prüfungen. Der admin-geschützte
`/api/debug/llm-version` führt einen kleinen, kostenpflichtigen Astra-Probeaufruf
aus (maximal 1024 Completion-Tokens, 45 Sekunden, keine Wiederholung) und gibt
nur Konfiguration/Status zurück. Nicht als periodischen Healthcheck verwenden.
`npm run eval:news` bleibt standardmäßig ohne Modellaufruf.

```
429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.
```

→ Zuerst unterscheiden: Rate-Limit, Projektquote und tatsächlich fehlendes
Guthaben. Ein grüner Kontostand beweist nicht, dass der verwendete Key diesem
Projekt zugeordnet ist. Aufladen oder Auto-Recharge nur nach ausdrücklicher
Freigabe; nicht pauschal als Fehlerbehebung empfehlen. Die aktuelle News-Pause
ist unabhängig davon. Nach bestätigter Anbieter-Funktion und sicherer
Konfiguration den nächsten Lauf abwarten oder nach ausdrücklicher Freigabe
genau einen kontrollierten End-to-End-Lauf auslösen und über `pipeline_runs`
+ Live-Check der Homepage/`/news` verifizieren, dass tatsächlich wieder neue
Artikel publiziert werden — nicht nur den Fehler als "behoben" annehmen,
weil das Guthaben da ist.

## "Prisma / PostgreSQL P1001 (Connection Error)"

```
PrismaClientKnownRequestError: ... Code: P1001
```

Die Produktionsdatenbank ist ein dauerhaft laufender Coolify-Service mit dem
Image `postgres:17-alpine`, kein serverless Neon-Projekt. Das leere Feld für
die initiale Datenbank fällt auf den Benutzer `postgres` zurück; effektiver
Datenbankname ist `postgres`. Die Daten liegen im Volume
`postgres-data-oun4xzvaum4o58fglnuqks6y` unter
`/var/lib/postgresql/data`. Bei einem einzelnen Fehler einmal retryen. Bei
Wiederholung in dieser Reihenfolge prüfen: Datenbank-Container und
Healthcheck, Neustartzähler und PostgreSQL-Logs, Auslastung des
Connection-Limits, Auflösung/Erreichbarkeit im privaten Coolify-Netzwerk und
zuletzt die Konfiguration von `DATABASE_URL`. Den Wert der Variable niemals
in Logs oder Chat ausgeben.

## "Yieldlab liefert dauerhaft NoBid"

Siehe `AD_STACK.md` Abschnitt 3+5+8 für die vollständige Diagnose-Historie.
Kurzfassung: technischer Client-Setup (ads.txt, Schain, TCF-Consent) wurde
mehrfach als korrekt verifiziert (`/adtest-prebid`, `/api/adtest/chain-check`)
— verbleibende Ursache liegt vermutlich auf Vermarkter-/Demand-Seite
(Floor-Price, fehlende Kampagnen). Kein rein clientseitig lösbares Problem.

## Historisch/optional: Supervisor-Konfiguration ändern — sicherer Ablauf

Dieser Abschnitt gilt nicht für die am 1. September 2026 verifizierte
Produktion. Er ist nur relevant, wenn später ausdrücklich wieder ein separater
Daemon außerhalb des aktuellen App-Containers eingeführt wird.

```bash
# 1. Config-Datei bearbeiten
# 2. NICHT supervisord komplett neu starten (kann zu XML-RPC-Fehlern führen)
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status <program-name>
tail -f /var/log/supervisor/<program-name>.log
```

Bei mehreren `environment=`-Zeilen im selben `[program:x]`-Block: IMMER zu
einer Zeile zusammenführen, kommagetrennt (`PATH="...",NODE_ENV="..."`).

## Sicherheit: Cron-Endpunkte

Alle `/api/cron/*`-Routen verlangen ausschließlich
`Authorization: Bearer <CRON_SECRET>`. Das Secret darf weder als Query-Parameter
noch in Logs oder Scheduler-URLs stehen. Ist `CRON_SECRET` nicht gesetzt,
antwortet der Endpoint absichtlich mit 503. Nach einer Rotation müssen die
App und alle tatsächlich eingesetzten Coolify-/externen Scheduler gemeinsam
aktualisiert und jede Route einmal ohne Ausgabe des Werts getestet werden.

Der öffentliche Push-Subscribe-Endpunkt besitzt zusätzlich eine lokale
Missbrauchsbremse. Diese ist pro Prozess und ersetzt keine persistente
Cloudflare-Rate-Limit-Regel für `/api/push/subscribe`.

## Backlog (historische Einzelbefunde, wo nicht anders datiert)

- **RapidAPI-Trailer-Download**: alle 3 Fallbacks lieferten HTTP 403 (Key
  vermutlich abgelaufen/Quota erschöpft). `RAPIDAPI_KEY_BACKUP` war zuletzt
  identisch mit `RAPIDAPI_KEY` — für einen funktionierenden Fallback muss
  das ein echter zweiter Key sein.
- **Sitemap-Prewarm** (`/api/internal/revalidate-sitemap`) lieferte zuletzt
  401 Unauthorized — Secret/Header-Mismatch, noch nicht tief untersucht.
  Betroffene Tabelle für Live-Status: `sitemap_prewarm_log`.
- **Zwei fehlende R2-Poster** (TMDB-IDs 79744, 1396) — leere Top-10-Kacheln
  im Frontend für diese zwei Serien.
- **12 nahezu identische AI-Autoren-Personas** — potenzielles
  SpamBrain-/E-E-A-T-Risiko bei Google, Konsolidierung auf weniger, klarer
  unterscheidbare Autoren-Profile ist offen.
- **`trailer.de`-Headline-Grammatik**: bekannter Dativ-Fehler in der
  automatischen Titelbau-Logik für diese eine Domain-Variante.
- **PostgreSQL-Backup-Automatisierung**: Hetzner/Coolify ist die bestätigte Produktion.
  In Coolify sind kein Datenbank-Backupplan und kein S3-Backupziel
  konfiguriert. Der aktuelle Satz vom 21. September enthält einen Custom-Dump
  und ein konsistentes physisches Basebackup; beide getrennt erfolgreich
  wiederhergestellt (4.360 Artikel, 44 Tabellen), Prüfsummen zuletzt 14:30 UTC
  erneut bestätigt. Dessen externe Kopie fehlt noch. Die bereits vorhandene
  private R2-Kopie vom 12. September ersetzt diese frische Kopie nicht.
  Automatische, überwachte Backupplanung und regelmäßiger Restore-Test bleiben
  offen.
- **Freshness-Schutz deployed, Alarmbetrieb noch abzunehmen**: Der ausgerollte
  Code markiert vollständige Quellfehler und – nur
  bei ausdrücklich aktivierter automatischer Veröffentlichung – mehr als
  36 Stunden ohne neuen Publish mit HTTP 503 und einem fehlgeschlagenen
  Pipeline-Run. Solange der News-Task deaktiviert ist, läuft auch diese
  Überwachung nicht regelmäßig. Benachrichtigungen über fehlgeschlagene
  Coolify-Task-Ausführungen müssen separat geprüft werden.

## Wie man den aktuellen Pipeline-Status selbst schnell prüft

### Ausgerollter Code und noch offene News-Abnahme

Der neue Ablauf ist seit 21. September, 14:28 UTC, auf `codex/takeover`
ausgerollt. Der vollständige Build einschließlich 164 statischer Seiten und
Image-Import bestand; sieben synthetische echte Modellfälle waren ebenfalls
erfolgreich. Das ersetzt keinen vollständigen echten Quellen-/Publikationslauf.
Der projektweite Typecheck enthält weiterhin Altfehler. Details stehen in
`PIPELINE_AND_LLM.md` und `PIPELINE_SCHEDULER.md`.

Für Folgeänderungen und die noch offene Automatik-Abnahme gilt diese Reihenfolge;
bereits erledigte Rolloutschritte nicht ohne Anlass wiederholen:

1. Den angemeldeten serien.de-Tab unter `http://168.119.171.20:8000/`
   öffnen. Andere Coolify-Instanzen sind nicht serien.de. Aktuellen
   Produktionsbranch, Commit und automatische Deploy-Trigger lesen; vorher
   nicht pushen. `main` bleibt unverändert.
2. Frischen konsistenten Datenbank-Dump und das persistente Volume-Backup
   verifizieren, inklusive Wiederherstellbarkeit und externem Sicherungsziel.
   Historische Sicherungen ersetzen diese Prüfung nicht.
3. In einer getrennten Testumgebung einen echten Quellenlauf ausführen:
   zunächst Entwurf, vollständiger Quelltext, belegte Termine/Regionen,
   redaktionelle Prüfung und gegebenenfalls eine Revision. Schlüssel ausschließlich
   in der vorgesehenen Umgebung bereitstellen, niemals in Chat/Logs.
4. Nur den geprüften `codex/takeover`-Stand ausrollen. Keine Migration,
   kein `prisma db push`, keine Secret-Rotation als Nebenwirkung dieser Reparatur.
5. Den vorhandenen Coolify-News-Task, Pause-Schalter, Autorenkonto und Namen
   der erforderlichen Variablen prüfen. Ein kontrollierter Einzeltest darf
   nicht mit dauerhaft freigegebener Automatik verwechselt werden:
   `AUTOMATED_NEWS_PUBLISHING_ENABLED` und Pause bewusst für den Test prüfen,
   mit `NEWS_LIMIT=1` beginnen; den Scheduled Task erst nach Abnahme aktivieren.
   Ein Scheduler genügt, kein zusätzlicher paralleler Daemon erforderlich.
6. Einen begleiteten automatischen Publish prüfen: gespeicherter Artikel,
   kanonische Seite, korrektes Bild einschließlich tatsächlich ausgelieferter
   Bilddatei, Startseiten-Karussell und News-Liste. Im HTTP-Handler wird eine
   lokale Cache-Invalidierung erst nach Antwortende ausgeführt. Ohne wirksamen
   separaten Revalidate-Aufruf kann die Bestätigung deshalb erst im nächsten
   Cronlauf erfolgen. `partial/publication-verification` ist kein neuer
   Generierungsauftrag; Wiederholungen prüfen den vorhandenen Datensatz.
7. Fehlerauswertung des Tasks mit HTTP-Fehlerstatus und ausreichend langem
   Request-Timeout verifizieren. Nach 36 Stunden ohne bestätigten automatischen
   Publish muss der aktivierte News-Import fehlschlagen; manuelle News dürfen
   diesen Ausfall nicht verdecken. Benachrichtigung in Coolify separat prüfen.

Bei Rollback zunächst automatische Veröffentlichung pausieren und den zuvor
verifizierten App-Commit wiederherstellen. Bereits veröffentlichte Artikel nicht
automatisch löschen; fehlerhafte Inhalte gezielt redaktionell korrigieren.

```bash
# Letzte 10 Pipeline-Runs
psql "$DATABASE_URL" -c "SELECT pipeline, trigger, status, \"errorStep\", \"startedAt\" FROM pipeline_runs ORDER BY \"startedAt\" DESC LIMIT 10;"

# Letzter publizierter Artikel
psql "$DATABASE_URL" -c "SELECT slug, title, \"publishedAt\" FROM articles WHERE status='published' ORDER BY \"publishedAt\" DESC LIMIT 5;"

# Produktions-Schedulerstatus
# In Coolify: Anwendung -> Scheduled Tasks -> letzte Ausführungen prüfen.
# Die App selbst enthält keinen Supervisor-Prozess.
```

(`psql` erfordert, dass `DATABASE_URL` als Env-Variable im Shell-Kontext
gesetzt ist bzw. explizit übergeben wird — Wert nie im Klartext in Logs/
Dokumentation schreiben.)
