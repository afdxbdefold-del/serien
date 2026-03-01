# Image Processing System (Option C)

## 🎯 Purpose
Makes TMDB images unique for Google with minimal transformations:
- **Crop**: Removes 5% from each edge
- **Resize**: Slight adjustment
- **Metadata**: Custom EXIF (Title, Description, Copyright)
- **Filename**: Unique per article (`{slug}-{timestamp}-{id}.jpg`)

## 🔧 Configuration

### Environment Variable
```bash
# In .env file
USE_PROCESSED_IMAGES=true   # Use processed images
USE_PROCESSED_IMAGES=false  # Use TMDB originals (default)
```

## 📝 Scripts

### 1. Process Images

**Process single article:**
```bash
npx tsx scripts/process-article-images.ts pipeline-1234567890
```

**Process all articles:**
```bash
npx tsx scripts/process-article-images.ts --all
```

**What it does:**
- Downloads TMDB backdrop
- Applies crop (5% from each edge)
- Saves processed version
- Saves original as backup (`*-original.jpg`)
- Updates article database with processed image URL

### 2. Rollback (Restore Originals)

**Rollback single article:**
```bash
npx tsx scripts/rollback-processed-images.ts pipeline-1234567890
```

**Rollback all articles:**
```bash
npx tsx scripts/rollback-processed-images.ts --all
```

**What it does:**
- Restores original TMDB image
- Removes processed image references from database
- Keeps backup files intact

## 🚀 Usage Workflow

### Initial Setup (Testing)

1. **Process one article:**
```bash
npx tsx scripts/process-article-images.ts pipeline-1772363420350
```

2. **Enable processed images:**
```bash
# Edit .env
USE_PROCESSED_IMAGES=true
```

3. **Test on website:**
- Check if image looks good
- Verify Google sees it as unique
- Check loading speed

4. **If satisfied, process all:**
```bash
npx tsx scripts/process-article-images.ts --all
```

### Rollback (If Needed)

1. **Disable processed images:**
```bash
# Edit .env
USE_PROCESSED_IMAGES=false
```

2. **Rollback all:**
```bash
npx tsx scripts/rollback-processed-images.ts --all
```

## 📁 File Structure

```
public/
  img/
    processed/
      hijack-staffel-2-1234-abc.jpg           # Processed
      hijack-staffel-2-1234-abc-original.jpg  # Original backup
```

## 🔍 How It Works

### Before Processing:
```
Article → TMDB Backdrop → https://image.tmdb.org/t/p/original/aRZ7k1M3...jpg
```

### After Processing:
```
Article → Processed Image → /img/processed/hijack-staffel-2-1234-abc.jpg
                          ↓
                    Transformations:
                    - Crop 5% edges
                    - EXIF Metadata
                    - Unique filename
                          ↓
                    Original Backup:
                    /img/processed/hijack-staffel-2-1234-abc-original.jpg
```

## ✅ Benefits

1. **SEO**: Google sees unique images
2. **Safe**: Originals are backed up
3. **Reversible**: Easy rollback
4. **Minimal**: Subtle transformations
5. **Fast**: ~1-2 seconds per image

## ⚙️ Technical Details

### Transformations Applied:

**Crop:**
- Removes 5% from each edge (10% total per dimension)
- Example: 1920x1080 → 1728x972

**Resize:**
- Maintains aspect ratio
- Uses `sharp` library with mozjpeg compression

**Metadata (EXIF):**
```
ImageDescription: "{Article Title} - {Series Name}"
Copyright: "TMDB / Editorial Use"
Software: "Custom Image Processor"
```

**Filename:**
```
{article-slug}-{timestamp}-{random-id}.jpg
```

## 🧪 Testing Uniqueness

### Test if Google sees it as unique:

1. **Google Reverse Image Search:**
   - Upload processed image
   - Check if TMDB original shows up

2. **Check Perceptual Hash:**
```bash
# Compare hashes
sharp image1.jpg --stats
sharp image2.jpg --stats
```

3. **Monitor Google Discover:**
   - Check if images appear in Discover
   - Track CTR improvements

## 📊 Expected Results

**Uniqueness:**
- ✅ Different perceptual hash
- ✅ Different file size
- ✅ Different dimensions
- ✅ Different metadata
- ✅ Unique filename

**Google Recognition:**
- 🟢 **Likely unique** (crop + metadata + filename)
- 🟡 **May still detect similarity** (same core image)
- 🔵 **Best with Option A/B** (text overlay)

## 🔄 Upgrade Path

If Option C is not unique enough:

**Upgrade to Option B:**
```typescript
// Add gradient overlay
await sharp(buffer)
  .composite([{
    input: gradientBuffer,
    blend: 'over'
  }])
  ...
```

**Upgrade to Option A:**
```typescript
// Add text overlay
await sharp(buffer)
  .composite([
    { input: gradientBuffer, blend: 'over' },
    { input: textBuffer, blend: 'over' }
  ])
  ...
```

## 📝 Notes

- **Backups**: Always kept in `*-original.jpg` format
- **Storage**: ~400KB per article (processed + original)
- **Performance**: Negligible impact on page load
- **SEO**: May take 2-4 weeks for Google to recognize uniqueness
