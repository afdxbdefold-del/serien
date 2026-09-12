/**
 * Serialize structured data for an inline application/ld+json script.
 * Escaping `<` prevents stored text from terminating the script element.
 */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value) ?? 'null';
  return json.replace(/</g, '\\u003c');
}
