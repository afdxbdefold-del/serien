import { decideEditorialPublication } from '../lib/editorial-publication-gate';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const requiredGates = ['quality', 'anti-ai', 'fact-safety', 'freshness', 'release-mode'];
const passingOutcomes = requiredGates.map((gate) => ({ gate, status: 'pass' as const }));

const publish = decideEditorialPublication({
  alreadyDraft: false,
  outcomes: passingOutcomes,
  requiredGates,
});
assert(publish.status === 'published', 'all required checks should publish');

const qualityFail = decideEditorialPublication({
  alreadyDraft: false,
  outcomes: passingOutcomes.map((outcome) =>
    outcome.gate === 'quality' ? { ...outcome, status: 'fail' as const, reason: 'score' } : outcome,
  ),
  requiredGates,
});
assert(qualityFail.status === 'draft', 'a quality failure must create a draft');
assert(qualityFail.failedGates.includes('quality'), 'quality failure should be reported');

const missingCheck = decideEditorialPublication({
  alreadyDraft: false,
  outcomes: passingOutcomes.filter((outcome) => outcome.gate !== 'fact-safety'),
  requiredGates,
});
assert(missingCheck.status === 'draft', 'a missing required check must fail closed');
assert(missingCheck.failedGates.includes('fact-safety'), 'missing check should be reported');

const dependencyError = decideEditorialPublication({
  alreadyDraft: false,
  outcomes: passingOutcomes.map((outcome) =>
    outcome.gate === 'anti-ai' ? { ...outcome, status: 'error' as const, reason: 'LLM unavailable' } : outcome,
  ),
  requiredGates,
});
assert(dependencyError.status === 'draft', 'a dependency error must not publish');

const releaseHold = decideEditorialPublication({
  alreadyDraft: false,
  outcomes: passingOutcomes.map((outcome) =>
    outcome.gate === 'release-mode'
      ? { ...outcome, status: 'fail' as const, reason: 'editorial hold' }
      : outcome,
  ),
  requiredGates,
});
assert(releaseHold.status === 'draft', 'the editorial release hold must prevent auto-publication');

console.log('✅ editorial-publication-gate tests passed');
