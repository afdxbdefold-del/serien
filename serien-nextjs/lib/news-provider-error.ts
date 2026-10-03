/** Only stable public OpenAI error codes may enter scheduler logs. */
const PROVIDER_ERROR_CODES = new Set([
  'rate_limit_exceeded', 'slow_down', 'credit_balance_exhausted',
  'organization_spend_limit_exceeded', 'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded', 'server_is_overloaded',
]);

export function safeProviderErrorCode(value: unknown): string | undefined {
  return typeof value === 'string' && PROVIDER_ERROR_CODES.has(value) ? value : undefined;
}
