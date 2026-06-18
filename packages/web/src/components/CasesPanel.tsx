import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { casesApi, type CaseRecord } from '../api.js';

/** Case workspace: create cases, investigate, and view evidence/hypotheses/timeline. */
export function CasesPanel(): JSX.Element {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh(): Promise<void> {
    try {
      setCases((await casesApi.list()).cases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) return;
    const { case: c } = await casesApi.create(title.trim());
    setTitle('');
    setSelected(c);
    await refresh();
  }

  async function onInvestigate(): Promise<void> {
    if (!selected || !question.trim() || busy) return;
    setBusy(true);
    try {
      const { case: c } = await casesApi.investigate(selected.id, question.trim());
      setSelected(c);
      setQuestion('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <aside className="space-y-2">
        <form onSubmit={onCreate} className="space-y-1">
          <input aria-label="New case title" className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm" placeholder="New case title…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="w-full rounded bg-sky-600 px-2 py-1 text-sm">Create case</button>
        </form>
        <ul className="space-y-1 text-sm">
          {cases.map((c) => (
            <li key={c.id}>
              <button onClick={() => void casesApi.get(c.id).then((r) => setSelected(r.case))} className={`w-full rounded px-2 py-1 text-left ${selected?.id === c.id ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                {c.title} <span className="text-xs text-slate-500">· {c.status}</span>
              </button>
            </li>
          ))}
          {cases.length === 0 && <li className="text-xs text-slate-500">No cases yet.</li>}
        </ul>
      </aside>

      <div className="space-y-3">
        {error && <div className="text-sm text-rose-300">{error}</div>}
        {!selected && <p className="text-sm text-slate-500">Select or create a case.</p>}
        {selected && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{selected.title}</h2>
            <div className="flex gap-2">
              <input aria-label="Case question" className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm" placeholder="Ask within this case…" value={question} onChange={(e) => setQuestion(e.target.value)} />
              <button onClick={() => void onInvestigate()} disabled={busy} className="rounded bg-sky-600 px-3 py-1 text-sm disabled:opacity-50">Investigate</button>
            </div>
            <Section title={`Hypotheses (${selected.hypotheses.length})`}>
              {selected.hypotheses.map((h) => <li key={h.id}>({(h.belief * 100).toFixed(0)}%) {h.statement}</li>)}
            </Section>
            <Section title={`Evidence (${selected.evidence.length})`}>
              {selected.evidence.map((e) => <li key={e.id}>{e.claim.slice(0, 100)} <span className="text-slate-500">— {e.citation.source}</span></li>)}
            </Section>
            <Section title={`Timeline (${selected.timeline.length})`}>
              {selected.timeline.map((t, i) => <li key={i}>{t.at ?? '(undated)'} — {t.event}</li>)}
            </Section>
            <Section title="Unresolved questions">
              {selected.unresolvedQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </Section>
          </div>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <details open className="rounded border border-slate-700 bg-slate-800/40 p-2">
      <summary className="cursor-pointer text-sm font-medium text-slate-300">{title}</summary>
      <ul className="mt-1 space-y-0.5 text-sm text-slate-300">{children}</ul>
    </details>
  );
}
