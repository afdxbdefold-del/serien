/**
 * Clean and parse JSON from LLM responses
 * Handles markdown code blocks that GPT-4o sometimes returns
 */
export function parseJsonResponse(content: string | null | undefined): any {
  let text = (content || '{}').trim();
  
  // Remove markdown code blocks
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  
  return JSON.parse(text.trim());
}
