# 🐛 Bugfix: Recurring Placeholder Slug Issue

## Problem
Die Pipeline generierte gelegentlich den ungültigen Slug `platzhalter-wird-abgerufen`, was zu Datenbankfehlern führte.

## Root Cause
- Keine Validierung des Artikel-Titels vor der Slug-Generierung
- Wenn der Crawler oder die Content-Generierung einen Placeholder-Titel zurückgab ("Platzhalter - wird abgerufen", "placeholder", etc.), wurde dieser direkt als Slug verwendet
- Fehlende Prüfung auf zu kurze oder leere Titel

## Solution Implemented

### 1. Title Validation vor Slug-Generierung (STEP 7.5)
**Datei:** `/app/serien-nextjs/scripts/pipeline-v1.ts` (Zeile ~920)

```typescript
// Validate article title before slug generation
if (!articleTitle || articleTitle.trim().length < 5) {
  throw new Error(`Pipeline error: Article title is empty or too short`);
}

// Check for placeholder patterns
const placeholderPatterns = [
  /platzhalter/i,
  /placeholder/i,
  /wird\s+abgerufen/i,
  /fetching/i,
  /loading/i,
];

const hasPlaceholder = placeholderPatterns.some(pattern => pattern.test(articleTitle));
if (hasPlaceholder) {
  throw new Error(`Pipeline error: Article title contains placeholder text`);
}
```

### 2. Slug Validation vor DB-Insert (STEP 8)
**Datei:** `/app/serien-nextjs/scripts/pipeline-v1.ts` (Zeile ~1161)

```typescript
// Final slug validation before DB insert
if (!slug || slug.length < 5) {
  throw new Error(`Invalid slug generated: "${slug}" from title: "${articleTitle}"`);
}
```

### 3. Enhanced Logging
Zusätzliches Debug-Logging vor Artikel-Erstellung:
```typescript
console.log(`📝 Creating article with:`);
console.log(`   Title: "${articleTitle}" (${articleTitle.length} chars)`);
console.log(`   Slug: "${slug}" (${slug.length} chars)`);
```

## Validation Test Results

| Test Title | Expected | Result |
|------------|----------|--------|
| "Breaking Bad: Season 5 Coming Soon" | ✅ PASS | ✅ PASS |
| "Platzhalter - wird abgerufen" | ❌ REJECT | ❌ REJECT |
| "placeholder content" | ❌ REJECT | ❌ REJECT |
| "wird abgerufen" | ❌ REJECT | ❌ REJECT |
| "" (empty) | ❌ REJECT | ❌ REJECT |
| "Test" (too short) | ❌ REJECT | ❌ REJECT |
| "Loading article..." | ❌ REJECT | ❌ REJECT |
| "Stranger Things: New Season Announced" | ✅ PASS | ✅ PASS |

**All tests passed! ✅**

## Impact
- **Pipeline Reliability:** ✅ Invalid titles now fail fast with clear error messages
- **Data Quality:** ✅ No more invalid slugs in database
- **Debugging:** ✅ Enhanced logging helps identify title/slug issues quickly
- **User Experience:** ✅ Prevents broken article URLs from placeholder slugs

## Breaking Changes
None. This is a backward-compatible improvement that adds validation.

## Next Steps
- Monitor pipeline logs for rejected placeholder titles
- Investigate upstream crawler/LLM if placeholder titles occur frequently
- Consider adding similar validation for other critical fields (excerpt, content length)

---
**Fixed:** 2026-02-27  
**Status:** ✅ DEPLOYED & TESTED
