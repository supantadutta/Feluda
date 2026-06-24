import { useState } from 'react';
import { learningApi, type LearningReport } from '../api.js';

/** Synthetic learning: run training rounds and watch accuracy climb. */
export function LearningPanel(): JSX.Element {
  const [report, setReport] = useState<LearningReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      setReport((await learningApi.run(6)).report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const w = 480;
  const h = 160;
  const pts = report?.rounds ?? [];
  const xy = pts.map((p, i) => {
    const x = pts.length > 1 ? (i / (pts.length - 1)) * (w - 30) + 20 : w / 2;
    const y = h - 20 - p.accuracy * (h - 40);
    return { x, y, p };
  });
  const path = xy.map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => void run()} disabled={busy} className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)] disabled:opacity-50">
          {busy ? 'Training…' : 'Run synthetic learning'}
        </button>
        <p className="text-xs text-slate-500">Generates labelled synthetic cases and trains a pattern learner — learning as data, not model retraining.</p>
      </div>

      {error && <div className="rounded border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>}

      {report && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Baseline" value={`${(report.baselineAccuracy * 100).toFixed(0)}%`} />
            <Stat label="Final accuracy" value={`${(report.finalAccuracy * 100).toFixed(0)}%`} glow />
            <Stat label="Learned (lift)" value={`+${(report.improvement * 100).toFixed(0)}%`} glow />
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-2">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Accuracy over training rounds">
              <line x1="20" y1={h - 20} x2={w} y2={h - 20} stroke="#1e293b" />
              <line x1="20" y1="20" x2="20" y2={h - 20} stroke="#1e293b" />
              <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
              {xy.map((d, i) => (
                <g key={i}>
                  <circle cx={d.x} cy={d.y} r="3.5" fill="#22d3ee" />
                  <text x={d.x} y={d.y - 8} textAnchor="middle" fontSize="9" fill="#67e8f9">{(d.p.accuracy * 100).toFixed(0)}%</text>
                  <text x={d.x} y={h - 6} textAnchor="middle" fontSize="8" fill="#475569">R{d.p.round}</text>
                </g>
              ))}
            </svg>
          </div>
          <div className="text-xs text-slate-500">Categories learned: {report.labels.join(', ')}</div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, glow }: { label: string; value: string; glow?: boolean }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${glow ? 'text-cyan-300' : 'text-slate-300'}`}>{value}</div>
    </div>
  );
}
