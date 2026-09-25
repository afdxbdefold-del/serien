import { serializeJsonLd } from '../lib/json-ld';
import { generateArticleSchema, ORG_ID } from '../lib/schema-generator';

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

const archivedArticle = generateArticleSchema({
  title: 'Archivbeitrag',
  description: 'Test',
  imageUrl: '/og-image.png',
  imageDimensions: { width: 1200, height: 630 },
  datePublished: '2026-04-21T00:00:00.000Z',
  dateModified: '2026-09-25T00:00:00.000Z',
  slug: 'archivbeitrag',
  author: 'serien.de',
  authorType: 'Organization',
  authorBio: 'Unbelegte Lebenslaufangabe',
});
assert(archivedArticle.author['@id'] === ORG_ID, 'public article must credit its responsible organization');
assert(!serializeJsonLd(archivedArticle).includes('Unbelegte Lebenslaufangabe'), 'unverified biography must not leak into article schema');

console.log('✅ JSON-LD serialization tests passed');
