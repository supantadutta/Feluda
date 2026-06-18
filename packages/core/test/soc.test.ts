import { describe, it, expect } from 'vitest';
import { SocAnalyzer } from '../src/soc/index.js';
import { socReport } from '../src/case/index.js';

const soc = new SocAnalyzer();

describe('SOC analyzer (defensive)', () => {
  it('escalates a brute-force burst and recommends defensive actions only', () => {
    const a = soc.analyze({
      type: 'brute_force',
      title: 'Multiple failed logins',
      logs: [
        'Failed password for admin from 203.0.113.9',
        'Failed password for admin from 203.0.113.9',
        'authentication failure user=admin',
        'invalid user root',
        'Failed login for admin',
      ],
    });
    expect(a.verdict).toBe('needs_escalation');
    expect(a.escalate).toBe(true);
    expect(a.recommendedActions.join(' ').toLowerCase()).toMatch(/lock|block|mfa/);
    // Defensive only — never suggests counter-attack.
    expect(a.recommendedActions.join(' ').toLowerCase()).not.toMatch(/exploit|attack the|hack back/);
  });

  it('treats authorised/expected activity as benign', () => {
    const a = soc.analyze({ type: 'suspicious_login', context: 'This was authorised scheduled maintenance by the admin.' });
    expect(a.verdict).toBe('benign');
  });

  it('flags impossible travel for escalation', () => {
    const a = soc.analyze({ type: 'impossible_travel', context: 'Login from two countries within an hour — impossible travel.' });
    expect(a.verdict).toBe('needs_escalation');
    expect(a.confidence).toBe('high');
  });

  it('stays inconclusive without evidence (no overclaiming)', () => {
    const a = soc.analyze({ type: 'unknown', title: 'Unclassified' });
    expect(a.verdict).toBe('inconclusive');
  });

  it('renders a SOC report in the standard format', () => {
    const a = soc.analyze({ type: 'phishing_email', title: 'Phish', artifacts: ['http://evil.example/login'] });
    const r = socReport(a);
    expect(r.content).toMatch(/## Alert Summary/);
    expect(r.content).toMatch(/## Assessment/);
    expect(r.content).toMatch(/Recommended Action/);
  });
});
