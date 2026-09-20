import assert from 'node:assert/strict';
import { sanitizeArticleContent } from '../lib/content-sanitizer';

const excerpt = 'Nordhafen geht mit sechs neuen Folgen in die zweite Staffel.';
const rest = '<p>Weitere Einzelheiten folgen nach dem Drehstart.</p>';
const extraFact = 'Gedreht wird ab Oktober in Kiel.';
const extendedOpening = `<p>${excerpt} ${extraFact}</p>${rest}`;
assert.equal(sanitizeArticleContent(extendedOpening, excerpt), extendedOpening,
  'a first paragraph sharing the whole excerpt must keep its additional facts');

const sharedPrefix = 'Die neue Staffel von Nordhafen wird nach Angaben der Produktion ';
assert(sharedPrefix.length > 50);
const changedDetail = `<p>${sharedPrefix}in Kiel gedreht.</p>${rest}`;
assert.equal(sanitizeArticleContent(changedDetail, `${sharedPrefix}sechs Folgen umfassen.`), changedDetail,
  'the same 50-character prefix does not make two complete assertions equal');

const differentClaim = '<p>Die neue Staffel startet nicht im Oktober bei Netflix.</p>' + rest;
assert.equal(sanitizeArticleContent(differentClaim, 'Die neue Staffel startet im Oktober bei Netflix.'), differentClaim,
  'shared words must not erase a different claim or a negation');
const shorterOpening = `<p>${excerpt}</p>${rest}`;
assert.equal(sanitizeArticleContent(shorterOpening, `${excerpt} ${extraFact}`), shorterOpening,
  'a shorter paragraph is not an exact duplicate of a longer excerpt');

assert.equal(sanitizeArticleContent(shorterOpening, excerpt), rest,
  'a complete exact duplicate is still removed');
assert.equal(sanitizeArticleContent(`<p>  Nordhafen geht mit\nsechs neuen Folgen in die zweite Staffel. </p>${rest}`, excerpt), rest);
assert.equal(sanitizeArticleContent(`<p>Nordhafen geht mit <strong>sechs neuen Folgen</strong> in die zweite Staffel.</p>${rest}`, excerpt), rest,
  'inline formatting does not change visible equality');
assert.equal(sanitizeArticleContent(`<p>Nordhafen &amp; Co.&nbsp;kommen zurück.</p>${rest}`, 'Nordhafen & Co. kommen zurück.'), rest,
  'decode entities before comparing visible text');
assert.equal(sanitizeArticleContent(`<p>Eine neue <em>Serien</em>staffel beginnt.</p>${rest}`, 'Eine neue Serienstaffel beginnt.'), rest,
  'inline markup must not manufacture word boundaries');

assert.equal(sanitizeArticleContent(extendedOpening), extendedOpening);
assert.equal(sanitizeArticleContent(extendedOpening, '  '), extendedOpening);
assert.equal(sanitizeArticleContent(extendedOpening, '<br>'), extendedOpening);
assert.equal(sanitizeArticleContent('', excerpt), '');
assert.equal(sanitizeArticleContent(`<p>${excerpt}</p><p>${excerpt} ${extraFact}</p>${rest}`, excerpt), `<p>${excerpt} ${extraFact}</p>${rest}`,
  'removing the exact lead must not consume the next paragraph with new facts');

// Preserve the existing unrelated heading cleanup without broadening this fix.
assert.equal(sanitizeArticleContent(`<h2>Artikel-Inhalt</h2>${extendedOpening}`, excerpt), extendedOpening);
assert.equal(sanitizeArticleContent(`<h2>Hintergrund</h2>${extendedOpening}`, excerpt), `<h2>Hintergrund</h2>${extendedOpening}`);
console.log('content-sanitizer tests passed');
