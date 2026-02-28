# Actor Linking & Database Population

Dieses Script automatisiert die Erstellung von Actor-Pages und deren Verlinkung in Artikeln.

## ✨ Features

1. **Automatische Name-Extraktion** - Erkennt Actor-Namen in `<strong>` Tags
2. **TMDB-Integration** - Sucht Actors in der TMDB-Datenbank
3. **Datenbank-Population** - Erstellt `persons` Records mit vollständigen Daten
4. **Artikel-Verlinkung** - Fügt automatisch Links zu Person-Pages ein
5. **Junction-Table** - Verknüpft Artikel mit Actors via `article_persons`

## 🚀 Usage

### Dry-Run (kein Schreiben in DB)
```bash
npx tsx scripts/link-actors-to-articles.ts --dry-run --limit 1
```

### Einzelnen Artikel verarbeiten
```bash
npx tsx scripts/link-actors-to-articles.ts --article wednesday-staffel-2-netflix-gibt-produktionsstart-und-neue-cast-mitglieder-bekannt
```

### 10 neueste Artikel verarbeiten
```bash
npx tsx scripts/link-actors-to-articles.ts --limit 10
```

### Alle veröffentlichten Artikel verarbeiten
```bash
npx tsx scripts/link-actors-to-articles.ts
```

## 📊 Was macht das Script?

1. **Extraktion**: Findet Namen in `<strong>` Tags (z.B. `<strong>Jenna Ortega</strong>`)
2. **Validierung**: Filtert offensichtliche Nicht-Namen (Orte, Monate, Serien-Titel)
3. **TMDB-Suche**: Sucht jeden Namen in TMDB (nur Actors mit `known_for_department: Acting`)
4. **Person erstellen**: Erstellt `persons` Record mit:
   - TMDB ID
   - Slug (`{tmdb_id}-{name}`, z.B. `884-steve-buscemi`)
   - Biografie (Deutsch, fallback Englisch)
   - Profil-Bild, Geburtstag, Geburtsort, Popularity
5. **Verknüpfung**: Erstellt `article_persons` Relation
6. **HTML-Update**: Ersetzt erste Erwähnung des Namens mit Link:
   ```html
   <a href="/person/884-steve-buscemi" class="text-blue-600 hover:text-blue-800 underline font-medium">Steve Buscemi</a>
   ```

## 🎯 Erfolgsbeispiel

**Input-Artikel:**
```html
<p>Neu dabei sind <strong>Steve Buscemi</strong>, <strong>Billie Piper</strong> und <strong>Haley Joel Osment</strong>.</p>
```

**Output:**
- ✅ 3 Person-Records in DB erstellt
- ✅ 3 Article-Person-Links erstellt
- ✅ HTML mit 3 klickbaren Links aktualisiert

## 📈 Stats nach Test-Run (5 Artikel)

- **10 Persons** in Datenbank
- **10 Article-Person-Links** erstellt
- **10 Actor-Namen** automatisch verlinkt

## ⚙️ Konfiguration

### TMDB API
- Key in `lib/tmdb-person.ts`: `TMDB_API_KEY`
- Popularity-Threshold: `> 2.0` (niedrig für breite Abdeckung)

### Rate Limiting
- 500ms Pause zwischen Artikeln (TMDB rate limits)

## 🔍 Beispiel-Persons

| Name | TMDB ID | Slug | Popularity |
|------|---------|------|------------|
| Steve Buscemi | 884 | `884-steve-buscemi` | 3.5 |
| Jenna Ortega | 974169 | `974169-jenna-ortega` | 12.4 |
| Emma Myers | 2604515 | `2604515-emma-myers` | 6.3 |
| Catherine Zeta-Jones | 1922 | `1922-catherine-zeta-jones` | 3.8 |
| Luis Guzmán | 40481 | `40481-luis-guzmn` | 3.3 |

## 🔗 Person-Page URL Format

```
/person/{tmdb_id}-{slug}

Beispiele:
- /person/884-steve-buscemi
- /person/974169-jenna-ortega
```

## ⚠️ Hinweise

1. **Nur erste Erwähnung** wird verlinkt (vermeidet Over-Linking)
2. **Showrunner/Directors** werden ignoriert (kein `Acting` Department)
3. **Character-Namen** (z.B. "Wednesday Addams") werden nicht erkannt
4. **Unvollständige Namen** in `<strong>` werden übersprungen

## 🛠️ Troubleshooting

**Problem: Actor nicht gefunden**
- Überprüfe TMDB: https://www.themoviedb.org/search/person?query={name}
- Popularity zu niedrig? (< 2.0)
- Kein "Acting" Department?

**Problem: Falsche Namen extrahiert**
- Prüfe `<strong>` Tags im Artikel-HTML
- Erweitere `excludePatterns` in `extractActorNames()`

**Problem: Links nicht sichtbar**
- Prüfe Artikel-`contentHtml` in DB
- Browser-Cache leeren
- Seite neu laden

## 📝 Next Steps

- [ ] Integration in Content-Pipeline (automatisch bei Artikel-Erstellung)
- [ ] Bulk-Processing aller bestehenden Artikel
- [ ] Admin-UI für manuelle Person-Verwaltung
