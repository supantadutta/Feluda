/**
 * Layer I — Interface (web chat shell).
 *
 * Phase 1: a minimal chat that runs the deduction loop. Each answer is rendered
 * with its reasoning trace, confidence, and hypotheses (see VerdictView). The
 * Case Dashboard arrives in Phase 7.
 */
import { useState, type FormEvent } from 'react';
import { investigate, type Verdict } from './api.js';
import { VerdictView } from './components/VerdictView.js';

interface UserMessage {
  role: 'user';
  text: string;
}
interface FeludaMessage {
  role: 'feluda';
  verdict: Verdict;
}
interface ErrorMessage {
  role: 'error';
  text: string;
}
type Message = UserMessage | FeludaMessage | ErrorMessage;

export function App(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);
    try {
      const verdict = await investigate(question);
      setMessages((m) => [...m, { role: 'feluda', verdict }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
        <header className="py-6">
          <h1 className="text-2xl font-semibold tracking-tight">Feluda</h1>
          <p className="text-sm text-slate-400">
            A calm, rigorous investigator — every answer shows its reasoning, confidence, and gaps.
          </p>
        </header>

        <div className="flex-1 space-y-4 pb-4">
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">
              Ask a question to start an investigation. Try: “What makes a source trustworthy?”
            </p>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="text-right">
                <span className="inline-block rounded-lg bg-sky-700/70 px-3 py-2 text-sm">
                  {m.text}
                </span>
              </div>
            ) : m.role === 'feluda' ? (
              <VerdictView key={i} verdict={m.verdict} />
            ) : (
              <div key={i} className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">
                {m.text}
              </div>
            ),
          )}
          {busy && <p className="text-sm text-slate-400">Feluda is investigating…</p>}
        </div>

        <form onSubmit={onSubmit} className="sticky bottom-0 bg-slate-900 py-4">
          <div className="flex gap-2">
            <input
              aria-label="Ask Feluda"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-600"
              placeholder="Ask Feluda a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || input.trim().length === 0}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-sky-500"
            >
              Ask
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
