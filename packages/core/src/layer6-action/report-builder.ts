/**
 * Report Builder (Layer VI). Turns a Verdict into a shareable case file. Phase 5
 * emits Markdown and self-contained HTML (printable to PDF from the browser) —
 * dependency-free and deterministic. PDF/DOCX binary formats are a documented
 * extension point behind the same `build()` shape.
 */
import type { Verdict } from '../types.js';

export type ReportFormat = 'markdown' | 'html';

export interface Report {
  filename: string;
  mime: string;
  content: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

export class ReportBuilder {
  build(verdict: Verdict, format: ReportFormat = 'markdown', title = 'Feluda Case Report'): Report {
    return format === 'html'
      ? { filename: 'feluda-report.html', mime: 'text/html', content: this.html(verdict, title) }
      : { filename: 'feluda-report.md', mime: 'text/markdown', content: this.markdown(verdict, title) };
  }

  private markdown(v: Verdict, title: string): string {
    const lines = [
      `# ${title}`,
      '',
      `**Confidence:** ${v.confidence.band} (${(v.confidence.score * 100).toFixed(0)}%)`,
      '',
      '## Answer',
      v.answer,
      '',
      '## Reasoning trace',
      ...v.trace.map((s, i) => `${i + 1}. _[${s.stage}]_ ${s.summary}`),
      '',
      '## Hypotheses considered',
      ...v.hypotheses.map((h) => `- (${(h.belief * 100).toFixed(0)}%) ${h.statement}`),
      '',
      '## Confidence gaps',
      ...(v.confidence.gaps.length ? v.confidence.gaps.map((g) => `- ${g}`) : ['- none recorded']),
      '',
      '## Citations',
      ...(v.citations.length
        ? v.citations.map((c) => `- [${c.title ?? c.source}](${c.source})`)
        : ['- No external citations.']),
    ];
    if (v.council) {
      lines.push('', '## Council', `- Panel: ${v.council.panel.join(', ')}`, `- Agreement: ${(v.council.agreement * 100).toFixed(0)}%`);
    }
    return lines.join('\n');
  }

  private html(v: Verdict, title: string): string {
    const md = this.markdown(v, title);
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      `<title>${escapeHtml(title)}</title>`,
      '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#0f172a}pre{white-space:pre-wrap}</style>',
      '</head><body><pre>',
      escapeHtml(md),
      '</pre></body></html>',
    ].join('');
  }
}
