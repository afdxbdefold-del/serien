import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

// Verify admin token
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  
  const token = authHeader.substring(7);
  try {
    // Simple JWT decode (in production, use proper verification)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// GET: Pipeline status and recent runs
export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get pipeline logs
    if (action === 'logs') {
      const logType = searchParams.get('type') || 'tvline';
      const logFile = logType === 'cinemaholic' 
        ? '/var/log/cinemaholic-pipeline.log'
        : '/var/log/tvline-pipeline.log';
      
      try {
        const logContent = await fs.readFile(logFile, 'utf-8');
        // Get last 100 lines
        const lines = logContent.split('\n').slice(-100).join('\n');
        return NextResponse.json({ logs: lines });
      } catch {
        return NextResponse.json({ logs: 'No logs available yet.' });
      }
    }

    // Get scheduler status
    if (action === 'scheduler-status') {
      try {
        const { stdout } = await execAsync('ps aux | grep pipeline-scheduler | grep -v grep');
        const isRunning = stdout.trim().length > 0;
        return NextResponse.json({ 
          running: isRunning,
          process: stdout.trim()
        });
      } catch {
        return NextResponse.json({ running: false, process: null });
      }
    }

    // Get recent pipeline articles (last 24h)
    const recentArticles = await prisma.articles.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        contentType: {
          in: ['GENERATED', 'NEWS']
        }
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        createdAt: true,
        series: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Get stats
    const stats = await prisma.articles.groupBy({
      by: ['contentType'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    return NextResponse.json({
      recentArticles,
      stats,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Pipeline API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Run pipeline actions
export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, url, title, seriesName, tmdbId } = body;

    // Run single article through pipeline
    if (action === 'run-single') {
      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }

      // Create a temporary script to run the pipeline
      const scriptContent = `
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  const result = await runPipelineV2({
    title: ${JSON.stringify(title || 'Auto-detected')},
    url: ${JSON.stringify(url)},
    text: '',
    useFullTextMode: true
  });
  console.log('Result:', result);
}

main().catch(console.error);
`;

      const tempScript = `/tmp/run-pipeline-${Date.now()}.ts`;
      await fs.writeFile(tempScript, scriptContent);

      // Run in background
      execAsync(`cd /app/serien-nextjs && npx tsx ${tempScript} >> /var/log/manual-pipeline.log 2>&1 &`);

      return NextResponse.json({ 
        success: true, 
        message: 'Pipeline started in background',
        logFile: '/var/log/manual-pipeline.log'
      });
    }

    // Run TVLine auto-pipeline
    if (action === 'run-tvline') {
      execAsync('cd /app/serien-nextjs && npx tsx scripts/tvline-auto-pipeline.ts >> /var/log/tvline-pipeline.log 2>&1 &');
      return NextResponse.json({ success: true, message: 'TVLine pipeline started' });
    }

    // Run CinemaHolic auto-pipeline
    if (action === 'run-cinemaholic') {
      execAsync('cd /app/serien-nextjs && npx tsx scripts/cinemaholic-auto-pipeline.ts >> /var/log/cinemaholic-pipeline.log 2>&1 &');
      return NextResponse.json({ success: true, message: 'CinemaHolic pipeline started' });
    }

    // Search TMDB and create article
    if (action === 'create-from-tmdb') {
      if (!tmdbId || !seriesName) {
        return NextResponse.json({ error: 'tmdbId and seriesName are required' }, { status: 400 });
      }

      // This would trigger a custom article creation flow
      const scriptContent = `
import { PrismaClient } from '@prisma/client';
import { getTvDetailsComplete } from '../lib/tmdb';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { markdownToHtml } from '../lib/markdown-to-html';

const prisma = new PrismaClient();

async function createFromTMDB() {
  const tmdbId = ${tmdbId};
  const seriesName = ${JSON.stringify(seriesName)};
  
  console.log('Creating article for:', seriesName);
  
  const details = await getTvDetailsComplete(tmdbId, 'de-DE');
  if (!details) throw new Error('Could not fetch TMDB details');
  
  // Generate content
  const content = await generateStructuredContent({
    title: \`\${seriesName}: Alles was du wissen musst\`,
    sourceText: details.overview || '',
    seriesName,
    seriesStatus: details.status
  });
  
  console.log('Content generated successfully');
}

createFromTMDB().catch(console.error);
`;

      const tempScript = `/tmp/create-tmdb-${Date.now()}.ts`;
      await fs.writeFile(tempScript, scriptContent);

      execAsync(`cd /app/serien-nextjs && npx tsx ${tempScript} >> /var/log/manual-pipeline.log 2>&1 &`);

      return NextResponse.json({ 
        success: true, 
        message: `Creating article for ${seriesName}`,
        logFile: '/var/log/manual-pipeline.log'
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Pipeline POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
