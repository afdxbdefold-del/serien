import { fetchFullArticleText } from '../lib/full-text-fetcher';

async function test() {
  const result = await fetchFullArticleText('https://thecinemaholic.com/cross-season-3/');

  console.log('Title:', result.title);
  console.log('\nFirst 500 chars:');
  console.log(result.fullText.substring(0, 500));
}

test().catch(console.error);
