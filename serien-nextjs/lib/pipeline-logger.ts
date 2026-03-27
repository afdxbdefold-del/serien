/**
 * Pipeline Logger
 * 
 * Tracks all pipeline executions with detailed logs, metrics, and error tracking.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type PipelineType = 'p3-trends' | 'p4-youtube' | 'pipeline-v2' | 'cron-news';
export type TriggerType = 'cron' | 'manual' | 'api';
export type RunStatus = 'running' | 'success' | 'partial' | 'failed';

interface PipelineRunInput {
  pipeline: PipelineType;
  trigger: TriggerType;
  inputQuery?: string;
  inputVideoId?: string;
  inputSource?: string;
}

interface PipelineRunUpdate {
  status?: RunStatus;
  articleId?: string;
  articleSlug?: string;
  articleTitle?: string;
  sourcesFound?: number;
  wordsCollected?: number;
  factsExtracted?: number;
  antiAiScore?: number;
  errorMessage?: string;
  errorStep?: string;
}

export class PipelineLogger {
  private runId: string | null = null;
  private logs: string[] = [];
  private startTime: number = Date.now();
  private metadata: Record<string, any> = {};

  constructor(
    private pipeline: PipelineType,
    private trigger: TriggerType = 'manual'
  ) {}

  // Start a new pipeline run
  async start(input: Partial<PipelineRunInput> = {}): Promise<string> {
    this.startTime = Date.now();
    this.logs = [];
    this.metadata = {};

    const run = await prisma.pipeline_runs.create({
      data: {
        id: crypto.randomUUID(),
        pipeline: this.pipeline,
        trigger: this.trigger,
        status: 'running',
        inputQuery: input.inputQuery,
        inputVideoId: input.inputVideoId,
        inputSource: input.inputSource,
        startedAt: new Date(),
      }
    });

    this.runId = run.id;
    this.log(`Pipeline gestartet: ${this.pipeline}`);
    
    return run.id;
  }

  // Add a log message
  log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✓';
    this.logs.push(`[${timestamp}] ${prefix} ${message}`);
    
    // Also log to console
    if (level === 'error') {
      console.error(`[${this.pipeline}] ${message}`);
    } else {
      console.log(`[${this.pipeline}] ${message}`);
    }
  }

  // Add metadata
  addMetadata(key: string, value: any) {
    this.metadata[key] = value;
  }

  // Update the run with progress
  async update(data: PipelineRunUpdate) {
    if (!this.runId) return;

    await prisma.pipeline_runs.update({
      where: { id: this.runId },
      data: {
        ...data,
        debugLog: JSON.stringify(this.logs),
        metadata: JSON.stringify(this.metadata),
      }
    });
  }

  // Complete the run successfully
  async success(data: Omit<PipelineRunUpdate, 'status' | 'errorMessage' | 'errorStep'>) {
    if (!this.runId) return;

    const duration = Date.now() - this.startTime;
    this.log(`Pipeline erfolgreich abgeschlossen in ${duration}ms`);

    await prisma.pipeline_runs.update({
      where: { id: this.runId },
      data: {
        ...data,
        status: 'success',
        durationMs: duration,
        completedAt: new Date(),
        debugLog: JSON.stringify(this.logs),
        metadata: JSON.stringify(this.metadata),
      }
    });
  }

  // Complete the run with partial success
  async partial(data: PipelineRunUpdate & { errorMessage: string }) {
    if (!this.runId) return;

    const duration = Date.now() - this.startTime;
    this.log(`Pipeline teilweise erfolgreich: ${data.errorMessage}`, 'warn');

    await prisma.pipeline_runs.update({
      where: { id: this.runId },
      data: {
        ...data,
        status: 'partial',
        durationMs: duration,
        completedAt: new Date(),
        debugLog: JSON.stringify(this.logs),
        metadata: JSON.stringify(this.metadata),
      }
    });
  }

  // Complete the run with failure
  async fail(errorMessage: string, errorStep?: string) {
    if (!this.runId) return;

    const duration = Date.now() - this.startTime;
    this.log(`Pipeline fehlgeschlagen: ${errorMessage}`, 'error');

    await prisma.pipeline_runs.update({
      where: { id: this.runId },
      data: {
        status: 'failed',
        errorMessage,
        errorStep,
        durationMs: duration,
        completedAt: new Date(),
        debugLog: JSON.stringify(this.logs),
        metadata: JSON.stringify(this.metadata),
      }
    });
  }

  // Get the run ID
  getRunId(): string | null {
    return this.runId;
  }
}

// Helper to get recent pipeline runs
export async function getRecentPipelineRuns(options: {
  limit?: number;
  pipeline?: PipelineType;
  status?: RunStatus;
  hours?: number;
} = {}) {
  const { limit = 50, pipeline, status, hours = 24 } = options;
  
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return prisma.pipeline_runs.findMany({
    where: {
      ...(pipeline && { pipeline }),
      ...(status && { status }),
      startedAt: { gte: since }
    },
    orderBy: { startedAt: 'desc' },
    take: limit
  });
}

// Helper to get pipeline statistics
export async function getPipelineStats(hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const runs = await prisma.pipeline_runs.findMany({
    where: { startedAt: { gte: since } },
    select: {
      pipeline: true,
      status: true,
      durationMs: true,
      articleId: true,
    }
  });

  const stats: Record<string, {
    total: number;
    success: number;
    partial: number;
    failed: number;
    articles: number;
    avgDuration: number;
  }> = {};

  for (const run of runs) {
    if (!stats[run.pipeline]) {
      stats[run.pipeline] = {
        total: 0,
        success: 0,
        partial: 0,
        failed: 0,
        articles: 0,
        avgDuration: 0
      };
    }
    
    stats[run.pipeline].total++;
    if (run.status === 'success') stats[run.pipeline].success++;
    if (run.status === 'partial') stats[run.pipeline].partial++;
    if (run.status === 'failed') stats[run.pipeline].failed++;
    if (run.articleId) stats[run.pipeline].articles++;
    if (run.durationMs) {
      const current = stats[run.pipeline].avgDuration;
      const count = stats[run.pipeline].total;
      stats[run.pipeline].avgDuration = (current * (count - 1) + run.durationMs) / count;
    }
  }

  return stats;
}

export default PipelineLogger;
