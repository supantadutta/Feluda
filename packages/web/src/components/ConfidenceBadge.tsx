import type { Verdict } from '@feluda/core';

const STYLES: Record<Verdict['confidence']['band'], string> = {
  low: 'bg-rose-900/60 text-rose-200 ring-rose-700/50',
  medium: 'bg-amber-900/50 text-amber-200 ring-amber-700/50',
  high: 'bg-emerald-900/50 text-emerald-200 ring-emerald-700/50',
};

export function ConfidenceBadge({ confidence }: { confidence: Verdict['confidence'] }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STYLES[confidence.band]}`}
      title={`Score ${(confidence.score * 100).toFixed(0)}%`}
    >
      Confidence: {confidence.band} · {(confidence.score * 100).toFixed(0)}%
    </span>
  );
}
