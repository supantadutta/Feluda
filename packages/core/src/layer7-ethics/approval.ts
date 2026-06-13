/**
 * Approval gate (Layer VII — Audit & Approval). Consequential actions (sending,
 * posting, deleting, spending) require explicit user confirmation before they
 * run (CLAUDE.md — Human-in-the-loop). This declares which action kinds are
 * consequential; Layer VI consults it before performing anything.
 */
import type { ApprovalGate } from './index.js';

/** Action kinds that change the world and therefore need confirmation. */
const CONSEQUENTIAL = new Set<string>([
  'ops.task.delete',
  'report.share',
  'ops.reminder.send',
]);

export class ConsequentialApprovalGate implements ApprovalGate {
  constructor(extra: Iterable<string> = []) {
    for (const k of extra) CONSEQUENTIAL.add(k);
  }

  requiresApproval(actionKind: string): boolean {
    return CONSEQUENTIAL.has(actionKind);
  }
}

export function createApprovalGate(): ApprovalGate {
  return new ConsequentialApprovalGate();
}
