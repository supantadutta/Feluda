/**
 * DOCX export (Layer VI). Renders a verdict or a structured set of sections to a
 * real .docx document (Office Open XML) via the dependency-free `docx` library.
 * Returns a Buffer the API/CLI can write to disk or stream. Citations come only
 * from the verdict — never fabricated.
 */
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import type { Verdict } from '../types.js';

export interface DocxSection {
  heading: string;
  lines: string[];
}

/** Build a .docx from a title and sections. */
export async function sectionsToDocx(title: string, sections: DocxSection[]): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun({ text: `Prepared by Feluda · ${new Date().toISOString().slice(0, 10)}`, italics: true })] }),
  ];
  for (const s of sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.heading)] }));
    for (const line of s.lines.length ? s.lines : ['(none)']) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Render a verdict to a .docx case file. */
export function verdictToDocx(verdict: Verdict, title = 'Feluda Case Report'): Promise<Buffer> {
  return sectionsToDocx(title, [
    { heading: 'Answer', lines: [verdict.answer] },
    { heading: 'Confidence', lines: [`${verdict.confidence.band} (${(verdict.confidence.score * 100).toFixed(0)}%)`, ...verdict.confidence.gaps.map((g) => `Gap: ${g}`)] },
    { heading: 'Hypotheses', lines: [...verdict.hypotheses].sort((a, b) => b.belief - a.belief).map((h) => `(${(h.belief * 100).toFixed(0)}%) ${h.statement}`) },
    { heading: 'Reasoning trace', lines: verdict.trace.map((s, i) => `${i + 1}. [${s.stage}] ${s.summary}`) },
    { heading: 'Citations', lines: verdict.citations.map((c) => c.title ? `${c.title} — ${c.source}` : c.source) },
  ]);
}
