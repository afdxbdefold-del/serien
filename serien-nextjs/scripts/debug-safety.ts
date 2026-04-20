import { classifyContent } from '../lib/content-classifier';
import { fetchFullArticleText } from '../lib/full-text-fetcher';

const urls = [
  'https://www.hollywoodreporter.com/tv/tv-news/itv-drama-believe-me-daniel-mays-black-cab-rapist-1236566643/',
  'https://deadline.com/2026/04/patrick-muldoon-dead-days-of-our-lives-melrose-place-1236865474/',
];

async function main() {
  for (const url of urls) {
    console.log('\n───', url.slice(0, 100));
    try {
      const ft = await fetchFullArticleText(url);
      console.log('   Title:', (ft.title || '').slice(0, 80));
      const t0 = Date.now();
      const r = await classifyContent(ft.title || '', url, ft.fullText || '');
      console.log('   dt:', Date.now() - t0 + 'ms');
      console.log('   type:', r.content_type, 'conf:', r.confidence);
      console.log('   reasoning:', (r.reasoning || '').slice(0, 200));
    } catch (e: any) { console.log('   FATAL:', e.message); }
  }
}
main();
