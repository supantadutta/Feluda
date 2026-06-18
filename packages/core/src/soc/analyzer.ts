/**
 * SOC Analyzer (Layer VI) — defensive triage of a security alert. It extracts
 * indicators, triages any logs, and produces a calibrated, evidence-based
 * assessment with defensive recommendations. It is humble: without confirming
 * evidence it prefers "needs escalation" or "inconclusive" over asserting a
 * true positive, and it never recommends offensive action.
 */
import { DefensiveSecurity } from '../layer6-action/index.js';
import { extractEntities } from '../osint/index.js';
import type { EntityNode } from '../osint/types.js';
import type { LogFinding } from '../layer6-action/index.js';
import type { SocAlertType, SocAssessment, SocConfidence, SocInput, SocVerdict } from './types.js';

const TITLES: Record<SocAlertType, string> = {
  suspicious_login: 'Suspicious login',
  brute_force: 'Brute-force authentication',
  password_spray: 'Password spraying',
  phishing_email: 'Phishing email',
  suspicious_ip: 'Suspicious IP address',
  suspicious_domain: 'Suspicious domain',
  suspicious_url: 'Suspicious URL',
  malware_hash: 'Malware file hash',
  web_attack: 'Web application attack',
  impossible_travel: 'Impossible travel',
  dns_tunneling: 'Possible DNS tunneling',
  lateral_movement: 'Possible lateral movement',
  unknown: 'Unclassified alert',
};

const BASE_ACTIONS: Record<SocAlertType, string[]> = {
  suspicious_login: ['Verify the login with the account owner', 'Review recent sessions/MFA prompts', 'Reset credentials if unconfirmed'],
  brute_force: ['Temporarily lock/rate-limit the targeted account', 'Block or throttle the source at the perimeter', 'Confirm MFA is enforced'],
  password_spray: ['Identify all targeted accounts', 'Enforce MFA and lockout thresholds', 'Block the source range'],
  phishing_email: ['Quarantine the message', 'Block the sender/domain', 'Notify recipients', 'Hunt for other recipients/clicks'],
  suspicious_ip: ['Check reputation (passive)', 'Block at the firewall if malicious', 'Review connections to/from the IP'],
  suspicious_domain: ['Check domain reputation (passive)', 'Sinkhole/block if malicious', 'Hunt for resolutions in DNS logs'],
  suspicious_url: ['Check URL reputation (passive)', 'Block at proxy if malicious', 'Identify who accessed it'],
  malware_hash: ['Enrich the hash via public reputation', 'Isolate affected host if confirmed', 'Block the hash in EDR'],
  web_attack: ['Apply/verify a WAF rule', 'Confirm the target is patched', 'Review web/access logs for success'],
  impossible_travel: ['Verify with the user', 'Revoke active sessions', 'Reset credentials and review MFA'],
  dns_tunneling: ['Inspect DNS volume/entropy to the domain', 'Block the domain', 'Isolate the host if confirmed'],
  lateral_movement: ['Review authentication graph between hosts', 'Isolate suspected hosts', 'Reset affected credentials'],
  unknown: ['Gather more evidence', 'Identify the indicators involved', 'Escalate if impact is unclear'],
};

export class SocAnalyzer {
  private readonly security = new DefensiveSecurity();

  analyze(input: SocInput): SocAssessment {
    const corpus = [input.title, input.context, ...(input.artifacts ?? []), ...(input.logs ?? [])]
      .filter(Boolean)
      .join('\n');
    const entities: EntityNode[] = extractEntities(corpus);
    const findings: LogFinding[] = input.logs?.length ? this.security.triageLogs(input.logs) : [];

    const critical = findings.some((f) => f.severity === 'critical');
    const warning = findings.some((f) => f.severity === 'warning');
    const hasArtifacts = (input.artifacts?.length ?? 0) > 0 || entities.length > 0;

    const { verdict, confidence, escalate, reasoning } = this.assess(input.type, {
      critical,
      warning,
      hasArtifacts,
      context: input.context ?? '',
    });

    const title = input.title ?? TITLES[input.type];
    const observedActivity = this.observed(input, entities);
    const recommendedActions = BASE_ACTIONS[input.type];

    return {
      alertSummary: `SOC received an alert: "${title}" (${input.type.replace(/_/g, ' ')}).`,
      observedActivity,
      findings,
      entities,
      verdict,
      reasoning,
      recommendedActions,
      escalate,
      confidence,
      managementSummary: this.management(title, verdict, escalate),
    };
  }

  private assess(
    type: SocAlertType,
    s: { critical: boolean; warning: boolean; hasArtifacts: boolean; context: string },
  ): { verdict: SocVerdict; confidence: SocConfidence; escalate: boolean; reasoning: string } {
    const ctx = s.context.toLowerCase();
    const impossible = /impossible travel|new country|two countries|different continent/.test(ctx);
    const authorized = /authori[sz]ed|known maintenance|pen ?test|expected|scheduled/.test(ctx);

    if (authorized) {
      return { verdict: 'benign', confidence: 'moderate', escalate: false, reasoning: 'Context indicates authorised/expected activity; no malicious indicators confirmed.' };
    }
    if (type === 'brute_force' || type === 'password_spray') {
      if (s.critical) return { verdict: 'needs_escalation', confidence: 'high', escalate: true, reasoning: 'A burst of failed authentications is consistent with an automated attack; confirm and contain before closing.' };
      if (s.warning) return { verdict: 'inconclusive', confidence: 'moderate', escalate: false, reasoning: 'Some failed authentications observed; volume is below a confident attack threshold.' };
      return { verdict: 'inconclusive', confidence: 'low', escalate: false, reasoning: 'No clear failed-authentication pattern in the provided logs.' };
    }
    if ((type === 'impossible_travel' || type === 'suspicious_login') && impossible) {
      return { verdict: 'needs_escalation', confidence: 'high', escalate: true, reasoning: 'Geographically inconsistent logins suggest possible account compromise; verify with the user.' };
    }
    if (type === 'phishing_email' && s.hasArtifacts) {
      return { verdict: 'needs_escalation', confidence: 'moderate', escalate: true, reasoning: 'The message contains actionable indicators (links/sender); treat as suspicious pending verification.' };
    }
    if ((type === 'malware_hash' || type === 'suspicious_ip' || type === 'suspicious_domain' || type === 'suspicious_url') && s.hasArtifacts) {
      return { verdict: 'inconclusive', confidence: 'moderate', escalate: false, reasoning: 'Indicator present; enrich via passive reputation before drawing a conclusion (no live reputation in offline mode).' };
    }
    if (type === 'web_attack' && (s.critical || s.warning)) {
      return { verdict: 'needs_escalation', confidence: 'moderate', escalate: true, reasoning: 'Logs show error/attack patterns; confirm whether the request succeeded.' };
    }
    if (!s.hasArtifacts && !s.warning && !s.critical) {
      return { verdict: 'inconclusive', confidence: 'low', escalate: false, reasoning: 'Insufficient evidence to assess; gather more indicators or logs.' };
    }
    return { verdict: 'inconclusive', confidence: 'low', escalate: false, reasoning: 'Indicators present but not decisive; further verification needed.' };
  }

  private observed(input: SocInput, entities: EntityNode[]): string {
    const ind = entities.slice(0, 6).map((e) => `${e.type}:${e.value}`);
    const base = input.context?.trim() || 'No free-text context was provided.';
    return ind.length ? `${base} Indicators: ${ind.join(', ')}.` : base;
  }

  private management(title: string, verdict: SocVerdict, escalate: boolean): string {
    const v = verdict.replace(/_/g, ' ');
    return `Alert "${title}" assessed as ${v}.${escalate ? ' Escalation recommended.' : ' No escalation required at this time.'} Actions are defensive and reversible.`;
  }
}
