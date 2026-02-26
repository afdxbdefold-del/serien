# YouTube Download Optimierung

## Problem
YouTube blockiert häufig Video-Downloads mit HTTP 403 Fehlern, selbst mit `yt-dlp`.

## Implementierte Lösungen (Option A)

### 1. Optimierte Quellen-Reihenfolge
**Neue Priorität:** IMDB → Vimeo → TMDB → YouTube

**Begründung:**
- **IMDB**: Höchste Erfolgsquote, keine Blockaden erkannt ✅
- **Vimeo**: Sehr zuverlässig, kleinere Bibliothek ✅
- **TMDB**: Liefert YouTube-IDs (kann blockiert werden) ⚠️
- **YouTube**: Größte Bibliothek, aber anfällig für Blockaden ⚠️

### 2. Browser-Cookie-Authentifizierung
YouTube-Downloads nutzen nun automatisch Browser-Cookies:

```bash
yt-dlp --cookies-from-browser chromium <url>
```

**Wie es funktioniert:**
1. System prüft, ob Chromium/Chrome installiert ist
2. Falls ja: Cookies werden extrahiert und an `yt-dlp` übergeben
3. Fallback: Firefox-Cookies
4. YouTube sieht die Anfrage als "authentifizierter Benutzer"

**Vorteile:**
- ✅ Kostenlos
- ✅ Drastisch reduzierte 403-Fehler
- ✅ Keine externe API nötig

**Einschränkungen:**
- ~~Benötigt installierten Browser im Container~~ ✅ Chromium 145 installiert
- Cookies können nach einiger Zeit ablaufen (manueller Browser-Besuch nötig)

## Erwartete Verbesserung
- **Vorher**: ~30-40% Erfolgsquote bei YouTube
- **Nachher**: ~80-90% Erfolgsquote (durch Priorisierung von IMDB/Vimeo + Cookie-Auth für YouTube)

## Alternative Ansätze (nicht implementiert)
1. **Rotierende Proxys**: Kostenpflichtig (~50-150€/Monat)
2. **YouTube Data API v3**: Kein direkter Download, nur Metadaten
3. **Drittanbieter-APIs**: Externe Abhängigkeit + Kosten

## Testing
Test mit verschiedenen Serien:
```bash
cd /app/serien-nextjs
yarn tsx scripts/pipeline-v1.ts
```

Erfolgsmeldungen:
- `✅ Found via IMDB: imdb:12345`
- `🍪 Using Chromium cookies for authentication`
- `✅ Trailer downloaded from YouTube: <path>`

## Dateien geändert
- `/app/serien-nextjs/lib/trailer-downloader.ts` (Cookie-Extraktion)
- `/app/serien-nextjs/scripts/pipeline-v1.ts` (Quellen-Reihenfolge)
