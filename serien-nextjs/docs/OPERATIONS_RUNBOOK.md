# Betriebs-Runbook

Praktische Troubleshooting-Anleitung für die häufigsten Ausfallmuster.
Bei jedem Punkt: **erst reproduzieren/verifizieren, dann fixen** — nicht
raten.

## "Keine neuen News erscheinen"

Reihenfolge der Prüfung (jeder Schritt kann die Ursache sein — der Bug ist
in der Vergangenheit mehrfach an unterschiedlichen Stellen der Kette
aufgetreten):

1. **Läuft der Scheduler-Prozess überhaupt?**
   ```bash
   sudo supervisorctl status pipeline-scheduler
   tail -n 100 /var/log/supervisor/pipeline-scheduler.log
   ```
   Sucht nach: `tsx: not found` (siehe Lessons Learned #2 in `HANDOFF.md`),
   Crash-Loops, oder ob der letzte Log-Eintrag Stunden/Tage alt ist (Prozess
   hängt).

2. **Zeigt Supervisor auf das richtige Skript?** Muss
   `scripts/news-scheduler.ts` sein (nicht ein alter/umbenannter Dateiname).
   ```bash
   grep -A 10 "program:pipeline-scheduler" /etc/supervisor/conf.d/*.conf
   ```

3. **Hat der Prozess Zugriff auf alle benötigten Binaries/Module?** Prüfe
   die `environment=`-Zeile im Supervisor-Block — muss `PATH` UND
   `NODE_ENV` in **einer einzigen** `environment=`-Zeile enthalten (siehe
   `PIPELINE_AND_LLM.md` Abschnitt 1 zur Zwei-Zeilen-Falle). Falls ein
   Python-Subprozess (`generate-character-content.py`) fehlschlägt: prüfen,
   ob das venv mit `openai`-Paket im PATH des Supervisor-Prozesses liegt.

4. **`pipeline_runs`-Tabelle abfragen** — zeigt die echte Ursache präziser
   als jedes Text-Log:
   ```sql
   SELECT id, pipeline, trigger, status, "errorStep", "errorMessage", "startedAt"
   FROM pipeline_runs
   ORDER BY "startedAt" DESC
   LIMIT 20;
   ```
   - `errorStep = 'us-corporate-news'` o. ä. → struktureller Filter hat
     legitim alle aktuellen Quellen-Artikel verworfen (kein Bug, ggf. Quellen
     erweitern).
   - `errorMessage` enthält `429`/`credits` → OpenAI-Billing-Problem, siehe
     unten.
   - Keine neuen Zeilen seit Stunden trotz laufendem Scheduler → Scheduler
     hängt fest oder wirft eine Exception VOR dem ersten Pipeline-Call
     (Scraping-Schritt selbst schlägt fehl, z. B. weil eine RSS-Quelle down
     ist) — Scheduler-Log genauer lesen.

5. **Niemals allein auf "processed: N" im Scheduler-Log vertrauen** — das
   zählt nur "keine Exception geflogen", nicht "wirklich publiziert". Immer
   gegen `articles.status = 'published'` mit passendem `publishedAt`
   gegenprüfen.

## "OpenAI 429 — You have no credits remaining"

```
429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.
```

→ Kein Code-Fehler. Erfordert Aktion im OpenAI-Billing-Dashboard (Guthaben
aufladen / Auto-Recharge aktivieren). Sobald erledigt: keine Code-Änderung
nötig, der nächste Scheduler-Tick (oder manueller Trigger über
`POST /api/admin/pipeline`) sollte sofort wieder funktionieren. Nach der
Aufladung: einen End-to-End-Lauf abwarten/triggern und über `pipeline_runs`
+ Live-Check der Homepage/`/news` verifizieren, dass tatsächlich wieder neue
Artikel publiziert werden — nicht nur den Fehler als "behoben" annehmen,
weil das Guthaben da ist.

## "Prisma / Neon P1001 (Connection Error)"

```
PrismaClientKnownRequestError: ... Code: P1001
```

Neon (serverless Postgres) hat gelegentliche Cold-Start-Verzögerungen nach
Inaktivität. Einmal retryen (manueller Reload/Retry reicht meist). Nur wenn
der Fehler wiederholt und dauerhaft auftritt: `DATABASE_URL` selbst prüfen
(Neon-Projekt pausiert? Connection-Limit erreicht? IP-Allowlist bei
Migration auf neue Infrastruktur?).

## "Yieldlab liefert dauerhaft NoBid"

Siehe `AD_STACK.md` Abschnitt 3+5+8 für die vollständige Diagnose-Historie.
Kurzfassung: technischer Client-Setup (ads.txt, Schain, TCF-Consent) wurde
mehrfach als korrekt verifiziert (`/adtest-prebid`, `/api/adtest/chain-check`)
— verbleibende Ursache liegt vermutlich auf Vermarkter-/Demand-Seite
(Floor-Price, fehlende Kampagnen). Kein rein clientseitig lösbares Problem.

## Supervisor-Konfiguration ändern — sicherer Ablauf

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
antwortet der Endpoint absichtlich mit 503. Nach einer Rotation müssen alle
Coolify-/Supervisor-/externen Scheduler gemeinsam aktualisiert und einmal
manuell mit dem Header getestet werden.

Der öffentliche Push-Subscribe-Endpunkt besitzt zusätzlich eine lokale
Missbrauchsbremse. Diese ist pro Prozess und ersetzt keine persistente
Cloudflare-Rate-Limit-Regel für `/api/push/subscribe`.

## Backlog (Stand Erstellung dieser Doku)

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
- **Hetzner/Coolify-Migrationsstatus**: siehe `MIGRATION_GUIDE.md` — Status
  zum Zeitpunkt dieser Doku unbedingt live nachprüfen, nicht aus alten
  Notizen übernehmen.
- **Freshness-Alarm fehlt**: keine automatische Warnung, falls die
  News-Pipeline mal wieder tagelang keine echten Publishes produziert (ist
  in der Vergangenheit unbemerkt eine Woche lang passiert). Ein einfacher
  Cron-Check "letzter `articles.publishedAt` älter als X Stunden → Alert"
  wäre die naheliegende Lösung, existiert aber noch nicht.

## Wie man den aktuellen Pipeline-Status selbst schnell prüft

```bash
# Letzte 10 Pipeline-Runs
psql "$DATABASE_URL" -c "SELECT pipeline, trigger, status, \"errorStep\", \"startedAt\" FROM pipeline_runs ORDER BY \"startedAt\" DESC LIMIT 10;"

# Letzter publizierter Artikel
psql "$DATABASE_URL" -c "SELECT slug, title, \"publishedAt\" FROM articles WHERE status='published' ORDER BY \"publishedAt\" DESC LIMIT 5;"

# Scheduler-Prozess-Status
sudo supervisorctl status pipeline-scheduler
tail -n 50 /var/log/supervisor/pipeline-scheduler.log
```

(`psql` erfordert, dass `DATABASE_URL` als Env-Variable im Shell-Kontext
gesetzt ist bzw. explizit übergeben wird — Wert nie im Klartext in Logs/
Dokumentation schreiben.)
