/**
 * Layer I — Interface (web shell).
 *
 * Phase 7: a tabbed PWA — Chat (the deduction loop) and a Case Dashboard
 * (evidence board, timeline, link-graph), plus voice mode (speech in / out).
 */
import { useState, type FormEvent } from 'react';
import { investigate, type Verdict } from './api.js';
import { VerdictView } from './components/VerdictView.js';
import { Dashboard } from './components/Dashboard.js';
import { useVoice } from './voice.js';

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

type Tab = 'chat' | 'dashboard';

export function App(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const [speakAnswers, setSpeakAnswers] = useState(false);
  const voice = useVoice();

  const verdicts = messages.filter((m): m is FeludaMessage => m.role === 'feluda').map((m) => m.verdict);

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
      if (speakAnswers) voice.speak(verdict.answer);
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
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
        <header className="flex items-center justify-between py-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Feluda</h1>
            <p className="text-sm text-slate-400">A calm, rigorous investigator that shows its work.</p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-slate-800 p-1 text-sm">
            {(['chat', 'dashboard'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 capitalize ${tab === t ? 'bg-sky-600' : 'text-slate-300'}`}
              >
                {t}
              </button>
            ))}
          </nav>
        </header>

        {tab === 'dashboard' ? (
          <div className="flex-1 pb-8">
            <Dashboard verdicts={verdicts} />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 pb-4">
              {messages.length === 0 && (
                <p className="text-sm text-slate-500">
                  Ask a question to start an investigation. Try: “What makes a source trustworthy?”
                </p>
              )}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="text-right">
                    <span className="inline-block rounded-lg bg-sky-700/70 px-3 py-2 text-sm">{m.text}</span>
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
                {voice.sttSupported && (
                  <button
                    type="button"
                    aria-label="Dictate"
                    title="Dictate"
                    onClick={() => voice.listen((t) => setInput(t))}
                    className={`rounded-lg px-3 py-2 text-sm ${voice.listening ? 'bg-rose-600' : 'bg-slate-700'}`}
                  >
                    🎤
                  </button>
                )}
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
              {voice.ttsSupported && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={speakAnswers} onChange={(e) => setSpeakAnswers(e.target.checked)} />
                  Read answers aloud
                </label>
              )}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
