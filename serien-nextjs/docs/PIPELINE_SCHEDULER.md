# Content Pipeline Scheduler Documentation

## ✅ Setup Complete

Automatische Content-Pipelines wurden erfolgreich eingerichtet für:
- **TVLine** - Alle 2 Stunden zur vollen Stunde
- **CinemaHolic** - Alle 2 Stunden zur vollen Stunde, offset +1h

---

## 📅 Zeitplan

### TVLine Auto-Pipeline
- **Frequenz**: Alle 2 Stunden
- **Zeitpunkte**: 00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
- **Skript**: `/app/serien-nextjs/scripts/tvline-auto-pipeline.ts`
- **Log**: `/var/log/tvline-pipeline.log`

### CinemaHolic Auto-Pipeline
- **Frequenz**: Alle 2 Stunden (offset)
- **Zeitpunkte**: 01:00, 03:00, 05:00, 07:00, 09:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00, 23:00
- **Skript**: `/app/serien-nextjs/scripts/cinemaholic-auto-pipeline.ts`
- **Log**: `/var/log/cinemaholic-pipeline.log`

**Warum zeitversetzt?**
Die Pipelines laufen zeitversetzt, um Server-Last zu verteilen und gleichzeitige Ressourcen-Konflikte zu vermeiden.

---

## 🔧 Technische Details

### Scheduler Implementation
- **Tool**: `node-cron` (Node.js-basierter Cron-Scheduler)
- **Supervisor Service**: `pipeline-scheduler`
- **Skript**: `/app/serien-nextjs/scripts/pipeline-scheduler.ts`
- **Auto-Start**: ✅ Ja (via Supervisor)
- **Auto-Restart**: ✅ Ja (bei Fehlern)

### Warum node-cron?
- Container-freundlich (kein systemd/cron erforderlich)
- Programmatische Kontrolle
- Besseres Error Handling
- Einfaches Logging

---

## 📊 Monitoring & Verwaltung

### Status prüfen
```bash
# Scheduler Status
sudo supervisorctl status pipeline-scheduler

# Live-Logs anzeigen
sudo supervisorctl tail -f pipeline-scheduler

# Pipeline-spezifische Logs
tail -f /var/log/tvline-pipeline.log
tail -f /var/log/cinemaholic-pipeline.log
```

### Scheduler steuern
```bash
# Stoppen
sudo supervisorctl stop pipeline-scheduler

# Starten
sudo supervisorctl start pipeline-scheduler

# Neustarten
sudo supervisorctl restart pipeline-scheduler
```

### Manuelle Ausführung (für Tests)
```bash
# TVLine manuell ausführen
cd /app/serien-nextjs
npx tsx scripts/tvline-auto-pipeline.ts

# CinemaHolic manuell ausführen
npx tsx scripts/cinemaholic-auto-pipeline.ts
```

---

## 📝 Log-Rotation

Logs werden automatisch rotiert:
- **Max Dateigröße**: 10 MB
- **Backups**: 3
- **Älteste werden automatisch gelöscht**

Manuelle Log-Bereinigung:
```bash
# Alte Logs löschen
rm /var/log/tvline-pipeline.log
rm /var/log/cinemaholic-pipeline.log

# Scheduler neu starten (erstellt neue Logs)
sudo supervisorctl restart pipeline-scheduler
```

---

## 🛠️ Wartung & Anpassungen

### Zeitplan ändern

**Datei bearbeiten**: `/app/serien-nextjs/scripts/pipeline-scheduler.ts`

```typescript
// TVLine: Alle 2 Stunden
cron.schedule('0 */2 * * *', () => { ... });

// Beispiele für andere Frequenzen:
// Stündlich:        '0 * * * *'
// Alle 4 Stunden:   '0 */4 * * *'
// Täglich 10:00:    '0 10 * * *'
// Zweimal täglich:  '0 9,21 * * *'
```

**Nach Änderung**:
```bash
sudo supervisorctl restart pipeline-scheduler
```

### Weitere Pipelines hinzufügen

1. **Skript erstellen**: `/app/serien-nextjs/scripts/[source]-auto-pipeline.ts`
2. **In Scheduler hinzufügen**:
   ```typescript
   cron.schedule('0 */2 * * *', () => {
     runPipeline('[Source]', 'scripts/[source]-auto-pipeline.ts', '/var/log/[source]-pipeline.log');
   });
   ```
3. **Scheduler neu starten**

---

## 🚨 Troubleshooting

### Problem: Scheduler läuft nicht
```bash
# Status prüfen
sudo supervisorctl status pipeline-scheduler

# Logs prüfen
tail -50 /var/log/supervisor/pipeline-scheduler.log

# Neustart erzwingen
sudo supervisorctl restart pipeline-scheduler
```

### Problem: Keine Artikel werden verarbeitet
1. **Logs prüfen**: `tail -50 /var/log/tvline-pipeline.log`
2. **Manuell testen**: `npx tsx scripts/tvline-auto-pipeline.ts`
3. **Quell-Website prüfen**: Ist die Seite erreichbar?
4. **Datenbank prüfen**: Sind bereits alle Artikel verarbeitet?

### Problem: Zu viele Fehler
1. **Rate Limiting**: Websites blockieren möglicherweise zu häufige Requests
   - Lösung: Frequenz reduzieren (z.B. auf alle 4 Stunden)
2. **API-Grenzen**: TMDB oder LLM-APIs haben Limits erreicht
   - Lösung: Limits überprüfen, ggf. upgraden
3. **Pipeline-Bug**: Ein Fehler in der Pipeline bricht alle Läufe ab
   - Lösung: Fehler in den Logs identifizieren und fixen

---

## 📈 Performance-Tipps

### Ressourcen-Nutzung optimieren
- **Parallele Läufe vermeiden**: Zeitversatz beibehalten
- **Delay zwischen Artikeln**: Aktuell 2-3 Sekunden, kann angepasst werden
- **Batch-Größe begrenzen**: Nicht mehr als 10-20 Artikel pro Lauf

### Kosten senken
- **Duplikat-Check**: Verhindert doppelte Verarbeitung (✅ bereits implementiert)
- **Intelligentes Filtern**: Nur relevante Artikel verarbeiten (✅ bereits implementiert)
- **Off-Peak Hours**: Günstigere API-Preise nachts (optional)

---

## 🔐 Sicherheit

### Best Practices
- ✅ Logs rotieren automatisch
- ✅ Fehler werden geloggt, brechen aber nicht den Scheduler
- ✅ Jede Pipeline läuft isoliert
- ⚠️ API-Keys in `.env` gespeichert (sicher, aber bei Key-Rotation neu starten)

### Bei Key-Rotation
```bash
# .env-Datei aktualisieren
nano /app/serien-nextjs/.env

# Scheduler neu starten
sudo supervisorctl restart pipeline-scheduler
```

---

## ✅ Setup-Checklist

- [x] TVLine Auto-Pipeline Skript erstellt
- [x] CinemaHolic Auto-Pipeline Skript erstellt
- [x] node-cron installiert
- [x] Scheduler-Skript erstellt
- [x] Supervisor-Konfiguration erstellt
- [x] Scheduler läuft und ist aktiv
- [x] Logs werden korrekt geschrieben
- [x] Zeitplan getestet (nächste Läufe: TVLine 16:00, CinemaHolic 15:00)

---

## 📞 Support

Bei Problemen:
1. Logs prüfen (siehe "Monitoring & Verwaltung")
2. Manuellen Test-Lauf durchführen
3. Scheduler-Status verifizieren
4. Im Zweifel: Scheduler neu starten

**Status**: ✅ **FULLY OPERATIONAL**
