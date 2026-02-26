import { runContentPipeline } from './pipeline-v1';

async function main() {
  const source = {
    title: "The Pitt Season 2 Episode 6 Recap",
    url: "https://thecinemaholic.com/the-pitt-season-2-episode-6/",
    text: `Initial placeholder - will be fetched via Playwright`,
    useFullTextMode: true
  };

  console.log('🚀 Starting Pipeline v1 for The Pitt article...\n');
  
  const result = await runContentPipeline(source);
  
  if ('skipped' in result && result.skipped) {
    console.log(`\n⚠️  Pipeline Result: SKIPPED`);
    console.log(`   Reason: ${result.reason}`);
    if ('draft' in result && result.draft) {
      console.log(`   Draft saved: ${result.draft.id}`);
    }
  } else if ('success' in result && result.success) {
    console.log(`\n✅ Pipeline Result: SUCCESS`);
    console.log(`   Article ID: ${result.article.id}`);
    console.log(`   Article Slug: ${result.article.slug}`);
    console.log(`   URL: http://localhost:3000/${result.article.slug}`);
  }
}

main().catch(console.error);
