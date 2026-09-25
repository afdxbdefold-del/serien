import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { marked } from 'marked';
import ts from 'typescript';
import { decideEditorialPublication } from '../lib/editorial-publication-gate';
import {
  linkPersonNamesInHtml,
  linkPersonNamesInMarkdown,
  sanitizePersonLinks,
  type PersonLinkTarget,
} from '../lib/person-link-safety';

const people: PersonLinkTarget[] = [
  { name: 'Lauren London', slug: 'lauren-london' },
  { name: 'Kerry Washington', slug: 'kerry-washington' },
  { name: 'Jason Brooks', slug: 'jason-brooks' },
  { name: 'Lena Dunham', slug: 'lena-dunham' },
  { name: 'Zoë Kravitz', slug: 'zoe-kravitz' },
];

function fragment(html: string) {
  return load(html, {}, false);
}

function markdownFragment(markdown: string) {
  return fragment(marked.parse(markdown, { async: false }));
}

// Regression: a filming location is not a cast member with that surname.
const places = 'Gedreht wird in London und Washington. Brooks Nader ist dabei.';
const plainPlaces = linkPersonNamesInMarkdown(places, people);
assert.equal(plainPlaces.castLinked, 0, 'bare cities and surnames must never become person links');
assert.equal(plainPlaces.linkedMarkdown, places);
const htmlPlaces = linkPersonNamesInHtml(`<p>${places}</p>`, people);
assert.equal(htmlPlaces.linked, 0);
assert.equal(fragment(htmlPlaces.html)('a').length, 0);
assert.equal(fragment(htmlPlaces.html).text(), places);

const fullNames = linkPersonNamesInMarkdown(
  'Lauren London trifft Kerry Washington in London. Lauren London kehrt zurück.',
  people,
);
const fullNamesDom = markdownFragment(fullNames.linkedMarkdown);
assert.equal(fullNames.castLinked, 2);
assert.equal(fullNamesDom('a[href="/person/lauren-london"]').length, 1);
assert.equal(fullNamesDom('a[href="/person/lauren-london"]').text(), 'Lauren London');
assert.equal(fullNamesDom('a[href="/person/kerry-washington"]').length, 1);
assert.equal(fullNamesDom('a').length, 2, 'link each verified full name at most once');
assert.equal(fullNamesDom('a').filter((_, node) => fullNamesDom(node).text() === 'London').length, 0);

const repeatedMarkdown = linkPersonNamesInMarkdown(fullNames.linkedMarkdown, people);
assert.equal(repeatedMarkdown.castLinked, 0, 'a second pass must not add repeat links');
assert.equal(repeatedMarkdown.linkedMarkdown, fullNames.linkedMarkdown);

const nonCanonical = linkPersonNamesInMarkdown(
  'lauren london, LAUREN LONDON, Lauren Londonderry, Lauren Londoner, Jason Brookstone und Brooks Nader.',
  people,
);
assert.equal(nonCanonical.castLinked, 0, 'matching must be case-sensitive and respect complete Unicode words');
assert.equal(markdownFragment(nonCanonical.linkedMarkdown)('a').length, 0);

const mononyms: PersonLinkTarget[] = [
  { name: 'London', slug: 'london' },
  { name: 'Cher', slug: 'cher' },
  { name: '123 456', slug: 'numbers' },
];
assert.equal(linkPersonNamesInMarkdown('London, Cher und 123 456.', mononyms).castLinked, 0,
  'only canonical multiword names containing letters qualify');
assert.equal(linkPersonNamesInHtml('<p>London, Cher und 123 456.</p>', mononyms).linked, 0);

const accented = linkPersonNamesInMarkdown('„Zoë Kravitz“ ist dabei. Zoë Kravitz bleibt.', people);
assert.equal(accented.castLinked, 1, 'Unicode names at punctuation boundaries must be recognized');
assert.equal(markdownFragment(accented.linkedMarkdown)('a[href="/person/zoe-kravitz"]').text(), 'Zoë Kravitz');
assert.equal(linkPersonNamesInMarkdown('Zoë Kravitzová', people).castLinked, 0,
  'an accented suffix must not be mistaken for a word boundary');

const protectedMarkdown = [
  '# Lauren London',
  '',
  'Kerry Washington',
  '----------------',
  '',
  '[**Lauren London**](https://example.com/quelle "Kerry Washington")',
  '',
  '![Kerry Washington](https://example.com/image.jpg "Lauren London")',
  '',
  '`Lauren London und Kerry Washington`',
  '',
  '```text',
  'Lauren London und Kerry Washington',
  '```',
  '',
  '<https://example.com/Lauren%20London>',
  '',
  '<span title="Lauren London" data-caption="Kerry Washington">Drehort</span>',
].join('\n');
const protectedResult = linkPersonNamesInMarkdown(protectedMarkdown, people);
assert.equal(protectedResult.castLinked, 0,
  'headings, existing formatted links, images, code, URLs and HTML attributes are not linkable prose');
assert.equal(protectedResult.linkedMarkdown, protectedMarkdown,
  'non-prose Markdown must remain untouched');

const existingFormatted = '[**Kerry Washington**](/person/kerry-washington) trifft Kerry Washington.';
const existingFormattedResult = linkPersonNamesInMarkdown(existingFormatted, people);
assert.equal(existingFormattedResult.castLinked, 0,
  'an existing person link with formatted visible text already consumes the name');
assert.equal(existingFormattedResult.linkedMarkdown, existingFormatted);

const htmlInput = '<h2>Lauren London</h2>'
  + '<p title="Kerry Washington">Lauren London trifft Kerry Washington. Lauren London bleibt.</p>'
  + '<p><code>Jason Brooks</code><a href="https://example.com">Zoë Kravitz</a></p>'
  + '<pre>Lena Dunham</pre><img alt="Lena Dunham" src="/bild.jpg">';
const htmlResult = linkPersonNamesInHtml(htmlInput, people);
const htmlDom = fragment(htmlResult.html);
assert.equal(htmlResult.linked, 2);
assert.equal(htmlDom('h2').html(), 'Lauren London', 'HTML headings must not acquire person links');
assert.equal(htmlDom('p[title]').attr('title'), 'Kerry Washington', 'attributes must not be rewritten');
assert.equal(htmlDom('code a, pre a, a a').length, 0);
assert.equal(htmlDom('a[href="/person/lauren-london"]').length, 1);
assert.equal(htmlDom('a[href="/person/kerry-washington"]').length, 1);
assert.equal(htmlDom('a[href="https://example.com"]').text(), 'Zoë Kravitz');
assert.equal(htmlDom('img').attr('alt'), 'Lena Dunham');
const htmlSecondPass = linkPersonNamesInHtml(htmlResult.html, people);
assert.equal(htmlSecondPass.linked, 0);
assert.equal(htmlSecondPass.html, htmlResult.html, 'HTML linking must be idempotent');

const ambiguous: PersonLinkTarget[] = [
  { name: 'Lauren London', slug: 'lauren-london' },
  { name: 'Lauren London', slug: 'another-lauren-london' },
];
assert.equal(linkPersonNamesInMarkdown('Lauren London', ambiguous).castLinked, 0,
  'a full name associated with two identities must fail closed');
assert.equal(linkPersonNamesInHtml('<p>Lauren London</p>', ambiguous).linked, 0);

const normalizedAmbiguous: PersonLinkTarget[] = [
  { name: 'Lauren London', slug: 'lauren-london' },
  { name: '  Lauren   London  ', slug: 'another-lauren-london' },
];
assert.equal(linkPersonNamesInMarkdown('Lauren London', normalizedAmbiguous).castLinked, 0,
  'whitespace normalization must not hide an ambiguous identity');

const duplicatedSameIdentity = [people[0], { ...people[0] }];
assert.equal(linkPersonNamesInMarkdown('Lauren London', duplicatedSameIdentity).castLinked, 1,
  'repeated records for the same name and target are not separate identities');

const invalidPersonHtml = '<p>In <a href="/person/lauren-london"><strong>London</strong></a> '
  + 'trifft <a href="/person/lena-dunham">Lauren <em>London</em></a> '
  + '<a href="/person/not-in-cast">Kerry Washington</a> '
  + 'auf <a href="/person/jason-brooks">Brooks Nader</a>.</p>';
const invalidBefore = fragment(invalidPersonHtml);
const sanitized = sanitizePersonLinks(invalidPersonHtml, people);
const sanitizedDom = fragment(sanitized.html);
assert.equal(sanitized.removed, 4, 'bare places, wrong identities, unknown targets and surname collisions must be unlinked');
assert.equal(sanitizedDom('a').length, 0);
assert.equal(sanitizedDom.text(), invalidBefore.text(), 'unlinking must preserve every visible word');
assert.equal(sanitizedDom('strong').text(), 'London', 'unlinking must preserve inline formatting');
assert.equal(sanitizedDom('em').text(), 'London');

const validAndUnrelatedHtml = '<p><a href="/person/lauren-london">Lauren <strong>London</strong></a> '
  + '<a href="https://serien.de/person/kerry-washington">Kerry Washington</a> '
  + '<a href="https://example.com/person/unknown">Externe Quelle</a> '
  + '<a href="/serie/london">London</a> '
  + '<a href="/news/neu">Mehr Nachrichten</a></p>';
const kept = sanitizePersonLinks(validAndUnrelatedHtml, people);
const keptDom = fragment(kept.html);
assert.equal(kept.removed, 0, 'verified identities and unrelated links must be preserved');
assert.equal(keptDom('a').length, 5);
assert.equal(keptDom('a[href="/person/lauren-london"] strong').text(), 'London');
assert.equal(keptDom('a[href="https://example.com/person/unknown"]').text(), 'Externe Quelle');
assert.equal(keptDom('a[href="/serie/london"]').text(), 'London');

const absoluteWrong = sanitizePersonLinks(
  '<p>In <a href="https://serien.de/person/lauren-london">London</a> wird gedreht.</p>',
  people,
);
assert.equal(absoluteWrong.removed, 1, 'absolute same-origin person URLs must receive the same identity validation');
assert.equal(fragment(absoluteWrong.html)('a').length, 0);

for (const href of ['/%70erson/lauren-london', '/person%2flauren-london', 'https://serien.de./person/lauren-london', '//www.serien.de/person/lauren-london']) {
  assert.equal(sanitizePersonLinks(`<p>In <a href="${href}">London</a>.</p>`, people).removed, 1,
    'encoded and same-site URL aliases must not bypass identity checks');
}
for (const href of ['https://serien.de:444/person/lauren-london', 'https://user@serien.de/person/lauren-london']) {
  assert.equal(sanitizePersonLinks(`<p><a href="${href}">Lauren London</a>.</p>`, people).removed, 1,
    'unexpected ports and URL credentials do not identify a canonical person page');
}

const ambiguousLink = sanitizePersonLinks(
  '<p><a href="/person/lauren-london">Lauren London</a></p>',
  ambiguous,
);
assert.equal(ambiguousLink.removed, 1, 'an existing ambiguous full-name link must also fail closed');
assert.equal(fragment(ambiguousLink.html).text(), 'Lauren London');

const invalidCase = sanitizePersonLinks('<p><a href="/person/lauren-london">lauren london</a></p>', people);
assert.equal(invalidCase.removed, 1, 'existing anchors must use the exact canonical case too');

const sanitizedAgain = sanitizePersonLinks(sanitized.html, people);
assert.equal(sanitizedAgain.removed, 0);
assert.equal(sanitizedAgain.html, sanitized.html, 'sanitizing an already sanitized fragment is idempotent');
assert.deepEqual(linkPersonNamesInMarkdown('', people), { linkedMarkdown: '', castLinked: 0 });
assert.equal(linkPersonNamesInHtml('', people).linked, 0);
assert.equal(sanitizePersonLinks('', people).removed, 0);

// A passing language-model review must not override deterministic identity.
const badRevision = '<p>In <a href="/person/lauren-london">London</a> wird gedreht.</p>';
const checkedRevision = sanitizePersonLinks(badRevision, people);
const publication = decideEditorialPublication({
  alreadyDraft: false,
  outcomes: [
    { gate: 'source-grounding', status: 'pass' },
    { gate: 'person-links', status: checkedRevision.removed === 0 ? 'pass' : 'fail' },
  ],
  requiredGates: ['source-grounding', 'person-links'],
});
assert.equal(publication.status, 'draft');
assert.deepEqual(publication.failedGates, ['person-links']);
assert.equal(badRevision.includes('<a '), true, 'validation does not mutate an already reviewed payload');

// Inspect the real entrypoint without importing its database/provider clients.
const pipelineSource = readFileSync(new URL('../scripts/pipeline-v2.ts', import.meta.url), 'utf8');
const pipelineAst = ts.createSourceFile('pipeline-v2.ts', pipelineSource, ts.ScriptTarget.Latest, true);
const declarations = new Map<string, ts.VariableDeclaration>();
const publicationCalls: ts.CallExpression[] = [];
const visit = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
  if (ts.isCallExpression(node) && node.expression.getText(pipelineAst) === 'decideEditorialPublication') publicationCalls.push(node);
  ts.forEachChild(node, visit);
};
visit(pipelineAst);
const beforeReview = declarations.get('personLinks')!;
const review = declarations.get('reviewed')!;
const afterReview = declarations.get('finalPersonLinks')!;
assert(beforeReview && review && afterReview, 'both real pipeline identity checks must exist');
assert(beforeReview.pos < review.pos && review.pos < afterReview.pos);
assert.match(beforeReview.initializer!.getText(pipelineAst), /sanitizePersonLinks\(sourceDocument\.html\(\), castLinkResult\.personLinkTargets\)/);
assert.match(afterReview.initializer!.getText(pipelineAst), /sanitizePersonLinks\(finalContentWithVideo, castLinkResult\.personLinkTargets\)/);
assert.match(pipelineSource, /gate: 'person-links', status: finalPersonLinks\.removed === 0 \? 'pass' : 'fail'/);
assert(publicationCalls.length > 0);
for (const call of publicationCalls) {
  const input = call.arguments[0];
  assert(ts.isObjectLiteralExpression(input));
  const required = input.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(pipelineAst) === 'requiredGates');
  assert(required && ts.isPropertyAssignment(required) && ts.isArrayLiteralExpression(required.initializer));
  assert(required.initializer.elements.some(element => ts.isStringLiteral(element) && element.text === 'person-links'));
}
assert.doesNotMatch(pipelineSource, /finalContentWithVideo\s*=\s*finalPersonLinks\.html/,
  'a post-review defect must hold publication, not silently change the hashed content');

console.log('person-link-safety tests passed');
