/**
 * Defensive Security (Layer VI) — DEFENSIVE SCOPE ONLY (CLAUDE.md hard boundary).
 * Log triage, detection-rule drafting, and hardening checklists. Nothing here
 * builds offensive capability; it helps a defender detect and harden.
 */
export interface LogFinding {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  count: number;
}

export class DefensiveSecurity {
  /** Triage log lines: surface failed-auth bursts, errors, and privilege use. */
  triageLogs(lines: string[]): LogFinding[] {
    const failedAuth = lines.filter((l) => /failed (password|login)|authentication failure|invalid user/i.test(l)).length;
    const errors = lines.filter((l) => /\berror\b|\bexception\b|\bfatal\b/i.test(l)).length;
    const privilege = lines.filter((l) => /\bsudo\b|privilege escalation|root login/i.test(l)).length;

    const findings: LogFinding[] = [];
    if (failedAuth > 0)
      findings.push({
        severity: failedAuth >= 5 ? 'critical' : 'warning',
        message: `${failedAuth} failed authentication attempt(s) — possible brute force.`,
        count: failedAuth,
      });
    if (errors > 0)
      findings.push({ severity: 'warning', message: `${errors} error/exception line(s).`, count: errors });
    if (privilege > 0)
      findings.push({ severity: 'info', message: `${privilege} privilege-related event(s) to review.`, count: privilege });
    if (findings.length === 0)
      findings.push({ severity: 'info', message: 'No notable patterns detected.', count: 0 });
    return findings;
  }

  /** Draft a Sigma-style detection rule (YAML) for a described pattern. */
  draftDetectionRule(title: string, pattern: string): string {
    const safeTitle = title.replace(/[\n\r]/g, ' ').slice(0, 80);
    return [
      `title: ${safeTitle}`,
      'status: experimental',
      'description: Auto-drafted by Feluda (review before deploying).',
      'logsource:',
      '  category: application',
      'detection:',
      '  selection:',
      `    message|contains: '${pattern.replace(/'/g, "''").slice(0, 120)}'`,
      '  condition: selection',
      'level: medium',
    ].join('\n');
  }

  /** A hardening checklist for a system type. */
  hardeningChecklist(system: string): string[] {
    const base = [
      'Enforce MFA on all administrative accounts.',
      'Apply least-privilege access; remove unused accounts.',
      'Keep packages patched; enable automatic security updates.',
      'Centralise and monitor logs; alert on failed-auth bursts.',
      'Back up critical data and test restores.',
    ];
    if (/web|http|nginx|apache/i.test(system)) {
      base.push('Set TLS, HSTS, and a strict Content-Security-Policy.', 'Put a WAF / rate limiting in front of public endpoints.');
    }
    if (/ssh|linux|server/i.test(system)) {
      base.push('Disable password SSH; use keys. Restrict SSH by source.', 'Run a host firewall (deny by default).');
    }
    return base;
  }
}
