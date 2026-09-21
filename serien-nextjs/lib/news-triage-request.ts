import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { createLLMClient, getNewsRequestConfig } from './llm-config';

export type NewsTriageRole = 'classification' | 'deduplication';
export interface TriageCompletion {
  choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }>;
}
export interface TriageDependencies {
  complete?: (request: ChatCompletionCreateParamsNonStreaming) => Promise<TriageCompletion>;
  wait?: (milliseconds: number) => Promise<void>;
}

/** All messages are allowlisted. Never carry provider bodies, tokens or URLs. */
export class NewsTriageError extends Error {
  constructor(readonly role: NewsTriageRole, readonly code: 'input' | 'refused' | 'incomplete' | 'invalid-response' | 'dependency', status?: number) {
    const messages = {
      input: 'input is empty or exceeds the complete-source budget',
      refused: 'response refused; no editorial decision available',
      incomplete: 'response incomplete; no editorial decision available',
      'invalid-response': 'response violates the required schema',
      dependency: 'provider/network unavailable',
    };
    super(`News ${role} ${messages[code]}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'NewsTriageError';
  }
}

export function parseTriageResponse(response: TriageCompletion, role: NewsTriageRole): unknown {
  const choice = response.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw new NewsTriageError(role, 'refused');
  if (choice?.finish_reason !== 'stop' || !choice.message?.content?.trim()) throw new NewsTriageError(role, 'incomplete');
  try { return JSON.parse(choice.message.content); }
  catch { throw new NewsTriageError(role, 'invalid-response'); }
}

export function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)));
}

export function boundedStrings(value: unknown, maxItems = 20, maxLength = 1000): value is string[] {
  return Array.isArray(value) && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && Boolean(item.trim()) && item.length <= maxLength);
}

/** Two explicit attempts, no nested SDK retries; 4xx/refusal never trigger a
 * heuristic fallback. A dependency failure is not a content rejection. */
export async function requestTriageJson<T>(
  role: NewsTriageRole, schema: Record<string, unknown>, instructions: string,
  data: unknown, validate: (value: unknown) => T, dependencies: TriageDependencies = {},
): Promise<T> {
  const request: ChatCompletionCreateParamsNonStreaming = {
    ...getNewsRequestConfig(role),
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(data) }],
    response_format: { type: 'json_schema', json_schema: { name: `news_${role}`, strict: true, schema } },
  };
  const complete = dependencies.complete || ((input) => createLLMClient().chat.completions.create(input, { timeout: 90_000, maxRetries: 0 }));
  const wait = dependencies.wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = parseTriageResponse(await complete(request), role);
      try { return validate(raw); }
      catch (error) {
        if (error instanceof NewsTriageError) throw error;
        throw new NewsTriageError(role, 'invalid-response');
      }
    } catch (error) {
      const rawStatus = (error as { status?: unknown })?.status;
      const status = typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus < 600 ? rawStatus : undefined;
      const safe = error instanceof NewsTriageError ? error : new NewsTriageError(role, 'dependency', status);
      if (attempt === 1 || (status && status >= 400 && status < 500) || safe.code === 'refused' || safe.code === 'input') throw safe;
      await wait(750);
    }
  }
  throw new NewsTriageError(role, 'dependency');
}
