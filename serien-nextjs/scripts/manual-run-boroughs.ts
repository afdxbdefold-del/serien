/* eslint-disable */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  const url = 'https://thecinemaholic.com/the-boroughs-ending-explained/';
  console.log(`▶ Running pipeline manually for: ${url}\n`);

  const result = await runPipelineV2({
    title: 'The Boroughs Ending Explained',
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
