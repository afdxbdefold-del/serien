import { markdownToHtml } from '../lib/markdown-to-html';

const testMarkdown = `
## Test Heading

This is a test with a [character link](/figur/test-character) and a [cast link](/person/test-actor).

Some more text here with [another link](/figur/another-char).

## Second Heading

More content with [cast member](/person/john-doe).
`;

console.log('📝 INPUT MARKDOWN:');
console.log(testMarkdown);
console.log('\n' + '='.repeat(70) + '\n');

const html = markdownToHtml(testMarkdown);

console.log('📄 OUTPUT HTML:');
console.log(html);
console.log('\n' + '='.repeat(70) + '\n');

const charLinks = (html.match(/href="\/figur\//g) || []).length;
const castLinks = (html.match(/href="\/person\//g) || []).length;

console.log('📊 RESULT:');
console.log(`   Character Links: ${charLinks}`);
console.log(`   Cast Links: ${castLinks}`);

if (charLinks === 2 && castLinks === 2) {
  console.log('   ✅ markdownToHtml() works correctly!');
} else {
  console.log('   ❌ markdownToHtml() is BROKEN!');
}
