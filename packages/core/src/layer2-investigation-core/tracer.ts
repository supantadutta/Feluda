/**
 * Reasoning Tracer (Layer II) — records the auditable chain from clue → verdict
 * so the user can inspect exactly how Feluda reached its answer.
 */
import type { Query, ReasoningStep, ReasoningTrace } from '../types.js';
import type { ReasoningTracer } from './index.js';

export class ArrayReasoningTracer implements ReasoningTracer {
  private steps: ReasoningStep[] = [];

  start(_query: Query): ReasoningTrace {
    this.steps = [];
    return this.steps;
  }

  record(stage: ReasoningStep['stage'], summary: string, refs?: string[]): void {
    this.steps.push({ stage, summary, refs, at: new Date().toISOString() });
  }

  trace(): ReasoningTrace {
    return this.steps;
  }
}
