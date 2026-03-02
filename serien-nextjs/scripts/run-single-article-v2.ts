import { runContentPipeline } from './pipeline-v1';

const url = process.argv[2];

if (!url) {
  console.log('Usage: npx tsx run-single-article.ts <URL>');
  process.exit(1);
}

console.log('🚀 Starting pipeline for:', url);

// Extract a basic title from URL for pipeline
const titleFromUrl = url
  .split('/').filter(Boolean).pop()
  ?.replace(/-/g, ' ')
  .replace(/\/$/, '') || 'Article';

runContentPipeline({
  url,
  title: titleFromUrl,
  excerpt: '',
  source: 'cinemaholic',
  useFullTextMode: true, // CRITICAL: Enable full text fetching
  text: '' // Will be fetched automatically
}).then(() => {
  console.log('✅ Pipeline complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Pipeline failed:', error);
  process.exit(1);
});
