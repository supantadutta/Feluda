/**
 * Investigative Council — role-based review (Layer III). A complementary QA pass
 * over a draft verdict: each role applies a distinct lens — Skeptic challenges
 * weak claims, Source-Verifier grades citations, OSINT/Cyber add domain context,
 * the Ethics reviewer re-checks the boundaries, and the Judge produces a
 * calibrated recommendation. It is DETERMINISTIC and offline-friendly: it reasons
 * over the evidence, hypotheses, and confidence already produced — no extra model
 * calls — so it is fully testable. (The model-panel Council handles synthesis;
 * this handles scrutiny.)
 */
import type {
  Citation,
  CouncilReview,
  Confidence,
  Evidence,
  Hypothesis,
  RoleFinding,
} from '../types.js';
import { gradeFromCredibility, isStale } from '../osint/grading.js';
import { createEthicsGate } from '../layer7-ethics/index.js';
import type { EthicsGate } from '../layer7-ethics/index.js';

export interface CouncilReviewInput {
  answer: string;
  hypotheses: Hypothesis[];
  evidence: Evidence[];
  confidence: Confidence;
  citations: Citation[];
}

export class InvestigativeCouncil {
  constructor(private readonly ethics: EthicsGate = createEthicsGate()) {}

  review(input: CouncilReviewInput): CouncilReview {
    const findings: RoleFinding[] = [];
    const missingEvidence: string[] = [];

    // Lead Investigator — frames the picture.
    findings.push({
      role: 'lead',
      severity: 'info',
      message: `Weighed ${input.hypotheses.length} hypotheses against ${input.evidence.length} evidence item(s).`,
    });

    // Skeptic / Red-Team — challenges weak or close conclusions.
    const sorted = [...input.hypotheses].sort((a, b) => b.belief - a.belief);
    const top = sorted[0];
    const separation = top ? top.belief - (sorted[1]?.belief ?? 0) : 0;
    if (top && separation < 0.1 && sorted.length > 1) {
      findings.push({ role: 'skeptic', severity: 'concern', message: 'The leading hypotheses are nearly tied; the conclusion is not yet decisive.' });
      missingEvidence.push('Evidence that discriminates between the two leading hypotheses.');
    }
    if (top && top.belief < 0.4) {
      findings.push({ role: 'skeptic', severity: 'concern', message: 'No hypothesis is well supported; treat the answer as provisional.' });
    }
    if (top && top.contradicting.length > top.supporting.length) {
      findings.push({ role: 'skeptic', severity: 'concern', message: 'The leading hypothesis has more contradicting than supporting evidence.' });
    }

    // Source-Verification Analyst — grades citation quality.
    if (input.citations.length === 0 && input.evidence.length === 0) {
      findings.push({ role: 'verifier', severity: 'concern', message: 'No external sources — the answer rests on reasoning alone.' });
      missingEvidence.push('At least one credible, independent source.');
    } else {
      const grades = input.evidence.map((e) => gradeFromCredibility(e.credibility));
      const weak = grades.filter((g) => g === 'D' || g === 'F').length;
      if (weak > 0) findings.push({ role: 'verifier', severity: 'concern', message: `${weak} source(s) graded D/F (weak or unusable).` });
      const stale = input.evidence.filter((e) => isStale((e as { freshnessDays?: number }).freshnessDays)).length;
      if (stale > 0) findings.push({ role: 'verifier', severity: 'info', message: `${stale} source(s) may be stale.` });
      const hosts = new Set(input.evidence.filter((e) => e.credibility >= 0.5).map((e) => e.citation.source));
      if (hosts.size < 2 && input.evidence.length > 0) {
        findings.push({ role: 'verifier', severity: 'concern', message: 'Claims are not corroborated across independent sources.' });
        missingEvidence.push('A second independent source to corroborate key claims.');
      }
    }

    // OSINT Specialist — coverage note.
    const offlineFixtures = input.evidence.filter((e) => e.flags?.includes('offline-fixture')).length;
    if (offlineFixtures > 0) {
      findings.push({ role: 'osint', severity: 'info', message: `${offlineFixtures} finding(s) are offline fixtures — run live lookups to confirm.` });
    }

    // Cyber Threat Analyst — flags overclaiming on threat language.
    if (/\b(definitely|certainly|proven|confirmed)\b/i.test(input.answer) && (top?.belief ?? 0) < 0.7) {
      findings.push({ role: 'cyber', severity: 'concern', message: 'Answer uses definitive language that the evidence does not yet support.' });
    }

    // Ethics & Legal Boundary Reviewer — re-screen the output.
    const screen = this.ethics.screenResponse(input.answer);
    findings.push(
      screen.allowed
        ? { role: 'ethics', severity: 'info', message: 'Output is within lawful, defensive boundaries.' }
        : { role: 'ethics', severity: 'critical', message: `Output crosses the ${screen.boundary} boundary.` },
    );

    // Carry the calibrator's named gaps into missing evidence.
    for (const gap of input.confidence.gaps) if (!missingEvidence.includes(gap)) missingEvidence.push(gap);

    // Final Judge — calibrated recommendation.
    const critical = findings.some((f) => f.severity === 'critical');
    const concerns = findings.filter((f) => f.severity === 'concern').length;
    const recommendation: CouncilReview['recommendation'] = critical
      ? 'do_not_conclude'
      : concerns > 0 || input.confidence.band === 'low'
        ? 'gather_more'
        : 'proceed';
    findings.push({
      role: 'judge',
      severity: critical ? 'critical' : concerns > 0 ? 'concern' : 'info',
      message: `Recommendation: ${recommendation.replace(/_/g, ' ')}${concerns ? ` (${concerns} concern(s) raised)` : ''}.`,
    });

    return { findings, missingEvidence, recommendation };
  }
}
