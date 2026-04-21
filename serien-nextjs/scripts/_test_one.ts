/**
 * Replay one of the URLs that just hit a 403 on Vercel cron, to see if our
 * local pipeline (using claude-sonnet-4-6) handles it cleanly.
 */
import { runPipelineV2 } from './pipeline-v2';

const url = process.argv[2] || 'https://variety.com/2026/tv/news/the-pitt-season-2-finale-ratings-record-viewers-1236726289/';

(async () => {
  console.log('Testing URL:', url);
  const res = await runPipelineV2({
    title: 'test',
    url,
    text: '',
    useFullTextMode: true,
    trigger: 'manual',
  } as any);
  console.log('Done:', res);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
