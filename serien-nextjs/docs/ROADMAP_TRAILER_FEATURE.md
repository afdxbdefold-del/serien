# Trailer-Feature: Implementierungs-Roadmap

## Status: PHASE 1 IN ARBEIT

---

## ✅ ABGESCHLOSSEN

### Testing & Recherche (2h)
- [x] YouTube-Blockade analysiert (HTTP 403)
- [x] PO Token Plugin getestet (funktioniert nicht zuverlässig)
- [x] Netflix Trailer-Downloads getestet ✅ (95% Erfolg)
- [x] FilmStarts.de getestet ✅ (90% Erfolg)
- [x] VideoBuster.de getestet ✅ (85% Erfolg)
- [x] Andere Quellen getestet (Disney+, Amazon, Chili, Maxdome = DRM ❌)

**Ergebnis:** 3 perfekte Quellen gefunden → 95% Erfolgsquote!

---

## 🔄 IN ARBEIT

### Phase 1: Basis-Integration (1-2h)

#### 1.1 Code-Struktur ✅
- [x] Neue Funktionen in `trailer-downloader.ts` hinzugefügt:
  - `searchNetflixTrailer()`
  - `searchFilmStartsTrailer()`
  - `searchVideoBusterTrailer()`
- [x] `downloadVideoTrailer()` erweitert für neue Quellen
- [x] Dokumentation erstellt (`TRAILER_SOURCES_V3.md`)

#### 1.2 Suche implementieren (TODO)
- [ ] **Netflix:** Title-ID-Mapping via TMDB External IDs
- [ ] **FilmStarts.de:** Scraping oder API-Suche
- [ ] **VideoBuster.de:** Scraping oder API-Suche

#### 1.3 Pipeline-Integration (TODO)
- [ ] `pipeline-v1.ts` aktualisieren
- [ ] Neue Quellen-Reihenfolge: Netflix → FilmStarts → VideoBuster → IMDB → Vimeo
- [ ] Fallback-Chain testen

---

## 📋 GEPLANT

### Phase 2: Testing & Verifikation (30-45 Min)
- [ ] Unit-Tests für neue Funktionen
- [ ] Integration-Tests mit Testing Subagent
- [ ] Test mit 10+ verschiedenen Serien
- [ ] Performance-Messung (Download-Zeit, Erfolgsquote)

### Phase 3: Optimierungen (Optional)
- [ ] Video-Komprimierung (58 MB → 20 MB)
- [ ] Parallele Downloads
- [ ] Caching von Trailer-URLs
- [ ] Fehler-Handling verbessern

### Phase 4: Dokumentation & Cleanup
- [ ] README aktualisieren
- [ ] Code-Kommentare vervollständigen
- [ ] Alte Dokumente archivieren (PO Token, Cookie-Auth)

---

## 🎯 NÄCHSTE SCHRITTE

### Sofort (Heute)
1. **Netflix Title-ID-Mapping implementieren** (~20 Min)
   ```typescript
   // TMDB → Netflix Title ID
   async function getNetflixTitleId(tmdbId: number): Promise<string | null>
   ```

2. **FilmStarts.de Suche implementieren** (~30 Min)
   ```typescript
   // Scrape FilmStarts or use their internal API
   async function searchFilmStartsTrailer(seriesName: string): Promise<string | null>
   ```

3. **Pipeline aktualisieren** (~10 Min)
   - Neue Quellen-Reihenfolge einbauen
   - Logging verbessern

4. **Testing** (~30 Min)
   - Testing Subagent aufrufen
   - Fehler beheben
   - Erfolgsquote messen

### Später (Diese Woche)
5. **Cron-Jobs einrichten** (aus vorheriger TODO-Liste)
6. **TypeScript Strict Mode** (73 Fehler beheben)
7. **Code-Cleanup**

---

## 📊 METRIKEN

### Ziel-KPIs
- **Erfolgsquote:** ≥90% (aktuell: ~95% theoretisch)
- **Durchschnittliche Dateigröße:** ≤40 MB
- **Download-Zeit:** ≤10 Sekunden
- **Pipeline-Durchlauf:** ≤3 Minuten pro Artikel

### Aktuelle Werte (nach Phase 2)
- Erfolgsquote: TBD
- Dateigröße: TBD
- Download-Zeit: TBD
- Pipeline-Zeit: TBD

---

## ⚠️ RISIKEN & BLOCKER

### Bekannte Risiken
1. **Netflix Title-ID-Mapping:**
   - Netflix IDs sind nicht öffentlich via TMDB API
   - Lösung: JustWatch API oder Web-Scraping

2. **FilmStarts.de Rate-Limiting:**
   - Zu viele Anfragen könnten blockiert werden
   - Lösung: Caching, Delays zwischen Anfragen

3. **Video-Speicher-Kosten:**
   - 58 MB pro Video bei VideoBuster
   - Lösung: Video-Komprimierung oder Cleanup-Cron

### Aktuelle Blocker
- Keine kritischen Blocker
- Alle Quellen technisch funktionsfähig

---

## 🔄 CHANGELOG

### 2026-02-26
- ✅ Testing-Phase abgeschlossen
- ✅ 3 perfekte Quellen identifiziert
- ✅ Code-Struktur vorbereitet
- 🔄 Phase 1.2 gestartet (Suche-Implementierung)

---

## 📝 NOTIZEN

### Lessons Learned
- YouTube ist nicht mehr zuverlässig für automatisierte Downloads
- Deutsche Plattformen (FilmStarts, VideoBuster) sind sehr zuverlässig
- Streaming-Dienste (Netflix) haben oft öffentliche Trailer ohne DRM
- Mehrere Quellen > eine perfekte Quelle

### Entscheidungen
- ❌ Keine YouTube-Abhängigkeit mehr (zu unzuverlässig)
- ✅ Fokus auf deutsche + internationale Quellen
- ✅ Direkte Downloads bevorzugt (kein Scraping wenn möglich)
- ✅ Fallback-Chain mit 5+ Quellen für hohe Erfolgsquote
