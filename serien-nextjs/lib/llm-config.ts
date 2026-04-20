/**
 * LLM Configuration
 * 
 * Centralized config for all LLM calls.
 * Uses Emergent proxy for Claude Sonnet 4.6 (OpenAI-compatible format).
 */

import OpenAI from 'openai';

export function getLLMConfig() {
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('No LLM API key found. Set EMERGENT_LLM_KEY or OPENAI_API_KEY');
  }
  
  const isEmergentKey = apiKey.startsWith('sk-emergent-');
  
  return {
    apiKey,
    baseURL: isEmergentKey ? 'https://integrations.emergentagent.com/llm' : 'https://api.openai.com/v1',
    model: isEmergentKey ? 'claude-sonnet-4-6' : 'gpt-4o',
  };
}

export const LLM_CONFIG = {
  get apiKey() { return getLLMConfig().apiKey; },
  get baseURL() { return getLLMConfig().baseURL; },
  get model() { return getLLMConfig().model; },
};

/** Robust JSON parser that handles Claude's German text with quotes */
export function parseLLMJson(raw: string): any {
  let content = raw.trim();
  
  // Strip markdown code blocks
  if (content.startsWith('```json')) content = content.slice(7);
  else if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();
  
  // Extract JSON object/array from surrounding text
  const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) content = jsonMatch[0];
  
  try {
    return JSON.parse(content);
  } catch {
    // Fix German quotes and unescaped inner quotes
    const fixed = content
      .replace(/„/g, "'").replace(/"/g, "'")  // German quotes → single quotes
      .replace(/\t/g, ' ')
      .replace(/[\x00-\x1f]/g, (ch) => ch === '\n' || ch === '\r' ? ch : '');  // Remove control chars
    return JSON.parse(fixed);
  }
}
export function createLLMClient(): OpenAI {
  const config = getLLMConfig();
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
}

/** Config for fetch-based LLM calls */
export function getLLMFetchConfig() {
  const config = getLLMConfig();
  return {
    url: `${config.baseURL}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    model: config.model,
  };
}
