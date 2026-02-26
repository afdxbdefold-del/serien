# Cron Jobs Setup

This document describes the automated maintenance jobs for the Serien News Portal.

## Available Cron Jobs

### 1. Series Status Update (Daily)
**Script**: `scripts/update-series-statuses.ts`  
**Purpose**: Updates TMDB data for all series in the database  
**Frequency**: Daily at 4:00 AM  

```bash
# Manual execution
cd /app/serien-nextjs
npx tsx scripts/update-series-statuses.ts

# Cron entry (Linux/Vercel Cron)
0 4 * * * cd /app/serien-nextjs && npx tsx scripts/update-series-statuses.ts
```

### 2. Trailer Cleanup (Weekly)
**Script**: `scripts/cleanup-trailers.ts`  
**Purpose**: Removes old/unused trailers from database (keeps newest per series)  
**Frequency**: Weekly on Sunday at 3:00 AM  

```bash
# Manual execution
cd /app/serien-nextjs
npx tsx scripts/cleanup-trailers.ts

# Dry run (preview without changes)
npx tsx scripts/cleanup-trailers.ts --dry-run

# Custom age threshold (60 days)
npx tsx scripts/cleanup-trailers.ts --days=60

# Cron entry (Linux/Vercel Cron)
0 3 * * 0 cd /app/serien-nextjs && npx tsx scripts/cleanup-trailers.ts
```

## Vercel Cron Setup

If deploying to Vercel, add these jobs to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-series",
      "schedule": "0 4 * * *"
    },
    {
      "path": "/api/cron/cleanup-trailers",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

Then create API routes:

**`app/api/cron/update-series/route.ts`**:
```typescript
import { NextResponse } from 'next/server';
import { updateAllSeriesStatuses } from '@/lib/series-status-tracker';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await updateAllSeriesStatuses();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**`app/api/cron/cleanup-trailers/route.ts`**:
```typescript
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = new PrismaClient();
  
  try {
    // Cleanup logic here (simplified version)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const result = await prisma.article.updateMany({
      where: {
        trailerLocalUrl: { not: null },
        publishedAt: { lt: cutoffDate },
      },
      data: {
        trailerLocalUrl: null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      cleaned: result.count 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
```

## Systemd Setup (Linux Server)

Create systemd timer files:

**`/etc/systemd/system/series-update.service`**:
```ini
[Unit]
Description=Update Series Statuses
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/app/serien-nextjs
ExecStart=/usr/bin/npx tsx scripts/update-series-statuses.ts
User=www-data
```

**`/etc/systemd/system/series-update.timer`**:
```ini
[Unit]
Description=Daily Series Status Update

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable series-update.timer
sudo systemctl start series-update.timer
sudo systemctl list-timers
```

## Monitoring

Check logs for cron job execution:

```bash
# Vercel
vercel logs --follow

# Systemd
sudo journalctl -u series-update.service -f
```

## Notes

- **Trailer Cleanup**: Due to Emergent Object Storage limitations (no delete API), the cleanup script only removes trailer references from the database. The actual video files remain in cloud storage.
- **Storage Costs**: Monitor storage usage regularly. Consider implementing a manual cleanup process for old videos if storage costs become significant.
- **Cron Secret**: For Vercel Cron, set `CRON_SECRET` environment variable to secure the endpoints.
