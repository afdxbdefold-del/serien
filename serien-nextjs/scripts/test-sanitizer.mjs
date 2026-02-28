const testText = `Die HBO-Serie "House of the Dragon" ist offiziell in Produktion. Die HBO-Serie „House of the Dragon" berichtet über die neue staffel. Inhaltlich steht weiterhin der Bürgerkrieg im Fokus.`;

const cleaned = testText
  .replace(/Die\s+[A-Z][\w-]+-(Serie|Plattform)\s+[„"][\w\s:]+[""]\s+berichtet über die neue staffel\./gi, '')
  .replace(/^\s*Inhaltlich steht\s*/gm, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

console.log('ORIGINAL:');
console.log(testText);
console.log('\nCLEANED:');
console.log(cleaned);
console.log('\n✅ Removed:', testText.length - cleaned.length, 'chars');
