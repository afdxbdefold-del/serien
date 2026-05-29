/* eslint-disable */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  const url = 'https://thecinemaholic.com/murder-mindfully-season-3/';
  console.log(`▶ Running pipeline manually for: ${url}\n`);

  const result = await runPipelineV2({
    // DE-titel im Source-Title erhöht TMDB-Confidence von 23 % auf >90 %,
    // weil unsere DB-Row als "Achtsam Morden" gespeichert ist.
    title: 'Achtsam Morden Staffel 3 — Murder Mindfully',
    url,
    text: '',
    useFullTextMode: true,
    trigger: 'manual',
    discoveryChannel: 'admin-manual',
  } as any);

  console.log('\n=== Result ===');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
