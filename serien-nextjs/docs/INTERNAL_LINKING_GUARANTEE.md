# Interne Verlinkung - Kritischer Prozess

## Garantierter Ablauf nach Artikel-Erstellung

### Wann passiert die Verlinkung?
**SOFORT nach dem Artikel-Post** in Step 11.5 der Pipeline (`post-processors.ts`)

### Ablauf:

1. **Artikel wird erstellt** (`article-creator.ts`)
   ```
   Article ID: xyz
   Content: HTML ohne Links
   Status: published/scheduled
   ```

2. **Post-Processing startet SOFORT** (`runPostProcessing`)
   - Läuft im selben Pipeline-Durchlauf
   - Keine Verzögerung, kein Cron-Job

3. **Step 11.5: Character Linking** (`processCharacters`)
   ```typescript
   a) Prüfe: Existieren Charaktere für diese Serie?
      - JA → Springe zu Schritt c)
      - NEIN → Importiere automatisch (Step b)
   
   b) Auto-Import von Charakteren
      - Läuft via import-characters.ts
      - Timeout: 120 Sekunden
      - Bei Fehler: Logge Warnung, aber fahre fort
   
   c) KRITISCH: Character-Linking (IMMER ausführen)
      - Liest Artikel-Content aus DB
      - Ruft linkCharactersInArticle() auf
      - Findet Character-Namen im Text
      - Ersetzt mit <a href="/figur/[slug]">Name</a>
      - Speichert verlinkten Content zurück in DB
      - Bei Fehler: THROW ERROR (sichtbar machen!)
   ```

4. **Artikel-Content wird ÜBERSCHRIEBEN**
   ```sql
   UPDATE article 
   SET contentHtml = '[HTML mit Links]'
   WHERE id = 'xyz'
   ```

### Fehlerbehandlung (ROBUST):

**Szenario 1: Character-Import schlägt fehl**
- ❌ Import-Error (z.B. TMDB-Timeout)
- ✅ Linking wird TROTZDEM versucht (falls alte Charaktere existieren)
- ⚠️ Nur bei 0 Charakteren: return false

**Szenario 2: Linking schlägt fehl**
- ❌ Link-Error (z.B. DB-Fehler)
- 🚨 **THROW ERROR** - Pipeline bricht ab
- 📝 Error wird in Logs sichtbar gemacht
- 🔔 Operator wird benachrichtigt

**Szenario 3: Alles erfolgreich**
- ✅ Charaktere vorhanden
- ✅ Linking erfolgreich
- ✅ Content gespeichert
- ✅ Console: "Character links applied to current article"

### Logging (SICHTBAR):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 11.5: AUTO CHARACTER IMPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Characters already exist (6 characters)
🔗 Applying character links to current article...
✅ Character links applied to current article
   Article ID: abc-123-def
```

### Warum es jetzt funktioniert:

1. ✅ **prisma.article** (nicht prisma.articles) - behoben
2. ✅ **Linking wird IMMER versucht** (auch wenn Import fehlschlägt)
3. ✅ **Fehler werden geworfen** (nicht verschluckt)
4. ✅ **Läuft SOFORT** (nicht verzögert)
5. ✅ **Robuste Error-Handling**

### Debug-Befehle:

**Prüfen ob Links gesetzt wurden:**
```bash
cd /app/serien-nextjs && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const article = await prisma.article.findFirst({
    orderBy: { publishedAt: 'desc' },
    select: { title: true, contentHtml: true }
  });
  
  const linkCount = (article.contentHtml.match(/href=\"\/figur\//g) || []).length;
  console.log('Artikel:', article.title);
  console.log('Interne Links:', linkCount);
  
  await prisma.\$disconnect();
})();
"
```

**Pipeline-Logs prüfen:**
```bash
# Suche nach "Character links applied"
grep -r "Character links applied" /var/log/supervisor/
```

## GARANTIE:

**Wenn ein Artikel erstellt wird, werden Links SOFORT gesetzt.**
- Keine Verzögerung
- Keine Cron-Jobs
- Kein manueller Schritt erforderlich
- Fehler werden sichtbar gemacht

**Bei Fehlern:**
1. Pipeline-Logs prüfen
2. "Character links applied" suchen
3. Fehler-Stack analysieren
4. prisma.article vs prisma.articles prüfen
