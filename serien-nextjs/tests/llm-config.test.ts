import assert from 'node:assert/strict';
import { getLLMConfig, createLLMClient, NEWS_LLM_CONFIG, getNewsRequestConfig, type NewsLLMRole } from '../lib/llm-config';

assert.equal(NEWS_LLM_CONFIG.model, 'gpt-6-astra');
for (const role of ['classification', 'deduplication', 'facts', 'writing', 'review', 'revision'] as NewsLLMRole[]) {
  const request = getNewsRequestConfig(role);
  assert.equal(request.model, 'gpt-6-astra');
  assert.equal(request.reasoning_effort, 'low');
  assert.ok(request.max_completion_tokens >= 4096, 'reasoning and visible output share the completion budget');
  assert.deepEqual(Object.keys(request).sort(), ['max_completion_tokens', 'model', 'reasoning_effort']);
}

const previous = { openai: process.env.OPENAI_API_KEY, emergent: process.env.EMERGENT_LLM_KEY };
try {
  delete process.env.OPENAI_API_KEY;
  process.env.EMERGENT_LLM_KEY = 'test-legacy-key-not-a-secret';
  assert.throws(() => getLLMConfig(), /OPENAI_API_KEY is not configured/);
  process.env.OPENAI_API_KEY = 'sk-emergent-test-only';
  assert.throws(() => getLLMConfig(), /direct OpenAI/);
  process.env.OPENAI_API_KEY = 'test-openai-key-not-a-secret';
  assert.equal(getLLMConfig().baseURL, 'https://api.openai.com/v1');
  assert.equal(getLLMConfig().model, 'gpt-5.4');
  assert.equal(createLLMClient().maxRetries, 1);
  assert.equal(createLLMClient().timeout, 90_000);
  console.log('PASS direct provider, explicit missing-key failure and bounded client retries');
} finally {
  if (previous.openai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previous.openai;
  if (previous.emergent === undefined) delete process.env.EMERGENT_LLM_KEY;
  else process.env.EMERGENT_LLM_KEY = previous.emergent;
}
