/**
 * Layer I — Interface (web shell).
 *
 * Phase 0: a placeholder shell that confirms the PWA boots. The chat UI that
 * runs the deduction loop lands in Phase 1; the Case Dashboard in Phase 7.
 */
export function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Feluda</h1>
        <p className="text-slate-400">
          A calm, rigorous investigator that shows its work — gathers evidence, weighs rival
          hypotheses, and answers with a reasoning trace, confidence, and citations.
        </p>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Phase 0 — scaffold. Chat arrives in Phase 1.
        </p>
      </div>
    </main>
  );
}
