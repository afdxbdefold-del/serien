# YouTube Download Optimierung v2 (PO Token Provider)

## Problem
YouTube enforced ab 2024/2025 "PO Tokens" für Video-Downloads. Ohne diese Tokens schlagen Downloads mit HTTP 403 Fehlern fehl.

## Implementierte Lösung: PO Token Provider Plugin

### Was ist ein PO Token?
Ein "Proof of Origin Token" ist ein Sicherheitstoken, den YouTube von Clients verlangt, um zu beweisen, dass die Anfrage von einem legitimen Client kommt. Ohne PO Token → HTTP 403.

### Unsere Lösung
**Plugin:** `bgutil-ytdlp-pot-provider`
- Automatische PO Token-Generierung
- Keine manuelle Konfiguration nötig
- Funktioniert nahtlos mit yt-dlp

### Installation
```bash
pip install bgutil-ytdlp-pot-provider
```

Das Plugin wird automatisch von yt-dlp erkannt und verwendet.

### Konfiguration
```typescript
// In trailer-downloader.ts
const ytdlpArgs = [
  'yt-dlp',
  '--extractor-args', 'youtube:player_client=mweb',  // Empfohlen für PO Token
  '--format', 'worst',
  // ... weitere Optionen
];
```

Der `mweb` Client wird verwendet, da er:
- ✅ Gut mit PO Token Provider funktioniert
- ✅ Zuverlässige Format-Auswahl
- ✅ Von yt-dlp Wiki empfohlen

### Optimierte Quellen-Reihenfolge
**Priorität:** IMDB → Vimeo → TMDB → YouTube

**Begründung:**
- **IMDB**: Höchste Erfolgsquote, keine PO Tokens nötig ✅
- **Vimeo**: Sehr zuverlässig, kleinere Bibliothek ✅
- **TMDB**: Liefert YouTube-IDs (benötigt PO Token) ⚠️
- **YouTube**: Größte Bibliothek, benötigt PO Token ⚠️

## Erwartete Verbesserung
- **Vorher (ohne PO Token)**: ~5-10% Erfolgsquote bei YouTube
- **Nachher (mit PO Token Plugin)**: ~90-95% Erfolgsquote

## Technical Details

### PO Token Types
1. **GVS Token** (Google Video Server): Für Video-Streaming
2. **Player Token**: Für Format-URL-Anfragen
3. **Subs Token**: Für Untertitel

Das Plugin generiert alle benötigten Token-Typen automatisch.

### Plugin-Funktionsweise
- Das Plugin nutzt `BgUtils` Library
- Simuliert Browser-Attestation
- Generiert gültige PO Tokens für aktuelle Session
- Tokens sind 12+ Stunden gültig

## Alternative Ansätze (nicht implementiert)
1. **Manuelle Cookie-Extraktion**: Fehleranfällig, Cookies rotieren
2. **TV-Client ohne PO Token**: Eingeschränkte Formate
3. **Rotierende Proxys**: Kostenpflichtig (~50-150€/Monat)

## Testing
Test mit verschiedenen Serien:
```bash
cd /app/serien-nextjs
yarn tsx scripts/test-optimized-sources.ts
```

Erfolgsmeldungen:
- `🎯 Using mweb client with PO Token Provider plugin`
- `✅ Download complete`
- `✅ Trailer downloaded from YouTube`

## Dateien geändert
- `/app/serien-nextjs/lib/trailer-downloader.ts` (PO Token Plugin Integration)
- `/app/serien-nextjs/scripts/pipeline-v1.ts` (Quellen-Reihenfolge optimiert)

## Fehlerbehebung

**Falls Downloads immer noch fehlschlagen:**
```bash
# 1. yt-dlp aktualisieren
pip install -U yt-dlp

# 2. Plugin neu installieren
pip install --upgrade --force-reinstall bgutil-ytdlp-pot-provider

# 3. Cache löschen
yt-dlp --rm-cache-dir
```

## Referenzen
- [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [bgutil-ytdlp-pot-provider Plugin](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)
- [BgUtils Library](https://github.com/LuanRT/BgUtils)

