import { serializeJsonLd } from '../lib/json-ld';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const payload = {
  headline: '</script><script>globalThis.compromised = true</script>',
  description: 'Normaler Text',
};
const serialized = serializeJsonLd(payload);

assert(!serialized.toLowerCase().includes('</script'), 'JSON-LD must not terminate its script element');
assert(JSON.parse(serialized).headline === payload.headline, 'escaped JSON-LD must preserve its data');

console.log('✅ JSON-LD serialization tests passed');
