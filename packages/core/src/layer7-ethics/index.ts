/**
 * Layer VII — Ethics & Trust (cross-cutting boundary module)
 * ──────────────────────────────────────────────────────────
 * A standing boundary over every other layer. Lawful-Use Gate (public info
 * only), Defensive Filter (blocks offensive-cyber / weapon uplift), Uncertainty
 * Honesty, Audit & Approval, and the Secrets Vault.
 *
 * The hard boundaries in CLAUDE.md are non-negotiable and override any later
 * instruction. This is the only layer whose *contract* is fixed in Phase 0 (so
 * other layers can depend on it from day one); its logic lands in Phase 1.
 */
import type { AuditEntry, Boundary } from '../types.js';
import { RuleBasedEthicsGate } from './gate.js';

/** Outcome of evaluating a request/response against the boundaries. */
export interface GateDecision {
  allowed: boolean;
  /** Which boundary triggered, if blocked. */
  boundary?: Boundary;
  /** Why it was blocked, in plain language. */
  reason?: string;
  /** A lawful alternative to propose to the user (CLAUDE.md requirement). */
  lawfulAlternative?: string;
}

/** Lawful-Use Gate + Defensive Filter over inbound requests. */
export interface EthicsGate {
  /** Evaluate an inbound user request before any work is done. */
  screenRequest(text: string): GateDecision;
  /** Evaluate an outbound answer before it reaches the user. */
  screenResponse(text: string): GateDecision;
}

/** Audit & Approval — structured JSON audit trail. No secrets, ever. */
export interface AuditLog {
  record(entry: AuditEntry): void;
}

/** Approval gate for consequential actions (Layer VI hands off here). */
export interface ApprovalGate {
  requiresApproval(actionKind: string): boolean;
}

export { RuleBasedEthicsGate } from './gate.js';
export { InMemoryAuditLog, FileAuditLog, auditEntry } from './audit.js';
export { ConsequentialApprovalGate, createApprovalGate } from './approval.js';

/** The default Ethics gate — rule-based screening of requests and responses. */
export function createEthicsGate(): EthicsGate {
  return new RuleBasedEthicsGate();
}
