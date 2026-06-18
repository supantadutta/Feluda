import { useState, type FormEvent } from 'react';
import { socInvestigate, type SocAssessment, type SocAlertType } from '../api.js';

const TYPES: SocAlertType[] = [
  'suspicious_login',
  'brute_force',
  'password_spray',
  'phishing_email',
  'suspicious_ip',
  'suspicious_domain',
  'suspicious_url',
  'malware_hash',
  'web_attack',
  'impossible_travel',
  'dns_tunneling',
  'lateral_movement',
];

const VERDICT_COLOR: Record<string, string> = {
  true_positive: 'bg-rose-900/60 text-rose-200',
  needs_escalation: 'bg-amber-900/60 text-amber-200',
  inconclusive: 'bg-slate-700 text-slate-200',
  benign: 'bg-emerald-900/50 text-emerald-200',
  false_positive: 'bg-emerald-900/50 text-emerald-200',
};

/** Defensive SOC alert triage form. */
export function SocPanel(): JSX.Element {
  const [type, setType] = useState<SocAlertType>('brute_force');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [logs, setLogs] = useState('');
  const [assessment, setAssessment] = useState<SocAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await socInvestigate({
        type,
        title: title.trim() || undefined,
        context: context.trim() || undefined,
        logs: logs.trim() ? logs.split(/\r?\n/).filter(Boolean) : undefined,
      });
      setAssessment(res.assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <select aria-label="Alert type" value={type} onChange={(e) => setType(e.target.value as SocAlertType)} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm">
            {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input aria-label="Alert title" className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm" placeholder="Alert title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <input aria-label="Context" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm" placeholder="Analyst context (e.g. login from a new country)" value={context} onChange={(e) => setContext(e.target.value)} />
        <textarea aria-label="Logs" className="h-24 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs" placeholder="Paste log lines (one per line)" value={logs} onChange={(e) => setLogs(e.target.value)} />
        <button type="submit" disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Triage alert</button>
      </form>
      <p className="text-xs text-slate-500">Defensive triage only. Recommended actions are reversible and lawful.</p>

      {error && <div className="rounded border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>}

      {assessment && (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${VERDICT_COLOR[assessment.verdict] ?? 'bg-slate-700'}`}>
              {assessment.verdict.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-400">confidence: {assessment.confidence.replace(/_/g, ' ')}</span>
            {assessment.escalate && <span className="text-xs text-amber-300">⚑ escalate</span>}
          </div>
          <p className="text-slate-300">{assessment.observedActivity}</p>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Reasoning</div>
            <p className="text-slate-300">{assessment.reasoning}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Recommended actions</div>
            <ul className="list-disc pl-5 text-slate-300">{assessment.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        </div>
      )}
    </section>
  );
}
