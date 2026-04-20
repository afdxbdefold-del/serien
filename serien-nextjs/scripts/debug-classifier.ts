import { classifyContent } from '../lib/content-classifier';
import { fetchFullArticleText } from '../lib/full-text-fetcher';

const urls = [
  'https://www.tvinsider.com/1259113/euphoria-season-3-eric-dane-filmed-scenes/',
  'https://collider.com/titus-welliver-bosch-legacy-season-4-discussions-confirmed/',
  'https://deadline.com/2026/04/patrick-muldoon-dead-days-of-our-lives-melrose-place-1236865474/',
  'https://www.tvinsider.com/1259093/rooster-episode-7-walt-dylan-dean-riggs-john-c-mcginley/',
];

async function main() {
  for (const url of urls) {
    console.log('\n───', url.slice(0, 90));
    try {
      const ft = await fetchFullArticleText(url);
      console.log('   Title:', (ft.title || '').slice(0, 80));
      console.log('   Text words:', ft.wordCount);
      const t0 = Date.now();
      const r = await classifyContent(ft.title || '', url, ft.fullText || '');
      console.log('   dt:', Date.now() - t0 + 'ms', 'type:', r.content_type, 'conf:', r.confidence);
      console.log('   reasoning:', (r.reasoning || '').slice(0, 160));
    } catch (e: any) {
      console.log('   FATAL:', e.message);
    }
  }
}
main();
