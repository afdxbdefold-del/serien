import { runContentPipeline } from './pipeline-v1';

const url = process.argv[2];

if (!url) {
  console.log('Usage: npx tsx run-single-article.ts <URL>');
  process.exit(1);
}

console.log('🚀 Starting pipeline for:', url);

runContentPipeline({
  url,
  title: '',
  excerpt: '',
  source: 'cinemaholic'
}).then(() => {
  console.log('✅ Pipeline complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Pipeline failed:', error);
  process.exit(1);
});
