/**
 * Layer VI — Action (boundary module)
 * ───────────────────────────────────
 * Turn conclusions into deliverables and handle daily admin: Report Builder
 * (PDF/DOCX), Data & Charts (sandboxed analysis + viz), defensive-only security
 * helpers, and Daily Ops (calendar/reminders/tasks).
 *
 * EVERY consequential action (sending, posting, deleting, spending) must pass
 * through the Layer VII approval gate before it runs.
 *
 * Phase: implemented in Phase 5.
 */
import { notImplemented } from '../util/not-implemented.js';

/** A proposed action the user may need to confirm. */
export interface ActionRequest {
  kind: 'report.export' | 'data.analyze' | 'security.triage' | 'ops.task';
  /** Whether this action is consequential and needs explicit confirmation. */
  consequential: boolean;
  payload: Record<string, unknown>;
}

/** Result of attempting an action. */
export interface ActionResult {
  ok: boolean;
  /** Set when the action is blocked pending user confirmation. */
  awaitingApproval?: boolean;
  detail?: Record<string, unknown>;
}

/** The boundary the Orchestrator uses to perform actions. */
export interface ActionPort {
  perform(req: ActionRequest): Promise<ActionResult>;
}

/** Phase 0 placeholder — deliverables + approval wiring land in Phase 5. */
export function createActionPort(): ActionPort {
  return {
    perform: () => notImplemented('Layer VI ActionPort.perform'),
  };
}
