/**
 * Layer I — Interface (web shell).
 *
 * Phase 7: a tabbed PWA — Chat (the deduction loop) and a Case Dashboard
 * (evidence board, timeline, link-graph), plus voice mode (speech in / out).
 */
import { useState, useEffect, type FormEvent } from 'react';
import { investigate, type Verdict } from './api.js';
import { VerdictView } from './components/VerdictView.js';
import { Dashboard } from './components/Dashboard.js';
import { OsintPanel } from './components/OsintPanel.js';
import { SocPanel } from './components/SocPanel.js';
import { CasesPanel } from './components/CasesPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { LearningPanel } from './components/LearningPanel.js';
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

type Tab = 'chat' | 'dashboard' | 'osint' | 'soc' | 'cases' | 'learning' | 'settings';
const TABS: Tab[] = ['chat', 'dashboard', 'osint', 'soc', 'cases', 'learning', 'settings'];

export function App(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const [speakAnswers, setSpeakAnswers] = useState(false);
  const voice = useVoice();

  const verdicts = messages.filter((m): m is FeludaMessage => m.role === 'feluda').map((m) => m.verdict);

  const [statusLine, setStatusLine] = useState('connecting…');
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
    fetch(`${base}/health`)
      .then((r) => r.json())
      .then((h) => setStatusLine(`${h.provider ?? '—'} · ${h.modelMode} · evidence:${h.evidenceMode}`))
      .catch(() => setStatusLine('offline'));
  }, [tab]);

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
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
        <header className="sticky top-0 z-20 -mx-4 mb-2 border-b border-cyan-500/20 px-4 py-4 glass">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md neon-border text-lg neon-text">◉</div>
              <div>
                <h1 className="text-xl font-bold uppercase tracking-[0.3em] neon-text">FELUDA</h1>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Investigative Intelligence Deck</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-slate-950/50 px-3 py-1 text-[11px] text-cyan-200/80">
              <span className="pulse-dot text-emerald-400">●</span>
              <span className="font-mono">{statusLine}</span>
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-1 text-xs">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 uppercase tracking-widest transition ${
                  tab === t
                    ? 'neon-border bg-cyan-500/10 neon-text'
                    : 'border border-transparent text-slate-400 hover:text-cyan-200'
                }`}
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
        ) : tab === 'osint' ? (
          <div className="flex-1 pb-8">
            <OsintPanel />
          </div>
        ) : tab === 'soc' ? (
          <div className="flex-1 pb-8">
            <SocPanel />
          </div>
        ) : tab === 'cases' ? (
          <div className="flex-1 pb-8">
            <CasesPanel />
          </div>
        ) : tab === 'learning' ? (
          <div className="flex-1 pb-8">
            <LearningPanel />
          </div>
        ) : tab === 'settings' ? (
          <div className="flex-1 pb-8">
            <SettingsPanel />
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
