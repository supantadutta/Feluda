import type { Verdict } from '@feluda/core';
import { LinkGraph } from './LinkGraph.js';

/**
 * Case Dashboard (Layer I) — an evidence board, a timeline, and a link-graph
 * view of the current session's investigations.
 */
export function Dashboard({ verdicts }: { verdicts: Verdict[] }): JSX.Element {
  if (verdicts.length === 0) {
    return <p className="text-sm text-slate-500">No investigations yet. Ask something in Chat to populate the board.</p>;
  }

  const latest = verdicts[verdicts.length - 1]!;
  const timeline = verdicts.flatMap((v, vi) =>
    v.trace.map((s) => ({ vi, stage: s.stage, summary: s.summary, at: s.at })),
  );
  const evidence = verdicts.flatMap((v) => v.evidence ?? []);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Link graph</h2>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2">
          <LinkGraph verdict={latest} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Evidence board ({evidence.length})
        </h2>
        <ul className="space-y-1 text-sm">
          {evidence.length === 0 && <li className="text-slate-500">No evidence gathered yet.</li>}
          {evidence.map((e) => (
            <li key={e.id} className="rounded border border-slate-700 bg-slate-800/40 p-2">
              <div className="text-slate-200">{e.claim.slice(0, 120)}</div>
              <div className="text-xs text-slate-500">
                {e.citation.source}
                {e.flags && e.flags.length > 0 && <span className="ml-2 text-amber-400">⚑ {e.flags.join(', ')}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 md:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Timeline ({timeline.length} steps)
        </h2>
        <ol className="space-y-1 border-l border-slate-700 pl-4 text-sm">
          {timeline.map((t, i) => (
            <li key={i} className="text-slate-300">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">[{t.stage}]</span>{' '}
              {t.summary}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
