import 'dotenv/config';
import { runPipelineV2 } from './scripts/pipeline-v2';

async function main() {
  const result = await runPipelineV2({
    title: "Severance Season 3 Gets Release Window",
    sourceUrl: "https://example.com/severance",
    sourceText: "Apple TV+ has confirmed Severance Season 3 will arrive in late 2026. The critically acclaimed workplace thriller continues.",
    trigger: 'manual'
  });
  console.log('\n\nFINAL RESULT:', result);
}
main().catch(e => console.log('ERROR:', e.message));
