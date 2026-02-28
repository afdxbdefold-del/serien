/**
 * Test content generation with markdown
 */

import { generateNaturalArticleHTML } from '../lib/article-formatter.ts';

const testText = `Die HBO-Serie **House of the Dragon** startet in **Staffel 3**. Autor **George R.R. Martin** gibt neue Hinweise. Die Produktion läuft in **Großbritannien**.

**HBO** bestätigt **2026** als Release. Die Serie setzt den **Targaryen-Bürgerkrieg** fort. Es werden mehrere Episoden gedreht.

Die Dreharbeiten sind im Gange. Weitere Details folgen bald. Die Fans sind gespannt.`;

console.log('=== INPUT ===\n');
console.log(testText);

const result = generateNaturalArticleHTML(testText, 'House of the Dragon');

console.log('\n=== OUTPUT ===\n');
console.log(result);
console.log('\n=== CHECKS ===');
console.log('✅ Contains ** :', result.includes('**') ? '❌ JA (Problem!)' : '✅ NEIN');
console.log('✅ Contains <strong>:', result.includes('<strong>') ? '✅ JA' : '❌ NEIN');
console.log('✅ Broken <strong> tags:', result.match(/<\/strong>[^<\s]+<strong>/g) ? '❌ JA (Problem!)' : '✅ NEIN');
