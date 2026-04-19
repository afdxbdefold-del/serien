# 🕷️ News Crawler - Dokumentation

## Überblick

Der **News Crawler** ist ein intelligentes System, das automatisch TV-Serien-News von englischen Quellen crawlt, übersetzt und in die serien.de Datenbank importiert.

## Features

### ✨ Intelligente Funktionen:

1. **Multi-Source Crawling**
   - thecinemaholic.com (allgemeine TV-News)
   - screenrant.com (TV-News Sektion)
   - Erweiterbar für weitere Quellen

2. **TMDB Integration**
   - Automatische Serien-Erkennung über TMDB API
   - Erstellt neue Serien-Einträge wenn nötig
   - Holt vollständige Metadaten (Poster, Backdrop, Genres, Provider)

3. **KI-Übersetzung (GPT-4o-mini)**
   - Übersetzt englische Artikel ins Deutsche
   - Behält Serien-Namen im Original
   - Erstellt SEO-optimierte Titel und Teaser
   - Generiert ausführliche, gut strukturierte Inhalte

4. **Bild-Spiegelung**
   - Lädt externe Bilder herunter
   - Speichert sie lokal in `/app/frontend/public/crawler-images/`
   - Verhindert Hotlinking-Probleme

5. **Intelligente Autoren-Zuweisung**
   - Weist Artikel basierend auf Genre, Kategorie und Streamer zu
   - Verschiedene Autorinnen für verschiedene Spezialgebiete

## API Endpoints

### 1. Crawler starten
```bash
POST /api/crawler/run?max_articles=10
```

**Authentifizierung:** Admin-Login erforderlich

**Parameter:**
- `max_articles` (optional, default: 10) - Maximale Anzahl zu importierender Artikel

**Response:**
```json
{
  "success": true,
  "message": "Crawler completed",
  "total_found": 50,
  "new_articles": 30,
  "checked": 25,
  "tmdb_matches": 20,
  "imported": 10,
  "series_created": 3
}
```

### 2. Crawler Status
```bash
GET /api/crawler/status
```

**Response:**
```json
{
  "total_articles": 150,
  "total_series": 45,
  "articles_last_24h": 12,
  "articles_last_week": 58,
  "crawler_sources": [
    "thecinemaholic.com",
    "screenrant.com"
  ]
}
```

## Verwendung

### Via API (mit Admin-Login):

```bash
# 1. Als Admin einloggen und Session-Cookie erhalten
# 2. Crawler starten:
curl -X POST "http://localhost:8001/api/crawler/run?max_articles=5" \
  -H "Cookie: session_id=YOUR_SESSION_ID"
```

### Via Python Script:

```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from crawler.news_crawler import run_crawler

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    api_key = "<YOUR_EMERGENT_LLM_KEY>"  # Emergent LLM Key
    
    result = await run_crawler(
        api_key=api_key,
        db=db,
        max_articles=10
    )
    
    print(result)
    client.close()

asyncio.run(main())
```

## Workflow

1. **Crawling:** 
   - Besucht konfigurierte Websites
   - Extrahiert Artikel-Links und Titel

2. **Filterung:**
   - Extrahiert Serien-Namen aus Titeln
   - Prüft Duplikate in der Datenbank

3. **TMDB-Abgleich:**
   - Sucht Serie in TMDB
   - Holt vollständige Metadaten
   - Erstellt Serie falls neu

4. **Content-Fetching:**
   - Lädt vollständigen Artikel-Text
   - Lädt Bilder herunter und speichert lokal

5. **KI-Übersetzung:**
   - Übersetzt mit GPT-4o-mini
   - Behält Serien-Namen original
   - Erstellt deutschen News-Stil

6. **Autoren-Zuweisung:**
   - Wählt passende Autorin basierend auf:
     - Genre (z.B. Sophie für Sci-Fi)
     - Kategorie (z.B. Emma für Casting-News)
     - Streamer (z.B. Lena für Netflix)

7. **Import:**
   - Speichert in MongoDB
   - Verknüpft mit Serie und Autor

## Konfiguration

### Umgebungsvariablen (.env):

```env
TMDB_API_KEY="YOUR_TMDB_API_KEY_HERE"
EMERGENT_LLM_KEY="<YOUR_EMERGENT_LLM_KEY>"
```

### Quellen anpassen:

Bearbeiten Sie `/app/backend/crawler/news_crawler.py`:

```python
CRAWLER_SOURCES = [
    {
        "name": "thecinemaholic.com",
        "url": "https://thecinemaholic.com/",
        "type": "general"
    },
    # Neue Quelle hinzufügen:
    {
        "name": "your-site.com",
        "url": "https://your-site.com/tv-news/",
        "type": "tv-news"
    }
]
```

## Kategorien

Der Crawler erkennt automatisch folgende Kategorien:

- **Renewal** - Verlängerungen
- **Cancellation** - Absetzungen
- **Casting** - Neue Cast-Mitglieder
- **Production** - Produktionsstarts
- **Trailer** - Neue Trailer
- **Recap** - Episode-Recaps
- **News** - Allgemeine News

## Autoren-Mapping

| Spezialisierung | Autorin | Email |
|----------------|---------|-------|
| Sci-Fi & Fantasy | Sophie Hartmann | sophie.hartmann@serien.de |
| Comedy | Julia Fischer | julia.fischer@serien.de |
| Crime & Mystery | Laura Klein | laura.klein@serien.de |
| Drama | Marie Weber | marie.weber@serien.de |
| Horror | Nina Wolf | nina.wolf@serien.de |
| Casting/Production | Emma Mueller | emma.mueller@serien.de |
| Netflix | Lena Bergmann | lena.bergmann@serien.de |
| HBO/Apple TV+ | Marie Weber | marie.weber@serien.de |

## Tipps & Best Practices

1. **Rate Limiting:** 
   - Der Crawler hat eine 0.5s Verzögerung zwischen Artikeln
   - Erhöhen Sie bei Bedarf in `news_crawler.py`

2. **Batch-Größe:**
   - Starten Sie mit `max_articles=5` zum Testen
   - Für regelmäßige Runs: `max_articles=20-30`

3. **Monitoring:**
   - Prüfen Sie `/api/crawler/status` für Statistiken
   - Logs: `tail -f /var/log/supervisor/backend.err.log`

4. **Kosten:**
   - Verwendet GPT-4o-mini (günstig)
   - ~$0.01-0.02 pro 10 Artikel
   - Emergent LLM Key wird verwendet

## Troubleshooting

### Crawler findet keine Serien
- TMDB API Key prüfen
- Serien-Name-Extraktion verbessern

### Übersetzung schlägt fehl
- Emergent LLM Key prüfen: `echo $EMERGENT_LLM_KEY`
- Rate Limits prüfen

### Bilder werden nicht gespeichert
- Verzeichnis prüfen: `ls -la /app/frontend/public/crawler-images/`
- Schreibrechte prüfen

## Erweiterungen

### Neue Quelle hinzufügen:

1. Quelle zu `CRAWLER_SOURCES` hinzufügen
2. Falls nötig, HTML-Parsing in `crawl_news_list()` anpassen
3. Testen mit kleiner Batch-Größe

### Übersetzungs-Stil anpassen:

Bearbeiten Sie den System-Prompt in `rewrite_article_german()` in `news_crawler.py`

---

**Status:** ✅ Vollständig funktionsfähig und einsatzbereit!
