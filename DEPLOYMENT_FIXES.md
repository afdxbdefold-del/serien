# Deployment Fixes für Vercel

## ✅ Behobene Issues

### 1. Prisma Schema erweitert
**File:** `/app/serien-nextjs/prisma/schema.prisma`

Fehlende Felder zum User-Model hinzugefügt:
```prisma
model User {
  // ... existing fields
  role      String   @default("user")
  image     String?
  // ...
}
```

### 2. Follow API Field-Name korrigiert
**File:** `/app/serien-nextjs/app/api/follow/route.ts`

Composite Key Namen korrigiert:
- ❌ `userId_seriesTmdbId` → ✅ `userId_tmdbSeriesId`
- ❌ `seriesTmdbId` → ✅ `tmdbSeriesId`

### 3. Hardcoded URLs entfernt
**Files:**
- `/app/serien-nextjs/app/page.tsx`
- `/app/serien-nextjs/app/[slug]/page.tsx`

Alle URLs nutzen jetzt:
- `metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de')`
- Relative Pfade statt absolute URLs

### 4. JWT Secret verbessert
**Files:**
- `/app/serien-nextjs/lib/auth.ts`
- `/app/serien-nextjs/app/api/auth/login/route.ts`
- `/app/serien-nextjs/app/api/auth/google-session/route.ts`
- `/app/serien-nextjs/app/api/admin/auth/login/route.ts`

JWT_SECRET jetzt **required**:
```typescript
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
```

### 5. Environment Variables
**File:** `/app/serien-nextjs/.env`

Hinzugefügt:
```env
NEXT_PUBLIC_BASE_URL="https://serien-5v18x10.vercel.app"
JWT_SECRET="production-secret-change-this-in-vercel-env"
```

---

## 🚀 Vercel Environment Variables

Stelle sicher, dass in Vercel folgende Variablen gesetzt sind:

### Required
```
DATABASE_URL=postgresql://...
TMDB_API_KEY=c0e0553140b7bd5f982df64c86319c1b
NEXT_PUBLIC_BASE_URL=https://serien-5v18x10.vercel.app
JWT_SECRET=<generiere-einen-sicheren-32-char-string>
```

### Optional
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>
```

---

## 📝 Nächste Schritte

1. **JWT_SECRET generieren:**
   ```bash
   openssl rand -base64 32
   ```

2. **In Vercel setzen:**
   - Gehe zu Project Settings → Environment Variables
   - Füge `JWT_SECRET` mit dem generierten Wert hinzu

3. **Deployment triggern:**
   - Nutze "Save to Github" im Chat
   - Oder pushe manuell via Git

---

## ✅ Deployment Ready

Alle kritischen Fixes sind implementiert. Die App ist bereit für Vercel!
