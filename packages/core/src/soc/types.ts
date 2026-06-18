/**
 * Defensive SOC investigation types (Layer VI scope: defensive security only).
 */
import type { EntityNode } from '../osint/types.js';
import type { LogFinding } from '../layer6-action/index.js';

export type SocAlertType =
  | 'suspicious_login'
  | 'brute_force'
  | 'password_spray'
  | 'phishing_email'
  | 'suspicious_ip'
  | 'suspicious_domain'
  | 'suspicious_url'
  | 'malware_hash'
  | 'web_attack'
  | 'impossible_travel'
  | 'dns_tunneling'
  | 'lateral_movement'
  | 'unknown';

/** Calibrated SOC verdict — never asserts a true positive without confirmation. */
export type SocVerdict =
  | 'true_positive'
  | 'false_positive'
  | 'benign'
  | 'needs_escalation'
  | 'inconclusive';

export type SocConfidence = 'very_high' | 'high' | 'moderate' | 'low' | 'unknown';

export interface SocInput {
  type: SocAlertType;
  title?: string;
  /** Indicators involved (IPs, domains, hashes, users…). */
  artifacts?: string[];
  /** Raw log lines, if available. */
  logs?: string[];
  /** Free-text analyst context (e.g. "login from a new country"). */
  context?: string;
}

export interface SocAssessment {
  alertSummary: string;
  observedActivity: string;
  findings: LogFinding[];
  entities: EntityNode[];
  verdict: SocVerdict;
  reasoning: string;
  recommendedActions: string[];
  escalate: boolean;
  confidence: SocConfidence;
  managementSummary: string;
}
