import { smartTruncate } from '../lib/smart-truncate.ts';

const testText = "Joel dürfte in Staffel 2 von „The Last of Us" noch tiefer in moralische Abgründe rutschen: Pedro Pascal lässt in einem Interview anklingen, dass die neuen Episoden deutlich düsterer werden.";

console.log('=== ORIGINAL ===');
console.log(testText);
console.log('Länge:', testText.length);

console.log('\n=== TRUNCATED (155 chars) ===');
const result = smartTruncate(testText, 155);
console.log(result);
console.log('Länge:', result.length);

console.log('\n=== TRUNCATED (200 chars) ===');
const result200 = smartTruncate(testText, 200);
console.log(result200);
console.log('Länge:', result200.length);

console.log('\n=== CHECK ===');
if (result.endsWith('dass die') || result.endsWith('dass')) {
  console.log('❌ Endet mit Funktionswort');
} else if (result.endsWith(':')) {
  console.log('✅ Endet mit Doppelpunkt (natürliche Pause)');
} else if (result.endsWith('.')) {
  console.log('✅ Endet mit Satzende');
} else {
  console.log('✅ Intelligenter Schnitt');
}
