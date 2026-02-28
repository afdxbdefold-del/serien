# Extended Series Overview Feature

## Übersicht
Automatische Generierung von ausführlichen, SEO-optimierten Serien-Beschreibungen mit KI (GPT-5.2).

## Features
- ✅ 300-400 Wörter pro Beschreibung
- ✅ SEO-optimiert, spoilerfrei, professionell
- ✅ **Dual-Source**: TMDB + Wikipedia für bessere Qualität
- ✅ Automatische Fallback-Strategie
- ✅ Markdown-frei (sauberer Text)
- ✅ Responsive auf Mobile & Desktop

## Datenquellen-Strategie

### 1. TMDB (Primär)
- Verwendet für alle Serien mit ausreichendem Overview (>100 Zeichen)
- Schnell und zuverlässig
- Immer verfügbar

### 2. Wikipedia (Ergänzend)
**Wird automatisch genutzt wenn:**
- TMDB-Overview < 100 Zeichen
- TMDB-Overview enthält generische Phrasen ("keine beschreibung", "coming soon", etc.)
- TMDB-Overview ist null

**Wikipedia-Fetcher:**
- Sucht auf de.wikipedia.org
- Probiert mehrere Suchvarianten: "[Serie] Fernsehserie", "[Serie] Serie", "[Serie]"
- Extrahiert die Intro-Sektion
- Fallback: Verwendet nur TMDB-Daten wenn Wikipedia nicht verfügbar

## Usage

### Einzelne Serie generieren
```bash
npx tsx scripts/generate-series-overview.ts <tmdbId>

# Beispiel
npx tsx scripts/generate-series-overview.ts 119051
```

### Bulk-Generierung (Top 50 Serien)
```bash
npx tsx scripts/bulk-generate-series-overviews.ts
```

Das Script:
- Priorisiert Serien mit vielen Artikeln
- Rate Limiting: 2 Sekunden zwischen Requests
- Automatischer Wikipedia-Fallback bei Bedarf
- Fehler werden geloggt aber stoppen nicht den Prozess

## Komponenten

### `SeriesOverview.tsx`
React-Komponente die die Extended Overview anzeigt:
- Props: `seriesName`, `extendedOverview`, `shortOverview`
- Fallback: Zeigt TMDB-Overview wenn Extended nicht vorhanden
- Styling: Weißer Card mit Schatten, responsive

### `series-overview-generator.ts`
Haupt-Generator:
- Nutzt GPT-5.2 für Text-Generierung
- Integriert TMDB + Wikipedia Daten
- Prompt-Engineering für hohe Qualität

### `wikipedia-fetcher.ts`
Wikipedia-Integration:
- `fetchWikipediaSummary(seriesName, originalTitle)` - Holt Wikipedia-Daten
- `isTMDBOverviewInsufficient(overview)` - Prüft ob Wikipedia benötigt wird

## Qualitätssicherung

### Prompt-Anforderungen
- **Länge**: 300-400 Wörter
- **Format**: Reiner Text, keine Markdown-Formatierung
- **Struktur**: 3-4 Absätze (Hook, Handlung, Charaktere, Stil)
- **Tone**: Informativ, engagierend, professionell
- **SEO**: Natürliche Keyword-Integration
- **Spoiler**: Nur Staffel 1 Information

### Ausgabequalität
- Keine `**Sternchen**` für Bold
- Keine `#Überschriften`
- Keine Bullet Points
- Nur fließender Text mit Absätzen

## Integration in Pipeline

Für automatische Generierung bei neuen Serien, füge folgendes zur Content Pipeline hinzu:

```typescript
// In pipeline-v1.ts oder ähnlich
import { generateSeriesExtendedOverview } from '@/lib/series-overview-generator';

// Nach dem Erstellen einer neuen Serie
const extendedOverview = await generateSeriesExtendedOverview({
  seriesName: series.name,
  originalTitle: series.originalName,
  originalOverview: series.overview,
  genres: series.genres,
  firstAirYear: new Date(series.firstAirDate).getFullYear(),
  numberOfSeasons: series.numberOfSeasons,
  status: series.status,
  cast: series.cast.slice(0, 5),
  creators: series.creators,
  networks: series.networks,
});

await prisma.series.update({
  where: { tmdbId: series.tmdbId },
  data: { extendedOverview }
});
```

## Monitoring & Logs

### Erfolgreiche Generierung
```
📝 Generating extended overview for series 119051...
✓ Found series: Wednesday
🤖 Calling GPT-5.2 to generate extended overview...
✓ Generated overview (2126 characters)
✅ Extended overview saved to database!
```

### Mit Wikipedia-Fallback
```
📝 Generating extended overview for series 1234...
✓ Found series: Example Series
📚 TMDB-Overview unzureichend, hole Wikipedia-Daten...
   ✓ Wikipedia gefunden via: "Example Series Fernsehserie"
   ✓ Wikipedia-Daten gefunden (542 Zeichen)
🤖 Calling GPT-5.2 to generate extended overview...
✓ Generated overview (2215 characters)
✅ Extended overview saved to database!
```

## Database Schema

```prisma
model series {
  // ... andere Felder
  extendedOverview String? @db.Text
  // ... andere Felder
}
```

## Performance

- **Single Generation**: ~3-5 Sekunden pro Serie
- **Bulk Generation**: ~2 Minuten für 20 Serien (mit Rate Limiting)
- **Wikipedia Lookup**: ~1-2 Sekunden zusätzlich wenn benötigt
- **LLM Call**: ~2-3 Sekunden (GPT-5.2)

## Kosten

- **GPT-5.2**: ~$0.002 pro Serie (300-400 Wörter Output)
- **Wikipedia API**: Kostenlos
- **TMDB API**: Bereits vorhanden, keine zusätzlichen Calls

## Beispiele

### Mit TMDB-Daten (ausreichend)
**Input**: Breaking Bad mit gutem TMDB-Overview
**Output**: 2256 Zeichen, nur TMDB-Daten genutzt

### Mit Wikipedia-Fallback
**Input**: The Wire mit minimalem TMDB-Overview ("Eine Serie.")
**Output**: 2196 Zeichen, Wikipedia-Daten integriert

## Troubleshooting

### Extended Overview wird nicht angezeigt
1. Prüfe ob Feld in DB existiert: `SELECT extendedOverview FROM series WHERE tmdbId = X`
2. Regeneriere Prisma Client: `npx prisma generate`
3. Restart Next.js Server

### Wikipedia-Daten nicht gefunden
- Normal bei nicht-deutschen Serien
- Fallback nutzt nur TMDB-Daten
- Kein Fehler, Feature designed für diesen Fall

### Text hat noch Markdown
- Neu generieren mit aktualisiertem Prompt
- Bulk-Regeneration Script verwenden
