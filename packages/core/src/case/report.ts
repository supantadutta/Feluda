/**
 * Professional Report Generator. Produces clean, citation-backed reports from a
 * CaseRecord or a SOC assessment. Dependency-free Markdown (printable to PDF in
 * the browser). Reports never fabricate citations — they cite only the evidence
 * already in the case.
 */
import type { CaseRecord } from './types.js';
import type { SocAssessment } from '../soc/types.js';

export type CaseReportType =
  | 'osint_case'
  | 'executive'
  | 'incident_timeline'
  | 'hypothesis_analysis'
  | 'evidence_appendix';

export interface Report {
  filename: string;
  mime: string;
  content: string;
}

const TYPE_TITLES: Record<CaseReportType, string> = {
  osint_case: 'OSINT Case Report',
  executive: 'Executive Summary',
  incident_timeline: 'Incident Timeline Report',
  hypothesis_analysis: 'Hypothesis Analysis Report',
  evidence_appendix: 'Evidence Appendix',
};

export class CaseReportBuilder {
  build(c: CaseRecord, type: CaseReportType = 'osint_case'): Report {
    const title = TYPE_TITLES[type];
    const lines = [
      `# ${title}: ${c.title}`,
      '',
      `**Date:** ${new Date().toISOString().slice(0, 10)}  `,
      `**Prepared by:** Feluda  `,
      `**Status:** ${c.status}`,
      '',
      '## Scope',
      c.objective ? `- Objective: ${c.objective}` : '- Objective: (not specified)',
      c.scope ? `- In scope: ${c.scope}` : '- In scope: (not specified)',
      ...c.boundaries.map((b) => `- Boundary: ${b}`),
      '',
    ];

    if (type !== 'evidence_appendix') {
      lines.push('## Confidence', ...this.confidence(c), '');
    }
    if (type === 'hypothesis_analysis' || type === 'osint_case' || type === 'executive') {
      lines.push('## Hypotheses', ...this.hypotheses(c), '');
    }
    if (type === 'incident_timeline' || type === 'osint_case') {
      lines.push('## Timeline', ...this.timeline(c), '');
    }
    if (type !== 'executive') {
      lines.push('## Evidence', ...this.evidence(c), '');
    }
    lines.push('## Unresolved questions', ...this.bullets(c.unresolvedQuestions, 'None recorded.'), '');
    if (c.riskFlags.length) lines.push('## Risk flags', ...this.bullets(c.riskFlags), '');
    if (c.ethicsFlags.length) lines.push('## Ethics flags', ...this.bullets(c.ethicsFlags), '');
    lines.push('## Citations', ...this.citations(c));

    return { filename: `feluda-${type}.md`, mime: 'text/markdown', content: lines.join('\n') };
  }

  private confidence(c: CaseRecord): string[] {
    const latest = c.confidenceHistory[c.confidenceHistory.length - 1];
    if (!latest) return ['- Not yet assessed.'];
    return [`- Level: **${latest.band}** (${(latest.score * 100).toFixed(0)}%)`, `- Note: ${latest.note}`];
  }
  private hypotheses(c: CaseRecord): string[] {
    if (c.hypotheses.length === 0) return ['- None formed yet.'];
    return [...c.hypotheses]
      .sort((a, b) => b.belief - a.belief)
      .map((h, i) => `- H${i + 1} (${(h.belief * 100).toFixed(0)}%): ${h.statement}`);
  }
  private timeline(c: CaseRecord): string[] {
    if (c.timeline.length === 0) return ['- No dated events extracted.'];
    return c.timeline.map((t) => `- ${t.at ?? '(undated)'} — ${t.event}${t.uncertainty ? ` _(${t.uncertainty})_` : ''}`);
  }
  private evidence(c: CaseRecord): string[] {
    if (c.evidence.length === 0) return ['- No evidence attached.'];
    return c.evidence.map(
      (e) => `- ${e.claim.slice(0, 120)} — ${e.citation.source}${e.flags?.length ? ` [${e.flags.join(', ')}]` : ''}`,
    );
  }
  private citations(c: CaseRecord): string[] {
    const sources = [...new Set(c.evidence.map((e) => e.citation.source))];
    return sources.length ? sources.map((s) => `- ${s}`) : ['- No external citations.'];
  }
  private bullets(items: string[], empty = ''): string[] {
    return items.length ? items.map((i) => `- ${i}`) : empty ? [`- ${empty}`] : [];
  }
}

/** Render a SOC assessment in the standard analyst format. */
export function socReport(a: SocAssessment): Report {
  const content = [
    '# SOC Investigation Report',
    `**Date:** ${new Date().toISOString().slice(0, 10)} · Prepared by Feluda`,
    '',
    '## Alert Summary',
    a.alertSummary,
    '',
    '## Observed Activity',
    a.observedActivity,
    '',
    '## Investigation Findings',
    ...(a.findings.length ? a.findings.map((f) => `- [${f.severity}] ${f.message}`) : ['- No log findings.']),
    '',
    `## Assessment`,
    `**${a.verdict.replace(/_/g, ' ')}** — confidence: ${a.confidence.replace(/_/g, ' ')}`,
    '',
    '## Reasoning',
    a.reasoning,
    '',
    '## Recommended Action (defensive)',
    ...a.recommendedActions.map((x) => `- ${x}`),
    '',
    '## Management Summary',
    a.managementSummary,
  ].join('\n');
  return { filename: 'feluda-soc-report.md', mime: 'text/markdown', content };
}
