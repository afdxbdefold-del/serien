const title = "'Allegiance' Renewed for Season 4 at CBS";

// Test different regex patterns
console.log('Test 1: Simple single quote');
const regex1 = /[']([^']{2,40})['/g;
const match1 = title.match(regex1);
console.log('Match:', match1);

console.log('\nTest 2: Multiple quote types in character class');
const regex2 = /["'„"''"]([^"'""'']{2,40})["'""''"]/g;
const matches2 = [...title.matchAll(regex2)];
console.log('Matches:', matches2.map(m => m[1]));

console.log('\nTest 3: Just the working one');
const regex3 = /'([^']+)'/g;
const matches3 = [...title.matchAll(regex3)];
console.log('Matches:', matches3.map(m => m[1]));
