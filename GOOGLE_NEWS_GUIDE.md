# Google News & Discover Submission Guide
## serien.de

---

## ✅ Voraussetzungen (Alle erfüllt!)

### Technische Anforderungen

- ✅ **NewsArticle Schema:** Vollständig implementiert mit JSON-LD
- ✅ **News Sitemap:** `/sitemap-news.xml` verfügbar
- ✅ **Strukturierte Daten:** Alle Artikel mit Autor, Datum, Bild
- ✅ **Mobile-Responsive:** Vollständig responsive Design
- ✅ **HTTPS:** Erforderlich für Produktion
- ✅ **Robots.txt:** Korrekt konfiguriert

### Content-Anforderungen

- ✅ **Original Content:** Alle Artikel selbst geschrieben
- ✅ **Regelmäßige Updates:** Crawler-freundliche Struktur
- ✅ **Klare Autorschaft:** Jeder Artikel mit Autor
- ✅ **Publikationsdatum:** Alle Artikel datiert
- ✅ **Qualitäts-Standards:** SEO Guardrails aktiv

### SEO-Optimierungen

- ✅ **Meta Tags:** Vollständig für alle Seiten
- ✅ **OG Images:** Hero + Fallback-Bild (1200x630)
- ✅ **Canonical URLs:** Root-Level Slugs
- ✅ **301 Redirects:** Von alten URLs
- ✅ **Server-Side Rendering:** Express SSR für Crawler

---

## 📋 Schritt-für-Schritt Anleitung

### Phase 1: Google Search Console Setup (Tag 1)

#### 1.1 Property hinzufügen

1. Gehe zu [Google Search Console](https://search.google.com/search-console)
2. Klicke auf "Property hinzufügen"
3. Wähle "URL-Präfix": `https://serien.de`
4. Verifiziere via HTML-Tag oder DNS

#### 1.2 Sitemaps einreichen

1. Navigiere zu **Sitemaps** (linkes Menü)
2. Reiche beide Sitemaps ein:
   - `https://serien.de/sitemap.xml` (Haupt-Sitemap)
   - `https://serien.de/sitemap-news.xml` (Google News Sitemap)
3. Warte auf Indexierung (24-48 Stunden)

#### 1.3 URL Inspection

Teste 5-10 News-URLs manuell:
1. Öffne **URL-Prüfung** (oben)
2. Gib eine News-URL ein: `https://serien.de/[slug]/`
3. Klicke auf "Live-Test"
4. Prüfe:
   - ✅ NewsArticle Schema erkannt
   - ✅ Alle Meta-Tags vorhanden
   - ✅ Keine kritischen Fehler

---

### Phase 2: Content-Wachstum (Wochen 1-4)

**Mindestanforderungen für Google News:**
- 📊 **Artikel-Anzahl:** Min. 50-100 Artikel (aktuell: 23)
- 📅 **Frequenz:** Tägliche Updates empfohlen
- 🎯 **Themen-Konsistenz:** Fokus auf TV-Serien beibehalten

**Empfohlener Zeitplan:**
```
Woche 1-2: 30 neue Artikel (2-3 täglich)
Woche 3-4: 40 neue Artikel (3-4 täglich)
→ Gesamt: ~100 Artikel
```

**Content-Strategie:**
- News zu neuen Serien-Starts
- Staffel-Updates
- Trailer-Ankündigungen
- Streaming-Verfügbarkeiten
- Reviews & Empfehlungen

---

### Phase 3: Google News Publisher Center (Woche 4-6)

#### 3.1 Anmeldung

1. Gehe zu [Google News Publisher Center](https://publishercenter.google.com)
2. Klicke auf "Publikation hinzufügen"
3. Gib Details ein:
   - **Name:** serien.de
   - **URL:** https://serien.de
   - **Sprache:** Deutsch
   - **Land:** Deutschland

#### 3.2 Publikationsdetails

**Über die Publikation:**
```
serien.de ist Deutschlands führendes Portal für TV-Serien-News. 
Wir berichten täglich über neue Serien, Staffel-Updates, Trailer 
und Streaming-Verfügbarkeiten auf Netflix, Disney+, Amazon Prime 
und weiteren Plattformen.
```

**Kategorien:**
- Unterhaltung
- Fernsehen & Streaming
- Kultur

**News Sitemap URL:**
```
https://serien.de/sitemap-news.xml
```

#### 3.3 Verifizierung

- Via Search Console (automatisch verknüpft)
- Oder HTML-Tag in Header

#### 3.4 Review-Prozess

⏰ **Dauer:** 2-4 Wochen

Google prüft:
- ✅ Content-Qualität
- ✅ Original-Berichterstattung
- ✅ Autorschaft
- ✅ Technische Standards
- ✅ Richtlinien-Konformität

---

### Phase 4: Google Discover Optimierung (Laufend)

#### 4.1 Content Best Practices

**Headlines:**
- ✅ Präzise & beschreibend (keine Clickbait!)
- ✅ 50-60 Zeichen
- ✅ Keyword am Anfang
- ❌ Vermeiden: "Du wirst nicht glauben", "Schockierend", etc.

**Bilder:**
- ✅ Min. 1200px Breite (automatisch validiert)
- ✅ Hero-Bild prominent platziert
- ✅ Alt-Text mit Kontext
- ✅ Hochwertige Pressebilder

**Struktur:**
- ✅ Lead-Absatz (erstes Paragraph)
- ✅ Kurze, lesbare Absätze
- ✅ Interne Links zu verwandten Artikeln
- ✅ Streamer & Genre Tags

#### 4.2 E-A-T (Expertise, Authority, Trust)

**Autorenprofil:**
- Klare Autorschaft bei jedem Artikel
- Biografie für Autoren (optional: `/redaktion`)
- Kontaktmöglichkeiten (Impressum vorhanden ✅)

**Transparenz:**
- Impressum: ✅ `/impressum`
- Datenschutz: `/datenschutz` (TODO)
- Über uns: ✅ `/about`

---

## 🧪 Testing & Monitoring

### Rich Results Test

🔗 [Google Rich Results Test](https://search.google.com/test/rich-results)

**Zu testen:**
1. Eine News-URL eingeben
2. Prüfen auf:
   - ✅ `NewsArticle` Schema
   - ✅ `headline`, `image`, `datePublished`, `author`, `publisher`
   - ✅ Keine Fehler oder Warnungen

### Search Console Reports

**Regelmäßig prüfen (wöchentlich):**

1. **Indexabdeckung:**
   - Alle News-URLs indexiert?
   - Keine Crawl-Fehler?

2. **Core Web Vitals:**
   - LCP < 2.5s
   - FID < 100ms
   - CLS < 0.1

3. **Mobile Usability:**
   - Keine Mobile-Fehler

4. **Structured Data:**
   - NewsArticle Status
   - Fehler beheben

### Discover Performance

⏰ **Verfügbar:** Nach 2-4 Wochen in Google News

**Metriken in Search Console:**
- Impressions in Discover
- Klicks aus Discover
- CTR (Durchschnittsrate: 3-5%)

---

## 📊 KPIs & Ziele

### Woche 1-2 (Indexierung)
- ✅ Alle Seiten in Google Index
- ✅ NewsArticle Schema validiert
- ✅ 0 kritische Fehler in Search Console

### Woche 3-4 (Wachstum)
- 🎯 50-100 Artikel veröffentlicht
- 🎯 Tägliche Updates
- 🎯 Google News Anmeldung eingereicht

### Woche 5-8 (Approval)
- 🎯 Google News Approval erhalten
- 🎯 Erste Impressions in Google News
- 🎯 Traffic-Wachstum 20-30%

### Ab Woche 8 (Optimierung)
- 🎯 Discover Impressions starten
- 🎯 Top-Positionen für Serien-Keywords
- 🎯 Traffic aus Google News: 10-20% des Gesamt-Traffics

---

## ⚠️ Häufige Ablehnungsgründe (Vermeiden!)

### ❌ Inhaltliche Probleme

1. **Zu wenig Content:**
   - Mindestens 50-100 Artikel erforderlich
   - Lösung: Content-Plan (siehe Phase 2)

2. **Keine Original-Berichterstattung:**
   - Nur kopierte News werden abgelehnt
   - Lösung: Eigene Zusammenfassungen, Analysen, Kommentare

3. **Clickbait Headlines:**
   - "Du wirst nicht glauben..."
   - Lösung: SEO Guardrails aktiv ✅

### ❌ Technische Probleme

1. **Fehlendes NewsArticle Schema:**
   - Status: ✅ Implementiert

2. **Unvollständige Metadaten:**
   - Autor, Datum, Bild fehlen
   - Lösung: SEO Validation blockiert unvollständige Artikel ✅

3. **Nicht-mobile-freundlich:**
   - Status: ✅ Vollständig responsive

---

## 📞 Support & Hilfe

### Google Dokumentation

- [Google News Publisher Help](https://support.google.com/news/publisher-center)
- [NewsArticle Schema Docs](https://developers.google.com/search/docs/advanced/structured-data/article)
- [News Sitemap Guidelines](https://support.google.com/webmasters/answer/9606710)

### Interne Dokumentation

- `/app/DEPLOYMENT.md` - Deployment Guide
- `/app/backend/validators/seo_validators.py` - SEO Guardrails
- `/app/backend/generate_news_sitemap.py` - News Sitemap Generator

---

## ✅ Final Checklist vor Submission

- [ ] Min. 50-100 Artikel veröffentlicht
- [ ] Search Console eingerichtet
- [ ] Beide Sitemaps eingereicht
- [ ] 10+ URLs manuell getestet (URL Inspection)
- [ ] NewsArticle Schema fehlerlos
- [ ] Keine kritischen Fehler in Search Console
- [ ] Impressum & Datenschutz vorhanden
- [ ] Regelmäßige Update-Frequenz etabliert (täglich)
- [ ] Mobile Usability geprüft
- [ ] Core Web Vitals OK
- [ ] HTTPS aktiv auf Produktion

---

**Status:** 🟡 **PHASE 2 - CONTENT WACHSTUM**

Aktuell: 23 Artikel → Ziel: 100+ Artikel für Google News Approval

**Nächste Schritte:**
1. Content-Produktion hochfahren (2-4 Artikel/Tag)
2. Search Console einrichten
3. Nach 100 Artikeln → Google News Anmeldung

🚀 **Viel Erfolg!**
