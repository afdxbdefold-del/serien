# FULL ARTICLE PIPELINE - Implementierung abgeschlossen

## ✅ Was wurde implementiert

Die Pipeline kann jetzt **vollständige Artikel (450-900 Wörter)** generieren statt nur kurze News-Snippets.

## 🔧 Verwendung

### Beispiel 1: Direkt in pipeline-v1.ts (bereits konfiguriert)

```typescript
// Das main() Beispiel in pipeline-v1.ts ist bereits auf FULL_ARTICLE gesetzt
cd /app/serien-nextjs
node --loader ts-node/esm scripts/pipeline-v1.ts
```

### Beispiel 2: Custom Script

```typescript
import { runContentPipeline } from './pipeline-v1';

const source = {
  title: "56 Days Ending Explained",
  url: "https://thecinemaholic.com/56-days-ending-explained/",
  text: "Initial placeholder text",
  useFullTextMode: true  // ← AKTIVIERT VOLLTEXT-MODUS
};

const result = await runContentPipeline(source);
```

## 📊 Was passiert im FULL_ARTICLE Modus?

### 1. Full-Text Fetching (Step 0.5)
- Playwright öffnet die URL
- Extrahiert den kompletten Artikel-Text
- Nutzt mehrere Selektoren: `article`, `[itemprop="articleBody"]`, `.article-content`, etc.
- Entfernt Ads, Navigation, Footer automatisch

### 2. AI Content Generation (Step 4)
- Nutzt `CONTENT_GENERATION_PROMPT_FULL` statt Standard-Prompt
- Target: 450-900 Wörter
- Mindestens 5 Absätze mit 2-4 Sätzen
- Max. 90 Wörter pro Absatz
- **KEIN** wortwörtliches Kopieren (SEO-Regel)

### 3. Quality Check (Step 6)
- **FAIL**: < 250 Wörter → Saved as DRAFT
- **WARN**: 250-349 Wörter → Warnung, aber proceeding
- **PASS**: ≥ 350 Wörter
- **OPTIMAL**: 450-900 Wörter
- Paragraph check: Min. 5 Absätze

### 4. Quelle-Block
Automatisch am Ende hinzugefügt:
```html
<p class="article-source">
  <strong>Quelle:</strong> 
  <a href="https://..." target="_blank" rel="noopener">domain.de</a>
</p>
```

### 5. Editorial Rewrite wird ÜBERSPRUNGEN
- FULL_ARTICLE Content ist bereits optimiert
- Keine zusätzliche Headline-Rewrite
- Direkt durch zur Fact Safety Layer

## 🎯 Erwartetes Ergebnis

Für **https://thecinemaholic.com/56-days-ending-explained/**:

1. ✅ Playwright fetched ~1500+ Wörter von der Quelle
2. ✅ AI generiert 450-900 Wörter **originalen** deutschen Content
3. ✅ 5+ Absätze mit guter Struktur
4. ✅ Quelle-Link zu thecinemaholic.com am Ende
5. ✅ Fact Safety Layer prüft alle Claims
6. ✅ Anti-AI Filter eliminiert Marketing-Sprache
7. ✅ Discover Gate checkt für Google News Eligibility

## 🧪 Testing-Optionen

### Option A: Via pipeline-v1.ts main()
```bash
cd /app/serien-nextjs
# Edit main() function if needed
# Currently set to: The Last of Us S3 test
node scripts/pipeline-v1.ts
```

### Option B: Via test-56-days.ts
```bash
cd /app/serien-nextjs
# Specifically tests the 56 Days URL
node scripts/test-56-days.ts
```

### Option C: Via existing crawler
```bash
cd /app/serien-nextjs
# Modify crawler to set useFullTextMode: true
node scripts/crawler-cinemaholic.ts
```

## 📁 Geänderte Dateien

1. **scripts/pipeline-v1.ts**
   - `useFullTextMode` Flag in `CrawledSource` interface
   - Step 0.5: Full-Text Fetcher Integration
   - Step 4: `isFullArticleMode` Logic
   - Step 5: Editorial Rewrite Skip für FULL_ARTICLE
   - Step 6: Custom Quality Check für FULL_ARTICLE
   - Alle Regeneration-Stellen angepasst

2. **lib/content-generator.ts**
   - `FULL_ARTICLE` Content-Type hinzugefügt
   - `sourceUrl` Parameter für Quelle-Block
   - Quelle-Block Generation am Ende
   - Max Tokens: 2500 für lange Artikel

3. **lib/full-text-fetcher.ts**
   - Bereits vorhanden, jetzt integriert
   - Playwright-based volltext Extraktion

## ⚠️ Wichtige Hinweise

### Standard vs. FULL_ARTICLE Modus

| Feature | Standard | FULL_ARTICLE |
|---------|----------|--------------|
| Text Source | `source.text` (Snippet) | Playwright fetch (Full) |
| Word Target | 200-350 | 450-900 |
| Paragraphs | 4+ | 5+ |
| Editorial Rewrite | ✅ Yes | ❌ Skipped |
| Quelle Block | ❌ No | ✅ Yes |
| Quality Threshold | 250 words | 350 words |

### Wann FULL_ARTICLE nutzen?

✅ **JA** für:
- Ausführliche Artikel von anderen Sites
- Tiefgehende Analysen / Erklärungen
- Content der 800+ Wörter Quell-Text hat
- Wenn SEO-Länge wichtig ist (450+ Wörter)

❌ **NEIN** für:
- Kurze News-Meldungen
- Breaking News (schnelle Veröffentlichung)
- Listen-Artikel (MULTI_SERIES_EDITORIAL besser)
- Wenn Quell-Text < 300 Wörter

## 🐛 Troubleshooting

### "Word count below target"
→ Quelle hat zu wenig Content
→ Fallback: Pipeline akzeptiert 350+ Wörter

### "Playwright timeout"
→ Site blockiert Scraping
→ Fallback: Nutzt `source.text` Snippet

### "Classification skipped"
→ Content ist nicht Series-Related
→ Expected behavior, nur TV-Serien werden verarbeitet

## 🔄 Nächste Schritte

1. **Jetzt testen**: Pipeline mit 56 Days URL ausführen
2. **P1 Task**: Unverifizierte Fakten in alten Artikeln korrigieren
3. **P2 Task**: Cron Job für Auto-Refresh einrichten
4. **P3 Task**: TypeScript Strict Mode + Code Cleanup
