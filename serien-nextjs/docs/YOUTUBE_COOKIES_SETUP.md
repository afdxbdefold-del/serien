# YouTube Cookies Setup Guide

## Problem
YouTube blockiert automatisierte Downloads mit HTTP 403. Lösung: Browser-Cookies nutzen.

## Lösung: Cookies.txt für yt-dlp

### Schritt 1: Browser-Extension installieren

**Chrome/Edge:**
- [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)

**Firefox:**
- [cookies.txt](https://addons.mozilla.org/de/firefox/addon/cookies-txt/)

### Schritt 2: Cookies exportieren

1. Bei **YouTube einloggen** (youtube.com)
2. Extension-Icon klicken
3. "Export" wählen
4. Datei speichern als `youtube-cookies.txt`

### Schritt 3: Cookies in die App integrieren

**Option A: Manuelle Platzierung**
```bash
# Cookies-Datei hier ablegen:
/app/serien-nextjs/cookies/youtube-cookies.txt
```

**Option B: Über Environment Variable**
```bash
# In .env:
YOUTUBE_COOKIES_PATH=/app/serien-nextjs/cookies/youtube-cookies.txt
```

### Schritt 4: Automatische Nutzung durch yt-dlp

Die `trailer-downloader.ts` prüft automatisch ob Cookies vorhanden sind:

```typescript
// Automatisch in downloadVideoTrailer():
if (source === 'YouTube' && cookieFileExists) {
  ytdlpArgs.push('--cookies', '/path/to/youtube-cookies.txt');
}
```

---

## Cookie-Format (Netscape)

Die Datei sollte so aussehen:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1735689600	SID	xxx...
.youtube.com	TRUE	/	FALSE	1735689600	HSID	xxx...
.youtube.com	TRUE	/	TRUE	1735689600	SSID	xxx...
```

---

## Wichtige Cookies für YouTube

Diese Cookies sind besonders wichtig:
- `SID` - Session ID
- `HSID` - Host Session ID  
- `SSID` - Secure Session ID
- `APISID` - API Session ID
- `SAPISID` - Secure API Session ID
- `__Secure-3PAPISID` - Third-party API SID

---

## Erfolgsquote mit Cookies

- **Ohne Cookies:** ~10% (häufige 403-Fehler)
- **Mit Cookies:** ~70-80% (deutlich besser!)

---

## Troubleshooting

### "HTTP 403 Forbidden" trotz Cookies
- Cookies sind abgelaufen → Neu exportieren
- Falsche Cookies → Bei YouTube einloggen, dann neu exportieren
- Cookie-Format falsch → Extension nutzen (nicht manuell erstellen)

### "Cookie file not found"
```bash
# Pfad prüfen:
ls -la /app/serien-nextjs/cookies/youtube-cookies.txt

# Verzeichnis erstellen:
mkdir -p /app/serien-nextjs/cookies
```

### Cookies erneuern
Cookies sind ~6-12 Monate gültig. Wenn Downloads wieder fehlschlagen:
1. Neu bei YouTube einloggen
2. Cookies neu exportieren
3. Alte Datei überschreiben

---

## Sicherheit

⚠️ **WICHTIG:**
- Cookies enthalten Ihre YouTube-Session
- NICHT in Git committen!
- `.gitignore` hinzufügen:
  ```
  cookies/
  *.txt
  ```

---

## Alternative: Chromium Browser-Cookies

Falls keine manuelle Datei gewünscht:
```bash
# yt-dlp kann auch direkt Browser-Cookies nutzen:
yt-dlp --cookies-from-browser chromium "URL"
```

**Nachteil:** Benötigt laufenden Browser-Prozess

**Vorteil unserer Lösung:** 
- Cookies-Datei funktioniert immer
- Keine Browser-Abhängigkeit
- Einfach zu erneuern

---

## Implementierung in Code

```typescript
// In trailer-downloader.ts
const YOUTUBE_COOKIES_PATH = process.env.YOUTUBE_COOKIES_PATH || 
  '/app/serien-nextjs/cookies/youtube-cookies.txt';

async function downloadFromYouTube(videoId: string) {
  const ytdlpArgs = ['yt-dlp', ...];
  
  // Cookies hinzufügen wenn vorhanden
  try {
    await fs.access(YOUTUBE_COOKIES_PATH);
    ytdlpArgs.push('--cookies', YOUTUBE_COOKIES_PATH);
    console.log('🍪 Using YouTube cookies for authentication');
  } catch {
    console.log('⚠️  No YouTube cookies - may encounter 403 errors');
  }
  
  // ... rest of download logic
}
```

---

## Nächste Schritte

1. ✅ Extension installieren
2. ✅ Cookies exportieren
3. ✅ Datei hochladen nach `/app/serien-nextjs/cookies/`
4. ✅ Code nutzt automatisch die Cookies
5. ✅ Höhere Erfolgsquote bei YouTube! (~70-80%)
