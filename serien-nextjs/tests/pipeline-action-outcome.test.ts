import assert from 'node:assert/strict';
import { pipelineActionOutcome } from '../lib/pipeline-action-outcome';

const saved = { articleId: 'article-1', slug: 'echte-news', headline: 'Echte News', status: 'published' };

const verified = pipelineActionOutcome({ ...saved, publicationVerified: true });
assert.equal(verified.success, true);
assert.equal(verified.published, true);
assert.equal(verified.stored, true);
assert.equal(verified.verificationPending, false);
assert.equal(verified.articleUrl, '/echte-news');

for (const publicationVerified of [false, undefined]) {
  const pending = pipelineActionOutcome({ ...saved, publicationVerified });
  assert.equal(pending.success, false, 'unverified display must not be reported as full success');
  assert.equal(pending.partial, true, 'a committed article is not a total generation failure');
  assert.equal(pending.stored, true);
  assert.equal(pending.created, true);
  assert.equal(pending.published, true, 'the actual persisted publication status must be preserved');
  assert.equal(pending.status, 'published');
  assert.equal(pending.verificationPending, true);
  assert.equal(pending.articleUrl, '/echte-news');
  assert.equal(pending.reviewUrl, undefined, 'a committed publication must not be presented as a draft');
  assert.match(pending.message, /nicht erneut importieren/);
}

const draft = pipelineActionOutcome({ ...saved, status: 'draft', draftReason: 'Beleg fehlt', publicationVerified: true });
assert.equal(draft.success, false, 'stale verification must never promote a draft');
assert.equal(draft.verificationPending, false);
assert.equal(draft.published, false);
assert.equal(draft.publicationVerified, false);
assert.equal(draft.reviewUrl, '/admin/articles/article-1');
assert.equal(draft.articleUrl, undefined);
assert.equal(draft.draftReason, 'Beleg fehlt');

const existing = pipelineActionOutcome(saved, false);
assert.equal(existing.created, false);
assert.equal(existing.stored, true);
assert.equal(existing.alreadyExists, true);
assert.equal(existing.verificationPending, true, 'existing storage alone proves no current live result');

const existingDraft = pipelineActionOutcome({ ...saved, status: 'draft' }, false);
assert.equal(existingDraft.reviewUrl, '/admin/articles/article-1');
assert.match(existingDraft.message, /bereits vorhanden/);

console.log('✅ pipeline-action-outcome tests passed');
