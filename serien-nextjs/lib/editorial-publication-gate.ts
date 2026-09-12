export type EditorialGateStatus = 'pass' | 'fail' | 'error';

export interface EditorialGateOutcome {
  gate: string;
  status: EditorialGateStatus;
  reason?: string;
}

interface EditorialPublicationDecisionInput {
  alreadyDraft: boolean;
  existingReason?: string;
  outcomes: EditorialGateOutcome[];
  requiredGates: string[];
}

export interface EditorialPublicationDecision {
  status: 'published' | 'draft';
  reason: string;
  failedGates: string[];
}

/**
 * A generated article may only be published when every required editorial
 * gate ran and passed. Missing checks and dependency errors fail closed into
 * the review queue instead of becoming public content.
 */
export function decideEditorialPublication(
  input: EditorialPublicationDecisionInput,
): EditorialPublicationDecision {
  if (input.alreadyDraft) {
    return {
      status: 'draft',
      reason: input.existingReason?.trim() || 'Bereits zur manuellen Prüfung markiert',
      failedGates: [],
    };
  }

  const byGate = new Map(input.outcomes.map((outcome) => [outcome.gate, outcome]));
  const failed: EditorialGateOutcome[] = [];

  for (const gate of input.requiredGates) {
    const outcome = byGate.get(gate);
    if (!outcome) {
      failed.push({ gate, status: 'error', reason: 'Prüfung wurde nicht ausgeführt' });
      continue;
    }
    if (outcome.status !== 'pass') failed.push(outcome);
  }

  if (failed.length === 0) {
    return { status: 'published', reason: '', failedGates: [] };
  }

  return {
    status: 'draft',
    reason: failed
      .map((outcome) => `${outcome.gate}: ${outcome.reason || outcome.status}`)
      .join('; '),
    failedGates: failed.map((outcome) => outcome.gate),
  };
}
