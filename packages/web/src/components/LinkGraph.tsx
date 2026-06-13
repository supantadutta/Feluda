import type { Verdict } from '@feluda/core';

/**
 * A simple link-graph (Layer I dashboard): a central question node connected to
 * hypothesis nodes and citation nodes — a visual of how facts connect.
 */
export function LinkGraph({ verdict }: { verdict: Verdict }): JSX.Element {
  const w = 360;
  const h = 240;
  const cx = w / 2;
  const cy = h / 2;

  const outer = [
    ...verdict.hypotheses.map((hp) => ({ label: hp.statement, kind: 'hyp' as const })),
    ...verdict.citations.map((c) => ({ label: c.title ?? c.source, kind: 'cite' as const })),
  ].slice(0, 8);

  const nodes = outer.map((n, i) => {
    const angle = (i / Math.max(1, outer.length)) * Math.PI * 2;
    return { ...n, x: cx + Math.cos(angle) * 130, y: cy + Math.sin(angle) * 90 };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Link graph">
      {nodes.map((n, i) => (
        <line key={`e${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="#334155" strokeWidth="1" />
      ))}
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <circle cx={n.x} cy={n.y} r="6" fill={n.kind === 'hyp' ? '#0ea5e9' : '#22c55e'} />
          <text x={n.x} y={n.y - 9} textAnchor="middle" fontSize="8" fill="#cbd5e1">
            {n.label.slice(0, 22)}
          </text>
        </g>
      ))}
      <circle cx={cx} cy={cy} r="9" fill="#f1f5f9" />
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="9" fill="#e2e8f0">
        Question
      </text>
    </svg>
  );
}
