import type { Verdict } from '@feluda/core';
import { ConfidenceBadge } from './ConfidenceBadge.js';

const STAGE_LABEL: Record<string, string> = {
  gather: 'Gather evidence',
  hypothesize: 'Form hypotheses',
  'cross-examine': 'Cross-examine',
  weigh: 'Weigh & test',
  verdict: 'Verdict',
};

/** Renders a transparent verdict: answer, confidence, reasoning trace, hypotheses. */
export function VerdictView({ verdict }: { verdict: Verdict }): JSX.Element {
  if (verdict.refusal) {
    return (
      <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-rose-300">
          Refused · {verdict.refusal.boundary}
        </div>
        <p className="text-slate-200 whitespace-pre-wrap">{verdict.answer}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-slate-100 whitespace-pre-wrap">{verdict.answer}</p>
        <ConfidenceBadge confidence={verdict.confidence} />
      </div>

      {verdict.reviewFlags && verdict.reviewFlags.length > 0 && (
        <div className="rounded border border-amber-700/60 bg-amber-950/30 p-2 text-xs text-amber-200">
          <div className="font-semibold">⚠ Self-review: {verdict.reviewFlags.length} prior verdict(s) flagged</div>
          <ul className="mt-1 list-disc pl-4 text-amber-300/90">
            {verdict.reviewFlags.map((f, i) => (
              <li key={i}>{f.priorSummary}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict.councilReview && verdict.councilReview.findings.some((f) => f.severity !== 'info') && (
        <details className="rounded border border-slate-700 bg-slate-900/50 p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-300">
            Council review · {verdict.councilReview.recommendation.replace(/_/g, ' ')}
          </summary>
          <ul className="mt-1 space-y-0.5">
            {verdict.councilReview.findings
              .filter((f) => f.severity !== 'info')
              .map((f, i) => (
                <li key={i} className={f.severity === 'critical' ? 'text-rose-300' : 'text-amber-300'}>
                  <span className="uppercase text-slate-500">{f.role}</span> · {f.message}
                </li>
              ))}
          </ul>
        </details>
      )}

      {verdict.council && (
        <div className="rounded border border-slate-700 bg-slate-900/50 p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">
              Council · {verdict.council.panel.length} model(s)
            </span>
            <span
              className={
                verdict.council.agreement >= 0.6 ? 'text-emerald-300' : 'text-amber-300'
              }
            >
              {(verdict.council.agreement * 100).toFixed(0)}% agreement
              {verdict.council.fellBackToSingle ? ' · single-model fallback' : ''}
            </span>
          </div>
          {verdict.council.dissent.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-slate-400">
              {verdict.council.dissent.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {verdict.confidence.gaps.length > 0 && (
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Gaps:</span>{' '}
          {verdict.confidence.gaps.join(' · ')}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-sky-300 hover:text-sky-200">
          Reasoning trace ({verdict.trace.length} steps)
        </summary>
        <ol className="mt-2 space-y-1.5 border-l border-slate-700 pl-4">
          {verdict.trace.map((step, i) => (
            <li key={i} className="text-sm text-slate-300">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {STAGE_LABEL[step.stage] ?? step.stage}
              </span>
              <div>{step.summary}</div>
            </li>
          ))}
        </ol>
      </details>

      {verdict.hypotheses.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-sky-300 hover:text-sky-200">
            Hypotheses considered ({verdict.hypotheses.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {verdict.hypotheses.map((h) => (
              <li key={h.id} className="text-sm">
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <span>{h.statement}</span>
                  <span className="tabular-nums text-slate-500">
                    {(h.belief * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-slate-700">
                  <div
                    className="h-1.5 rounded bg-sky-500"
                    style={{ width: `${Math.round(h.belief * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {verdict.citations.length === 0 ? (
        <div className="text-xs text-slate-500">
          No external citations — reasoning over the question and general knowledge.
        </div>
      ) : (
        <details open>
          <summary className="cursor-pointer text-sm font-medium text-sky-300 hover:text-sky-200">
            Citation trail ({verdict.citations.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {verdict.citations.map((c, i) => {
              const flags = verdict.evidence?.find((e) => e.citation.source === c.source)?.flags;
              return (
                <li key={i} className="text-xs">
                  <a
                    href={c.source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline break-all"
                  >
                    {c.title ?? c.source}
                  </a>
                  {flags && flags.length > 0 && (
                    <span className="ml-2 text-amber-400">⚑ {flags.join(', ')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
