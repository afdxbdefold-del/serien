/**
 * LLM Configuration
 * 
 * Centralized config for all LLM calls.
 * Uses OpenAI API directly for production (Vercel).
 */

export function getLLMConfig() {
  // Production: Use OpenAI directly
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('No LLM API key found. Set OPENAI_API_KEY or EMERGENT_LLM_KEY');
  }
  
  // Check if we're in Emergent local environment (proxy available)
  const isLocalProxy = process.env.USE_LOCAL_LLM_PROXY === 'true';
  
  return {
    apiKey,
    baseURL: isLocalProxy ? 'http://localhost:8002/v1' : 'https://api.openai.com/v1',
    model: 'gpt-4o', // Using gpt-4o for production (stable, fast, cost-effective)
  };
}

export const LLM_CONFIG = {
  get apiKey() { return getLLMConfig().apiKey; },
  get baseURL() { return getLLMConfig().baseURL; },
  get model() { return getLLMConfig().model; },
};
