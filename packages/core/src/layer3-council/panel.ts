/**
 * Multi-AI Council (Layer III). Fans the same question out to a panel of models,
 * detects where they diverge (divergence is signal, not noise), and runs a judge
 * step that merges the strongest reasoning into one answer while preserving
 * dissent. A configurable cost cap falls back to a single model when the panel
 * would be too expensive or the query is simple.
 */
import type { CouncilReport, Evidence, Hypothesis, Query } from '../types.js';
import {
  buildSynthesisPrompt,
  parseSynthesis,
  SYNTH_SYSTEM,
  type SynthesisResult,
} from '../layer2-investigation-core/synthesizer.js';
import type { ModelGateway } from './index.js';

/** One seat on the panel. */
export interface PanelMember {
  /** Display name, e.g. 'claude-opus-4-8' or 'gpt-x'. */
  id: string;
  gateway: ModelGateway;
  /** Optional model id passed through to the gateway. */
  model?: string;
  /** Rough USD cost per 1k tokens, used by the cost cap. */
  usdPer1k?: number;
}

export interface CouncilOptions {
  /** Hard cap (USD) per consultation before falling back to a single model. */
  costCapUsd?: number;
}

export interface CouncilOutcome {
  synthesis: SynthesisResult;
  report: CouncilReport;
}

const AGREEMENT_THRESHOLD = 0.6;

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

/** Mean pairwise similarity of the panel's answers (1 = unanimous). */
export function agreementOf(answers: string[]): number {
  if (answers.length < 2) return 1;
  const sets = answers.map(tokens);
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      sum += jaccard(sets[i]!, sets[j]!);
      pairs++;
    }
  }
  return pairs === 0 ? 1 : sum / pairs;
}

function estimateCostUsd(promptLen: number, member: PanelMember): number {
  const approxTokens = promptLen / 4 + 1024; // prompt + max output
  return (approxTokens / 1000) * (member.usdPer1k ?? 0.01);
}

export class Council {
  constructor(
    private readonly members: PanelMember[],
    private readonly judge: ModelGateway,
    private readonly options: CouncilOptions = {},
  ) {}

  get panelIds(): string[] {
    return this.members.map((m) => m.id);
  }

  async consult(
    query: Query,
    hypotheses: Hypothesis[],
    evidence: Evidence[] = [],
    memory: string[] = [],
  ): Promise<CouncilOutcome> {
    const prompt = buildSynthesisPrompt(query, hypotheses, evidence, memory);
    const cap = this.options.costCapUsd ?? Infinity;
    const estimated = this.members.reduce((s, m) => s + estimateCostUsd(prompt.length, m), 0);

    // ── Cost cap / simple-query fallback: single model ──
    if (this.members.length < 2 || estimated > cap) {
      const only = this.members[0]!;
      const res = await only.gateway.complete({
        system: SYNTH_SYSTEM,
        prompt,
        model: only.model,
        task: 'general',
      });
      return {
        synthesis: parseSynthesis(res.text),
        report: { panel: [only.id], agreement: 1, dissent: [], fellBackToSingle: true },
      };
    }

    // ── Panel reasoning (parallel) ──
    const results = await Promise.all(
      this.members.map(async (m) => {
        const res = await m.gateway.complete({
          system: SYNTH_SYSTEM,
          prompt,
          model: m.model,
          task: 'general',
        });
        return { member: m, synth: parseSynthesis(res.text) };
      }),
    );

    // ── Disagreement detection ──
    const agreement = agreementOf(results.map((r) => r.synth.answer));
    const dissent: string[] = [];
    if (agreement < AGREEMENT_THRESHOLD) {
      for (const r of results) {
        const oneLine = r.synth.answer.split(/[.\n]/)[0]?.trim() ?? '';
        if (oneLine) dissent.push(`${r.member.id}: ${oneLine}`);
      }
    }

    // ── Judge: strongest answer is the base; on dissent, a judge model merges ──
    const winner = [...results].sort((a, b) => b.synth.modelScore - a.synth.modelScore)[0]!;
    let merged: SynthesisResult = winner.synth;
    if (dissent.length > 0) {
      const judgePrompt = [
        'TASK=JUDGE',
        `Question: "${query.text}"`,
        'A panel of models gave these answers; merge the strongest reasoning into one verdict,',
        'and lower confidence to reflect the disagreement. Never fabricate citations.',
        ...results.map((r) => `- ${r.member.id} (self-score ${r.synth.modelScore}): ${r.synth.answer}`),
        'Return ONLY JSON: {"answer":string,"reasoning":[string,...],',
        '"confidence":{"score":number,"gaps":[string,...]}}.',
      ].join('\n');
      try {
        const jr = await this.judge.complete({ system: SYNTH_SYSTEM, prompt: judgePrompt, task: 'general' });
        merged = parseSynthesis(jr.text);
      } catch {
        merged = winner.synth; // fall back to the strongest single answer
      }
      merged = {
        ...merged,
        gaps: [...merged.gaps, `Panel disagreement (${(agreement * 100).toFixed(0)}% agreement).`],
      };
    }

    return {
      synthesis: merged,
      report: { panel: this.panelIds, agreement, dissent, fellBackToSingle: false },
    };
  }
}
