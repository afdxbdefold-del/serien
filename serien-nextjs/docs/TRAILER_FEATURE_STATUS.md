# Video Trailer Feature - Known Issues

## Current Status: ⚠️ YouTube Download Blocked

### Problem
YouTube returns **HTTP 403 Forbidden** when attempting to download videos via `yt-dlp`, even with proper user agents and format selectors.

### Root Cause
1. YouTube has strengthened anti-bot measures
2. Missing JavaScript runtime (deno/node.js) for signature decryption
3. IP-based rate limiting

### Attempted Solutions
- ✅ Simplified format selector
- ✅ Added user-agent spoofing
- ✅ Disabled certificate verification
- ❌ Still blocked by YouTube

## Workarounds

### Option 1: Use YouTube Embed (Recommended)
Instead of downloading videos, embed YouTube trailers directly:

```typescript
// Store YouTube ID in database instead of file
trailerYoutubeId: string | null

// Frontend: Use YouTube iframe
<iframe 
  src={`https://www.youtube.com/embed/${trailerYoutubeId}`}
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
/>
```

**Pros:**
- No storage costs
- Always works
- Auto-updates if trailer changes
- Better performance (YouTube CDN)

**Cons:**
- Requires internet connection
- YouTube branding
- Potential ads

### Option 2: Use Alternative Video Source
- Upload trailers manually to Emergent Object Storage
- Use official press kits from streaming services
- Partner with content providers

### Option 3: Fix yt-dlp (Advanced)
Install JavaScript runtime and ffmpeg:

```bash
# Install deno (JavaScript runtime)
curl -fsSL https://deno.land/install.sh | sh

# Install ffmpeg (for video merging)
apt-get install ffmpeg

# Update yt-dlp
pip install --upgrade yt-dlp

# Test with runtime
yt-dlp --js-runtime deno --format "best[height<=480]" URL
```

## Current Implementation

The trailer download feature is **fully implemented** but **temporarily disabled** due to YouTube blocking:

- ✅ Storage infrastructure (Emergent Object Storage)
- ✅ Database schema (`trailerLocalUrl`)
- ✅ Download logic (`trailer-downloader.ts`)
- ✅ API proxy (`/trailer/[...path]`)
- ✅ Video player modal
- ❌ YouTube download blocked

## Recommendation

**Switch to YouTube Embed** (Option 1) until YouTube download restrictions are lifted or alternative video sources are available.

### Migration Steps:
1. Update schema: Add `trailerYoutubeId` field
2. Store YouTube ID instead of downloading
3. Update VideoPlayerModal to use YouTube iframe
4. Remove cloud storage dependency (save costs)

## Legal Note

Downloading YouTube videos violates YouTube Terms of Service. Using embeds is the legal and recommended approach.
