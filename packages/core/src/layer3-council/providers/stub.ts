/**
 * Offline stub provider. Used when no API key is configured, and in tests, so
 * the deduction loop is runnable without network or secrets. It returns valid,
 * clearly-labelled JSON for the two Phase 1 prompt kinds (HYPOTHESES, SYNTHESIS).
 *
 * It is intentionally honest: answers say they came from an offline stub so a
 * user never mistakes a placeholder for a real, reasoned result.
 */
import type { ModelGateway, ModelRequest, ModelResponse } from '../index.js';

export class StubGateway implements ModelGateway {
  readonly model = 'feluda-stub';

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const text = this.respond(req.prompt);
    return { text, model: this.model };
  }

  private respond(prompt: string): string {
    if (prompt.includes('TASK=HYPOTHESES')) {
      return JSON.stringify({
        hypotheses: [
          { statement: 'The most direct explanation consistent with the question.', belief: 0.5 },
          { statement: 'A plausible alternative that should not be ruled out yet.', belief: 0.3 },
          { statement: 'A less likely but still possible explanation.', belief: 0.2 },
        ],
      });
    }
    // TASK=SYNTHESIS (default)
    return JSON.stringify({
      answer:
        'Offline stub response: set ANTHROPIC_API_KEY to enable real reasoning. ' +
        'With no model and no external sources, this is a placeholder, not a reasoned conclusion.',
      reasoning: [
        'Considered the leading hypothesis against the alternatives.',
        'No external evidence was available to update beliefs.',
      ],
      confidence: {
        score: 0.2,
        band: 'low',
        gaps: ['No live model configured (offline stub).', 'No external evidence gathered.'],
      },
    });
  }
}
