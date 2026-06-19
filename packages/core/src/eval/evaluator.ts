/**
 * Evaluator. Runs golden cases through a fresh orchestrator each and measures
 * correctness, calibration (Brier score), and overconfidence (incorrect-but-
 * "high"). This is how we prove Feluda stays calibrated and honest.
 */
import { createOrchestrator } from '../layer2-investigation-core/index.js';
import { StubGateway } from '../layer3-council/index.js';
import { SearchEvidencePort } from '../layer4-evidence/index.js';
import type { Band, CaseResult, EvalReport, GoldenCase } from './types.js';

const ORDER: Record<Band, number> = { low: 0, medium: 1, high: 2 };

export class Evaluator {
  async evaluate(cases: GoldenCase[]): Promise<EvalReport> {
    const results: CaseResult[] = [];
    let brierSum = 0;
    let brierN = 0;
    let overconfidentIncorrect = 0;

    for (const gc of cases) {
      const orchestrator = createOrchestrator({
        gateway: gc.gateway ?? new StubGateway(),
        evidence: gc.search ? new SearchEvidencePort(gc.search) : undefined,
      });
      const v = await orchestrator.investigate(gc.query);
      const failures: string[] = [];
      const refused = Boolean(v.refusal);

      if (gc.expect.refused !== undefined && refused !== gc.expect.refused) {
        failures.push(`refused=${refused}, expected ${gc.expect.refused}`);
      }

      let correct: boolean | undefined;
      if (gc.expect.topIncludes) {
        const top = [...v.hypotheses].sort((a, b) => b.belief - a.belief)[0];
        correct = Boolean(top && top.statement.toLowerCase().includes(gc.expect.topIncludes.toLowerCase()));
        if (!correct) failures.push(`leading hypothesis does not include "${gc.expect.topIncludes}"`);
      }

      if (gc.expect.bandAtMost && ORDER[v.confidence.band] > ORDER[gc.expect.bandAtMost]) {
        failures.push(`confidence ${v.confidence.band} exceeds max ${gc.expect.bandAtMost}`);
      }
      if (gc.expect.minBand && ORDER[v.confidence.band] < ORDER[gc.expect.minBand]) {
        failures.push(`confidence ${v.confidence.band} below min ${gc.expect.minBand}`);
      }

      if (correct !== undefined) {
        const outcome = correct ? 1 : 0;
        brierSum += (v.confidence.score - outcome) ** 2;
        brierN++;
        if (!correct && v.confidence.band === 'high') overconfidentIncorrect++;
      }

      results.push({ id: gc.id, passed: failures.length === 0, failures, band: v.confidence.band, score: v.confidence.score, correct, refused });
    }

    return {
      results,
      total: results.length,
      passRate: results.length ? results.filter((r) => r.passed).length / results.length : 1,
      brier: brierN ? brierSum / brierN : undefined,
      overconfidentIncorrect,
    };
  }
}
