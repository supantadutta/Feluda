import { useState, type FormEvent } from 'react';
import { osintInvestigate, type OsintResult } from '../api.js';

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-300',
  B: 'text-emerald-200',
  C: 'text-amber-300',
  D: 'text-orange-300',
  F: 'text-rose-300',
};

/** Lawful, passive OSINT lookup of an indicator (domain/ip/url/email/hash/cve). */
export function OsintPanel(): JSX.Element {
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<OsintResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!target.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      setResult(await osintInvestigate(target.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          aria-label="OSINT target"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-600"
          placeholder="domain, IP, URL, email, file hash, or CVE…"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium disabled:opacity-50">
          Investigate
        </button>
      </form>
      <p className="text-xs text-slate-500">Passive, public-source only. Doxxing/deanonymisation/intrusive requests are refused.</p>

      {error && <div className="rounded border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded bg-slate-700 px-2 py-0.5">{result.target.type}</span>
            <span className="text-slate-400">{result.target.normalized}</span>
            {result.offline && <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-200">offline fixtures</span>}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-1">Grade</th><th>Finding</th><th>Category</th><th>Source</th></tr>
            </thead>
            <tbody>
              {result.findings.map((f) => (
                <tr key={f.id} className="border-t border-slate-800">
                  <td className={`py-1 font-bold ${GRADE_COLOR[f.grade] ?? ''}`}>{f.grade}</td>
                  <td className="pr-2 text-slate-200">{f.claim}</td>
                  <td className="text-slate-400">{f.category}</td>
                  <td className="text-sky-400">{f.citation.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.graph.nodes.length > 0 && (
            <div className="text-xs text-slate-400">
              Entities: {result.graph.nodes.map((n) => `${n.type}:${n.value}`).join(' · ')}
            </div>
          )}
          <ul className="text-xs text-slate-500">{result.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
