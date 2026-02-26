# YouTube Cookies Directory

## Purpose
This directory stores YouTube cookies for authenticated downloads with yt-dlp.

## Setup

1. **Install Browser Extension:**
   - Chrome: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/de/firefox/addon/cookies-txt/)

2. **Export Cookies:**
   - Login to youtube.com
   - Click extension icon → Export
   - Save as `youtube-cookies.txt`

3. **Place Cookie File Here:**
   ```
   /app/serien-nextjs/cookies/youtube-cookies.txt
   ```

## File Format

Netscape HTTP Cookie File format:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1735689600	SID	xxx...
```

## Security

⚠️ **IMPORTANT:**
- This file contains your YouTube session
- DO NOT commit to Git
- Renew every 6-12 months

## Usage

The app automatically detects and uses cookies if present:
```typescript
// Automatic in trailer-downloader.ts
if (cookieFileExists) {
  ytdlp --cookies youtube-cookies.txt
}
```

## Success Rate

- Without cookies: ~10%
- With cookies: ~70-80%

## More Info

See: `/app/serien-nextjs/docs/YOUTUBE_COOKIES_SETUP.md`
